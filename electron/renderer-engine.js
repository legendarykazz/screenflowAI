const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./database');

async function renderAndExport(projectId, exportPath, format, quality, isPro, onProgress) {
  const project = db.getProject(projectId);
  if (!project) throw new Error('Project not found');

  const cursorEvents = db.getCursorEvents(projectId);
  const settings = project.settings;

  const duration = project.duration || 10;
  const fps = 30;
  
  const screenVideoPath = project.video_path;
  if (!fs.existsSync(screenVideoPath)) {
    throw new Error('Recorded screen video file not found');
  }
  if (fs.existsSync(exportPath)) {
    try { fs.unlinkSync(exportPath); } catch (e) {}
  }

  // Define quality presets
  const qualityPresets = {
    low: ['-crf', '28', '-preset', 'ultrafast'],
    medium: ['-crf', '23', '-preset', 'medium'],
    high: ['-crf', '18', '-preset', 'slow'],
    ultra: ['-crf', '12', '-preset', 'veryslow']
  };
  const qualityParams = qualityPresets[quality.toLowerCase()] || qualityPresets.medium;

  if (settings.cursor_baked && settings.zoom_level <= 1.0) {
    return exportDirect(screenVideoPath, exportPath, qualityParams, isPro, duration, onProgress, settings.timeline_clips);
  }

  // Build FFmpeg command.
  // To avoid compiling native Canvas, we build a highly optimized FFmpeg filter_complex command
  // that overlays a background, scales the video, and overlays a cursor.
  // 
  // Let's create a temporary cursor overlay PNG or use a built-in character.
  // We can write a tiny white cursor PNG to appData space and load it into FFmpeg!
  const tempCursorPath = path.join(path.dirname(exportPath), 'temp_cursor.png');
  writeTempCursorPng(tempCursorPath);

  // Parse cursor coordinates into FFmpeg conditional overlay expressions
  let cursorXExpr = 'w/2';
  let cursorYExpr = 'h/2';

  if (cursorEvents.length > 0) {
    // Generate staircase if/then expressions for FFmpeg overlay coordinates
    cursorXExpr = '';
    cursorYExpr = '';
    
    for (let i = 0; i < cursorEvents.length; i++) {
      const e = cursorEvents[i];
      const nextTime = cursorEvents[i + 1] ? cursorEvents[i + 1].timestamp : duration;
      
      const condX = `if(between(t,${e.timestamp.toFixed(2)},${nextTime.toFixed(2)}),${Math.round(e.x)},`;
      const condY = `if(between(t,${e.timestamp.toFixed(2)},${nextTime.toFixed(2)}),${Math.round(e.y)},`;
      
      cursorXExpr += condX;
      cursorYExpr += condY;
    }
    
    // Close parentheses
    cursorXExpr += 'w/2' + ')'.repeat(cursorEvents.length);
    cursorYExpr += 'h/2' + ')'.repeat(cursorEvents.length);
  }

  // Parse click-based zoom parameters or continuous cursor follow zoom (Screen Studio style)
  let zoomExpr = '1.0';
  let zoomXExpr = 'iw/2';
  let zoomYExpr = 'ih/2';

  if (settings.follow_cursor !== false && settings.zoom_level > 1.0 && cursorEvents.length > 0) {
    const targetZoom = settings.zoom_level || 1.35;
    zoomExpr = `${targetZoom}`;
    
    // Smooth dynamic interpolation: we keep exactly 25 keyframes and linearly interpolate
    // between them inside FFmpeg. This guarantees zero crashes and a silky smooth pan!
    const maxKeyframes = 25;
    const step = Math.ceil(cursorEvents.length / maxKeyframes) || 1;
    const filteredEvents = cursorEvents.filter((_, idx) => idx % step === 0);
    
    let currentX = filteredEvents[0] ? filteredEvents[0].x : 960;
    let currentY = filteredEvents[0] ? filteredEvents[0].y : 540;
    const smoothingFactor = 0.5;
    
    const smoothedEvents = filteredEvents.map(e => {
      currentX = currentX + (e.x - currentX) * smoothingFactor;
      currentY = currentY + (e.y - currentY) * smoothingFactor;
      return {
        timestamp: e.timestamp,
        x: currentX,
        y: currentY
      };
    });
    
    const partsX = [];
    const partsY = [];
    
    if (smoothedEvents[0].timestamp > 0) {
      partsX.push(`(lt(t,${smoothedEvents[0].timestamp.toFixed(2)})*960)`);
      partsY.push(`(lt(t,${smoothedEvents[0].timestamp.toFixed(2)})*540)`);
    }
    
    for (let i = 0; i < smoothedEvents.length - 1; i++) {
      const e1 = smoothedEvents[i];
      const e2 = smoothedEvents[i + 1];
      const t1 = e1.timestamp.toFixed(2);
      const t2 = e2.timestamp.toFixed(2);
      const dt = (e2.timestamp - e1.timestamp).toFixed(2);
      
      const x1 = Math.round(e1.x);
      const dx = Math.round(e2.x - e1.x);
      const y1 = Math.round(e1.y);
      const dy = Math.round(e2.y - e1.y);
      
      partsX.push(`(between(t,${t1},${t2})*(${x1}+(${dx}*(t-${t1})/${dt})))`);
      partsY.push(`(between(t,${t1},${t2})*(${y1}+(${dy}*(t-${t1})/${dt})))`);
    }
    
    const lastEvent = smoothedEvents[smoothedEvents.length - 1];
    if (lastEvent.timestamp < duration) {
      partsX.push(`(gt(t,${lastEvent.timestamp.toFixed(2)})*${Math.round(lastEvent.x)})`);
      partsY.push(`(gt(t,${lastEvent.timestamp.toFixed(2)})*${Math.round(lastEvent.y)})`);
    }
    
    zoomXExpr = partsX.join('+');
    zoomYExpr = partsY.join('+');
  } else if (settings.follow_cursor === false && settings.zoom_level > 1.0) {
    const targetZoom = settings.zoom_level || 1.35;
    zoomExpr = `${targetZoom}`;
    const targetX = (settings.zoom_center_x !== undefined ? settings.zoom_center_x : 0.5) * 1920;
    const targetY = (settings.zoom_center_y !== undefined ? settings.zoom_center_y : 0.5) * 1080;
    zoomXExpr = `${Math.round(targetX)}`;
    zoomYExpr = `${Math.round(targetY)}`;
  } else {
    const clicks = cursorEvents.filter(e => e.event_type && e.event_type.includes('click')).slice(0, 15);
    if (clicks.length > 0) {
      const max_z = settings.zoom_level || 1.5;
      const in_dur = settings.zoom_in_duration || 0.35;
      const hold_dur = settings.zoom_hold_duration || 0.55;
      const out_dur = settings.zoom_out_duration || 0.35;
      const tot_dur = in_dur + hold_dur + out_dur;

      for (let i = 0; i < clicks.length; i++) {
        const tc = clicks[i].timestamp;
        const cx = Math.round(clicks[i].x);
        const cy = Math.round(clicks[i].y);

        const zoomInExpr = `(1.0+(${max_z}-1.0)*(t-${tc})/${in_dur})`;
        const zoomOutExpr = `(1.0+(${max_z}-1.0)*(${tc + tot_dur}-t)/${out_dur})`;

        zoomExpr = `if(between(t,${tc},${tc + in_dur}),${zoomInExpr},if(between(t,${tc + in_dur},${tc + in_dur + hold_dur}),${max_z},if(between(t,${tc + in_dur + hold_dur},${tc + tot_dur}),${zoomOutExpr},${zoomExpr})))`;
        zoomXExpr = `if(between(t,${tc},${tc + tot_dur}),${cx},${zoomXExpr})`;
        zoomYExpr = `if(between(t,${tc},${tc + tot_dur}),${cy},${zoomYExpr})`;
      }
    }
  }

  // Setup input streams: [0:v] screen video, [1:v] cursor overlay, optional [2:a] audio
  const ffmpegParams = [
    '-i', screenVideoPath,
    '-i', tempCursorPath,
  ];

  const hasAudio = project.audio_path && fs.existsSync(project.audio_path);
  if (project.audio_path && fs.existsSync(project.audio_path)) {
    ffmpegParams.push('-i', project.audio_path);
  }

  // Complex Filter:
  // 1. Create a background (solid dark blue/violet gradient approximation) using a color source
  // 2. Scale the main video, and overlay on the background
  // 3. Apply auto-zoom easing zoompan filter only if zoom is active
  const hasZoom = zoomExpr !== '1.0' && zoomExpr !== '1';
  const filterGraphParts = [
    `[0:v]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1[out_v]`
  ];
  
  if (hasZoom) {
    filterGraphParts.push(`[out_v]scale=w='1920*${zoomExpr}':h='1080*${zoomExpr}',crop=w=1920:h=1080:x='min(max(${zoomXExpr}*${zoomExpr}-960,0),iw-1920)':y='min(max(${zoomYExpr}*${zoomExpr}-540,0),ih-1080)'[zoomed]`);
  } else {
    filterGraphParts.push(`[out_v]null[zoomed]`);
  }

  const cursorVisible = !settings.cursor_baked && settings.cursor_visible !== false && cursorEvents.length > 0;
  if (cursorVisible) {
    const cursorSize = Math.max(12, Math.min(140, Math.round((settings.cursor_size || 40) * (settings.cursor_scale || 1))));
    filterGraphParts.push(`[1:v]scale=${cursorSize}:${cursorSize}[cursor]`);
    filterGraphParts.push(`[zoomed][cursor]overlay=x='${cursorXExpr}':y='${cursorYExpr}'[final_v]`);
  } else {
    filterGraphParts.push(`[zoomed]null[final_v]`);
  }
  
  const filterGraph = filterGraphParts.join('; ');

  // Write filter graph to a temporary script file to prevent command line length issues on Windows
  const tempFilterScriptPath = path.join(path.dirname(exportPath), `temp_filter_${projectId}_${Math.random().toString(36).substring(2, 7)}.txt`);
  fs.writeFileSync(tempFilterScriptPath, filterGraph, 'utf8');

  ffmpegParams.push(
    '-filter_complex_script', tempFilterScriptPath,
    '-map', '[final_v]',
  );

  if (hasAudio) {
    ffmpegParams.push('-map', '2:a');
  }

  const threadsParam = isPro ? '0' : '2'; // Pro uses maximum CPU threads. Free plan is throttled to 2 threads.
  ffmpegParams.push(
    '-c:v', 'libx264',
    '-threads', threadsParam,
    ...qualityParams,
    '-pix_fmt', 'yuv420p',
    '-y',
    exportPath
  );

  const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const ffmpegProcess = spawn(ffmpegPath, ffmpegParams);

  return new Promise((resolve, reject) => {
    let errorLog = '';
    
    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const line = data.toString();
      errorLog += line;
      // Parse progress from FFmpeg stderr (e.g. frame= 123 time=00:00:04.10)
      const match = line.match(/time=(\d+):(\d+):(\d+.\d+)/);
      if (match) {
        const hh = parseFloat(match[1]);
        const mm = parseFloat(match[2]);
        const ss = parseFloat(match[3]);
        const elapsed = hh * 3600 + mm * 60 + ss;
        const progress = Math.min(99, Math.floor((elapsed / duration) * 100));
        onProgress(progress);
      }
    });

    ffmpegProcess.on('close', (code) => {
      // Cleanup temp cursor PNG and temp filter complex script
      try { fs.unlinkSync(tempCursorPath); } catch (e) {}
      try { fs.unlinkSync(tempFilterScriptPath); } catch (e) {}

      if (code === 0) {
        onProgress(100);
        resolve();
      } else {
        try { if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath); } catch (e) {}
        console.error("FFmpeg export failed details:", errorLog);
        reject(new Error(`FFmpeg export exited with code ${code}. Logs:\n${errorLog.slice(-400)}`));
      }
    });
  });
}

function exportDirect(inputPath, exportPath, qualityParams, isPro, duration, onProgress, timelineClips = null) {
  const threadsParam = isPro ? '0' : '2';
  const ffmpegPath = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const screenClip = Array.isArray(timelineClips)
    ? timelineClips.find((clip) => clip.id === 'screen' && clip.enabled !== false)
    : null;
  const trimStart = screenClip ? Math.max(0, (screenClip.start || 0) * duration) : 0;
  const trimEnd = screenClip ? Math.min(duration, (screenClip.end || 1) * duration) : duration;
  const trimDuration = Math.max(0.1, trimEnd - trimStart);
  const ffmpegParams = [
    ...(trimStart > 0 ? ['-ss', trimStart.toFixed(3)] : []),
    '-i', inputPath,
    ...(screenClip ? ['-t', trimDuration.toFixed(3)] : []),
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-threads', threadsParam,
    ...qualityParams,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    '-y',
    exportPath
  ];

  const ffmpegProcess = spawn(ffmpegPath, ffmpegParams);

  return new Promise((resolve, reject) => {
    let errorLog = '';

    ffmpegProcess.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const line = data.toString();
      errorLog += line;
      const match = line.match(/time=(\d+):(\d+):(\d+.\d+)/);
      if (match) {
        const hh = parseFloat(match[1]);
        const mm = parseFloat(match[2]);
        const ss = parseFloat(match[3]);
        const elapsed = hh * 3600 + mm * 60 + ss;
        onProgress(Math.min(99, Math.floor((elapsed / duration) * 100)));
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        onProgress(100);
        resolve();
      } else {
        try { if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath); } catch (e) {}
        console.error("FFmpeg direct export failed details:", errorLog);
        reject(new Error(`FFmpeg export exited with code ${code}. Logs:\n${errorLog.slice(-400)}`));
      }
    });
  });
}

// Function to write a standard white cursor icon PNG to file if it doesn't exist
function writeTempCursorPng(targetPath) {
  // A tiny 24x24 white arrow cursor PNG Base64
  const cursorBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAQAAABK7StDAAAAPklEQVR4AWXBAQ0AIAwEsaswhH9tXECg0N0q2K9a473F471fQ6DR3SoI3Cpwq8CtAmejwNkoGLgXmBfYF5hXIbF1Vd92AAAAAElFTkSuQmCC';
  fs.writeFileSync(targetPath, Buffer.from(cursorBase64, 'base64'));
}

module.exports = {
  renderAndExport
};

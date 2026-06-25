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

  // Define quality presets
  const qualityPresets = {
    low: ['-crf', '28', '-preset', 'ultrafast'],
    medium: ['-crf', '23', '-preset', 'medium'],
    high: ['-crf', '18', '-preset', 'slow'],
    ultra: ['-crf', '12', '-preset', 'veryslow']
  };
  const qualityParams = qualityPresets[quality.toLowerCase()] || qualityPresets.medium;

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

  // Parse click-based zoom parameters
  const clicks = cursorEvents.filter(e => e.event_type && e.event_type.includes('click'));
  let zoomExpr = '1.0';
  let zoomXExpr = 'iw/2';
  let zoomYExpr = 'ih/2';

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

  // Setup input streams: [0:v] screen video, [1:i] cursor image
  const ffmpegParams = [
    '-i', screenVideoPath,
    '-i', tempCursorPath,
  ];

  if (project.audio_path && fs.existsSync(project.audio_path)) {
    ffmpegParams.push('-i', project.audio_path);
  }

  // Complex Filter:
  // 1. Create a background (solid dark blue/violet gradient approximation) using a color source
  // 2. Scale the main video, round the corners, and overlay on the background
  // 3. Overlay the cursor based on the coordinate calculations
  // 4. Zoom the combined output video and cursor on clicks
  const filterGraph = [
    `color=c=0x1e1e2e:s=1920x1080:d=${duration}[bg]`,
    `[0:v]scale=1800:1012,setsar=1[main_scaled]`,
    `[bg][main_scaled]overlay=x=60:y=34[bg_with_video]`,
    `[bg_with_video][1:v]overlay=x='${cursorXExpr}':y='${cursorYExpr}'[out_v]`,
    `[out_v]zoompan=z='${zoomExpr}':x='min(max(${zoomXExpr}-iw/(2*z),0),iw-iw/z)':y='min(max(${zoomYExpr}-ih/(2*z),0),ih-ih/z)':d=1:fps=30:s=1920x1080[zoomed]`
  ].join('; ');

  // Write filter graph to a temporary script file to prevent command line length issues on Windows
  const tempFilterScriptPath = path.join(path.dirname(exportPath), `temp_filter_${projectId}_${Math.random().toString(36).substring(2, 7)}.txt`);
  fs.writeFileSync(tempFilterScriptPath, filterGraph, 'utf8');

  ffmpegParams.push(
    '-filter_complex_script', tempFilterScriptPath,
    '-map', '[zoomed]',
  );

  if (project.audio_path && fs.existsSync(project.audio_path)) {
    ffmpegParams.push('-map', '2:a'); // map third input (audio)
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

  const ffmpegProcess = spawn('ffmpeg', ffmpegParams);

  return new Promise((resolve, reject) => {
    ffmpegProcess.stderr.on('data', (data) => {
      // Parse progress from FFmpeg stderr (e.g. frame= 123 time=00:00:04.10)
      const line = data.toString();
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
        reject(new Error(`FFmpeg export exited with code ${code}`));
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

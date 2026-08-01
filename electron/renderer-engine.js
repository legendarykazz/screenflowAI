const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { ffmpegPath, ffprobePath } = require('./media-tools');

function getEventCoordinate(event, axis, outputSize) {
  const value = Number(event?.[axis]);
  if (!Number.isFinite(value)) return outputSize / 2;
  return event.coordinate_space === 'normalized'
    ? Math.max(0, Math.min(outputSize, value * outputSize))
    : value;
}

function hasMediaStream(filePath, streamType) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const result = spawnSync(ffprobePath, [
    '-v', 'error',
    '-select_streams', `${streamType}:0`,
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    filePath
  ], { encoding: 'utf8', timeout: 8000 });
  return result.status === 0 && Boolean(result.stdout?.trim());
}

function clipStartSeconds(clip, duration) {
  return Math.max(0, Math.min(duration, Number(clip?.start || 0) * duration));
}

function clipEndSeconds(clip, duration) {
  return Math.max(clipStartSeconds(clip, duration), Math.min(duration, Number(clip?.end ?? 1) * duration));
}

function getEnabledClips(settings) {
  return Array.isArray(settings.timeline_clips)
    ? settings.timeline_clips.filter((clip) => clip && clip.enabled !== false)
    : [];
}

function buildColorFilters(settings) {
  const exposure = Math.max(-100, Math.min(100, Number(settings.color_exposure || 0)));
  const contrast = Math.max(-100, Math.min(100, Number(settings.color_contrast || 0)));
  const saturation = Math.max(-100, Math.min(100, Number(settings.color_saturation || 0)));
  const temperature = Math.max(-100, Math.min(100, Number(settings.color_temperature || 0)));
  const tint = Math.max(-100, Math.min(100, Number(settings.color_tint || 0)));
  const filters = [
    `eq=brightness=${(exposure / 100).toFixed(3)}:contrast=${Math.max(0.25, 1 + contrast / 100).toFixed(3)}:saturation=${Math.max(0, 1 + saturation / 100).toFixed(3)}`
  ];
  if (temperature !== 0 || tint !== 0) {
    filters.push(`colorbalance=rs=${(temperature / 500).toFixed(3)}:bs=${(-temperature / 500).toFixed(3)}:gm=${(tint / 500).toFixed(3)}`);
  }
  return filters.join(',');
}

function buildVoiceFilters(settings) {
  const filters = [];
  const cleanupEnabled = settings.voice_cleanup_enabled === true;
  const isolation = Math.max(0, Math.min(100, Number(settings.voice_isolation ?? 55))) / 100;
  if (cleanupEnabled) {
    filters.push(`highpass=f=${Math.round(70 + isolation * 55)}`);
    filters.push(`afftdn=nf=${Math.round(-22 - isolation * 10)}`);
    filters.push(`equalizer=f=3400:t=q:w=0.8:g=${(1.5 + isolation * 3.5).toFixed(2)}`);
    filters.push(`acompressor=threshold=${(-24 + isolation * 6).toFixed(1)}dB:ratio=${(2.2 + isolation * 2.8).toFixed(2)}:attack=12:release=220`);
  }
  const voiceGain = Math.max(-18, Math.min(18, Number(settings.voice_gain || 0)));
  if (voiceGain !== 0) filters.push(`volume=${voiceGain.toFixed(1)}dB`);
  return filters;
}

function hasAdvancedEdits(settings, enabledClips) {
  const colorChanged = ['color_exposure', 'color_contrast', 'color_saturation', 'color_temperature', 'color_tint']
    .some((key) => Number(settings[key] || 0) !== 0);
  const extraMedia = enabledClips.some((clip) => clip.sourcePath || clip.kind === 'sfx');
  const splitRecording = enabledClips.filter((clip) => clip.role === 'screen' || clip.id === 'screen').length > 1;
  return colorChanged || settings.voice_cleanup_enabled === true || settings.normalize_audio === true || Number(settings.voice_gain || 0) !== 0 || extraMedia || splitRecording;
}

async function renderAndExport(projectId, exportPath, format, quality, isPro, onProgress) {
  const project = db.getProject(projectId);
  if (!project) throw new Error('Project not found');

  const cursorEvents = db.getCursorEvents(projectId);
  const settings = project.settings;
  const enabledClips = getEnabledClips(settings);

  const duration = project.duration || 10;
  const fps = 30;
  
  const screenVideoPath = project.raw_video_path && fs.existsSync(project.raw_video_path)
    ? project.raw_video_path
    : project.video_path;
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

  if (settings.cursor_baked && settings.zoom_level <= 1.0 && !hasAdvancedEdits(settings, enabledClips)) {
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
      
      const condX = `if(between(t,${e.timestamp.toFixed(2)},${nextTime.toFixed(2)}),${Math.round(getEventCoordinate(e, 'x', 1920))},`;
      const condY = `if(between(t,${e.timestamp.toFixed(2)},${nextTime.toFixed(2)}),${Math.round(getEventCoordinate(e, 'y', 1080))},`;
      
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
    
    let currentX = filteredEvents[0] ? getEventCoordinate(filteredEvents[0], 'x', 1920) : 960;
    let currentY = filteredEvents[0] ? getEventCoordinate(filteredEvents[0], 'y', 1080) : 540;
    const smoothingFactor = 0.5;
    
    const smoothedEvents = filteredEvents.map(e => {
      const eventX = getEventCoordinate(e, 'x', 1920);
      const eventY = getEventCoordinate(e, 'y', 1080);
      currentX = currentX + (eventX - currentX) * smoothingFactor;
      currentY = currentY + (eventY - currentY) * smoothingFactor;
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
        const cx = Math.round(getEventCoordinate(clicks[i], 'x', 1920));
        const cy = Math.round(getEventCoordinate(clicks[i], 'y', 1080));

        const zoomInExpr = `(1.0+(${max_z}-1.0)*(t-${tc})/${in_dur})`;
        const zoomOutExpr = `(1.0+(${max_z}-1.0)*(${tc + tot_dur}-t)/${out_dur})`;

        zoomExpr = `if(between(t,${tc},${tc + in_dur}),${zoomInExpr},if(between(t,${tc + in_dur},${tc + in_dur + hold_dur}),${max_z},if(between(t,${tc + in_dur + hold_dur},${tc + tot_dur}),${zoomOutExpr},${zoomExpr})))`;
        zoomXExpr = `if(between(t,${tc},${tc + tot_dur}),${cx},${zoomXExpr})`;
        zoomYExpr = `if(between(t,${tc},${tc + tot_dur}),${cy},${zoomYExpr})`;
      }
    }
  }

  // Inputs: primary video, a looped cursor image, optional clean microphone, then imported media.
  const ffmpegParams = ['-i', screenVideoPath, '-i', tempCursorPath];
  let nextInputIndex = 2;
  const microphonePath = project.audio_path && fs.existsSync(project.audio_path) ? project.audio_path : null;
  const microphoneInputIndex = microphonePath ? nextInputIndex++ : null;
  if (microphonePath) ffmpegParams.push('-i', microphonePath);

  const importedInputs = enabledClips
    .filter((clip) => clip.sourcePath && fs.existsSync(clip.sourcePath))
    .map((clip) => ({ ...clip, inputIndex: nextInputIndex++ }));
  importedInputs.forEach((clip) => ffmpegParams.push('-i', clip.sourcePath));

  const hasZoom = zoomExpr !== '1.0' && zoomExpr !== '1';
  const colorFilters = buildColorFilters(settings);
  const filterGraphParts = [
    `[0:v]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,${colorFilters}[graded_v]`
  ];

  const allTimelineClips = Array.isArray(settings.timeline_clips) ? settings.timeline_clips : [];
  const timelineDeclaresScreen = allTimelineClips.some((clip) => clip.role === 'screen' || clip.id === 'screen');
  const screenClips = enabledClips.filter((clip) => clip.role === 'screen' || clip.id === 'screen');
  const screenRanges = screenClips.map((clip) => `between(t,${clipStartSeconds(clip, duration).toFixed(3)},${clipEndSeconds(clip, duration).toFixed(3)})`);
  if (timelineDeclaresScreen && screenRanges.length === 0) {
    filterGraphParts.push('[graded_v]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill[timed_v]');
  } else if (screenRanges.length > 0) {
    filterGraphParts.push(`[graded_v]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='not(${screenRanges.join('+')})'[timed_v]`);
  } else {
    filterGraphParts.push('[graded_v]null[timed_v]');
  }

  if (hasZoom) {
    filterGraphParts.push(`[timed_v]scale=w='1920*${zoomExpr}':h='1080*${zoomExpr}',crop=w=1920:h=1080:x='min(max(${zoomXExpr}*${zoomExpr}-960,0),iw-1920)':y='min(max(${zoomYExpr}*${zoomExpr}-540,0),ih-1080)'[zoomed]`);
  } else {
    filterGraphParts.push('[timed_v]null[zoomed]');
  }

  let currentVideoLabel = 'zoomed';
  importedInputs.filter((clip) => clip.kind === 'video').forEach((clip, index) => {
    const start = clipStartSeconds(clip, duration);
    const end = clipEndSeconds(clip, duration);
    const sourceStart = Math.max(0, Number(clip.sourceStart || 0));
    const sourceEnd = Math.max(sourceStart + 0.05, Number(clip.sourceEnd || sourceStart + (end - start)));
    const clipLabel = `broll_${index}`;
    const outputLabel = `with_broll_${index}`;
    filterGraphParts.push(`[${clip.inputIndex}:v]trim=start=${sourceStart.toFixed(3)}:end=${sourceEnd.toFixed(3)},setpts=PTS-STARTPTS+${start.toFixed(3)}/TB,fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,${colorFilters}[${clipLabel}]`);
    filterGraphParts.push(`[${currentVideoLabel}][${clipLabel}]overlay=eof_action=pass:shortest=0:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'[${outputLabel}]`);
    currentVideoLabel = outputLabel;
  });

  const cursorVisible = !settings.cursor_baked && settings.cursor_visible !== false && cursorEvents.length > 0;
  if (cursorVisible) {
    const cursorSize = Math.max(12, Math.min(140, Math.round((settings.cursor_size || 40) * (settings.cursor_scale || 1))));
    filterGraphParts.push(`[1:v]scale=${cursorSize}:${cursorSize},format=rgba[cursor]`);
    filterGraphParts.push(`[${currentVideoLabel}][cursor]overlay=x='${cursorXExpr}':y='${cursorYExpr}':shortest=0:repeatlast=1[final_v]`);
  } else {
    filterGraphParts.push(`[${currentVideoLabel}]null[final_v]`);
  }

  const audioLabels = [];
  const embeddedAudioIndex = hasMediaStream(screenVideoPath, 'a') ? 0 : null;
  const baseAudioIndex = microphoneInputIndex ?? embeddedAudioIndex;
  if (baseAudioIndex != null) {
    const baseFilters = buildVoiceFilters(settings);
    const audioClips = enabledClips.filter((clip) => clip.role === 'audio' || clip.id === 'audio');
    const audioRanges = audioClips.map((clip) => `between(t,${clipStartSeconds(clip, duration).toFixed(3)},${clipEndSeconds(clip, duration).toFixed(3)})`);
    const filters = [...baseFilters];
    if (allTimelineClips.some((clip) => clip.role === 'audio' || clip.id === 'audio')) {
      filters.push(audioRanges.length ? `volume=0:enable='not(${audioRanges.join('+')})'` : 'volume=0');
    }
    filterGraphParts.push(`[${baseAudioIndex}:a]${filters.length ? filters.join(',') : 'anull'}[voice_a]`);
    audioLabels.push('voice_a');
  }

  importedInputs
    .filter((clip) => clip.kind === 'audio' || (clip.kind === 'video' && clip.useAudio === true))
    .forEach((clip, index) => {
      if (!hasMediaStream(clip.sourcePath, 'a')) return;
      const start = clipStartSeconds(clip, duration);
      const end = clipEndSeconds(clip, duration);
      const sourceStart = Math.max(0, Number(clip.sourceStart || 0));
      const sourceEnd = Math.max(sourceStart + 0.05, Number(clip.sourceEnd || sourceStart + (end - start)));
      const label = `imported_a_${index}`;
      const delayMs = Math.max(0, Math.round(start * 1000));
      const clipVolume = Math.max(0, Math.min(2, Number(clip.volume ?? 0.8)));
      filterGraphParts.push(`[${clip.inputIndex}:a]atrim=start=${sourceStart.toFixed(3)}:end=${sourceEnd.toFixed(3)},asetpts=PTS-STARTPTS,volume=${clipVolume.toFixed(2)},adelay=delays=${delayMs}:all=1[${label}]`);
      audioLabels.push(label);
    });

  enabledClips.filter((clip) => clip.kind === 'sfx').forEach((clip, index) => {
    const start = clipStartSeconds(clip, duration);
    const clipLength = Math.max(0.08, clipEndSeconds(clip, duration) - start);
    const delayMs = Math.max(0, Math.round(start * 1000));
    const clipVolume = Math.max(0, Math.min(2, Number(clip.volume ?? 0.75)));
    const label = `sfx_a_${index}`;
    if (clip.sfxKind === 'whoosh') {
      filterGraphParts.push(`anoisesrc=color=pink:duration=${clipLength.toFixed(3)},highpass=f=180,lowpass=f=6200,afade=t=in:st=0:d=${Math.min(0.18, clipLength / 3).toFixed(3)},afade=t=out:st=${Math.max(0, clipLength - 0.28).toFixed(3)}:d=${Math.min(0.28, clipLength).toFixed(3)},volume=${(clipVolume * 0.5).toFixed(2)},adelay=delays=${delayMs}:all=1[${label}]`);
    } else {
      const frequency = clip.sfxKind === 'pop' ? 520 : 880;
      filterGraphParts.push(`sine=frequency=${frequency}:duration=${clipLength.toFixed(3)},afade=t=out:st=${Math.max(0, clipLength - 0.16).toFixed(3)}:d=${Math.min(0.16, clipLength).toFixed(3)},volume=${(clipVolume * 0.65).toFixed(2)},adelay=delays=${delayMs}:all=1[${label}]`);
    }
    audioLabels.push(label);
  });

  let finalAudioLabel = null;
  if (audioLabels.length === 1) {
    finalAudioLabel = audioLabels[0];
  } else if (audioLabels.length > 1) {
    filterGraphParts.push(`${audioLabels.map((label) => `[${label}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0:normalize=0[mixed_a]`);
    finalAudioLabel = 'mixed_a';
  }
  if (finalAudioLabel && settings.normalize_audio === true) {
    filterGraphParts.push(`[${finalAudioLabel}]loudnorm=I=-16:LRA=7:TP=-1.5[final_a]`);
    finalAudioLabel = 'final_a';
  }

  const filterGraph = filterGraphParts.join('; ');

  // Write filter graph to a temporary script file to prevent command line length issues on Windows
  const tempFilterScriptPath = path.join(path.dirname(exportPath), `temp_filter_${projectId}_${Math.random().toString(36).substring(2, 7)}.txt`);
  fs.writeFileSync(tempFilterScriptPath, filterGraph, 'utf8');

  ffmpegParams.push(
    '-filter_complex_script', tempFilterScriptPath,
    '-map', '[final_v]',
  );

  if (finalAudioLabel) ffmpegParams.push('-map', `[${finalAudioLabel}]`);

  const threadsParam = isPro ? '0' : '2'; // Pro uses maximum CPU threads. Free plan is throttled to 2 threads.
  ffmpegParams.push(
    '-c:v', 'libx264',
    '-threads', threadsParam,
    ...qualityParams,
    '-pix_fmt', 'yuv420p',
    ...(finalAudioLabel ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []),
    '-t', duration.toFixed(3),
    '-movflags', '+faststart',
    '-y',
    exportPath
  );

  const ffmpegProcess = spawn(ffmpegPath, ffmpegParams);

  return new Promise((resolve, reject) => {
    let errorLog = '';
    let settled = false;
    const configuredTimeout = Number(process.env.SCREENFLOW_EXPORT_TIMEOUT_MS || 0);
    const exportTimeoutMs = configuredTimeout > 0
      ? configuredTimeout
      : Math.max(5 * 60 * 1000, duration * 90 * 1000);
    const exportTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ffmpegProcess.kill();
      reject(new Error(`FFmpeg export timed out after ${Math.round(exportTimeoutMs / 1000)} seconds. Logs:\n${errorLog.slice(-600)}`));
    }, exportTimeoutMs);
    
    ffmpegProcess.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(exportTimeout);
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
      clearTimeout(exportTimeout);
      // Cleanup temp cursor PNG and temp filter complex script
      try { fs.unlinkSync(tempCursorPath); } catch (e) {}
      try { fs.unlinkSync(tempFilterScriptPath); } catch (e) {}

      if (settled) return;
      settled = true;
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

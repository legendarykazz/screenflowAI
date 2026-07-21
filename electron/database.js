const path = require('path');
const fs = require('fs');

let dbPath;
let data = {
  projects: [],
  project_settings: [],
  cursor_events: [],
  captions: [],
  exports: [],
  brand_kit: null
};

const defaultBrandKit = {
  brand_name: 'SaaS Studio',
  primary_logo: null,
  white_logo: null,
  extra_logos: [],
  primary_color: '#7C3AED',
  secondary_color: '#FF4D7E',
  watermark_text: '@SaaSStudio',
  watermark_opacity: 0.7,
  watermark_position: 'top-right',
  watermark_font: 'Inter',
  lower_third_name: 'Alex Morgan',
  lower_third_title: 'SaaS Founder & CEO',
  lower_third_style: 'modern',
  intro_style: 'fade',
  outro_style: 'subscribe',
  outro_text: 'Thanks for Watching!'
};

function readData() {
  try {
    if (fs.existsSync(dbPath)) {
      const fileContent = fs.readFileSync(dbPath, 'utf8');
      data = JSON.parse(fileContent);
    } else {
      writeData();
    }
  } catch (e) {
    console.error("Error reading database file: ", e);
  }
}

function writeData() {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing database file: ", e);
  }
}

function initDatabase(userDataPath) {
  dbPath = path.join(userDataPath, 'screenflow_ai_db.json');
  readData();
}

function getProjects() {
  readData();
  return [...data.projects].sort((a, b) => b.updated_at - a.updated_at);
}

function getProject(id) {
  readData();
  const project = data.projects.find(p => p.id === id);
  if (!project) return null;
  
  const settings = data.project_settings.find(s => s.project_id === id) || {
    project_id: id,
    zoom_level: 1.5,
    cursor_scale: 1.0,
    cursor_highlight: 'ripple',
    cursor_color: '#ff4500',
    cursor_opacity: 0.8,
    cursor_size: 40,
    cursor_style: 'arrow',
    cursor_smoothing: 0.18,
    cursor_auto_hide: true,
    cursor_idle_hide_delay: 1.2,
    cursor_loop_to_start: false,
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    webcam_size: 0.2,
    webcam_position: 'bottom-right',
    webcam_label: 'Camera',
    motion_blur: 1,
    motion_blur_intensity: 0.5,
    cursor_visible: true,
    cursor_baked: false,
    auto_zoom: true,
    auto_smooth_cursor: true,
    click_emphasis: 'ripple',
    cinematic_preset: 'cinematic',
    recording_mode: 'Fullscreen',
    recording_source: null,
    resolution: '1080p - 60fps',
    system_audio: true,
    webcam_enabled: false,
    webcam_baked: false,
    timeline_clips: null,
    zoom_in_duration: 0.35,
    zoom_hold_duration: 0.55,
    zoom_out_duration: 0.35,
    zoom_smoothing: 0.08,
  };
  
  return { ...project, settings };
}

function createProject(id, name) {
  readData();
  const now = Date.now();
  
  const newProject = {
    id,
    name,
    created_at: now,
    updated_at: now,
    video_path: null,
    audio_path: null,
    webcam_path: null,
    duration: 0,
    aspect_ratio: '16:9'
  };

  const newSettings = {
    project_id: id,
    zoom_level: 1.5,
    cursor_scale: 1.0,
    cursor_highlight: 'ripple',
    cursor_color: '#ff4500',
    cursor_opacity: 0.8,
    cursor_size: 40,
    cursor_style: 'arrow',
    cursor_smoothing: 0.18,
    cursor_auto_hide: true,
    cursor_idle_hide_delay: 1.2,
    cursor_loop_to_start: false,
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    webcam_size: 0.2,
    webcam_position: 'bottom-right',
    webcam_label: 'Camera',
    motion_blur: 1,
    motion_blur_intensity: 0.5,
    cursor_visible: true,
    cursor_baked: false,
    auto_zoom: true,
    auto_smooth_cursor: true,
    click_emphasis: 'ripple',
    cinematic_preset: 'cinematic',
    recording_mode: 'Fullscreen',
    recording_source: null,
    resolution: '1080p - 60fps',
    system_audio: true,
    webcam_enabled: false,
    webcam_baked: false,
    timeline_clips: null,
    zoom_in_duration: 0.35,
    zoom_hold_duration: 0.55,
    zoom_out_duration: 0.35,
    zoom_smoothing: 0.08,
    watermark_path: null,
    watermark_opacity: 0.5,
    watermark_scale: 0.1,
    watermark_position: 'top-right',
    intro_video: null,
    outro_video: null
  };

  data.projects.push(newProject);
  data.project_settings.push(newSettings);
  writeData();

  return getProject(id);
}

function updateProject(id, fields) {
  readData();
  const projectIdx = data.projects.findIndex(p => p.id === id);
  if (projectIdx === -1) return null;

  const now = Date.now();
  data.projects[projectIdx].updated_at = now;

  const allowedProjectFields = ['name', 'video_path', 'audio_path', 'webcam_path', 'raw_video_path', 'duration', 'aspect_ratio'];
  const allowedSettingsFields = [
    'zoom_level', 'cursor_scale', 'cursor_highlight', 'cursor_color', 'cursor_opacity', 'cursor_size',
    'cursor_style', 'cursor_smoothing',
    'cursor_auto_hide', 'cursor_idle_hide_delay', 'cursor_loop_to_start',
    'background_type', 'background_value', 'background_value_start', 'background_value_end', 'webcam_size', 'webcam_position', 'webcam_label', 'motion_blur',
    'motion_blur_intensity', 'watermark_path', 'watermark_opacity', 'watermark_scale', 'watermark_position',
    'intro_video', 'outro_video', 'cursor_visible', 'cursor_baked', 'auto_zoom', 'auto_smooth_cursor', 'click_emphasis',
    'cinematic_preset', 'recording_mode', 'recording_source', 'resolution', 'system_audio', 'webcam_enabled', 'webcam_baked',
    'zoom_in_duration', 'zoom_hold_duration', 'zoom_out_duration', 'zoom_smoothing', 'timeline_clips',
    'brand_preset', 'brand_name', 'brand_author', 'brand_title', 'brand_primary_color', 'brand_secondary_color',
    'brand_logo', 'brand_white_logo', 'watermark_enabled', 'watermark_text', 'watermark_font',
    'lower_third_enabled', 'lower_third_style', 'intro_enabled', 'intro_style', 'outro_enabled', 'outro_style', 'outro_text'
  ];

  // Update project fields
  Object.keys(fields).forEach(key => {
    if (allowedProjectFields.includes(key)) {
      data.projects[projectIdx][key] = fields[key];
    }
  });

  // Update or insert settings
  let settingsIdx = data.project_settings.findIndex(s => s.project_id === id);
  if (settingsIdx === -1) {
    const newSettings = { project_id: id };
    data.project_settings.push(newSettings);
    settingsIdx = data.project_settings.length - 1;
  }

  Object.keys(fields).forEach(key => {
    if (allowedSettingsFields.includes(key)) {
      data.project_settings[settingsIdx][key] = fields[key];
    }
  });

  writeData();
  return getProject(id);
}

function deleteProject(id) {
  readData();
  data.projects = data.projects.filter(p => p.id !== id);
  data.project_settings = data.project_settings.filter(s => s.project_id !== id);
  data.cursor_events = data.cursor_events.filter(e => e.project_id !== id);
  data.captions = data.captions.filter(c => c.project_id !== id);
  data.exports = data.exports.filter(x => x.project_id !== id);
  writeData();
  return { success: true };
}

function saveCursorEvents(projectId, events) {
  readData();
  data.cursor_events = data.cursor_events.filter(e => e.project_id !== projectId);
  
  const formattedEvents = events.map(e => ({
    project_id: projectId,
    timestamp: e.timestamp,
    x: e.x,
    y: e.y,
    event_type: e.event_type
  }));

  data.cursor_events.push(...formattedEvents);
  writeData();
}

function getCursorEvents(projectId) {
  readData();
  return data.cursor_events
    .filter(e => e.project_id === projectId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function saveCaptions(projectId, captionList) {
  readData();
  data.captions = data.captions.filter(c => c.project_id !== projectId);
  
  const formattedCaptions = captionList.map(c => ({
    project_id: projectId,
    start_time: c.start_time,
    end_time: c.end_time,
    text: c.text
  }));

  data.captions.push(...formattedCaptions);
  writeData();
}

function getCaptions(projectId) {
  readData();
  return data.captions
    .filter(c => c.project_id === projectId)
    .sort((a, b) => a.start_time - b.start_time);
}

function addExport(id, projectId, exportPath) {
  readData();
  const newExport = {
    id,
    project_id: projectId,
    export_path: exportPath,
    status: 'pending',
    progress: 0,
    created_at: Date.now()
  };
  data.exports.push(newExport);
  writeData();
  return newExport;
}

function updateExport(id, status, progress) {
  readData();
  const idx = data.exports.findIndex(x => x.id === id);
  if (idx !== -1) {
    data.exports[idx].status = status;
    data.exports[idx].progress = progress;
    writeData();
    return data.exports[idx];
  }
  return null;
}

function getExports() {
  readData();
  return [...data.exports].sort((a, b) => b.created_at - a.created_at);
}

function getBrandKit() {
  readData();
  return { ...defaultBrandKit, ...(data.brand_kit || {}) };
}

function saveBrandKit(fields) {
  readData();
  data.brand_kit = { ...defaultBrandKit, ...(data.brand_kit || {}), ...fields, updated_at: Date.now() };
  writeData();
  return data.brand_kit;
}

module.exports = {
  initDatabase,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  saveCursorEvents,
  getCursorEvents,
  saveCaptions,
  getCaptions,
  addExport,
  updateExport,
  getExports,
  getBrandKit,
  saveBrandKit
};

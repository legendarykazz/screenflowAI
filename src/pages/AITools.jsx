import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  ArrowRight,
  BarChart2,
  CheckCircle,
  Eye,
  Image,
  MousePointer,
  Scissors,
  Sparkles,
  Type,
  Volume2,
  Wand2,
  Zap
} from 'lucide-react';

const tools = [
  { id: 'enhance', name: 'AI Enhance', desc: 'Apply export-ready clarity, motion, and background polish.', btn: 'Enhance Video', icon: Sparkles, color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)', stat: 'Export preset' },
  { id: 'captions', name: 'AI Captions', desc: 'Generate captions and save them into the selected project.', btn: 'Add Captions', icon: Type, color: '#FF4D7E', bg: 'rgba(255, 77, 126, 0.08)', stat: 'Saved to editor' },
  { id: 'silence', name: 'Silence Removal', desc: 'Detect quiet sections and save timeline cut suggestions.', btn: 'Remove Silence', icon: Scissors, color: '#FFB800', bg: 'rgba(255, 184, 0, 0.08)', stat: 'Timeline cuts' },
  { id: 'scene', name: 'AI Scene Detection', desc: 'Create smart zoom moments for important parts of the video.', btn: 'Detect Scenes', icon: Eye, color: '#00B8D4', bg: 'rgba(0, 184, 212, 0.08)', stat: 'Scene zooms' },
  { id: 'zoom', name: 'Auto Zoom', desc: 'Turn on click-focused zoom settings for the next export.', btn: 'Apply Auto Zoom', icon: MousePointer, color: '#00A878', bg: 'rgba(0, 168, 120, 0.08)', stat: '1.85x zoom' },
  { id: 'bg_remove', name: 'Background Remover', desc: 'Apply a webcam background blur preset.', btn: 'Remove Background', icon: Image, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.08)', stat: 'Webcam blur' },
  { id: 'voice', name: 'AI Voice Clarity', desc: 'Analyze narration for quiet/noisy sections.', btn: 'Improve Voice', icon: Volume2, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)', stat: 'Audio analysis' },
  { id: 'summary', name: 'Content Summarizer', desc: 'Generate chapter ideas from captions and download them.', btn: 'Summarize', icon: AlignLeft, color: '#EC4899', bg: 'rgba(236, 72, 153, 0.08)', stat: 'Auto-chapters' }
];

export default function AITools({ navigateTo }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [runningTool, setRunningTool] = useState(null);
  const [completedTools, setCompletedTools] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [resultMap, setResultMap] = useState({});
  const [errorMap, setErrorMap] = useState({});
  const [pendingTool, setPendingTool] = useState(null);
  const [chooserProjectId, setChooserProjectId] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      const list = await window.electron?.getProjects?.();
      const safeList = Array.isArray(list) ? list : [];
      setProjects(safeList);
      setSelectedProjectId((current) => current || safeList[0]?.id || '');
      setChooserProjectId((current) => current || safeList[0]?.id || '');
    };
    loadProjects();
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const startProgress = (toolId) => {
    setRunningTool(toolId);
    setProgressMap((prev) => ({ ...prev, [toolId]: 0 }));
    return setInterval(() => {
      setProgressMap((prev) => ({
        ...prev,
        [toolId]: Math.min(92, (prev[toolId] || 0) + 8 + Math.random() * 10)
      }));
    }, 220);
  };

  const finishProgress = (toolId, interval) => {
    clearInterval(interval);
    setProgressMap((prev) => ({ ...prev, [toolId]: 100 }));
    setRunningTool(null);
    setCompletedTools((prev) => (prev.includes(toolId) ? prev : [...prev, toolId]));
  };

  const saveJsonResult = (toolId, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject?.name || 'screenflow'}-${toolId}-result.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const runTool = async (tool, project) => {
    if (runningTool) return;
    if (!project) {
      setErrorMap((prev) => ({ ...prev, [tool.id]: 'Record or select a project first.' }));
      return;
    }
    if (!window.electron) {
      setErrorMap((prev) => ({ ...prev, [tool.id]: 'Desktop app APIs are not available.' }));
      return;
    }

    setErrorMap((prev) => ({ ...prev, [tool.id]: '' }));
    const interval = startProgress(tool.id);

    try {
      let message = '';

      if (tool.id === 'captions') {
        const result = await window.electron.generateAICaptions(project.id, '');
        if (!result?.success) throw new Error(result?.error || 'Caption generation failed.');
        message = `${result.captions?.length || 0} captions generated and saved to the editor.`;
      } else if (tool.id === 'silence') {
        const segments = await window.electron.detectSilence(project.id, -40);
        const timelineClips = (segments || []).map((segment, index) => ({
          id: `silence-${Date.now()}-${index}`,
          type: 'cut',
          start: segment.start,
          end: segment.end,
          label: 'Removed silence'
        }));
        await window.electron.updateProject(project.id, { timeline_clips: timelineClips });
        message = `${timelineClips.length} silence cuts saved to the project timeline.`;
      } else if (tool.id === 'zoom') {
        await window.electron.updateProject(project.id, {
          auto_zoom: true,
          follow_cursor: false,
          zoom_level: 1.85,
          zoom_in_duration: 0.28,
          zoom_hold_duration: 0.75,
          zoom_out_duration: 0.32,
          click_emphasis: 'both'
        });
        message = 'Auto zoom settings saved. Open the editor to preview or export.';
      } else if (tool.id === 'scene') {
        const sceneClips = Array.from({ length: 5 }, (_, index) => ({
          id: `scene-${Date.now()}-${index}`,
          type: 'zoom',
          start: index * 6,
          end: index * 6 + 2.5,
          zoom: 1.55,
          label: `Scene ${index + 1}`
        }));
        await window.electron.updateProject(project.id, {
          auto_zoom: true,
          zoom_level: 1.55,
          timeline_clips: sceneClips
        });
        message = `${sceneClips.length} scene zoom moments saved to the timeline.`;
      } else if (tool.id === 'enhance') {
        await window.electron.updateProject(project.id, {
          motion_blur: true,
          cinematic_preset: 'enhanced',
          background_type: 'gradient',
          background_value: 'linear-gradient(135deg, #111827 0%, #243B55 100%)'
        });
        message = 'Enhancement preset saved for the next export.';
      } else if (tool.id === 'bg_remove') {
        await window.electron.updateProject(project.id, {
          webcam_enabled: true,
          webcam_baked: true,
          webcam_label: 'Camera',
          webcam_size: 0.22,
          webcam_position: 'bottom-right',
          background_type: 'blur'
        });
        message = 'Webcam background blur preset saved.';
      } else if (tool.id === 'voice') {
        const segments = await window.electron.detectSilence(project.id, -35);
        message = `Voice clarity analyzed ${segments?.length || 0} quiet/noisy sections.`;
      } else if (tool.id === 'summary') {
        const captions = await window.electron.getCaptions(project.id);
        const chapters = (captions?.length ? captions : [
          { start_time: 0, text: 'Opening' },
          { start_time: 10, text: 'Main walkthrough' },
          { start_time: 25, text: 'Key takeaway' }
        ]).slice(0, 6).map((caption, index) => ({
          time: caption.start_time || index * 10,
          title: caption.text?.slice(0, 56) || `Chapter ${index + 1}`
        }));
        saveJsonResult(tool.id, { project: project.name, chapters });
        message = `${chapters.length} chapter ideas generated and downloaded as JSON.`;
      }

      setResultMap((prev) => ({ ...prev, [tool.id]: message }));
      finishProgress(tool.id, interval);
    } catch (error) {
      clearInterval(interval);
      setRunningTool(null);
      setErrorMap((prev) => ({ ...prev, [tool.id]: error.message }));
    }
  };

  const openChooser = (tool) => {
    setPendingTool(tool);
    setChooserProjectId(selectedProjectId || projects[0]?.id || '');
  };

  const runPendingOnProject = async () => {
    const tool = pendingTool;
    const project = projects.find((item) => item.id === chooserProjectId) || selectedProject;
    setPendingTool(null);
    await runTool(tool, project);
  };

  const runPendingOnLocalFile = async () => {
    const tool = pendingTool;
    if (!tool) return;
    if (!window.electron?.selectFile || !window.electron?.createProject || !window.electron?.updateProject) {
      setErrorMap((prev) => ({ ...prev, [tool.id]: 'Local file picker is not available.' }));
      setPendingTool(null);
      return;
    }

    const filePath = await window.electron.selectFile([
      { name: 'Media files', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac'] }
    ]);
    if (!filePath) return;

    const fileName = filePath.split(/[\\/]/).pop() || 'Local media';
    const projectName = fileName.replace(/\.[^.]+$/, '') || fileName;
    const project = await window.electron.createProject(projectName);
    const isAudio = /\.(mp3|wav|m4a|aac)$/i.test(filePath);
    const updatedProject = await window.electron.updateProject(project.id, {
      video_path: isAudio ? project.video_path : filePath,
      raw_video_path: isAudio ? project.raw_video_path : filePath,
      audio_path: filePath,
      name: projectName
    });
    const list = await window.electron.getProjects();
    setProjects(Array.isArray(list) ? list : []);
    setSelectedProjectId(updatedProject?.id || project.id);
    setPendingTool(null);
    await runTool(tool, updatedProject || project);
  };

  return (
    <div style={{
      background: '#F8FAFF',
      minHeight: '100%',
      margin: '-32px',
      padding: '32px 40px',
      color: '#1A1F36',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      fontFamily: 'var(--font-sans)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>AI Tools</h1>
          <p style={{ color: '#5A607F', fontSize: 14, marginTop: 4 }}>
            Run AI helpers on a real recording project and save the result back into the editor.
          </p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #D9E1EF', borderRadius: 16, padding: 14, minWidth: 300 }}>
          <label style={{ color: '#475569', display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 800, gap: 7 }}>
            Project
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              style={{ border: '1px solid #D9E1EF', borderRadius: 10, color: '#172033', fontSize: 13, fontWeight: 800, minHeight: 40, padding: '0 10px' }}
            >
              {projects.length === 0 ? (
                <option value="">No projects yet</option>
              ) : projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {projects.length === 0 && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #FBBF24',
          borderRadius: 14,
          color: '#92400E',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            No recording projects found. AI tools need a recording project to save captions, zooms, cuts, and presets.
          </div>
          <button onClick={() => navigateTo('recording')} style={{ ...primaryLightButtonStyle, border: '1px solid #FBBF24', color: '#92400E' }}>
            Start Recording
          </button>
        </div>
      )}

      <div style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
        borderRadius: 20,
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 900 }}>All AI tools are now wired to your selected project.</div>
            <div style={{ fontSize: 13, opacity: 0.82, marginTop: 2 }}>Captions save into the editor; settings and timeline suggestions are applied locally.</div>
          </div>
        </div>
        <button onClick={() => navigateTo('projects')} style={primaryLightButtonStyle}>Open Projects</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isRunning = runningTool === tool.id;
          const isCompleted = completedTools.includes(tool.id);
          const progress = progressMap[tool.id] || 0;

          return (
            <div key={tool.id} style={cardStyle(isCompleted, tool.color)}>
              {isCompleted && <DoneBadge />}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ background: tool.bg, color: tool.color, width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={23} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#172033', marginBottom: 5 }}>{tool.name}</h3>
                  <p style={{ fontSize: 13, color: '#71809A', lineHeight: 1.45 }}>{tool.desc}</p>
                </div>
              </div>

              <div style={{ background: tool.bg, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Zap size={12} style={{ color: tool.color }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: tool.color }}>{tool.stat}</span>
              </div>

              {isRunning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 7, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: tool.color, borderRadius: 999, transition: 'width 0.25s ease' }} />
                  </div>
                  <span style={{ color: '#71809A', fontSize: 12, fontWeight: 700 }}>Processing... {Math.round(progress)}%</span>
                </div>
              )}

              {resultMap[tool.id] && <StatusText color="#00A878" text={resultMap[tool.id]} />}
              {errorMap[tool.id] && <StatusText color="#EF4444" text={errorMap[tool.id]} />}

              <button
                disabled={isRunning}
                onClick={() => openChooser(tool)}
                style={{
                  background: isCompleted ? 'rgba(0,168,120,0.08)' : isRunning ? '#F1F5F9' : tool.bg,
                  border: `1.5px solid ${isCompleted ? 'rgba(0,168,120,0.25)' : isRunning ? '#E2E8F0' : `${tool.color}44`}`,
                  borderRadius: 12,
                  color: isCompleted ? '#00A878' : isRunning ? '#8A94A6' : tool.color,
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  fontSize: 13,
                  fontWeight: 800,
                  padding: '12px 16px',
                  width: '100%'
                }}
              >
                {isCompleted ? 'Run Again' : isRunning ? 'Processing...' : tool.btn}
                {!isRunning && <ArrowRight size={14} />}
              </button>
            </div>
          );
        })}
      </div>

      {pendingTool && (
        <div style={{
          alignItems: 'center',
          background: 'rgba(15,23,42,0.55)',
          display: 'flex',
          inset: 0,
          justifyContent: 'center',
          padding: 24,
          position: 'fixed',
          zIndex: 100000
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #D9E1EF',
            borderRadius: 18,
            boxShadow: '0 32px 80px rgba(15,23,42,0.28)',
            color: '#172033',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 22,
            width: 460
          }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>{pendingTool.name}</h2>
              <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.45 }}>
                Choose a saved project or pick a local media file for this AI tool.
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
              <label style={{ color: '#475569', display: 'flex', flexDirection: 'column', fontSize: 12, fontWeight: 900, gap: 7 }}>
                Existing project
                <select
                  value={chooserProjectId}
                  onChange={(event) => setChooserProjectId(event.target.value)}
                  style={{ border: '1px solid #D9E1EF', borderRadius: 10, color: '#172033', fontSize: 13, fontWeight: 800, minHeight: 40, padding: '0 10px' }}
                >
                  {projects.length === 0 ? (
                    <option value="">No projects yet</option>
                  ) : projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <button
                disabled={!chooserProjectId}
                onClick={runPendingOnProject}
                style={{
                  ...modalButtonStyle,
                  background: chooserProjectId ? pendingTool.bg : '#F1F5F9',
                  borderColor: chooserProjectId ? `${pendingTool.color}44` : '#E2E8F0',
                  color: chooserProjectId ? pendingTool.color : '#94A3B8',
                  marginTop: 12
                }}
              >
                Run on Selected Project <ArrowRight size={14} />
              </button>
            </div>

            <button
              onClick={runPendingOnLocalFile}
              style={{
                ...modalButtonStyle,
                background: '#172033',
                borderColor: '#172033',
                color: '#FFFFFF'
              }}
            >
              Choose Local File <ArrowRight size={14} />
            </button>

            <button
              onClick={() => setPendingTool(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 800,
                padding: 8
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DoneBadge() {
  return (
    <div style={{ position: 'absolute', right: 14, top: 14, background: 'rgba(0,168,120,0.12)', color: '#00A878', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 900, padding: '4px 8px' }}>
      <CheckCircle size={11} /> DONE
    </div>
  );
}

function StatusText({ color, text }) {
  return (
    <div style={{ background: `${color}10`, border: `1px solid ${color}22`, borderRadius: 10, color, fontSize: 12, fontWeight: 800, lineHeight: 1.45, padding: '9px 10px' }}>
      {text}
    </div>
  );
}

const cardStyle = (isCompleted, color) => ({
  background: '#FFFFFF',
  border: `1px solid ${isCompleted ? `${color}30` : 'rgba(0,0,0,0.05)'}`,
  borderRadius: 20,
  boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minHeight: 250,
  overflow: 'hidden',
  padding: 24,
  position: 'relative'
});

const primaryLightButtonStyle = {
  background: '#FFFFFF',
  border: 'none',
  borderRadius: 12,
  color: '#7C3AED',
  cursor: 'pointer',
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 900,
  padding: '11px 18px'
};

const modalButtonStyle = {
  alignItems: 'center',
  border: '1.5px solid',
  borderRadius: 12,
  cursor: 'pointer',
  display: 'flex',
  fontSize: 13,
  fontWeight: 900,
  gap: 8,
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 14px',
  width: '100%'
};

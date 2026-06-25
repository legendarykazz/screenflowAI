import React, { useState } from 'react';
import { 
  Sparkles, Type, Scissors, Eye, MousePointer, Image, Volume2, AlignLeft, 
  ArrowRight, Zap, CheckCircle, Lock, BarChart2, Wand2
} from 'lucide-react';

export default function AITools({ navigateTo }) {
  const [runningTool, setRunningTool] = useState(null);
  const [completedTools, setCompletedTools] = useState([]);
  const [progressMap, setProgressMap] = useState({});

  const tools = [
    {
      id: 'enhance',
      name: 'AI Enhance',
      desc: 'Improve video quality, brightness and clarity with one click.',
      btn: 'Enhance Video',
      icon: Sparkles,
      color: '#7C3AED',
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #a855f7 100%)',
      bg: 'rgba(124, 58, 237, 0.08)',
      isPro: false,
      stat: '2x sharper',
    },
    {
      id: 'captions',
      name: 'AI Captions',
      desc: 'Generate accurate captions using OpenAI Whisper. 100+ languages.',
      btn: 'Add Captions',
      icon: Type,
      color: '#FF4D7E',
      gradient: 'linear-gradient(135deg, #FF4D7E 0%, #ff8fa3 100%)',
      bg: 'rgba(255, 77, 126, 0.08)',
      isPro: true,
      stat: '98% accuracy',
    },
    {
      id: 'silence',
      name: 'Silence Removal',
      desc: 'Remove awkward pauses and dead air automatically from audio.',
      btn: 'Remove Silence',
      icon: Scissors,
      color: '#FFB800',
      gradient: 'linear-gradient(135deg, #FFB800 0%, #ffd84d 100%)',
      bg: 'rgba(255, 184, 0, 0.08)',
      isPro: false,
      stat: '–3.2 min avg',
    },
    {
      id: 'scene',
      name: 'AI Scene Detection',
      desc: 'Detect important keyframes and generate smart zoom events.',
      btn: 'Detect Scenes',
      icon: Eye,
      color: '#00E0FF',
      gradient: 'linear-gradient(135deg, #00E0FF 0%, #00b4cc 100%)',
      bg: 'rgba(0, 224, 255, 0.08)',
      isPro: true,
      stat: '25+ scenes avg',
    },
    {
      id: 'zoom',
      name: 'Auto Zoom',
      desc: 'Auto-zoom on mouse clicks and keyboard interactions.',
      btn: 'Apply Auto Zoom',
      icon: MousePointer,
      color: '#00C48C',
      gradient: 'linear-gradient(135deg, #00C48C 0%, #00a878 100%)',
      bg: 'rgba(0, 196, 140, 0.08)',
      isPro: true,
      stat: '1.5x–2.5x zoom',
    },
    {
      id: 'bg_remove',
      name: 'Background Remover',
      desc: 'Remove or blur the background from your webcam overlay.',
      btn: 'Remove Background',
      icon: Image,
      color: '#3B82F6',
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #6fa8ff 100%)',
      bg: 'rgba(59, 130, 246, 0.08)',
      isPro: true,
      stat: 'Virtual BG ready',
    },
    {
      id: 'voice',
      name: 'AI Voice Clarity',
      desc: 'Remove background noise, hum and echo from your narration.',
      btn: 'Improve Voice',
      icon: Volume2,
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #b590ff 100%)',
      bg: 'rgba(139, 92, 246, 0.08)',
      isPro: false,
      stat: 'Studio quality',
    },
    {
      id: 'summary',
      name: 'Content Summarizer',
      desc: 'Generate chapter titles and key takeaway frames from your video.',
      btn: 'Summarize',
      icon: AlignLeft,
      color: '#EC4899',
      gradient: 'linear-gradient(135deg, #EC4899 0%, #f880bf 100%)',
      bg: 'rgba(236, 72, 153, 0.08)',
      isPro: true,
      stat: 'Auto-chapters',
    }
  ];

  const simulateRun = (toolId) => {
    setRunningTool(toolId);
    setProgressMap(prev => ({ ...prev, [toolId]: 0 }));
    const interval = setInterval(() => {
      setProgressMap(prev => {
        const current = prev[toolId] || 0;
        const next = current + Math.random() * 15;
        if (next >= 100) {
          clearInterval(interval);
          setRunningTool(null);
          setCompletedTools(prev2 => [...prev2, toolId]);
          return { ...prev, [toolId]: 100 };
        }
        return { ...prev, [toolId]: next };
      });
    }, 200);
  };

  const handleToolAction = (tool) => {
    if (tool.isPro) {
      // For demo, show a pro alert but navigate to settings if user confirmed
      if (window.confirm(`"${tool.name}" requires a Pro subscription.\n\nWould you like to upgrade in Settings?`)) {
        navigateTo('settings');
      }
      return;
    }
    if (runningTool) return;
    simulateRun(tool.id);
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
      gap: '28px',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>AI Tools</h1>
          <p style={{ color: '#5A607F', fontSize: '14px', marginTop: '4px' }}>
            Powerful AI-driven enhancements to make your screen records look amazing.
          </p>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(255,77,126,0.08) 100%)',
          border: '1px solid rgba(124,58,237,0.15)', borderRadius: '16px', padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <BarChart2 size={18} style={{ color: '#7C3AED' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1F36' }}>AI Usage</div>
            <div style={{ fontSize: '11px', color: '#8A94A6' }}>Free: 3/5 runs</div>
          </div>
        </div>
      </div>

      {/* Usage Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
        borderRadius: '20px', padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wand2 size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', fontFamily: 'var(--font-display)' }}>Unlock All AI Features with Pro</div>
            <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>AI Captions, Auto Zoom, Scene Detection, Background Remover &amp; more</div>
          </div>
        </div>
        <button 
          onClick={() => navigateTo('settings')}
          style={{
            background: '#fff', color: '#7C3AED', border: 'none',
            borderRadius: '12px', padding: '10px 20px',
            fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            flexShrink: 0, transition: 'all 0.2s'
          }}
        >
          Upgrade to Pro →
        </button>
      </div>

      {/* AI Tools Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {tools.map(tool => {
          const Icon = tool.icon;
          const isRunning = runningTool === tool.id;
          const isCompleted = completedTools.includes(tool.id);
          const progress = progressMap[tool.id] || 0;

          return (
            <div 
              key={tool.id}
              style={{
                background: '#FFF',
                border: `1px solid ${isCompleted ? tool.color + '30' : 'rgba(0,0,0,0.04)'}`,
                borderRadius: '24px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                cursor: 'pointer',
                transition: 'all 0.25s',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.transform = 'translateY(-3px)'; 
                e.currentTarget.style.boxShadow = `0 16px 40px ${tool.color}20`; 
                e.currentTarget.style.borderColor = tool.color + '40';
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = isCompleted ? tool.color + '30' : 'rgba(0,0,0,0.04)';
              }}
            >
              {/* Pro badge */}
              {tool.isPro && (
                <div style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
                  color: '#fff', fontSize: '9px', fontWeight: 800,
                  padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.5px'
                }}>
                  PRO
                </div>
              )}

              {/* Completed badge */}
              {isCompleted && (
                <div style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'rgba(0,196,140,0.12)', color: '#00C48C',
                  fontSize: '9px', fontWeight: 800, padding: '3px 8px',
                  borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px'
                }}>
                  <CheckCircle size={10} /> DONE
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  background: tool.bg,
                  color: tool.color,
                  width: '48px', height: '48px',
                  borderRadius: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1A1F36', marginBottom: '4px' }}>{tool.name}</h3>
                  <p style={{ fontSize: '12px', color: '#8A94A6', lineHeight: '1.5' }}>{tool.desc}</p>
                </div>
              </div>

              {/* Stat */}
              <div style={{ 
                background: tool.bg, borderRadius: '8px', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                <Zap size={12} style={{ color: tool.color }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: tool.color }}>{tool.stat}</span>
              </div>

              {/* Progress bar when running */}
              {isRunning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', width: `${progress}%`,
                      background: tool.gradient, borderRadius: '99px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#8A94A6', fontWeight: 600 }}>Processing... {Math.round(progress)}%</span>
                </div>
              )}

              <button 
                onClick={() => handleToolAction(tool)}
                disabled={isRunning}
                style={{
                  background: isCompleted ? 'rgba(0,196,140,0.08)' : isRunning ? '#F1F5F9' : tool.bg,
                  border: `1.5px solid ${isCompleted ? 'rgba(0,196,140,0.25)' : isRunning ? '#E2E8F0' : tool.color + '40'}`,
                  color: isCompleted ? '#00C48C' : isRunning ? '#8A94A6' : tool.color,
                  borderRadius: '12px', padding: '11px 16px',
                  fontSize: '13px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  width: '100%', transition: 'all 0.2s'
                }}
              >
                {tool.isPro && !isRunning && !isCompleted && <Lock size={12} />}
                {isCompleted ? 'Applied Successfully' : isRunning ? 'Processing...' : tool.btn}
                {!isRunning && !isCompleted && <ArrowRight size={13} />}
                {isCompleted && <CheckCircle size={13} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

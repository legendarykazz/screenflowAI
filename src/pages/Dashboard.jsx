import React, { useState, useEffect } from 'react';
import { 
  Play, Plus, Trash2, Copy, FileVideo, FolderOpen, 
  Video, Type, ArrowRight, Clock, Download, HardDrive, 
  Search, ChevronRight, MoreVertical, Activity, Zap,
  TrendingUp, Check, Circle, AlertCircle, RefreshCw, Trophy, Users
} from 'lucide-react';

export default function Dashboard({ onCreateProject, onOpenProject, navigateTo }) {
  const [projects, setProjects] = useState([]);
  const [autoZoom, setAutoZoom] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [savedStatus, setSavedStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [searchQuery, setSearchQuery] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(null);

  useEffect(() => {
    loadProjects();
    // Simulate auto-save feedback
    const interval = setInterval(() => {
      setSavedStatus('saving');
      setTimeout(() => setSavedStatus('saved'), 1000);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    if (window.electron && window.electron.getProjects) {
      const projs = await window.electron.getProjects();
      setProjects(projs);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    const name = `Project #${Math.floor(100 + Math.random() * 900)}`;
    if (window.electron && window.electron.createProject) {
      setSavedStatus('saving');
      const newProj = await window.electron.createProject(name);
      setSavedStatus('saved');
      onOpenProject(newProj.id);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    setShowContextMenu(null);
    if (window.electron && window.electron.deleteProject) {
      await window.electron.deleteProject(id);
      loadProjects();
    }
  };

  const handleDuplicate = async (proj, e) => {
    e.stopPropagation();
    setShowContextMenu(null);
    if (window.electron && window.electron.createProject) {
      const name = `${proj.name} (Copy)`;
      const newProj = await window.electron.createProject(name);
      if (window.electron.updateProject) {
        await window.electron.updateProject(newProj.id, {
          video_path: proj.video_path,
          audio_path: proj.audio_path,
          duration: proj.duration,
        });
      }
      loadProjects();
    }
  };

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  ];

  const displayProjects = projects.length > 0 ? projects : [
    { id: 'saas-prod', name: 'SaaS Product Walkthrough', updated_at: Date.now() - 3600000*2, duration: '8:45', size: '1080p', tag: 'Edited' },
    { id: 'design-sys', name: 'Design System Overview', updated_at: Date.now() - 3600000*26, duration: '12:15', size: '1080p' },
    { id: 'yt-tut', name: 'YouTube Tutorial Intro', updated_at: Date.now() - 3600000*50, duration: '5:30', size: '1080p' },
    { id: 'dash-demo', name: 'Dashboard Demo', updated_at: Date.now() - 3600000*72, duration: '9:10', size: '1080p' },
  ];

  const filteredProjects = displayProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { label: 'Total Projects', value: displayProjects.length, icon: FolderOpen, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
    { label: 'Recordings', value: '12', icon: Video, color: '#FF4D7E', bg: 'rgba(255,77,126,0.1)' },
    { label: 'Exports Done', value: '8', icon: Download, color: '#00C48C', bg: 'rgba(0,196,140,0.1)' },
    { label: 'Hours Saved', value: '4.2h', icon: Zap, color: '#FFB800', bg: 'rgba(255,184,0,0.1)' },
  ];

  const quickActions = [
    { label: 'Start Recording', icon: Video, color: '#FF4D7E', action: () => navigateTo('recording') },
    { label: 'Live Call Studio', icon: Users, color: '#00A878', action: () => navigateTo('livecall') },
    { label: 'New Project', icon: Plus, color: '#7C3AED', action: handleCreate },
    { label: 'View Exports', icon: Download, color: '#00E0FF', action: () => navigateTo('exports') },
  ];

  const formatRelativeTime = (ts) => {
    if (typeof ts === 'string') return ts;
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
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
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 750, color: '#1A1F36', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Projects
          </h1>
          <p style={{ color: '#5A607F', fontSize: '14px', marginTop: '4px' }}>
            Record, edit, and export screen videos from one quiet workspace.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Auto-save status */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#fff', border: '1px solid #E2E8F0',
            borderRadius: '8px', padding: '6px 12px',
            fontSize: '12px', fontWeight: 600,
            color: savedStatus === 'saved' ? '#00C48C' : savedStatus === 'saving' ? '#FFB800' : '#ef4444'
          }}>
            {savedStatus === 'saved' && <Check size={12} />}
            {savedStatus === 'saving' && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {savedStatus === 'error' && <AlertCircle size={12} />}
            {savedStatus === 'saved' ? 'All saved' : savedStatus === 'saving' ? 'Saving...' : 'Save failed'}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: '#8A94A6' }} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#FFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '10px 12px 10px 36px',
                fontSize: '13px',
                outline: 'none',
                color: '#1A1F36',
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>

          <button 
            onClick={handleCreate} 
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'none',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} style={{
              background: '#FFF',
              border: '1px solid rgba(0,0,0,0.04)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 1px 2px rgba(17,19,24,0.04)',
              transition: 'all 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.03)'; }}
            >
              <div style={{ 
                background: stat.bg, 
                color: stat.color, 
                width: '48px', height: '48px', 
                borderRadius: '14px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={22} />
              </div>
              <div>
                <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-display)', color: '#1A1F36', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: '#8A94A6', fontWeight: 600, marginTop: '4px' }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1A1F36' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={action.action}
                style={{
                  background: '#FFF',
                  border: '1px solid rgba(0,0,0,0.04)',
                  borderRadius: '8px',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={e => { 
                  e.currentTarget.style.transform = 'translateY(-2px)'; 
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.boxShadow = `0 8px 24px ${action.color}20`;
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.transform = 'translateY(0)'; 
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.04)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                }}
              >
                <div style={{
                  background: `${action.color}15`,
                  color: action.color,
                  width: '40px', height: '40px',
                  borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={18} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A1F36' }}>{action.label}</span>
                <ArrowRight size={14} style={{ color: '#C1C8E4', marginLeft: 'auto' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1A1F36' }}>Recent Projects</h2>
          <button 
            onClick={() => navigateTo('projects')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ background: '#FFF', borderRadius: '8px', height: '200px', border: '1px solid rgba(0,0,0,0.04)', 
                animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.6 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
            {filteredProjects.slice(0, 8).map((proj, idx) => (
              <div 
                key={proj.id}
                style={{ position: 'relative' }}
                onClick={() => { setShowContextMenu(null); onOpenProject(proj.id); }}
              >
                <div style={{
                  background: '#FFF',
                  border: '1px solid rgba(0,0,0,0.04)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 2px rgba(17,19,24,0.04)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.03)'; }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: '130px',
                    background: gradients[idx % gradients.length],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.15)', 
                      backdropFilter: 'blur(4px)',
                      width: '44px', height: '44px', 
                      borderRadius: '50%', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid rgba(255,255,255,0.4)'
                    }}>
                      <Play size={18} fill="#FFF" style={{ color: '#FFF', marginLeft: '2px' }} />
                    </div>
                    
                    {/* Duration badge */}
                    <span style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                      color: '#FFF', fontSize: '10px', fontWeight: 700,
                      padding: '3px 8px', borderRadius: '6px'
                    }}>
                      {proj.duration || '10:00'}
                    </span>

                    {proj.tag && (
                      <span style={{
                        position: 'absolute', top: '10px', left: '10px',
                        background: '#FF4D7E', color: '#FFF',
                        fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.5px'
                      }}>
                        {proj.tag.toUpperCase()}
                      </span>
                    )}

                    {/* More menu button */}
                    <button
                      onClick={e => { e.stopPropagation(); setShowContextMenu(showContextMenu === proj.id ? null : proj.id); }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                        border: 'none', color: '#FFF',
                        width: '28px', height: '28px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s'
                      }}
                      className="context-menu-trigger"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  {/* Info */}
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1A1F36', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} style={{ color: '#C1C8E4' }} />
                      <span style={{ fontSize: '11px', color: '#8A94A6', fontWeight: 500 }}>
                        {formatRelativeTime(proj.updated_at)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#C1C8E4' }}>•</span>
                      <span style={{ fontSize: '11px', color: '#8A94A6', fontWeight: 500 }}>{proj.size || '1080p'}</span>
                    </div>
                  </div>
                </div>

                {/* Context dropdown menu */}
                {showContextMenu === proj.id && (
                  <div style={{
                    position: 'absolute', top: '140px', right: '10px',
                    background: '#FFF', border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '12px', padding: '6px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100,
                    minWidth: '160px'
                  }}
                  onClick={e => e.stopPropagation()}
                  >
                    <button onClick={e => { onOpenProject(proj.id); setShowContextMenu(null); }} 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#1A1F36', fontWeight: 600, textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Play size={13} /> Open Editor
                    </button>
                    <button onClick={e => handleDuplicate(proj, e)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#1A1F36', fontWeight: 600, textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Copy size={13} /> Duplicate
                    </button>
                    <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                    <button onClick={e => handleDelete(proj.id, e)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: 600, textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={13} /> Delete Project
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Create new project card */}
            <div 
              onClick={handleCreate}
              style={{
                background: '#FFF',
                border: '2px dashed #E2E8F0',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: '24px',
                minHeight: '200px'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = 'rgba(124,58,237,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#FFF'; }}
            >
              <div style={{ 
                background: 'rgba(124,58,237,0.08)', color: '#7C3AED',
                width: '44px', height: '44px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Plus size={20} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#8A94A6' }}>New Project</span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .context-menu-trigger { opacity: 0; }
        div:hover > .context-menu-trigger { opacity: 1 !important; }
      `}</style>
    </div>
  );
}




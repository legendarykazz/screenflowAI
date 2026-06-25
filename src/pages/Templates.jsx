import React, { useState } from 'react';
import { Youtube, Instagram, Film, GraduationCap, Laptop, Sparkles, Send, Download, Lock, Search } from 'lucide-react';

export default function Templates({ onCreateProject, license }) {
  const [exportProgress, setExportProgress] = useState(null);
  const [exportingName, setExportingName] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [attemptedTemplate, setAttemptedTemplate] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const templates = [
    {
      id: 'youtube_tutorial',
      name: 'YOUTUBE TUTORIAL',
      desc: '16:9 widescreen layout with professional gradient overlays, large smooth mouse pointer, and click highlights.',
      icon: Youtube,
      color: '#ef4444',
      pro: false,
      settings: { aspect_ratio: '16:9', zoom_level: 1.5, cursor_scale: 1.2, background_type: 'gradient' }
    },
    {
      id: 'tiktok_tutorial',
      name: 'TIKTOK SHORT',
      desc: '9:16 vertical viewport with canvas background blur, auto-zooms on mouse clicks, optimized for mobile viewing.',
      icon: Instagram,
      color: '#ec4899',
      pro: true,
      settings: { aspect_ratio: '9:16', zoom_level: 2.0, cursor_scale: 1.3, background_type: 'blur' }
    },
    {
      id: 'product_demo',
      name: 'PRODUCT WALKTHROUGH',
      desc: 'Sleek dark design with 1.8x automatic zooms on clicking elements, emphasizing UI inputs and button clicks.',
      icon: Laptop,
      color: '#3b82f6',
      pro: false,
      settings: { aspect_ratio: '16:9', zoom_level: 1.8, cursor_scale: 1.0, background_type: 'solid', background_value: '#0f0f1b' }
    },
    {
      id: 'saas_walkthrough',
      name: 'SAAS WALKTHROUGH',
      desc: 'Cinematic layout with custom branding watermarks, high-fidelity cursor trace, and slow zoom speeds.',
      icon: Film,
      color: '#8b5cf6',
      pro: true,
      settings: { aspect_ratio: '16:9', zoom_level: 1.5, cursor_scale: 1.4, cursor_highlight: 'both' }
    },
    {
      id: 'feature_highlight',
      name: 'FEATURE HIGHLIGHT',
      desc: 'Bright zoom focus on keyboard actions and buttons overlay.',
      icon: Sparkles,
      color: '#10b981',
      pro: false,
      settings: { aspect_ratio: '16:9', zoom_level: 1.6 }
    },
    {
      id: 'customer_onboarding',
      name: 'CUSTOMER ONBOARDING',
      desc: '16:9 widescreen layout built for onboarding guides and tours.',
      icon: GraduationCap,
      color: '#FFB800',
      pro: true,
      settings: { aspect_ratio: '16:9', webcam_position: 'bottom-right' }
    }
  ];

  const checkProStatus = (tpl) => {
    const isPro = license?.plan === 'pro';
    if (tpl.pro && !isPro) {
      setAttemptedTemplate(tpl.name);
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  const handleApply = async (tpl) => {
    if (!checkProStatus(tpl)) return;

    if (window.electron && window.electron.createProject) {
      const name = `${tpl.name} Project`;
      const proj = await window.electron.createProject(name);
      
      if (window.electron.updateProject) {
        await window.electron.updateProject(proj.id, {
          ...tpl.settings,
          duration: 12,
          video_path: 'mock_video.mp4'
        });
      }
      onCreateProject(proj.id);
    }
  };

  const isPro = license?.plan === 'pro';

  return (
    <div style={{ 
      background: '#F8FAFF', 
      minHeight: '100%', 
      margin: '-32px', 
      padding: '32px 40px',
      color: '#1A1F36',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      fontFamily: 'var(--font-sans)'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>
            Templates
          </h1>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8A94A6' }} />
          <input 
            type="text" 
            placeholder="Search templates..." 
            style={{
              width: '100%',
              background: '#FFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '10px 12px 10px 38px',
              fontSize: '13px',
              outline: 'none',
              color: '#1A1F36'
            }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
        {['All', 'YouTube', 'TikTok', 'Instagram', 'Product Demo', 'Education', 'Business'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 4px',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--accent-primary)' : '#8A94A6',
              borderBottom: activeTab === tab ? '2.5px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Action Progress Info */}
      {exportProgress !== null && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--accent-primary)' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>One-Click Exporting: {exportingName}...</span>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${exportProgress}%`, background: 'var(--accent-gradient)', transition: 'width 0.2s ease' }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rendering: {exportProgress}% complete</span>
        </div>
      )}

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {templates.map(tpl => {
          const Icon = tpl.icon;
          return (
            <div 
              key={tpl.id}
              style={{
                background: '#FFF',
                border: '1px solid rgba(0,0,0,0.04)',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '320px'
              }}
            >
              {/* Graphic Header Box */}
              <div style={{
                background: tpl.pro ? 'var(--gradient-violet)' : 'var(--gradient-sunset)',
                height: '160px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#FFF',
                position: 'relative',
                textAlign: 'center',
                padding: '20px'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.05em' }}>{tpl.name}</h3>
                
                {tpl.pro && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isPro ? 'rgba(99, 102, 241, 0.25)' : 'rgba(244, 63, 94, 0.25)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    color: '#FFF',
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '99px',
                    textTransform: 'uppercase'
                  }}>
                    {!isPro && <Lock size={10} />}
                    Pro
                  </div>
                )}
              </div>

              {/* Text Description and Button footer */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '12px', color: '#5A607F', lineHeight: '1.4' }}>{tpl.desc}</p>
                
                <button 
                  onClick={() => handleApply(tpl)}
                  style={{
                    background: tpl.pro && !isPro ? '#E2E8F0' : 'var(--accent-primary)',
                    color: tpl.pro && !isPro ? '#8A94A6' : '#FFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: tpl.pro && !isPro ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    marginTop: '12px'
                  }}
                >
                  {tpl.pro && !isPro && <Lock size={14} />}
                  Use Template
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upgrade Premium Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{
            width: '450px',
            padding: '32px',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            background: '#FFF',
            color: '#1A1F36'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f43f5e',
              margin: '0 auto'
            }}>
              <Lock size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Pro License Required</h3>
              <p style={{ color: '#5A607F', fontSize: '14px', lineHeight: '1.5' }}>
                The template <strong>{attemptedTemplate}</strong> features advanced viewport layouts and premium configurations exclusive to ScreenFlow AI Pro.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowUpgradeModal(false)} className="btn-primary" style={{ flex: 1.2, justifyContent: 'center' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

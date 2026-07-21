import React from 'react';
import { 
  Home, 
  Video, 
  FolderHeart, 
  Download, 
  Settings,
  Flame,
  Award,
  ChevronDown,
  Sparkles,
  Palette,
  Trophy,
  Users
} from 'lucide-react';

export default function Sidebar({ currentPage, setCurrentPage, license }) {
  const menuItems = [
    { id: 'dashboard', name: 'Home', icon: Home },
    { id: 'recording', name: 'Record', icon: Video },
    { id: 'projects', name: 'Projects', icon: FolderHeart },
    { id: 'exports', name: 'Exports', icon: Download },
    { id: 'brandkit', name: 'Brand Kit', icon: Palette },
    { id: 'aitools', name: 'AI Tools', icon: Sparkles },
    { id: 'livecall', name: 'Live Call', icon: Users },
    { id: 'football', name: 'Football Lab', icon: Trophy },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const isPro = license?.plan === 'pro';

  return (
    <div 
      style={{
        width: '260px',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 20px',
        height: '100%',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Brand Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px' }}>
          <div style={{
            background: 'var(--gradient-violet)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '18px'
          }}>
            S
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            ScreenFlow <span style={{ color: 'var(--accent-secondary)' }}>AI</span>
          </span>
        </div>

        {/* Menu Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'var(--gradient-violet)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={18} style={{ color: isActive ? '#ffffff' : 'var(--text-muted)' }} />
                {item.name}
              </button>
            );
          })}
        </div>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Upgrade Premium Box */}
        {!isPro && (
          <div 
            style={{
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(255, 77, 126, 0.15) 100%)',
              border: '1px solid rgba(255, 77, 126, 0.15)',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={16} style={{ color: 'var(--accent-secondary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                Upgrade to Pro
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Unlock all AI features and advanced exports.
            </span>
            <button 
              onClick={() => setCurrentPage('settings')}
              className="btn-primary" 
              style={{ 
                background: 'var(--gradient-sunset)', 
                border: 'none', 
                borderRadius: '8px',
                padding: '8px 12px', 
                fontSize: '11px',
                width: '100%',
                fontWeight: 700,
                boxShadow: 'none'
              }}
            >
              Upgrade Now
            </button>
          </div>
        )}

        {/* Profile Details */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 8px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--gradient-sunset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
              color: '#fff'
            }}>
              AM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Alex Morgan</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isPro ? 'Pro Plan' : 'Free Trial Plan'}
              </span>
            </div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

      </div>
    </div>
  );
}

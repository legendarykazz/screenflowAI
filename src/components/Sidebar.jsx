import React, { useEffect, useState } from 'react';
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
  Users,
  MoreHorizontal,
  X
} from 'lucide-react';

export default function Sidebar({ currentPage, setCurrentPage, license }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuItems = [
    { id: 'dashboard', name: 'Home', shortName: 'Home', icon: Home },
    { id: 'recording', name: 'Record', shortName: 'Record', icon: Video },
    { id: 'projects', name: 'Projects', icon: FolderHeart },
    { id: 'exports', name: 'Exports', icon: Download },
    { id: 'brandkit', name: 'Brand Kit', icon: Palette },
    { id: 'aitools', name: 'AI Tools', icon: Sparkles },
    { id: 'livecall', name: 'Live Call', shortName: 'Call', icon: Users },
    { id: 'football', name: 'Football Lab', shortName: 'Football', icon: Trophy },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];
  const mobilePrimaryIds = ['dashboard', 'recording', 'livecall', 'football'];
  const mobileSecondaryItems = menuItems.filter((item) => !mobilePrimaryIds.includes(item.id));
  const mobileMoreActive = mobileSecondaryItems.some((item) => item.id === currentPage);

  const isPro = license?.plan === 'pro';

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPage]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const navigate = (page) => {
    setMobileMenuOpen(false);
    setCurrentPage(page);
  };

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="app-sidebar"
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
      <div className="sidebar-primary" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Brand Logo Header */}
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px' }}>
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
          <span className="sidebar-brand-text" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: 0 }}>
            ScreenFlow <span style={{ color: 'var(--accent-secondary)' }}>AI</span>
          </span>
        </div>

        {/* Menu Items */}
        <div className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`sidebar-nav-button ${mobilePrimaryIds.includes(item.id) ? 'mobile-primary' : 'mobile-secondary'}`}
                key={item.id}
                onClick={() => navigate(item.id)}
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
                <span className="sidebar-nav-label sidebar-nav-label-desktop">{item.name}</span>
                <span className="sidebar-nav-label sidebar-nav-label-mobile">{item.shortName || item.name}</span>
              </button>
            );
          })}
          <button
            aria-expanded={mobileMenuOpen}
            aria-label="More navigation"
            className="sidebar-nav-button mobile-more-button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              background: mobileMoreActive || mobileMenuOpen ? 'var(--gradient-violet)' : 'transparent',
              color: mobileMoreActive || mobileMenuOpen ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontWeight: mobileMoreActive || mobileMenuOpen ? 600 : 500,
              fontSize: '14px',
              textAlign: 'left'
            }}
          >
            <MoreHorizontal size={18} />
            <span className="sidebar-nav-label">More</span>
          </button>
        </div>

      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Upgrade Premium Box */}
        {!isPro && (
          <div 
            className="sidebar-upgrade"
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
            onClick={() => navigate('settings')}
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
        <div className="sidebar-profile" style={{
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
            <div className="sidebar-profile-copy" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Alex Morgan</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isPro ? 'Pro Plan' : 'Free Trial Plan'}
              </span>
            </div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </div>

      </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <section
            aria-label="More destinations"
            aria-modal="true"
            className="mobile-more-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mobile-more-header">
              <div>
                <strong>More</strong>
                <span>All ScreenFlow tools</span>
              </div>
              <button aria-label="Close more menu" onClick={() => setMobileMenuOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="mobile-more-grid">
              {mobileSecondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    className={isActive ? 'active' : ''}
                    key={item.id}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

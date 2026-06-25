import React, { useState, useRef, useEffect } from 'react';
import { 
  Palette, Plus, Type, Image, Layers, Video, 
  Upload, Check, Trash2, Edit3, Save, RefreshCw,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ChevronDown, Star
} from 'lucide-react';

export default function BrandKit() {
  const [activeTab, setActiveTab] = useState('logos');
  const [brandName, setBrandName] = useState('SaaS Studio');
  const [primaryColor, setPrimaryColor] = useState('#7C3AED');
  const [secondaryColor, setSecondaryColor] = useState('#FF4D7E');
  const [savedMsg, setSavedMsg] = useState('');
  
  const [logos, setLogos] = useState([
    { id: 'primary', label: 'Primary Logo', src: null },
    { id: 'white', label: 'White Logo', src: null },
  ]);
  
  const [watermarkText, setWatermarkText] = useState('@SaaSStudio');
  const [watermarkOpacity, setWatermarkOpacity] = useState(70);
  const [watermarkPosition, setWatermarkPosition] = useState('top-right');
  const [watermarkFont, setWatermarkFont] = useState('Inter');
  
  const [lowerThirdName, setLowerThirdName] = useState('Alex Morgan');
  const [lowerThirdTitle, setLowerThirdTitle] = useState('SaaS Founder & CEO');
  const [lowerThirdStyle, setLowerThirdStyle] = useState('modern');
  
  const [introStyle, setIntroStyle] = useState('fade');
  const [outroStyle, setOutroStyle] = useState('subscribe');
  const [outroText, setOutroText] = useState('Thanks for Watching!');

  const [presets, setPresets] = useState([
    { id: 'tech', name: 'TechCo Modern', primary: '#7C3AED', secondary: '#00E0FF', active: true },
    { id: 'creative', name: 'Creative Studio', primary: '#FF4D7E', secondary: '#FFB800', active: false },
    { id: 'corporate', name: 'Corporate Blue', primary: '#3B82F6', secondary: '#1A1F36', active: false },
    { id: 'nature', name: 'Nature Green', primary: '#00C48C', secondary: '#38f9d7', active: false },
  ]);

  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const tabs = [
    { id: 'logos', name: 'Logos & Assets', icon: Image },
    { id: 'watermarks', name: 'Watermarks', icon: Layers },
    { id: 'colors', name: 'Brand Colors', icon: Palette },
    { id: 'fonts', name: 'Typography', icon: Type },
    { id: 'lower_thirds', name: 'Lower Thirds', icon: AlignLeft },
    { id: 'intro_outro', name: 'Intro & Outro', icon: Video },
    { id: 'presets', name: 'Brand Presets', icon: Star },
  ];

  const brandColors = [
    '#FF4D7E', '#FFB800', '#00E0FF', '#7C3AED', '#00C48C', 
    '#3B82F6', '#1A1F36', '#232840', '#F8FAFF', '#FFFFFF'
  ];

  const handleLogoUpload = (logoId) => {
    setUploadingId(logoId);
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogos(prev => prev.map(l => l.id === uploadingId ? { ...l, src: ev.target.result } : l));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = (logoId) => {
    setLogos(prev => prev.map(l => l.id === logoId ? { ...l, src: null } : l));
  };

  const handleApplyPreset = (preset) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setPresets(prev => prev.map(p => ({ ...p, active: p.id === preset.id })));
    showSaved('Preset applied!');
  };

  const showSaved = (msg = 'Saved!') => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2500);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>Brand Kit</h1>
          <p style={{ color: '#5A607F', fontSize: '14px', marginTop: '4px' }}>
            Manage brand assets, colors, and video styling presets.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {savedMsg && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(0,196,140,0.1)', color: '#00C48C',
              border: '1px solid rgba(0,196,140,0.2)',
              borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: 600
            }}>
              <Check size={14} /> {savedMsg}
            </div>
          )}
          <button 
            onClick={() => showSaved()}
            style={{
              background: 'linear-gradient(135deg, #7C3AED 0%, #FF4D7E 100%)',
              border: 'none', borderRadius: '12px', color: '#fff',
              padding: '10px 20px', fontWeight: 700, fontSize: '13px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(124,58,237,0.3)'
            }}
          >
            <Save size={14} /> Save Brand Kit
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Tabs */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '12px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '11px 14px',
                  borderRadius: '12px', border: 'none',
                  background: isActive ? 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(255,77,126,0.08) 100%)' : 'transparent',
                  color: isActive ? '#7C3AED' : '#5A607F',
                  cursor: 'pointer', fontWeight: isActive ? 700 : 500,
                  fontSize: '13px', textAlign: 'left', transition: 'all 0.15s',
                  borderLeft: isActive ? '3px solid #7C3AED' : '3px solid transparent'
                }}
              >
                <Icon size={15} />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div style={{ background: '#FFF', borderRadius: '20px', padding: '32px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {activeTab === 'logos' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Logos & Assets</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Upload primary and secondary logos. PNG with transparency recommended.</p>
              </div>

              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {logos.map(logo => (
                  <div key={logo.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A1F36' }}>{logo.label}</span>
                    <div style={{
                      border: logo.src ? '2px solid #E2E8F0' : '2px dashed #E2E8F0',
                      borderRadius: '16px', width: '160px', height: '140px',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: '10px', cursor: 'pointer', 
                      background: logo.src ? '#F8FAFF' : '#FFF',
                      overflow: 'hidden', position: 'relative',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#7C3AED'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = logo.src ? '#E2E8F0' : '#E2E8F0'}
                    >
                      {logo.src ? (
                        <>
                          <img src={logo.src} alt={logo.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '16px' }} />
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                            display: 'flex', gap: '0'
                          }}>
                            <button onClick={() => handleLogoUpload(logo.id)} style={{
                              flex: 1, background: 'none', border: 'none', color: '#fff', 
                              padding: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                            }}>Replace</button>
                            <button onClick={() => handleRemoveLogo(logo.id)} style={{
                              flex: 1, background: 'none', border: 'none', color: '#f87171', 
                              padding: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                            }}>Remove</button>
                          </div>
                        </>
                      ) : (
                        <div onClick={() => handleLogoUpload(logo.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', height: '100%', justifyContent: 'center' }}>
                          <div style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Upload size={18} />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6' }}>Click to Upload</span>
                          <span style={{ fontSize: '10px', color: '#C1C8E4' }}>PNG • SVG • WebP</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add More Slot */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1A1F36' }}>Add More</span>
                  <div
                    onClick={() => {
                      const id = 'logo-' + Date.now();
                      setLogos(prev => [...prev, { id, label: 'Custom Logo', src: null }]);
                      setTimeout(() => { setUploadingId(id); fileInputRef.current.click(); }, 100);
                    }}
                    style={{
                      border: '2px dashed #E2E8F0', borderRadius: '16px',
                      width: '160px', height: '140px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: '8px', cursor: 'pointer', color: '#8A94A6', transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#8A94A6'; }}
                  >
                    <Plus size={24} />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Add Logo</span>
                  </div>
                </div>
              </div>

              {/* Brand Name */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '24px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1A1F36', display: 'block', marginBottom: '8px' }}>Brand Name (Used in Watermarks)</label>
                <input
                  type="text" value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  style={{ width: '320px', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', outline: 'none', color: '#1A1F36', fontFamily: 'var(--font-sans)' }}
                />
              </div>
            </>
          )}

          {activeTab === 'watermarks' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Watermarks</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Configure how your logo/text watermark appears on exports.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Watermark Text</label>
                    <input type="text" value={watermarkText} onChange={e => setWatermarkText(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Position</label>
                    <select value={watermarkPosition} onChange={e => setWatermarkPosition(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36', background: '#FFF' }}>
                      <option value="top-left">Top Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-right">Bottom Right</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Opacity: {watermarkOpacity}%</label>
                    <input type="range" min="10" max="100" value={watermarkOpacity} onChange={e => setWatermarkOpacity(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#7C3AED' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Font Style</label>
                    <select value={watermarkFont} onChange={e => setWatermarkFont(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36', background: '#FFF' }}>
                      <option>Inter</option>
                      <option>Outfit</option>
                      <option>Poppins</option>
                    </select>
                  </div>
                </div>

                {/* Watermark Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Live Preview</label>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '16px', height: '200px', position: 'relative',
                    overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: watermarkPosition.includes('top') ? '16px' : undefined,
                      bottom: watermarkPosition.includes('bottom') ? '16px' : undefined,
                      left: watermarkPosition.includes('left') ? '16px' : undefined,
                      right: watermarkPosition.includes('right') ? '16px' : undefined,
                      background: `rgba(0,0,0,${watermarkOpacity / 100 * 0.7})`,
                      backdropFilter: 'blur(8px)',
                      color: '#fff', padding: '6px 14px', borderRadius: '8px',
                      fontSize: '12px', fontWeight: 700, fontFamily: watermarkFont,
                      opacity: watermarkOpacity / 100
                    }}>
                      {watermarkText}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'colors' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Brand Colors</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Set your brand color palette for overlays, watermarks, and captions.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Primary Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      style={{ width: '52px', height: '52px', border: '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: '#1A1F36' }}>{primaryColor.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Secondary Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      style={{ width: '52px', height: '52px', border: '1px solid #E2E8F0', borderRadius: '12px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: '#1A1F36' }}>{secondaryColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '14px' }}>Color Library</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {brandColors.map(color => (
                    <div
                      key={color}
                      onClick={() => setPrimaryColor(color)}
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: color, border: primaryColor === color ? `3px solid #1A1F36` : '3px solid #FFF',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer',
                        transition: 'all 0.2s', transform: primaryColor === color ? 'scale(1.1)' : 'scale(1)'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Gradient Preview */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '10px' }}>Brand Gradient Preview</label>
                <div style={{
                  height: '60px', borderRadius: '16px',
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                  border: '1px solid rgba(0,0,0,0.04)'
                }} />
              </div>
            </>
          )}

          {activeTab === 'fonts' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Typography</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Set your brand's default fonts for captions and overlays.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { label: 'Display Font (Titles & Overlays)', fonts: ['Outfit', 'Montserrat', 'Poppins', 'Space Grotesk', 'Plus Jakarta Sans'] },
                  { label: 'Body Font (Captions & Subtitles)', fonts: ['Inter', 'Roboto', 'Manrope', 'DM Sans', 'Nunito'] },
                  { label: 'Monospace (Code Tutorials)', fonts: ['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Hack', 'Cascadia Code'] },
                ].map(group => (
                  <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>{group.label}</label>
                    <select style={{ padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '14px', background: '#FFF', outline: 'none', color: '#1A1F36' }}>
                      {group.fonts.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'lower_thirds' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Lower Thirds</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Configure animated lower third overlays for speaker introductions.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Speaker Name</label>
                    <input type="text" value={lowerThirdName} onChange={e => setLowerThirdName(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Speaker Title / Role</label>
                    <input type="text" value={lowerThirdTitle} onChange={e => setLowerThirdTitle(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Animation Style</label>
                    <select value={lowerThirdStyle} onChange={e => setLowerThirdStyle(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36', background: '#FFF' }}>
                      <option value="modern">Modern Slide-In</option>
                      <option value="minimal">Minimal Clean</option>
                      <option value="bold">Bold Accent Bar</option>
                      <option value="glass">Glassmorphism</option>
                    </select>
                  </div>
                </div>

                {/* Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Live Preview</label>
                  <div style={{
                    background: 'linear-gradient(135deg, #1A1F36 0%, #232840 100%)',
                    borderRadius: '16px', height: '200px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{
                      position: 'absolute', bottom: '24px', left: '20px',
                      background: lowerThirdStyle === 'glass' ? 'rgba(255,255,255,0.1)' : 'rgba(9,9,11,0.85)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px', padding: '12px 20px',
                      borderLeft: `4px solid ${primaryColor}`
                    }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>{lowerThirdName}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '3px' }}>{lowerThirdTitle}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'intro_outro' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Intro & Outro Animations</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Add animated opening and closing screens to your videos.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {/* Intro */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1F36' }}>Intro Animation</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['fade', 'zoom', 'slide', 'glitch'].map(style => (
                      <button key={style} onClick={() => setIntroStyle(style)}
                        style={{
                          padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                          background: introStyle === style ? `${primaryColor}15` : '#F8FAFF',
                          border: introStyle === style ? `2px solid ${primaryColor}` : '2px solid #F1F5F9',
                          color: introStyle === style ? primaryColor : '#5A607F',
                          fontWeight: 700, fontSize: '13px', textAlign: 'left',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{style} In</span>
                        {introStyle === style && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outro */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#1A1F36' }}>Outro Card</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['subscribe', 'cta', 'social', 'brand'].map(style => (
                      <button key={style} onClick={() => setOutroStyle(style)}
                        style={{
                          padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                          background: outroStyle === style ? `${primaryColor}15` : '#F8FAFF',
                          border: outroStyle === style ? `2px solid ${primaryColor}` : '2px solid #F1F5F9',
                          color: outroStyle === style ? primaryColor : '#5A607F',
                          fontWeight: 700, fontSize: '13px', textAlign: 'left',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{style === 'cta' ? 'Call-to-Action' : style + ' Card'}</span>
                        {outroStyle === style && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#8A94A6' }}>Outro Text</label>
                    <input type="text" value={outroText} onChange={e => setOutroText(e.target.value)}
                      style={{ padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#1A1F36' }} />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'presets' && (
            <>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Brand Presets</h3>
                <p style={{ color: '#8A94A6', fontSize: '13px' }}>Save and switch between different brand configurations instantly.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {presets.map(preset => (
                  <div key={preset.id} style={{
                    border: preset.active ? `2px solid ${preset.primary}` : '2px solid #F1F5F9',
                    borderRadius: '20px', padding: '20px',
                    background: preset.active ? `${preset.primary}08` : '#F8FAFF',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onClick={() => handleApplyPreset(preset)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1A1F36' }}>{preset.name}</span>
                      {preset.active && (
                        <span style={{ background: preset.primary, color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ height: '40px', borderRadius: '10px', background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.secondary} 100%)`, marginBottom: '14px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: preset.primary, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: preset.secondary, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                    </div>
                  </div>
                ))}

                {/* Add New Preset */}
                <div style={{
                  border: '2px dashed #E2E8F0', borderRadius: '20px', padding: '20px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', cursor: 'pointer', transition: 'all 0.2s', minHeight: '140px'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7C3AED'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                onClick={() => {
                  const id = 'custom-' + Date.now();
                  setPresets(prev => [...prev, { id, name: 'My Custom Brand', primary: primaryColor, secondary: secondaryColor, active: false }]);
                  showSaved('Preset saved!');
                }}
                >
                  <div style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#8A94A6' }}>Save Current as Preset</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

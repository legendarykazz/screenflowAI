import React, { useState, useEffect } from 'react';
import { 
  Download, CheckCircle, Clock, XCircle, FileVideo, 
  Settings, BarChart2, Play, Trash2, FolderOpen,
  RefreshCw, Filter, Search, Zap
} from 'lucide-react';

export default function Exports() {
  const [exportsList, setExportsList] = useState([]);
  const [activeTab, setActiveTab] = useState('All Exports');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenExportIds, setHiddenExportIds] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    loadExports();
  }, []);

  const loadExports = async () => {
    setIsRefreshing(true);
    if (window.electron?.getExports) {
      const list = await window.electron.getExports();
      setExportsList(list);
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const mockExports = [
    { id: 'exp-1', name: 'SaaS Product Walkthrough.mp4', resolution: '1080p', duration: '12:30', size: '245 MB', status: 'Completed', date: Date.now() - 3600000 * 2, format: 'MP4' },
    { id: 'exp-2', name: 'YouTube Tutorial Intro.mp4', resolution: '1080p', duration: '05:30', size: '108 MB', status: 'Completed', date: Date.now() - 3600000 * 26, format: 'MP4' },
    { id: 'exp-3', name: 'Design System Overview.mov', resolution: '1080p', duration: '12:15', size: '239 MB', status: 'Completed', date: Date.now() - 3600000 * 50, format: 'MOV' },
    { id: 'exp-4', name: 'Dashboard Demo.mp4', resolution: '1080p', duration: '09:10', size: '188 MB', status: 'Completed', date: Date.now() - 3600000 * 72, format: 'MP4' },
    { id: 'exp-5', name: 'Code Editor Tutorial.webm', resolution: '1080p', duration: '15:40', size: '320 MB', status: 'Processing', date: Date.now() - 1800000, format: 'WebM' },
    { id: 'exp-6', name: 'API Integration Demo.mp4', resolution: '4K', duration: '18:05', size: '1.2 GB', status: 'Failed', date: Date.now() - 86400000, format: 'MP4' },
  ];

  const displayExports = exportsList.length > 0 
    ? exportsList.map(e => ({
        id: e.id,
        name: e.export_path?.split(/[\\/]/).pop() || 'export.mp4',
        resolution: '1080p',
        duration: '—',
        size: '—',
        status: e.status === 'completed' ? 'Completed' : 'Processing',
        date: e.created_at || Date.now(),
        format: 'MP4'
      }))
    : mockExports;

  const visibleExports = displayExports.filter(exp => !hiddenExportIds.includes(exp.id));

  const filteredExports = visibleExports.filter(exp => {
    const matchesSearch = exp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All Exports' || 
      (activeTab === 'Completed' && exp.status === 'Completed') ||
      (activeTab === 'Processing' && exp.status === 'Processing') ||
      (activeTab === 'Failed' && exp.status === 'Failed');
    return matchesSearch && matchesTab;
  });

  const totalSize = visibleExports.filter(e => e.status === 'Completed').reduce((acc, e) => {
    const mb = parseFloat(e.size);
    return isNaN(mb) ? acc : acc + mb;
  }, 0);

  const stats = [
    { label: 'Total Exports', value: visibleExports.length, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
    { label: 'Completed', value: visibleExports.filter(e => e.status === 'Completed').length, color: '#00C48C', bg: 'rgba(0,196,140,0.08)' },
    { label: 'Processing', value: visibleExports.filter(e => e.status === 'Processing').length, color: '#FFB800', bg: 'rgba(255,184,0,0.08)' },
    { label: 'Total Size', value: `${(totalSize / 1000).toFixed(1)} GB`, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  ];

  const formatDate = (ts) => {
    const diff = Date.now() - ts;
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };

  const statusConfig = {
    Completed: { color: '#00C48C', bg: 'rgba(0,196,140,0.1)', icon: CheckCircle },
    Processing: { color: '#FFB800', bg: 'rgba(255,184,0,0.1)', icon: RefreshCw },
    Failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle },
  };

  const formatBadgeConfig = {
    MP4: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    MOV: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    WebM: { color: '#00C48C', bg: 'rgba(0,196,140,0.1)' },
  };

  const handleDownloadRecord = (exp) => {
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exp.name.replace(/\.[^.]+$/, '')}-export-record.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Export record prepared for ${exp.name}.`);
  };

  const handleRemoveExport = (exp) => {
    setHiddenExportIds(prev => [...prev, exp.id]);
    setStatusMessage(`${exp.name} removed from this view.`);
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
      gap: '24px',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 800 }}>Exports</h1>
          <p style={{ color: '#5A607F', fontSize: '14px', marginTop: '4px' }}>
            All rendered videos and export history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '11px', color: '#8A94A6' }} />
            <input 
              type="text" placeholder="Search exports..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 12px 10px 36px', fontSize: '13px', outline: 'none', color: '#1A1F36' }}
            />
          </div>
          <button 
            onClick={loadExports}
            style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#5A607F' }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button
            onClick={() => {
              setActiveTab('Processing');
              setStatusMessage('Showing export jobs that are still processing.');
            }}
            style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#5A607F' }}
          >
            <Settings size={14} /> Export Settings
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ background: '#EEF7FF', border: '1px solid #CBE4FF', borderRadius: '12px', color: '#2563EB', fontSize: '13px', fontWeight: 700, padding: '10px 14px' }}>
          {statusMessage}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.04)', borderRadius: '18px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ background: stat.bg, color: stat.color, width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1A1F36', fontFamily: 'var(--font-display)' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#8A94A6', fontWeight: 600 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '6px', borderRadius: '14px', width: 'fit-content', borderBottom: 'none' }}>
        {['All Exports', 'Completed', 'Processing', 'Failed'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px', borderRadius: '10px', border: 'none',
              background: activeTab === tab ? '#FFF' : 'transparent',
              color: activeTab === tab ? '#1A1F36' : '#8A94A6',
              fontWeight: activeTab === tab ? 700 : 500, fontSize: '13px',
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Exports Table */}
      <div style={{ background: '#FFF', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#FAFBFF' }}>
              {['FILE NAME', 'FORMAT', 'RESOLUTION', 'DURATION', 'SIZE', 'DATE', 'STATUS', ''].map((h, i) => (
                <th key={i} style={{ padding: '14px 16px', fontSize: '11px', color: '#8A94A6', fontWeight: 700, letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredExports.map((exp, idx) => {
              const statusCfg = statusConfig[exp.status] || statusConfig.Completed;
              const formatCfg = formatBadgeConfig[exp.format] || formatBadgeConfig.MP4;
              const StatusIcon = statusCfg.icon;
              return (
                <tr 
                  key={exp.id} 
                  style={{ borderBottom: idx !== filteredExports.length - 1 ? '1px solid #F8FAFF' : 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFBFF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileVideo size={16} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#1A1F36', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ background: formatCfg.bg, color: formatCfg.color, fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.3px' }}>{exp.format}</span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#5A607F', fontWeight: 600 }}>{exp.resolution}</td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#5A607F', fontWeight: 600 }}>{exp.duration}</td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#5A607F', fontWeight: 600 }}>{exp.size}</td>
                  <td style={{ padding: '16px', fontSize: '12px', color: '#8A94A6' }}>{formatDate(exp.date)}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: statusCfg.bg, color: statusCfg.color, fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' }}>
                      <StatusIcon size={10} style={exp.status === 'Processing' ? { animation: 'spin 1s linear infinite' } : {}} />
                      {exp.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {exp.status === 'Completed' && (
                        <button
                          onClick={() => handleDownloadRecord(exp)}
                          style={{ background: 'rgba(0,196,140,0.08)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#00C48C', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Download size={11} /> Download
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveExport(exp)}
                        style={{ background: 'rgba(239,68,68,0.06)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredExports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Download size={40} style={{ color: '#C1C8E4', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#1A1F36' }}>No exports found</p>
            <p style={{ fontSize: '13px', color: '#8A94A6', marginTop: '4px' }}>Exports will appear here once you render a project.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

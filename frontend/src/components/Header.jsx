import React from 'react';

export default function Header({ user, currentRole, onSelectRole, highContrast, onToggleContrast, socketConnected }) {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">Q</div>
        <div>
          <div className="brand-title">SMART CLINIC</div>
          <div className="brand-subtitle">Outpatient Queue & Predictive ETA System</div>
        </div>
      </div>

      <div className="nav-actions">
        <div className="socket-status" title={socketConnected ? 'Real-time WebSocket active' : 'Connecting to WebSocket...'}>
          <span className={`status-dot ${socketConnected ? '' : 'offline'}`}></span>
          <span>{socketConnected ? 'Live Updates' : 'Connecting...'}</span>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={onToggleContrast}
          style={{ padding: '6px 12px', fontSize: '13px' }}
        >
          {highContrast ? '☀️ Normal View' : '👁️ High Contrast'}
        </button>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="role-badge">{currentRole || user.role}</span>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.fullName}</span>
            <button className="btn btn-secondary" onClick={() => onSelectRole('')} style={{ padding: '6px 12px' }}>
              Switch Role
            </button>
          </div>
        ) : (
          <span className="role-badge">{currentRole || 'GUEST'}</span>
        )}
      </div>
    </header>
  );
}

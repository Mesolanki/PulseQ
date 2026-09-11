import React, { useState } from 'react';
import { loginUser } from '../services/api';

export default function Login({ onLoginSuccess, onSelectView }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(username, password);
      localStorage.setItem('token', data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = async (u, p) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    setError('');
    try {
      const data = await loginUser(u, p);
      localStorage.setItem('token', data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '60px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px', textAlign: 'center' }}>Smart Clinic Login</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center' }}>
          Select a demonstration role or log in with credentials
        </p>

        {error && (
          <div style={{ background: 'var(--coral-light)', color: 'var(--coral-danger)', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ margin: '24px 0 16px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
            Quick Role Presets
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => selectPreset('admin', 'admin123')}>
            🏢 Admin
          </button>
          <button className="btn btn-secondary" onClick={() => selectPreset('receptionist', 'reception123')}>
            📋 Receptionist
          </button>
          <button className="btn btn-secondary" onClick={() => selectPreset('drshah', 'doctor123')}>
            🩺 Dr. Shah
          </button>
          <button className="btn btn-secondary" onClick={() => selectPreset('drrao', 'doctor123')}>
            🩺 Dr. Rao
          </button>
        </div>

        <div style={{ margin: '20px 0 12px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
            Public & Client Displays
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => onSelectView('waiting-room')} style={{ fontSize: '12px' }}>
            📱 Patient View
          </button>
          <button className="btn btn-secondary" onClick={() => onSelectView('kiosk')} style={{ fontSize: '12px' }}>
            🖥️ Kiosk
          </button>
          <button className="btn btn-secondary" onClick={() => onSelectView('display')} style={{ fontSize: '12px' }}>
            📺 Lobby TV
          </button>
        </div>
      </div>
    </div>
  );
}

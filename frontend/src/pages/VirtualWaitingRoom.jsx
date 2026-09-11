import React, { useState, useEffect } from 'react';
import { fetchVirtualWaitingRoom, holdMySpot, resumeSpot } from '../services/api';

export default function VirtualWaitingRoom({ tokenParam }) {
  const [tokenInput, setTokenInput] = useState(tokenParam || 'ORTH-103');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTokenState = async (tok) => {
    if (!tok) return;
    setError('');
    try {
      const res = await fetchVirtualWaitingRoom(tok);
      setData(res);
    } catch (err) {
      setError(err.message || 'Token not found');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokenState(tokenInput);
    const interval = setInterval(() => loadTokenState(tokenInput), 4000);
    return () => clearInterval(interval);
  }, [tokenInput]);

  const handleHoldSpot = async () => {
    if (!data) return;
    try {
      await holdMySpot(data.queueEntryId, 10);
      loadTokenState(tokenInput);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResumeSpot = async () => {
    if (!data) return;
    try {
      await resumeSpot(data.queueEntryId);
      loadTokenState(tokenInput);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '520px', margin: '20px auto', padding: '0 16px' }}>
      {/* Token Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
        <label className="form-label" style={{ fontSize: '12px' }}>Enter Your Digital Token Number</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            className="form-input" 
            value={tokenInput} 
            onChange={e => setTokenInput(e.target.value)} 
            placeholder="e.g. ORTH-103"
          />
          <button className="btn btn-primary" onClick={() => loadTokenState(tokenInput)}>
            Track
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--coral-danger)', color: 'var(--coral-danger)', textAlign: 'center' }}>
          {error}. Please check your token ticket.
        </div>
      )}

      {data && (
        <div>
          {/* Main Hero Banner */}
          <div className="token-hero">
            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', opacity: '0.9' }}>
              {data.departmentName}
            </div>
            <div className="token-hero-number">{data.tokenNumber}</div>
            <div className="token-hero-sub">Welcome, {data.patientName}</div>
          </div>

          {/* Real-time Status Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className={`badge ${data.status === 'CALLED' ? 'badge-called' : data.status === 'IN_CONSULTATION' ? 'badge-consulting' : 'badge-waiting'}`} style={{ fontSize: '14px', padding: '6px 14px' }}>
                {data.status === 'CALLED' ? '📢 CALLED TO ROOM' : data.status === 'TEMPORARILY_ABSENT' ? '⏳ ON HOLD (GRACE PERIOD)' : data.status}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Doctor Status: <strong>{data.doctorStatus}</strong>
              </span>
            </div>

            <div className="grid-2" style={{ marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned Doctor</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{data.doctorName}</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Room {data.roomNumber} · Floor {data.floor}</div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Patients Ahead</div>
                <div style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)' }}>
                  {data.eta ? data.eta.patientsAhead : 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>in front of you</div>
              </div>
            </div>

            {/* Predictive ETA Window */}
            {data.eta && (
              <div style={{ background: 'var(--primary-teal-light)', border: '1px solid var(--primary-teal)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--primary-teal-deep)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Predictive ETA Window
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)', margin: '4px 0' }}>
                  Expected: {data.eta.lowerBound} – {data.eta.upperBound}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--primary-teal-deep)' }}>
                  Confidence Score: <strong>{Math.round(data.eta.confidence * 100)}%</strong> · Range widens dynamically with queue changes.
                </div>
              </div>
            )}

            {/* Hold My Spot Feature */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {data.status === 'TEMPORARILY_ABSENT' ? (
                <div>
                  <div style={{ background: 'var(--amber-light)', color: 'var(--amber-warning)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                    ⚠️ Your spot is temporarily held. Click below when you return to the waiting area.
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleResumeSpot}>
                    🔄 I Am Back — Resume My Spot
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Need to step away to the pharmacy or restroom? Click below to temporarily hold your spot.
                  </p>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleHoldSpot}>
                    ☕ HOLD MY SPOT (10 Min Grace Period)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

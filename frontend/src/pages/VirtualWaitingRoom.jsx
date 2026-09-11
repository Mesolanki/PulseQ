import React, { useState, useEffect } from 'react';
import { fetchVirtualWaitingRoom, holdMySpot, resumeSpot } from '../services/api';
import socket from '../services/socket';

export default function VirtualWaitingRoom({ tokenParam }) {
  const [tokenInput, setTokenInput] = useState(tokenParam || 'ORTH-103');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [roomChangeAlert, setRoomChangeAlert] = useState(null);
  const [doctorDelayAlert, setDoctorDelayAlert] = useState(null);

  const loadTokenState = async (tok) => {
    if (!tok) return;
    setError('');
    try {
      const res = await fetchVirtualWaitingRoom(tok);
      setData(res);

      if (res.doctorStatus === 'INPATIENT_EMERGENCY') {
        setDoctorDelayAlert('Doctor is currently responding to an inpatient clinical emergency. Your estimated waiting time has been updated.');
      } else {
        setDoctorDelayAlert(null);
      }
    } catch (err) {
      setError(err.message || 'Token not found');
      setData(null);
    }
  };

  useEffect(() => {
    loadTokenState(tokenInput);
    const interval = setInterval(() => loadTokenState(tokenInput), 3000);
    return () => clearInterval(interval);
  }, [tokenInput]);

  // Listen for WebSocket room change & queue update events
  useEffect(() => {
    socket.on('queue:updated', (payload) => {
      if (payload.action === 'ROOM_CHANGED') {
        setRoomChangeAlert(`ROOM CHANGED! Please proceed to ${payload.newRoom} (Floor ${payload.floor})`);
      }
      loadTokenState(tokenInput);
    });

    return () => {
      socket.off('queue:updated');
    };
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
    <div style={{ maxWidth: '540px', margin: '20px auto', padding: '0 16px' }}>
      {/* Token Tracker Input */}
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
            Track Live
          </button>
        </div>
      </div>

      {/* Prominent Room Change Alert Banner */}
      {roomChangeAlert && (
        <div style={{ background: 'var(--amber-light)', border: '2px solid var(--amber-warning)', color: 'var(--amber-warning)', padding: '16px', borderRadius: '12px', marginBottom: '16px', fontSize: '15px', fontWeight: '700', textAlign: 'center' }}>
          🚨 {roomChangeAlert}
        </div>
      )}

      {/* Doctor Delay Notification Banner */}
      {doctorDelayAlert && (
        <div style={{ background: 'var(--coral-light)', border: '1px solid var(--coral-danger)', color: 'var(--coral-danger)', padding: '14px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px', textAlign: 'center' }}>
          ⚠️ {doctorDelayAlert}
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--coral-danger)', color: 'var(--coral-danger)', textAlign: 'center' }}>
          {error}. Please check your printed token ticket.
        </div>
      )}

      {data && (
        <div>
          {/* Main Hero Header */}
          <div className="token-hero">
            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', opacity: '0.9' }}>
              SMART CLINIC · {data.departmentName}
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

            {/* Appointment Date & Time Info */}
            <div style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
              <div><strong>Appointment Date:</strong> {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div><strong>Scheduled Time:</strong> 10:30 AM</div>
            </div>

            <div className="grid-2" style={{ marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Assigned Doctor</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{data.doctorName}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary-teal)', marginTop: '4px' }}>
                  Room {data.roomNumber} · Floor {data.floor}
                </div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Patients Ahead</div>
                <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)' }}>
                  {data.eta ? data.eta.patientsAhead : 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ahead of you in queue</div>
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
                  Confidence Score: <strong>{Math.round(data.eta.confidence * 100)}%</strong> · Range widens dynamically with queue updates.
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
                    Need to step away to the pharmacy or restroom? Click below to hold your spot.
                  </p>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleHoldSpot}>
                    ☕ HOLD MY SPOT (10 Min Grace Period)
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
              Last Updated: {new Date().toLocaleTimeString()} · Real-time WebSocket Active
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

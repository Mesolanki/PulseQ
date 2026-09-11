import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Volume2, VolumeX, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_SERVER = 'http://localhost:5000';

export default function App() {
  const [queue, setQueue] = useState([]);
  const [currentlyCalled, setCurrentlyCalled] = useState(null);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [audioEnabled, setAudioEnabled] = useState(true);

  const socketRef = useRef(null);
  const lastCalledTokenRef = useRef(null);

  // Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSockets & Queue Sync
  useEffect(() => {
    fetchQueue();
    socketRef.current = io(SOCKET_SERVER);

    socketRef.current.on('queue:updated', () => {
      fetchQueue();
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/queue`);
      if (res.ok) {
        const data = await res.json();
        const activeQueue = data.queue || [];
        setQueue(activeQueue);

        // Find the most recently CALLED or IN_CONSULTATION token
        const current = activeQueue.find(q => q.status === 'CALLED' || q.status === 'IN_CONSULTATION');
        if (current) {
          setCurrentlyCalled(current);
          if (audioEnabled && current.status === 'CALLED' && lastCalledTokenRef.current !== current.token_number) {
            lastCalledTokenRef.current = current.token_number;
            announceToken(current);
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync display queue:', err);
    }
  };

  const announceToken = (item) => {
    if (!('speechSynthesis' in window)) return;
    const text = `Attention please. Token number ${item.token_number}, for patient ${item.patient_name || 'Patient'}, please proceed to ${item.room_name || 'Room 101'} for ${item.doctor_name || 'Doctor'}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const upcomingPatients = queue.filter(q => q.status === 'WAITING' || q.status === 'ON_HOLD').slice(0, 5);

  return (
    <div className="display-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="logo-section">
          <Activity size={40} color="#06b6d4" />
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>SMART CLINIC MAIN LOBBY</h1>
            <div style={{ color: '#475569', fontSize: '0.9rem' }}>Real-Time Digital Token & Waiting Room Board</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              border: '1px solid #cbd5e1',
              background: audioEnabled ? '#dcfce7' : '#fee2e2',
              color: audioEnabled ? '#15803d' : '#b91c1c',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            {audioEnabled ? 'Voice ON' : 'Muted'}
          </button>

          <div className="clock-section">{time}</div>
        </div>
      </div>

      {/* Main Board */}
      <div className="main-board">
        {/* Currently Called / In Room Hero Card */}
        <div className={`current-card ${currentlyCalled ? 'pulse' : ''}`}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                NOW SERVING / CALLED PATIENT
              </span>
              <span style={{ padding: '0.4rem 1rem', borderRadius: '30px', background: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: '0.9rem' }}>
                {currentlyCalled?.status || 'STANDBY'}
              </span>
            </div>

            <div className="token-hero">
              {currentlyCalled?.token_number || '--'}
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>PATIENT NAME</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                  {currentlyCalled?.patient_name || 'Standing By'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>PROCEED TO ROOM</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0284c7', marginTop: '0.2rem' }}>
                  {currentlyCalled?.room_name || 'Main Consultation Desk'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>ATTENDING DOCTOR</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  {currentlyCalled?.doctor_name || 'Duty Medical Officer'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>DEPARTMENT</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.2rem' }}>
                  {currentlyCalled?.department || 'Outpatient Clinic'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Upcoming Next Tokens */}
        <div className="upcoming-panel">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
            NEXT IN QUEUE ({upcomingPatients.length})
          </h2>

          {upcomingPatients.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0', fontSize: '0.9rem' }}>
              No upcoming patients waiting
            </div>
          ) : (
            upcomingPatients.map((item, idx) => (
              <div key={item.id} className="upcoming-row">
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7' }}>
                    {item.token_number}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                    {item.patient_name}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                    {item.room_name || 'Room 101'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.2rem', fontWeight: 700 }}>
                    Est: {item.estimated_start_time || '10:40 AM'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Ticker */}
      <div className="ticker-footer">
        <AlertTriangle size={24} color="#f59e0b" />
        <div style={{ flex: 1 }}>
          <strong>PUBLIC ANNOUNCEMENT:</strong> Please keep your digital ticket active on your phone. If your token is called, proceed directly to the designated room.
        </div>
      </div>
    </div>
  );
}

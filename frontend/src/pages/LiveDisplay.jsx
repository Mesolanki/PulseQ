import React, { useState, useEffect } from 'react';
import { fetchQueue } from '../services/api';

export default function LiveDisplay() {
  const [queueData, setQueueData] = useState(null);
  const [lastCalledToken, setLastCalledToken] = useState(null);

  const loadDisplayQueue = async () => {
    try {
      const q = await fetchQueue();
      setQueueData(q);

      // Check if a patient was recently called
      const called = q.queue.find(item => item.status === 'CALLED');
      if (called && called.token_number !== lastCalledToken) {
        setLastCalledToken(called.token_number);
        speakAnnouncement(`Token ${called.token_number}, please proceed to Room ${called.room_number || '204'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const speakAnnouncement = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    loadDisplayQueue();
    const interval = setInterval(loadDisplayQueue, 3000);
    return () => clearInterval(interval);
  }, [lastCalledToken]);

  if (!queueData) {
    return <div style={{ background: '#0f172a', color: 'white', minHeight: '100vh', padding: '60px', textAlign: 'center', fontSize: '28px' }}>Loading Lobby Display...</div>;
  }

  const calledList = queueData.queue.filter(q => q.status === 'CALLED');
  const inConsultList = queueData.queue.filter(q => q.status === 'IN_CONSULTATION');
  const waitingList = queueData.queue.filter(q => q.status === 'WAITING' || q.status === 'RESUMED');

  return (
    <div style={{ background: '#0f172a', color: 'white', minHeight: '100vh', padding: '32px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '20px', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '36px', color: '#14b8a6', fontFamily: 'var(--font-serif)' }}>SMART CLINIC — MAIN LOBBY DISPLAY</h1>
          <div style={{ fontSize: '18px', color: '#94a3b8' }}>Live Department Queue & Room Status</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'monospace', color: '#14b8a6' }}>
            {new Date().toLocaleTimeString()}
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ fontSize: '12px', padding: '4px 8px', marginTop: '4px' }}
            onClick={() => speakAnnouncement('Testing audio announcement system')}
          >
            🔊 Test Audio Announcement
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* CALLED NOW HERO BOX */}
        <div>
          <h2 style={{ fontSize: '24px', color: '#38bdf8', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            📢 CALLED TO ROOM NOW
          </h2>

          {calledList.length === 0 ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '20px' }}>
              No patients called at this moment
            </div>
          ) : (
            calledList.map(c => (
              <div key={c.id} style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '32px', borderRadius: '20px', marginBottom: '16px', boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.4)' }}>
                <div style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.9 }}>
                  PLEASE PROCEED TO
                </div>
                <div style={{ fontSize: '64px', fontWeight: '800', fontFamily: 'var(--font-serif)', margin: '8px 0' }}>
                  {c.token_number}
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700' }}>
                  ROOM {c.room_number || '204'} · FLOOR {c.floor || '2'}
                </div>
                <div style={{ fontSize: '18px', marginTop: '8px', opacity: 0.9 }}>
                  Physician: {c.doctor_name}
                </div>
              </div>
            ))
          )}

          {/* IN CONSULTATION SECTION */}
          <h2 style={{ fontSize: '20px', color: '#4ade80', margin: '32px 0 16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            🩺 CURRENTLY IN CONSULTATION
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {inConsultList.map(ic => (
              <div key={ic.id} style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px 20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#4ade80' }}>{ic.token_number}</div>
                <div style={{ fontSize: '14px', color: '#e2e8f0', marginTop: '2px' }}>Room {ic.room_number} ({ic.doctor_name})</div>
              </div>
            ))}
          </div>
        </div>

        {/* UPCOMING WAITING QUEUE */}
        <div>
          <h2 style={{ fontSize: '24px', color: '#14b8a6', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            ⏳ UPCOMING QUEUE
          </h2>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '18px' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '16px 20px', color: '#94a3b8' }}>TOKEN</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8' }}>DEPARTMENT</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8' }}>ESTIMATED START</th>
                </tr>
              </thead>
              <tbody>
                {waitingList.slice(0, 8).map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '16px 20px', fontWeight: '800', color: '#14b8a6', fontSize: '22px' }}>{w.token_number}</td>
                    <td style={{ padding: '16px 20px', color: '#e2e8f0' }}>{w.department_name}</td>
                    <td style={{ padding: '16px 20px', color: '#cbd5e1' }}>{w.eta ? w.eta.expectedStart : 'Calculating...'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

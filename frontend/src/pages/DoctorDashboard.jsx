import React, { useState, useEffect } from 'react';
import { fetchQueue, fetchDoctors, callNextPatient, startConsultation, completeConsultation, updateDoctorStatus, fetchIntakeForm } from '../services/api';

export default function DoctorDashboard({ user }) {
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [queueData, setQueueData] = useState(null);
  const [activeIntake, setActiveIntake] = useState(null);
  const [consultTimerSeconds, setConsultTimerSeconds] = useState(0);
  const [consultNotes, setConsultNotes] = useState('');

  // Find doctor ID for user
  useEffect(() => {
    fetchDoctors().then(docs => {
      setDoctors(docs);
      if (docs.length > 0) {
        const found = docs.find(d => d.user_id === (user ? user.id : 'u-drshah') || d.full_name.includes(user ? user.fullName : 'Shah'));
        setDoctorId(found ? found.id : docs[0].id);
      }
    });
  }, [user]);

  const loadDoctorQueue = async () => {
    if (!doctorId) return;
    try {
      const q = await fetchQueue('', doctorId);
      setQueueData(q);

      // Check if current patient in consult has intake form
      const inConsult = q.queue.find(item => item.status === 'IN_CONSULTATION');
      if (inConsult) {
        fetchIntakeForm(inConsult.id).then(form => setActiveIntake(form)).catch(() => setActiveIntake(null));
      } else {
        setActiveIntake(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDoctorQueue();
    const interval = setInterval(loadDoctorQueue, 3000);
    return () => clearInterval(interval);
  }, [doctorId]);

  // Consultation timer
  useEffect(() => {
    const inConsult = queueData && queueData.queue.find(item => item.status === 'IN_CONSULTATION');
    let timer;
    if (inConsult && inConsult.consult_started_at) {
      const startMs = new Date(inConsult.consult_started_at).getTime();
      timer = setInterval(() => {
        setConsultTimerSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      }, 1000);
    } else {
      setConsultTimerSeconds(0);
    }
    return () => clearInterval(timer);
  }, [queueData]);

  const handleCallNext = async () => {
    try {
      await callNextPatient(doctorId);
      loadDoctorQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartConsultation = async (entry) => {
    try {
      await startConsultation(entry.id);
      loadDoctorQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteConsultation = async (entry) => {
    try {
      await completeConsultation(entry.id, consultNotes);
      setConsultNotes('');
      loadDoctorQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await updateDoctorStatus(doctorId, status);
      loadDoctorQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!queueData) return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Doctor Consultation Station...</div>;

  const currentDoc = doctors.find(d => d.id === doctorId) || {};
  const currentConsulting = queueData.queue.find(q => q.status === 'IN_CONSULTATION');
  const calledPatient = queueData.queue.find(q => q.status === 'CALLED');
  const waitingQueue = queueData.queue.filter(q => q.status === 'WAITING' || q.status === 'RESUMED');

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Doctor Consultation Console</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {currentDoc.full_name} ({currentDoc.department_name} — Room {currentDoc.room_number})
          </p>
        </div>

        {/* Doctor Status Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Status:</span>
          <select 
            className="form-select" 
            value={currentDoc.current_status || 'AVAILABLE'} 
            onChange={e => handleStatusChange(e.target.value)}
            style={{ width: 'auto', fontWeight: '600' }}
          >
            <option value="AVAILABLE">🟢 AVAILABLE</option>
            <option value="CONSULTING">🔵 CONSULTING</option>
            <option value="DOCUMENTING">📝 DOCUMENTING</option>
            <option value="BREAK">☕ ON BREAK</option>
            <option value="INPATIENT_EMERGENCY">🚨 INPATIENT EMERGENCY</option>
            <option value="UNAVAILABLE">🔴 UNAVAILABLE</option>
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Active Consultation Card */}
        <div className="card" style={{ borderTop: '4px solid var(--primary-teal)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Active Consultation Station</h3>

          {currentConsulting ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span className="badge badge-consulting">IN CONSULTATION</span>
                  <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)', marginTop: '4px' }}>
                    {currentConsulting.token_number}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600' }}>{currentConsulting.patient_name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentConsulting.visit_type} · Phone: {currentConsulting.patient_phone}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consult Timer</div>
                  <div style={{ fontSize: '32px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary-teal-deep)' }}>
                    {formatTimer(consultTimerSeconds)}
                  </div>
                </div>
              </div>

              {/* Digital Intake Preview */}
              {activeIntake ? (
                <div style={{ background: 'var(--bg-main)', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px', color: 'var(--primary-teal-deep)' }}>📋 Digital Pre-Consultation Intake:</div>
                  <div><strong>Reason:</strong> {activeIntake.reason_for_visit}</div>
                  <div><strong>Symptoms:</strong> {activeIntake.symptoms}</div>
                  <div><strong>Medications:</strong> {activeIntake.current_medications}</div>
                  <div><strong>Allergies:</strong> <span style={{ color: 'var(--coral-danger)', fontWeight: '600' }}>{activeIntake.allergies}</span></div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-main)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Intake summary: Standard appointment checkup.
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Consultation & Prescription Notes</label>
                <textarea 
                  className="form-textarea" 
                  rows="3" 
                  placeholder="Enter diagnosis, clinical notes, or prescription..."
                  value={consultNotes}
                  onChange={e => setConsultNotes(e.target.value)}
                ></textarea>
              </div>

              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleCompleteConsultation(currentConsulting)}>
                ✅ Complete Consultation & Advance Queue
              </button>
            </div>
          ) : calledPatient ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <span className="badge badge-called" style={{ fontSize: '14px', padding: '6px 14px' }}>PATIENT CALLED</span>
              <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--accent-blue)', margin: '10px 0' }}>
                {calledPatient.token_number}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>{calledPatient.patient_name}</div>
              <button className="btn btn-primary btn-lg" onClick={() => handleStartConsultation(calledPatient)}>
                ▶️ Patient Arrived — Start Consultation
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px' }}>No active consultation in progress</div>
              <button className="btn btn-primary btn-lg" onClick={handleCallNext} disabled={waitingQueue.length === 0}>
                📢 Call Next Patient
              </button>
            </div>
          )}
        </div>

        {/* Doctor Queue View */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px' }}>Waiting Patients ({waitingQueue.length})</h3>
            <button className="btn btn-secondary" onClick={handleCallNext} disabled={waitingQueue.length === 0 || !!currentConsulting || !!calledPatient}>
              Call Next
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Visit Type</th>
                  <th>ETA</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {waitingQueue.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No patients waiting in queue</td></tr>
                ) : (
                  waitingQueue.map(q => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                      <td>{q.patient_name}</td>
                      <td><span className={`badge badge-${q.priority_level === 1 ? 'emergency' : 'routine'}`}>{q.visit_type}</span></td>
                      <td style={{ fontSize: '12px' }}>{q.eta ? q.eta.expectedStart : '—'}</td>
                      <td>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleStartConsultation(q)}>
                          Call Now
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

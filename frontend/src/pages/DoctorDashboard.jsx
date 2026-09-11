import React, { useState, useEffect } from 'react';
import { 
  fetchQueue, fetchDoctors, callNextPatient, startConsultation, completeConsultation, updateDoctorStatus, 
  fetchIntakeForm, savePrescription, fetchPatientHistory 
} from '../services/api';

export default function DoctorDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('consultation');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [queueData, setQueueData] = useState(null);
  const [activeIntake, setActiveIntake] = useState(null);
  const [patientHistoryList, setPatientHistoryList] = useState([]);
  const [consultTimerSeconds, setConsultTimerSeconds] = useState(0);

  // Clinical Consultation Form state
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('2026-09-25');
  
  // Prescription Writer state
  const [prescriptions, setPrescriptions] = useState([
    { medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Twice Daily', duration: '5 Days', instructions: 'After meals' },
    { medicineName: 'Ibuprofen 400mg', dosage: '1 tab', frequency: 'As Needed', duration: '3 Days', instructions: 'Take with food' }
  ]);

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

      const inConsult = q.queue.find(item => item.status === 'IN_CONSULTATION');
      if (inConsult) {
        fetchIntakeForm(inConsult.id).then(form => setActiveIntake(form)).catch(() => setActiveIntake(null));
        fetchPatientHistory(inConsult.patient_id).then(hist => setPatientHistoryList(hist)).catch(() => setPatientHistoryList([]));
      } else {
        setActiveIntake(null);
        setPatientHistoryList([]);
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
      // 1. Save prescription if medicines added
      if (prescriptions.length > 0) {
        await savePrescription({
          consultationId: 'cons-' + entry.id,
          patientId: entry.patient_id,
          doctorId: doctorId,
          medicines: prescriptions
        });
      }

      // 2. Complete consultation
      await completeConsultation(entry.id, `${diagnosis ? 'Diagnosis: ' + diagnosis + '. ' : ''}${clinicalNotes}`);
      setDiagnosis('');
      setClinicalNotes('');
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

  const addPrescriptionRow = () => {
    setPrescriptions([...prescriptions, { medicineName: '', dosage: '1 tab', frequency: 'Twice Daily', duration: '5 Days', instructions: 'After meals' }]);
  };

  if (!queueData) return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Doctor Console...</div>;

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
      {/* Top Console Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Doctor Consultation Console</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {currentDoc.full_name} ({currentDoc.department_name} — Room {currentDoc.room_number})
          </p>
        </div>

        {/* Doctor Status Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>Doctor Status:</span>
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

      {/* Sub Navigation Toolbar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px' }}>
        <button className={`btn ${activeTab === 'consultation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('consultation')}>Active Consultation</button>
        <button className={`btn ${activeTab === 'intake' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('intake')}>Digital Intake</button>
        <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('history')}>Patient History</button>
        <button className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('queue')}>Waiting Queue ({waitingQueue.length})</button>
      </div>

      {/* ACTIVE CONSULTATION TAB */}
      {activeTab === 'consultation' && (
        <div className="grid-2">
          {/* Consultation Station */}
          <div className="card" style={{ borderTop: '4px solid var(--primary-teal)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Clinical Consultation Station</h3>

            {currentConsulting ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="badge badge-consulting">IN CONSULTATION</span>
                    <div style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)' }}>
                      {currentConsulting.token_number}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{currentConsulting.patient_name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentConsulting.visit_type}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consultation Timer</div>
                    <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary-teal-deep)' }}>
                      {formatTimer(consultTimerSeconds)}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Diagnosis</label>
                  <input type="text" className="form-input" placeholder="e.g. Lumbar Spondylosis / Sprain" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Clinical Notes</label>
                  <textarea className="form-textarea" rows="3" placeholder="Enter clinical observations, progress, and physical exam..." value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)}></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-Up Date</label>
                  <input type="date" className="form-input" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                </div>

                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '12px' }} onClick={() => handleCompleteConsultation(currentConsulting)}>
                  ✅ Complete Consultation & Advance Queue
                </button>
              </div>
            ) : calledPatient ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <span className="badge badge-called" style={{ fontSize: '14px', padding: '6px 14px' }}>PATIENT CALLED</span>
                <div style={{ fontSize: '42px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--accent-blue)', margin: '10px 0' }}>
                  {calledPatient.token_number}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>{calledPatient.patient_name}</div>
                <button className="btn btn-primary btn-lg" onClick={() => handleStartConsultation(calledPatient)}>
                  ▶️ Patient Arrived — Start Consultation
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '16px' }}>No active consultation in progress</div>
                <button className="btn btn-primary btn-lg" onClick={handleCallNext} disabled={waitingQueue.length === 0}>
                  📢 Call Next Patient
                </button>
              </div>
            )}
          </div>

          {/* Prescription Writer */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '18px' }}>Rx Prescription Writer</h3>
              <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={addPrescriptionRow}>+ Add Medicine</button>
            </div>

            {prescriptions.map((rx, idx) => (
              <div key={idx} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
                <div className="grid-2" style={{ marginBottom: '8px' }}>
                  <input type="text" className="form-input" placeholder="Medicine Name (e.g. Paracetamol 500mg)" value={rx.medicineName} onChange={e => {
                    const updated = [...prescriptions];
                    updated[idx].medicineName = e.target.value;
                    setPrescriptions(updated);
                  }} />
                  <input type="text" className="form-input" placeholder="Dosage (e.g. 1 tab)" value={rx.dosage} onChange={e => {
                    const updated = [...prescriptions];
                    updated[idx].dosage = e.target.value;
                    setPrescriptions(updated);
                  }} />
                </div>

                <div className="grid-2">
                  <input type="text" className="form-input" placeholder="Frequency (e.g. Twice Daily)" value={rx.frequency} onChange={e => {
                    const updated = [...prescriptions];
                    updated[idx].frequency = e.target.value;
                    setPrescriptions(updated);
                  }} />
                  <input type="text" className="form-input" placeholder="Duration (e.g. 5 Days)" value={rx.duration} onChange={e => {
                    const updated = [...prescriptions];
                    updated[idx].duration = e.target.value;
                    setPrescriptions(updated);
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DIGITAL INTAKE TAB */}
      {activeTab === 'intake' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Digital Pre-Consultation Intake Form</h3>
          {activeIntake ? (
            <div>
              <div><strong>Reason for Visit:</strong> {activeIntake.reason_for_visit}</div>
              <div style={{ marginTop: '8px' }}><strong>Symptoms:</strong> {activeIntake.symptoms}</div>
              <div style={{ marginTop: '8px' }}><strong>Current Medications:</strong> {activeIntake.current_medications}</div>
              <div style={{ marginTop: '8px' }}><strong>Allergies:</strong> <span style={{ color: 'var(--coral-danger)', fontWeight: '600' }}>{activeIntake.allergies}</span></div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No pre-consultation intake form available for current patient.</div>
          )}
        </div>
      )}

      {/* PATIENT HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Patient Clinical History</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit Date</th>
                  <th>Physician</th>
                  <th>Department</th>
                  <th>Diagnosis</th>
                  <th>Clinical Notes</th>
                </tr>
              </thead>
              <tbody>
                {patientHistoryList.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No previous visit history records found.</td></tr>
                ) : (
                  patientHistoryList.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: '600' }}>{h.visit_date}</td>
                      <td>{h.doctor_name}</td>
                      <td>{h.department_name}</td>
                      <td style={{ fontWeight: '600', color: 'var(--primary-teal-deep)' }}>{h.diagnosis}</td>
                      <td>{h.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUEUE TAB */}
      {activeTab === 'queue' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Waiting Queue List</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Visit Type</th>
                  <th>ETA Start</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {waitingQueue.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                    <td>{q.patient_name}</td>
                    <td><span className="badge badge-routine">{q.visit_type}</span></td>
                    <td>{q.eta ? q.eta.expectedStart : '—'}</td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleStartConsultation(q)}>
                        Call Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

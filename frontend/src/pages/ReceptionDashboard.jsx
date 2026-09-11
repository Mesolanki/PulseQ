import React, { useState, useEffect } from 'react';
import { fetchQueue, fetchDoctors, fetchPatients, checkInPatient, insertEmergency, registerPatient } from '../services/api';

export default function ReceptionDashboard() {
  const [queueData, setQueueData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  // Form states
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [visitType, setVisitType] = useState('ROUTINE');
  const [emergencyReason, setEmergencyReason] = useState('Acute Severe Trauma');

  // New patient registration form state
  const [newPatient, setNewPatient] = useState({
    fullName: '', phone: '', gender: 'Female', age: 30, preferredLanguage: 'English'
  });

  const loadData = async () => {
    try {
      const q = await fetchQueue();
      const docs = await fetchDoctors();
      const pts = await fetchPatients().catch(() => []);
      setQueueData(q);
      setDoctors(docs);
      setPatients(pts);
      if (docs.length > 0 && !selectedDoctorId) setSelectedDoctorId(docs[0].id);
      if (pts.length > 0 && !selectedPatientId) setSelectedPatientId(pts[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    try {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      const deptId = doc ? doc.department_id : 'dept-ortho';
      await checkInPatient({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        departmentId: deptId,
        visitType
      });
      setShowCheckInModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEmergencySubmit = async (e) => {
    e.preventDefault();
    try {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      const deptId = doc ? doc.department_id : 'dept-ortho';
      await insertEmergency({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        departmentId: deptId,
        reason: emergencyReason
      });
      setShowEmergencyModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreatePatientSubmit = async (e) => {
    e.preventDefault();
    try {
      const created = await registerPatient(newPatient);
      setPatients([created, ...patients]);
      setSelectedPatientId(created.id);
      setShowNewPatientModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!queueData) return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Reception Desk...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Reception & Check-In Desk</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Patient token generation, queue entry, and priority management</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowNewPatientModal(true)}>
            👤 + Register Patient
          </button>
          <button className="btn btn-primary" onClick={() => setShowCheckInModal(true)}>
            🎫 + Issue Token / Check-In
          </button>
          <button className="btn btn-danger" onClick={() => setShowEmergencyModal(true)}>
            🚨 Emergency Preemption
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card">
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Live Outpatient Department Queue</h3>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient Name</th>
                <th>Doctor</th>
                <th>Visit Type</th>
                <th>Priority</th>
                <th>Expected ETA</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queueData.queue.map(q => (
                <tr key={q.id}>
                  <td style={{ fontWeight: '700', fontSize: '16px', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                  <td style={{ fontWeight: '500' }}>{q.patient_name}</td>
                  <td>{q.doctor_name || '—'} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Rm {q.room_number})</span></td>
                  <td><span className={`badge badge-${q.priority_level === 1 ? 'emergency' : q.priority_level === 2 ? 'urgent' : 'routine'}`}>{q.visit_type}</span></td>
                  <td>{q.priority_level === 1 ? '🔥 Priority 1' : 'Priority 3'}</td>
                  <td>{q.eta ? `${q.eta.lowerBound} – ${q.eta.upperBound}` : 'Calculating...'}</td>
                  <td>{q.eta ? `${Math.round(q.eta.confidence * 100)}%` : '—'}</td>
                  <td>
                    <span className={`badge ${q.status === 'CALLED' ? 'badge-called' : q.status === 'IN_CONSULTATION' ? 'badge-consulting' : 'badge-waiting'}`}>
                      {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check-In Modal */}
      {showCheckInModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ marginBottom: '16px' }}>Check-In & Issue Token</h3>
            <form onSubmit={handleCheckInSubmit}>
              <div className="form-group">
                <label className="form-label">Select Patient</label>
                <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id_code}) - {p.phone}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.department_name} - Rm {d.room_number})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Visit Type</label>
                <select className="form-select" value={visitType} onChange={e => setVisitType(e.target.value)}>
                  <option value="ROUTINE">Routine Consultation (15m)</option>
                  <option value="FIRST_VISIT">First Visit (18m-30m)</option>
                  <option value="FOLLOW_UP">Follow-Up Checkup (8m-15m)</option>
                  <option value="DIAGNOSTIC_REVIEW">MRI / Scan Review (25m-40m)</option>
                  <option value="REFILL">Prescription Refill (4m-10m)</option>
                  <option value="POST_OP">Post-Operative Review (12m-24m)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Token & Check In</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {showEmergencyModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ borderColor: 'var(--coral-danger)' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--coral-danger)' }}>🚨 Clinical Emergency Preemption</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Inserting an emergency patient will immediately reorder the top of the queue and recalculate all downstream patient ETAs.
            </p>
            <form onSubmit={handleEmergencySubmit}>
              <div className="form-group">
                <label className="form-label">Emergency Patient</label>
                <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id_code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} (Rm {d.room_number})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Reason</label>
                <input type="text" className="form-input" value={emergencyReason} onChange={e => setEmergencyReason(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEmergencyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Execute Emergency Preemption</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Patient Registration Modal */}
      {showNewPatientModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ marginBottom: '16px' }}>Register New Patient</h3>
            <form onSubmit={handleCreatePatientSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={newPatient.fullName} onChange={e => setNewPatient({ ...newPatient, fullName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="text" className="form-input" value={newPatient.phone} onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewPatientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './index.css';

const socket = io('http://localhost:5000');

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queueData, setQueueData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  // Forms & Modal state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showAptModal, setShowAptModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  // Patient Input Mode: 'NEW' (Direct Form Input) or 'EXISTING' (Dropdown Select)
  const [patientMode, setPatientMode] = useState('NEW');

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('204');
  const [visitType, setVisitType] = useState('ROUTINE');
  const [emergencyReason, setEmergencyReason] = useState('Acute Chest Pain');

  // Direct Patient Input Form state
  const [patientForm, setPatientForm] = useState({
    fullName: '',
    phone: '',
    age: 35,
    gender: 'Male',
    address: '123 Main Street',
    accessibilityRequirements: 'None'
  });

  // Hourly Slot Capacity State
  const [slotData, setSlotData] = useState(null);

  const [newApt, setNewApt] = useState({
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: '10:00 AM - 11:00 AM',
    reasonForVisit: 'Orthopedic Consultation & Evaluation'
  });

  const loadData = async () => {
    try {
      const qRes = await fetch('http://localhost:5000/api/queue').then(r => r.json());
      const dRes = await fetch('http://localhost:5000/api/doctors').then(r => r.json());
      const pRes = await fetch('http://localhost:5000/api/patients').then(r => r.json()).catch(() => []);
      const aRes = await fetch('http://localhost:5000/api/appointments').then(r => r.json()).catch(() => []);
      const rRes = await fetch('http://localhost:5000/api/rooms').then(r => r.json()).catch(() => []);

      setQueueData(qRes);
      setDoctors(dRes);
      setPatients(pRes);
      setAppointments(aRes);
      setRooms(rRes);

      if (dRes.length > 0 && !selectedDoctorId) setSelectedDoctorId(dRes[0].id);
      if (pRes.length > 0 && !selectedPatientId) setSelectedPatientId(pRes[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHourlySlots = async (docId, dateStr) => {
    try {
      const res = await fetch(`http://localhost:5000/api/appointments/slots?doctorId=${docId || selectedDoctorId}&date=${dateStr || newApt.appointmentDate}`).then(r => r.json());
      setSlotData(res);
      if (res.recommendedSlot) {
        setNewApt(prev => ({ ...prev, appointmentTime: res.recommendedSlot }));
      }
    } catch (e) {
      console.error('Failed to fetch hourly slots:', e);
    }
  };

  useEffect(() => {
    loadData();
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('queue:updated', () => loadData());
    return () => {
      socket.off('queue:updated');
    };
  }, []);

  useEffect(() => {
    if (showAptModal) {
      fetchHourlySlots(selectedDoctorId, newApt.appointmentDate);
    }
  }, [showAptModal, selectedDoctorId, newApt.appointmentDate]);

  // Helper: Get or Register Patient ID
  const getOrRegisterPatientId = async () => {
    if (patientMode === 'EXISTING' && selectedPatientId) {
      return selectedPatientId;
    }

    if (!patientForm.fullName || !patientForm.phone) {
      alert('Please enter Patient Full Name and Phone Number');
      return null;
    }

    // Register new patient directly
    const res = await fetch('http://localhost:5000/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: patientForm.fullName,
        phone: patientForm.phone,
        age: parseInt(patientForm.age) || 30,
        gender: patientForm.gender,
        address: patientForm.address,
        accessibilityRequirements: patientForm.accessibilityRequirements
      })
    });

    if (!res.ok) {
      alert('Failed to register new patient. Please check details.');
      return null;
    }

    const createdPatient = await res.json();
    await loadData();
    return createdPatient.id;
  };

  const handleRegisterPatientOnly = async (e) => {
    e.preventDefault();
    const targetPatientId = await getOrRegisterPatientId();
    if (targetPatientId) {
      alert(`✅ Patient Registered Successfully!\nName: ${patientForm.fullName}\nPhone: ${patientForm.phone}`);
      setShowPatientModal(false);
      setPatientForm({ fullName: '', phone: '', age: 35, gender: 'Male', address: '', accessibilityRequirements: 'None' });
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    const patientId = await getOrRegisterPatientId();
    if (!patientId) return;

    const doc = doctors.find(d => d.id === selectedDoctorId);
    await fetch('http://localhost:5000/api/queue/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        doctorId: selectedDoctorId,
        departmentId: doc ? doc.department_id : 'dept-ortho',
        visitType
      })
    });

    alert('🎫 Queue Token Generated Successfully!');
    setShowCheckInModal(false);
    loadData();
  };

  const handleEmergency = async (e) => {
    e.preventDefault();
    const patientId = await getOrRegisterPatientId();
    if (!patientId) return;

    const doc = doctors.find(d => d.id === selectedDoctorId);
    await fetch('http://localhost:5000/api/queue/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        doctorId: selectedDoctorId,
        departmentId: doc ? doc.department_id : 'dept-ortho',
        reason: emergencyReason
      })
    });

    alert('🚨 Emergency Preemption Token Issued!');
    setShowEmergencyModal(false);
    loadData();
  };

  const handleBookApt = async (e) => {
    e.preventDefault();
    const patientId = await getOrRegisterPatientId();
    if (!patientId) return;

    const doc = doctors.find(d => d.id === selectedDoctorId);
    const res = await fetch('http://localhost:5000/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        doctorId: selectedDoctorId,
        departmentId: doc ? doc.department_id : 'dept-ortho',
        appointmentDate: newApt.appointmentDate,
        appointmentTime: newApt.appointmentTime,
        visitType,
        reasonForVisit: newApt.reasonForVisit
      })
    });
    const created = await res.json();

    if (created.autoReallocated) {
      alert(`⚠️ Selected slot was FULL (12/12 capacity reached). Patient was automatically allocated to the next available hourly slot: ${created.allocatedTime}`);
    } else {
      alert(`✅ Appointment Successfully Booked!\nSlot: ${created.appointment_time}\nConfirmation ID: ${created.id}`);
    }

    setShowAptModal(false);
    loadData();
  };

  const handleReallocateLate = async (queueEntryId, tokenNumber) => {
    if (!confirm(`Mark patient for token ${tokenNumber} as LATE?\n\nThis will automatically push their slot +30 mins downstream and promote the next waiting patient immediately.`)) return;

    try {
      const res = await fetch(`http://localhost:5000/api/queue/${queueEntryId}/reallocate-late`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        alert(`⏰ Patient ${tokenNumber} reallocated to buffer slot. Next patient in line promoted.`);
        loadData();
      }
    } catch (e) {
      alert('Error reallocating late patient');
    }
  };

  const handleAssignRoom = async (e) => {
    e.preventDefault();
    const doc = doctors.find(d => d.id === selectedDoctorId);
    await fetch('http://localhost:5000/api/rooms/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: selectedDoctorId, roomNumber: selectedRoomNumber, floor: doc ? doc.floor : '2' })
    });
    alert(`Room ${selectedRoomNumber} assigned! Room change alert sent to patients.`);
    setShowRoomModal(false);
    loadData();
  };

  if (!queueData) return <div className="card" style={{ margin: '40px', textAlign: 'center' }}>Loading Reception Portal...</div>;

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">📋</div>
          <div>
            <div className="brand-title">RECEPTION PORTAL</div>
            <div className="brand-subtitle">Smart Clinic Front Desk & Direct Patient Entry</div>
          </div>
        </div>
        <div className="nav-actions">
          <span className="role-badge">RECEPTIONIST</span>
          <span className={`status-dot ${socketConnected ? '' : 'offline'}`}></span>
          <span style={{ fontSize: '12px' }}>{socketConnected ? 'Live Real-Time' : 'Connecting...'}</span>
        </div>
      </header>

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Front Desk Operations</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-danger" onClick={() => setShowEmergencyModal(true)}>🚨 + EMERGENCY CASE</button>
            <button className="btn btn-primary" onClick={() => setShowCheckInModal(true)}>🎫 + ISSUE TOKEN</button>
            <button className="btn btn-secondary" onClick={() => setShowAptModal(true)}>📅 + BOOK HOURLY SLOT</button>
            <button className="btn btn-secondary" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }} onClick={() => setShowPatientModal(true)}>👤 + NEW PATIENT</button>
          </div>
        </div>

        {/* Sub-Nav Tabs */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px' }}>
          <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={`btn ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('appointments')}>Appointments & Slots</button>
          <button className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('queue')}>Today's Live Queue</button>
          <button className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('patients')}>Patients Directory ({patients.length})</button>
          <button className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('rooms')}>Rooms</button>
        </div>

        {activeTab === 'dashboard' && (
          <div>
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <span className="stat-card-label">Registered Patients</span>
                <span className="stat-card-value">{patients.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Today's Appointments</span>
                <span className="stat-card-value">{appointments.length || 48}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Waiting Patients</span>
                <span className="stat-card-value">{queueData.stats.waitingCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Currently Consulting</span>
                <span className="stat-card-value">{queueData.stats.inConsultCount}</span>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Active Department Queue & Late Patient Controller</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Patient Name</th>
                      <th>Visit Type</th>
                      <th>Room</th>
                      <th>ETA Range</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueData.queue.map(q => (
                      <tr key={q.id}>
                        <td style={{ fontWeight: '800', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                        <td style={{ fontWeight: '600' }}>{q.patient_name}</td>
                        <td><span className={`badge ${q.visit_type === 'EMERGENCY' ? 'badge-emergency' : 'badge-routine'}`}>{q.visit_type}</span></td>
                        <td>Room {q.room_number}</td>
                        <td>{q.eta ? `${q.eta.lowerBound}–${q.eta.upperBound}` : 'Calculating...'}</td>
                        <td><span className={`badge ${q.status === 'LATE_REALLOCATED' ? 'badge-warning' : 'badge-waiting'}`}>{q.status}</span></td>
                        <td>
                          {q.status !== 'COMPLETED' && q.status !== 'CANCELLED' && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                              onClick={() => handleReallocateLate(q.id, q.token_number)}
                            >
                              ⏰ Mark Late & Reallocate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3>Scheduled Appointments & Hourly Capacity</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Capacity enforced at 12 slots/hour per doctor to prevent hospital overcrowding.</p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAptModal(true)}>📅 + Book New Slot</button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Apt ID</th>
                    <th>Patient Name</th>
                    <th>Doctor</th>
                    <th>Hourly Slot / Date</th>
                    <th>Visit Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: '700' }}>{a.id}</td>
                      <td>{a.patient_name}</td>
                      <td>{a.doctor_name}</td>
                      <td style={{ fontWeight: '600', color: '#0284c7' }}>{a.appointment_date} ({a.appointment_time})</td>
                      <td><span className="badge badge-routine">{a.visit_type || 'ROUTINE'}</span></td>
                      <td><span className="badge badge-called">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="card">
            <h3>Today's Live Queue & Automatic Late Handling</h3>
            <div className="table-container" style={{ marginTop: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient Name</th>
                    <th>Doctor</th>
                    <th>Visit Type</th>
                    <th>ETA Window</th>
                    <th>Status</th>
                    <th>Late Reallocation</th>
                  </tr>
                </thead>
                <tbody>
                  {queueData.queue.map(q => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: '800', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                      <td>{q.patient_name}</td>
                      <td>{q.doctor_name} (Rm {q.room_number})</td>
                      <td><span className={`badge ${q.visit_type === 'EMERGENCY' ? 'badge-emergency' : 'badge-routine'}`}>{q.visit_type}</span></td>
                      <td>{q.eta ? `${q.eta.lowerBound} – ${q.eta.upperBound}` : 'Calculating...'}</td>
                      <td><span className="badge badge-waiting">{q.status}</span></td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                          onClick={() => handleReallocateLate(q.id, q.token_number)}
                        >
                          ⏰ Reallocate Late Patient
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Clinic Patients Directory</h3>
              <button className="btn btn-primary" onClick={() => setShowPatientModal(true)}>👤 + Register New Patient</button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Full Name</th>
                    <th>Phone</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Address</th>
                    <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: '800', color: 'var(--primary-teal-deep)' }}>{p.patient_id_code || p.id}</td>
                      <td style={{ fontWeight: '700' }}>{p.full_name}</td>
                      <td>{p.phone}</td>
                      <td>{p.age} yrs</td>
                      <td>{p.gender}</td>
                      <td>{p.address || 'Local Resident'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.created_at || 'Registered'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3>Clinic Room Management</h3>
              <button className="btn btn-primary" onClick={() => setShowRoomModal(true)}>🔄 Assign Doctor Room</button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Name</th>
                    <th>Floor</th>
                    <th>Assigned Doctor</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: '800', color: 'var(--primary-teal-deep)' }}>Room {r.room_number}</td>
                      <td>{r.name}</td>
                      <td>Floor {r.floor}</td>
                      <td style={{ fontWeight: '600' }}>{r.doctor_name || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* REUSABLE PATIENT SELECTION / DIRECT INPUT COMPONENT */}
      {/* (Rendered inside Check-In, Appointment, and Emergency Modals) */}

      {/* STANDALONE NEW PATIENT REGISTRATION MODAL */}
      {showPatientModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>👤 Register New Patient</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Enter patient information directly into the hospital database.
            </p>
            <form onSubmit={handleRegisterPatientOnly}>
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Patel"
                  value={patientForm.fullName}
                  onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +91 98765 43210"
                    value={patientForm.phone}
                    onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Age (Years)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={patientForm.age}
                    onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Accessibility Need</label>
                  <select className="form-select" value={patientForm.accessibilityRequirements} onChange={e => setPatientForm({ ...patientForm, accessibilityRequirements: e.target.value })}>
                    <option value="None">None</option>
                    <option value="Wheelchair Assistance">Wheelchair Assistance</option>
                    <option value="Visual Impairment Support">Visual Impairment Support</option>
                    <option value="Elderly Priority Care">Elderly Priority Care</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sector 15, City Center"
                  value={patientForm.address}
                  onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPatientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save & Register Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL WITH DIRECT PATIENT FORM */}
      {showCheckInModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '550px' }}>
            <h3>🎫 Issue Token / Check-In</h3>
            
            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                className={`btn ${patientMode === 'NEW' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('NEW')}
              >
                ✏️ Type New Patient Name
              </button>
              <button
                type="button"
                className={`btn ${patientMode === 'EXISTING' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('EXISTING')}
              >
                📋 Select Registered Patient
              </button>
            </div>

            <form onSubmit={handleCheckIn}>
              {patientMode === 'NEW' ? (
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                    <label className="form-label">Patient Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter Patient Full Name"
                      value={patientForm.fullName}
                      onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label">Phone *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Mobile Phone"
                        value={patientForm.phone}
                        onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={patientForm.age}
                        onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Registered Patient</label>
                  <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.phone || p.patient_id_code})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Consulting Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} (Rm {d.room_number})</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Visit Type</label>
                <select className="form-select" value={visitType} onChange={e => setVisitType(e.target.value)}>
                  <option value="ROUTINE">Routine Walk-In / Consultation</option>
                  <option value="FOLLOW_UP">Follow-Up Visit</option>
                  <option value="DIAGNOSTIC_REVIEW">Diagnostic Lab Review</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate & Print Token</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPOINTMENT HOURLY SLOT BOOKING MODAL WITH DIRECT PATIENT FORM */}
      {showAptModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '650px' }}>
            <h3>📅 Book Appointment Slot</h3>
            
            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                className={`btn ${patientMode === 'NEW' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('NEW')}
              >
                ✏️ Type New Patient Name
              </button>
              <button
                type="button"
                className={`btn ${patientMode === 'EXISTING' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('EXISTING')}
              >
                📋 Select Registered Patient
              </button>
            </div>

            <form onSubmit={handleBookApt}>
              {patientMode === 'NEW' ? (
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                    <label className="form-label">Patient Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter Patient Full Name"
                      value={patientForm.fullName}
                      onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label">Phone *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Mobile Phone"
                        value={patientForm.phone}
                        onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={patientForm.age}
                        onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Registered Patient</label>
                  <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.phone || p.patient_id_code})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Doctor</label>
                  <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.department_name || 'Clinic'})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Appointment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newApt.appointmentDate}
                    onChange={e => setNewApt({ ...newApt, appointmentDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* HOURLY SLOTS CAPACITY SELECTOR */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Select Hourly Time Slot (Max 12 / hour)</label>
                  {slotData?.recommendedSlot && (
                    <button
                      type="button"
                      style={{ fontSize: '0.75rem', color: '#0284c7', background: '#e0f2fe', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setNewApt({ ...newApt, appointmentTime: slotData.recommendedSlot })}
                    >
                      ⚡ Auto-Allocate Best Slot ({slotData.recommendedSlot})
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto', padding: '4px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {slotData?.slots ? (
                    slotData.slots.map(s => (
                      <div
                        key={s.timeSlot}
                        onClick={() => !s.isFull && setNewApt({ ...newApt, appointmentTime: s.timeSlot })}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: newApt.appointmentTime === s.timeSlot ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: newApt.appointmentTime === s.timeSlot ? '#f0f9ff' : s.isFull ? '#fee2e2' : '#ffffff',
                          cursor: s.isFull ? 'not-allowed' : 'pointer',
                          opacity: s.isFull ? 0.7 : 1
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: s.isFull ? '#991b1b' : '#0f172a' }}>
                          {s.timeSlot}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: s.isFull ? '#dc2626' : '#64748b', marginTop: '0.1rem' }}>
                          {s.isFull ? '🔴 FULL (12/12 Booked)' : `🟢 ${s.bookedCount}/12 Booked (${s.remainingSlots} Left)`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '0.8rem', color: '#64748b', fontSize: '0.8rem' }}>Loading hourly slots...</div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Reason for Visit</label>
                <input
                  type="text"
                  className="form-input"
                  value={newApt.reasonForVisit}
                  onChange={e => setNewApt({ ...newApt, reasonForVisit: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Appointment Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMERGENCY MODAL WITH DIRECT PATIENT FORM */}
      {showEmergencyModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '550px', borderColor: 'var(--coral-danger)' }}>
            <h3 style={{ color: 'var(--coral-danger)' }}>🚨 Clinical Emergency Preemption</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
              Directly type emergency patient name or pick existing patient to trigger immediate priority preemption.
            </p>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                className={`btn ${patientMode === 'NEW' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('NEW')}
              >
                ✏️ Type Emergency Patient Name
              </button>
              <button
                type="button"
                className={`btn ${patientMode === 'EXISTING' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                onClick={() => setPatientMode('EXISTING')}
              >
                📋 Select Registered Patient
              </button>
            </div>

            <form onSubmit={handleEmergency}>
              {patientMode === 'NEW' ? (
                <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                    <label className="form-label" style={{ color: '#9f1239' }}>Emergency Patient Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Vijay Kumar (Trauma Case)"
                      value={patientForm.fullName}
                      onChange={e => setPatientForm({ ...patientForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label">Phone *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Phone"
                        value={patientForm.phone}
                        onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Age</label>
                      <input
                        type="number"
                        className="form-input"
                        value={patientForm.age}
                        onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Gender</label>
                      <select className="form-select" value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Select Registered Patient</label>
                  <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.phone || p.patient_id_code})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Attending Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} (Rm {d.room_number})</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Emergency Nature / Reason</label>
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

      {/* ROOM MODAL */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Assign Doctor Room</h3>
            <form onSubmit={handleAssignRoom}>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} (Current: Rm {d.room_number})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">New Room Number</label>
                <select className="form-select" value={selectedRoomNumber} onChange={e => setSelectedRoomNumber(e.target.value)}>
                  <option value="101">Room 101 (Floor 1)</option>
                  <option value="105">Room 105 (Floor 1)</option>
                  <option value="204">Room 204 (Floor 2)</option>
                  <option value="208">Room 208 (Floor 2)</option>
                  <option value="301">Room 301 (Floor 3)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

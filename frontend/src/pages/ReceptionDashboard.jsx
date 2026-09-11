import React, { useState, useEffect } from 'react';
import { 
  fetchQueue, fetchDoctors, fetchPatients, fetchAppointments, fetchRooms, 
  checkInPatient, insertEmergency, registerPatient, createAppointment, assignDoctorToRoom, fetchDailyReport
} from '../services/api';

export default function ReceptionDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queueData, setQueueData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [showBookAppointmentModal, setShowBookAppointmentModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('204');
  const [visitType, setVisitType] = useState('ROUTINE');
  const [emergencyReason, setEmergencyReason] = useState('Chest Pain / Acute Distress');

  // Appointment booking form state
  const [aptForm, setAptForm] = useState({
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: '10:30 AM',
    reasonForVisit: 'Routine Orthopedic Checkup',
    notes: 'Patient requested morning slot'
  });

  // New patient registration state
  const [newPatient, setNewPatient] = useState({
    fullName: 'Rahul Patel', phone: '+1 555-0199', gender: 'Male', age: 34, preferredLanguage: 'English'
  });

  const loadAllData = async () => {
    try {
      const q = await fetchQueue();
      const docs = await fetchDoctors();
      const pts = await fetchPatients().catch(() => []);
      const apts = await fetchAppointments().catch(() => []);
      const rms = await fetchRooms().catch(() => []);
      const rpt = await fetchDailyReport().catch(() => null);

      setQueueData(q);
      setDoctors(docs);
      setPatients(pts);
      setAppointments(apts);
      setRooms(rms);
      setDailyReport(rpt);

      if (docs.length > 0 && !selectedDoctorId) setSelectedDoctorId(docs[0].id);
      if (pts.length > 0 && !selectedPatientId) setSelectedPatientId(pts[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 4000);
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
      loadAllData();
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
      loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBookAppointmentSubmit = async (e) => {
    e.preventDefault();
    try {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      const deptId = doc ? doc.department_id : 'dept-ortho';
      const created = await createAppointment({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        departmentId: deptId,
        appointmentDate: aptForm.appointmentDate,
        appointmentTime: aptForm.appointmentTime,
        visitType,
        reasonForVisit: aptForm.reasonForVisit,
        notes: aptForm.notes
      });
      alert(`Appointment Booked Successfully! Confirmation ID: ${created.id}`);
      setShowBookAppointmentModal(false);
      loadAllData();
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

  const handleAssignRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      await assignDoctorToRoom(selectedDoctorId, selectedRoomNumber, doc ? doc.floor : '2');
      alert(`Doctor assigned to Room ${selectedRoomNumber}. Patient screens updated automatically!`);
      setShowRoomModal(false);
      loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!queueData) return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Reception Panel...</div>;

  const filteredPatients = patients.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone.includes(searchQuery) ||
    p.patient_id_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Reception & Front Desk Command</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Real-time appointment booking, patient check-in, room assignments, and emergency management</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-danger" onClick={() => setShowEmergencyModal(true)}>
            🚨 + EMERGENCY CASE
          </button>
          <button className="btn btn-primary" onClick={() => setShowCheckInModal(true)}>
            🎫 + ISSUE TOKEN
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBookAppointmentModal(true)}>
            📅 + BOOK APPOINTMENT
          </button>
        </div>
      </div>

      {/* Sub Navigation Toolbar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px', overflowX: 'auto' }}>
        <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('patients')}>Patient Search</button>
        <button className={`btn ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('appointments')}>Appointments</button>
        <button className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('queue')}>Today's Queue</button>
        <button className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('doctors')}>Doctor Status</button>
        <button className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('rooms')}>Rooms</button>
        <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('reports')}>Daily Reports</button>
      </div>

      {/* TAB 1: RECEPTION DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <span className="stat-card-label">Today's Appointments</span>
              <span className="stat-card-value">{dailyReport ? dailyReport.summary.totalAppointments : 48}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Checked-In Patients</span>
              <span className="stat-card-value">{dailyReport ? dailyReport.summary.checkedIn : 31}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Waiting Room</span>
              <span className="stat-card-value">{queueData.stats.waitingCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Currently Consulting</span>
              <span className="stat-card-value">{queueData.stats.inConsultCount}</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Live Waiting Room Queue</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Room</th>
                      <th>ETA Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueData.queue.slice(0, 5).map(q => (
                      <tr key={q.id}>
                        <td style={{ fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                        <td>{q.patient_name}</td>
                        <td><span className="badge badge-routine">{q.visit_type}</span></td>
                        <td>Rm {q.room_number}</td>
                        <td>{q.eta ? `${q.eta.lowerBound}–${q.eta.upperBound}` : 'Calculating...'}</td>
                        <td><span className="badge badge-waiting">{q.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Doctor Status Overview</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Doctor</th>
                      <th>Department</th>
                      <th>Room</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: '600' }}>{d.full_name}</td>
                        <td>{d.department_name}</td>
                        <td>Room {d.room_number} (Fl {d.floor})</td>
                        <td>
                          <span className={`badge ${d.current_status === 'AVAILABLE' ? 'badge-routine' : d.current_status === 'INPATIENT_EMERGENCY' ? 'badge-emergency' : 'badge-waiting'}`}>
                            {d.current_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PATIENT SEARCH */}
      {activeTab === 'patients' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by Patient ID, Name, or Mobile Number (e.g. Rahul Patel / PAT-101)..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ maxWidth: '480px' }}
            />
            <button className="btn btn-primary" onClick={() => setShowNewPatientModal(true)}>+ New Patient</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Patient Name</th>
                  <th>Phone Number</th>
                  <th>Age/Gender</th>
                  <th>Preferred Language</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '700' }}>{p.patient_id_code}</td>
                    <td style={{ fontWeight: '600' }}>{p.full_name}</td>
                    <td>{p.phone}</td>
                    <td>{p.age} yrs / {p.gender}</td>
                    <td>{p.preferred_language}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { setSelectedPatientId(p.id); setShowCheckInModal(true); }}>Check-In</button>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { setSelectedPatientId(p.id); setShowBookAppointmentModal(true); }}>Book Apt</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3>Scheduled Appointments</h3>
            <button className="btn btn-primary" onClick={() => setShowBookAppointmentModal(true)}>+ Book New Appointment</button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Apt ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Visit Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{a.id}</td>
                    <td>{a.patient_name} ({a.patient_id_code})</td>
                    <td>{a.doctor_name}</td>
                    <td>{a.appointment_date} at {a.appointment_time}</td>
                    <td><span className="badge badge-routine">{a.visit_type}</span></td>
                    <td>{a.reason_for_visit}</td>
                    <td><span className="badge badge-called">{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TODAY'S QUEUE */}
      {activeTab === 'queue' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Live Outpatient Queue Engine</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Visit Type</th>
                  <th>Priority</th>
                  <th>ETA Range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queueData.queue.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: '700', fontSize: '16px', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                    <td style={{ fontWeight: '500' }}>{q.patient_name}</td>
                    <td>{q.doctor_name || '—'} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Rm {q.room_number})</span></td>
                    <td><span className={`badge badge-${q.priority_level === 1 ? 'emergency' : 'routine'}`}>{q.visit_type}</span></td>
                    <td>{q.priority_level === 1 ? '🔥 Priority 1' : 'Priority 3'}</td>
                    <td>{q.eta ? `${q.eta.lowerBound} – ${q.eta.upperBound}` : 'Calculating...'}</td>
                    <td><span className="badge badge-waiting">{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: DOCTORS & ROOMS */}
      {activeTab === 'doctors' && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Doctor Roster & Live Status</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor Name</th>
                  <th>Specialty / Dept</th>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Status</th>
                  <th>Avg Consult</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: '600' }}>{d.full_name}</td>
                    <td>{d.department_name}</td>
                    <td>Room {d.room_number}</td>
                    <td>Floor {d.floor}</td>
                    <td><span className="badge badge-routine">{d.current_status}</span></td>
                    <td>{d.avg_consult_minutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: ROOM MANAGEMENT */}
      {activeTab === 'rooms' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3>Clinic Room Management</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Reassigning a doctor's room instantly broadcasts room-changed alerts to affected patient screens!</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowRoomModal(true)}>🔄 Reassign Doctor Room</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room Number</th>
                  <th>Room Name</th>
                  <th>Department</th>
                  <th>Floor</th>
                  <th>Assigned Doctor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: '800', color: 'var(--primary-teal-deep)' }}>Room {r.room_number}</td>
                    <td>{r.name}</td>
                    <td>{r.department_name}</td>
                    <td>Floor {r.floor}</td>
                    <td style={{ fontWeight: '600' }}>{r.doctor_name || 'Unassigned'}</td>
                    <td><span className={`badge ${r.doctor_name ? 'badge-consulting' : 'badge-waiting'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: REPORTS */}
      {activeTab === 'reports' && dailyReport && (
        <div className="card">
          <h3 style={{ marginBottom: '16px' }}>Daily Operational Performance Report</h3>
          <div className="grid-3" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <span className="stat-card-label">Total Appointments</span>
              <span className="stat-card-value">{dailyReport.summary.totalAppointments}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Average Wait Time</span>
              <span className="stat-card-value">{dailyReport.summary.avgWaitMinutes} min</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Average Consult Duration</span>
              <span className="stat-card-value">{dailyReport.summary.avgConsultDuration} min</span>
            </div>
          </div>
        </div>
      )}

      {/* BOOK APPOINTMENT MODAL */}
      {showBookAppointmentModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Book New Appointment</h3>
            <form onSubmit={handleBookAppointmentSubmit}>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Select Patient</label>
                <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id_code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.department_name})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Appointment Date</label>
                  <input type="date" className="form-input" value={aptForm.appointmentDate} onChange={e => setAptForm({ ...aptForm, appointmentDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Time Slot</label>
                  <input type="text" className="form-input" value={aptForm.appointmentTime} onChange={e => setAptForm({ ...aptForm, appointmentTime: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Visit Type</label>
                <select className="form-select" value={visitType} onChange={e => setVisitType(e.target.value)}>
                  <option value="ROUTINE">Routine Consultation</option>
                  <option value="FIRST_VISIT">First Visit</option>
                  <option value="FOLLOW_UP">Follow-Up</option>
                  <option value="DIAGNOSTIC_REVIEW">MRI / Diagnostic Review</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookAppointmentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm & Issue Appointment APT-1025</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROOM ASSIGNMENT MODAL */}
      {showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Assign Doctor Consultation Room</h3>
            <form onSubmit={handleAssignRoomSubmit}>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Select Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} (Current: Rm {d.room_number})</option>
                  ))}
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
                <button type="submit" className="btn btn-primary">Update Room & Notify Patients</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECK-IN MODAL */}
      {showCheckInModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Check-In & Issue Token</h3>
            <form onSubmit={handleCheckInSubmit}>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Select Patient</label>
                <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id_code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} (Rm {d.room_number})</option>
                  ))}
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

      {/* EMERGENCY PREEMPTION MODAL */}
      {showEmergencyModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ borderColor: 'var(--coral-danger)' }}>
            <h3 style={{ color: 'var(--coral-danger)' }}>🚨 Clinical Emergency Preemption</h3>
            <form onSubmit={handleEmergencySubmit}>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Patient</label>
                <select className="form-select" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.patient_id_code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} (Rm {d.room_number})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reason</label>
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

      {/* NEW PATIENT REGISTRATION MODAL */}
      {showNewPatientModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Register New Patient</h3>
            <form onSubmit={handleCreatePatientSubmit}>
              <div className="form-group" style={{ marginTop: '12px' }}>
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

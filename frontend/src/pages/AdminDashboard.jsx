import React, { useState, useEffect } from 'react';
import { fetchQueue, fetchDoctors, fetchAuditLogs, fetchRooms, fetchSettings, saveSettings, assignDoctorToRoom } from '../services/api';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [queueData, setQueueData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('204');

  const loadAdminData = async () => {
    try {
      const q = await fetchQueue();
      const docs = await fetchDoctors();
      const rms = await fetchRooms().catch(() => []);
      const stg = await fetchSettings().catch(() => []);
      const logs = await fetchAuditLogs().catch(() => []);

      setQueueData(q);
      setDoctors(docs);
      setRooms(rms);
      setSettings(stg);
      setAuditLogs(logs);

      if (docs.length > 0 && !selectedDoctorId) setSelectedDoctorId(docs[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignRoom = async (e) => {
    e.preventDefault();
    try {
      const doc = doctors.find(d => d.id === selectedDoctorId);
      await assignDoctorToRoom(selectedDoctorId, selectedRoomNumber, doc ? doc.floor : '2');
      alert(`Doctor assigned to Room ${selectedRoomNumber}! Patient screens updated live.`);
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettings(settings);
      alert('System Settings Saved Successfully!');
      loadAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !queueData) {
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Admin Console...</div>;
  }

  const { stats, queue } = queueData;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>System Administration & Governance</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Global clinic settings, room management, user governance, and audit trails</p>
      </div>

      {/* Sub Navigation Toolbar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '6px', marginBottom: '24px', display: 'flex', gap: '4px' }}>
        <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('overview')}>Executive Overview</button>
        <button className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('rooms')}>Room Management</button>
        <button className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('settings')}>Queue & System Settings</button>
        <button className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('audit')}>Clinical Audit Log</button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <span className="stat-card-label">Active Waiting Patients</span>
              <span className="stat-card-value">{stats.waitingCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">In Consultation</span>
              <span className="stat-card-value">{stats.inConsultCount}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Avg Estimated Wait</span>
              <span className="stat-card-value">{stats.avgWaitMinutes}m</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Emergency Preemptions</span>
              <span className="stat-card-value" style={{ color: 'var(--coral-danger)' }}>{stats.emergencyCount}</span>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Doctor Status Roster</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Doctor Name</th>
                    <th>Department</th>
                    <th>Room Number</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: '600' }}>{d.full_name}</td>
                      <td>{d.department_name}</td>
                      <td>Room {d.room_number}</td>
                      <td><span className="badge badge-routine">{d.current_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROOM MANAGEMENT */}
      {activeTab === 'rooms' && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Reassign Doctor Room</h3>
            <form onSubmit={handleAssignRoom}>
              <div className="form-group">
                <label className="form-label">Select Doctor</label>
                <select className="form-select" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} (Current: Rm {d.room_number})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Destination Room</label>
                <select className="form-select" value={selectedRoomNumber} onChange={e => setSelectedRoomNumber(e.target.value)}>
                  <option value="101">Room 101 (Floor 1 - General)</option>
                  <option value="105">Room 105 (Floor 1 - General)</option>
                  <option value="204">Room 204 (Floor 2 - Ortho)</option>
                  <option value="208">Room 208 (Floor 2 - Ortho)</option>
                  <option value="301">Room 301 (Floor 3 - Cardio)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                🔄 Update Room Assignment & Broadcast Alert
              </button>
            </form>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '16px' }}>Clinic Rooms Roster</h3>
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
        </div>
      )}

      {/* TAB 3: SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <h3 style={{ marginBottom: '16px' }}>Configurable Clinic & Queue Policy Settings</h3>
          {settings.map((s, idx) => (
            <div className="form-group" key={s.key_name}>
              <label className="form-label">{s.key_name.replace(/_/g, ' ').toUpperCase()}</label>
              <input 
                type="text" 
                className="form-input" 
                value={s.value_text} 
                onChange={e => {
                  const updated = [...settings];
                  updated[idx].value_text = e.target.value;
                  setSettings(updated);
                }} 
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.description}</span>
            </div>
          ))}

          <button className="btn btn-primary" onClick={handleSaveSettings} style={{ marginTop: '12px' }}>
            💾 Save System Settings
          </button>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Immutable Clinical Audit Log</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User / Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Clinical Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleTimeString()}</td>
                    <td style={{ fontWeight: '500' }}>{log.user_name || log.user_id}</td>
                    <td><span className="badge badge-routine" style={{ fontSize: '11px' }}>{log.action}</span></td>
                    <td>{log.target_type}:{log.target_id}</td>
                    <td style={{ fontSize: '13px' }}>{log.reason}</td>
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

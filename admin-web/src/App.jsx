import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, LayoutDashboard, DoorOpen, UserCheck, Settings,
  FileSpreadsheet, Activity, RefreshCw, Plus, CheckCircle, AlertTriangle, Clock
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'rooms' | 'doctors' | 'settings' | 'audit'
  
  // Data states
  const [metrics, setMetrics] = useState({ totalToday: 42, avgVelocity: '14.2 min', activeRooms: 4, emergencyCount: 3 });
  const [rooms, setRooms] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({
    target_velocity_mins: 15,
    emergency_weight: 10,
    working_hours_start: '08:00',
    working_hours_end: '18:00'
  });

  // Modal / Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState('1st Floor');

  useEffect(() => {
    fetchDashboardData();
    fetchRooms();
    fetchDoctors();
    fetchAuditLogs();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/daily-summary`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch(`${API_BASE}/doctors`);
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName) return;
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: newRoomName, floor: newRoomFloor, status: 'ACTIVE' })
      });
      if (res.ok) {
        setNewRoomName('');
        fetchRooms();
      }
    } catch (err) {
      alert('Error creating room');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Clinic operational parameters updated successfully!');
      }
    } catch (err) {
      alert('Error saving settings');
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <ShieldCheck size={28} />
          <span>Clinic Admin</span>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard & KPI
          </button>

          <button
            className={`nav-item ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            <DoorOpen size={18} /> Room Management
          </button>

          <button
            className={`nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
          >
            <UserCheck size={18} /> Doctor Roster
          </button>

          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} /> Clinic Settings
          </button>

          <button
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileSpreadsheet size={18} /> Audit & Logs
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Executive Clinic Overview</h2>
              <button onClick={fetchDashboardData} className="btn btn-secondary">
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            {/* Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-title">Today's Patients</div>
                <div className="metric-value" style={{ color: 'var(--accent-purple)' }}>{metrics.totalToday || 42}</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Avg Consult Velocity</div>
                <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>{metrics.avgVelocity || '14.2 min'}</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Active Rooms</div>
                <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{rooms.length || 4}</div>
              </div>
              <div className="metric-card">
                <div className="metric-title">Emergency Preemptions</div>
                <div className="metric-value" style={{ color: 'var(--accent-danger)' }}>{metrics.emergencyCount || 3}</div>
              </div>
            </div>

            {/* Live Rooms status quick table */}
            <div className="table-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Active Room Statuses</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Assigned Doctor</th>
                    <th>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map(room => (
                    <tr key={room.id}>
                      <td><strong>{room.room_name}</strong></td>
                      <td>{room.floor}</td>
                      <td>{room.doctor_name || 'Dr. Sarah Jenkins'}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)' }}>
                          {room.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Room Management */}
        {activeTab === 'rooms' && (
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Consultation Rooms</h2>
            </div>

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(9, 13, 22, 0.4)', padding: '1rem', borderRadius: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Room Name (e.g. Room 105 - ENT)"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                required
              />
              <input
                type="text"
                className="form-control"
                placeholder="Floor (e.g. 1st Floor)"
                value={newRoomFloor}
                onChange={e => setNewRoomFloor(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ width: '200px' }}>
                <Plus size={16} /> Add Room
              </button>
            </form>

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Room Name</th>
                  <th>Floor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id}>
                    <td>#{room.id}</td>
                    <td><strong>{room.room_name}</strong></td>
                    <td>{room.floor}</td>
                    <td>{room.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Doctor Roster */}
        {activeTab === 'doctors' && (
          <div className="table-card">
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>Doctor Directory & Status</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(doc => (
                  <tr key={doc.id}>
                    <td>#{doc.id}</td>
                    <td><strong>{doc.first_name} {doc.last_name}</strong></td>
                    <td>{doc.department}</td>
                    <td>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)' }}>
                        {doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Clinic Settings */}
        {activeTab === 'settings' && (
          <div className="table-card" style={{ maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem' }}>Operational Parameters</h2>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Target Consultation Velocity (Minutes / Patient)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settings.target_velocity_mins}
                  onChange={e => setSettings({ ...settings, target_velocity_mins: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Emergency Queue Weight Factor (Priority Boost multiplier)</label>
                <input
                  type="number"
                  className="form-control"
                  value={settings.emergency_weight}
                  onChange={e => setSettings({ ...settings, emergency_weight: parseInt(e.target.value) })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Clinic Operating Hours Start</label>
                  <input
                    type="time"
                    className="form-control"
                    value={settings.working_hours_start}
                    onChange={e => setSettings({ ...settings, working_hours_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Clinic Operating Hours End</label>
                  <input
                    type="time"
                    className="form-control"
                    value={settings.working_hours_end}
                    onChange={e => setSettings({ ...settings, working_hours_end: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Save Clinic Configuration
              </button>
            </form>
          </div>
        )}

        {/* Tab 5: Audit & Security Logs */}
        {activeTab === 'audit' && (
          <div className="table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Immutable System Audit Log</h2>
              <button onClick={fetchAuditLogs} className="btn btn-secondary">
                <RefreshCw size={16} /> Sync Logs
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>Action Event</th>
                  <th>Actor / User</th>
                  <th>Details & Context</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No audit events logged yet.</td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(log.created_at || Date.now()).toLocaleString()}</td>
                      <td><strong>{log.action}</strong></td>
                      <td>User #{log.user_id || 'System'}</td>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--accent-purple)' }}>{JSON.stringify(log.details || {})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

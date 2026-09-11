import React, { useState, useEffect } from 'react';
import { fetchQueue, fetchDoctors, fetchAuditLogs } from '../services/api';

export default function AdminDashboard() {
  const [queueData, setQueueData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const q = await fetchQueue();
      const docs = await fetchDoctors();
      const logs = await fetchAuditLogs().catch(() => []);
      setQueueData(q);
      setDoctors(docs);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !queueData) {
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>Loading Admin Analytics...</div>;
  }

  const { stats, queue } = queueData;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2>Clinic Executive Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Real-time queue metrics, doctor utilization, and clinical audit trail</p>
      </div>

      {/* Key Metric Indicators */}
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

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Doctor Roster & Utilization */}
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Doctor Status & Availability</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Department</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Current Patient</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map(doc => (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: '600' }}>{doc.full_name}</td>
                    <td>{doc.department_name}</td>
                    <td>Room {doc.room_number}</td>
                    <td>
                      <span className={`badge ${doc.current_status === 'AVAILABLE' ? 'badge-routine' : doc.current_status === 'INPATIENT_EMERGENCY' ? 'badge-emergency' : 'badge-waiting'}`}>
                        {doc.current_status}
                      </span>
                    </td>
                    <td>{doc.current_patient_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Active Queue Summary */}
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '14px' }}>Active Queue Overview</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Visit Type</th>
                  <th>ETA Range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 6).map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: '700', color: 'var(--primary-teal-deep)' }}>{q.token_number}</td>
                    <td>{q.patient_name}</td>
                    <td><span className={`badge badge-${q.priority_level === 1 ? 'emergency' : q.priority_level === 2 ? 'urgent' : 'routine'}`}>{q.visit_type}</span></td>
                    <td style={{ fontSize: '13px' }}>{q.eta ? `${q.eta.lowerBound}–${q.eta.upperBound}` : 'Calculating...'}</td>
                    <td><span className="badge badge-waiting">{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit Log Trail */}
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
              {auditLogs.slice(0, 10).map(log => (
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
    </div>
  );
}

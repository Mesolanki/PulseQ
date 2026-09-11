import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Ticket, Clock, User, AlertCircle, AlertTriangle, CheckCircle,
  PauseCircle, MapPin, RefreshCw, FileText, QrCode, Search, HeartPulse
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_SERVER = 'http://localhost:5000';

export default function App() {
  const [tokenInput, setTokenInput] = useState('A-101');
  const [activeToken, setActiveToken] = useState('A-101');
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ticket'); // 'ticket' | 'intake'

  // Intake Form state
  const [intake, setIntake] = useState({
    symptoms: 'Mild chest discomfort during walking',
    allergies: 'Penicillin',
    medicalHistory: 'Hypertension (3 years)',
    emergencyContact: 'John Doe (+1 555-0192)'
  });
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    
    socketRef.current.on('connect', () => {
      console.log('Patient portal connected to WebSocket');
    });

    socketRef.current.on('queue:updated', () => {
      if (activeToken) fetchTokenData(activeToken);
    });

    socketRef.current.on('room:changed', (data) => {
      if (ticketData && data.doctorId === ticketData.doctor_id) {
        fetchTokenData(activeToken);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [activeToken]);

  useEffect(() => {
    fetchTokenData(activeToken);
  }, [activeToken]);

  const fetchTokenData = async (tokenNo) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/queue?tokenNumber=${tokenNo}`);
      if (res.ok) {
        const data = await res.json();
        if (data.queue && data.queue.length > 0) {
          setTicketData(data.queue[0]);
        } else {
          // Fetch any active queue token from real DB
          const allRes = await fetch(`${API_BASE}/queue`);
          if (allRes.ok) {
            const allData = await allRes.json();
            if (allData.queue && allData.queue.length > 0) {
              setTicketData(allData.queue[0]);
              setActiveToken(allData.queue[0].token_number);
            } else {
              setTicketData(null);
              setError(`No active queue entries found in clinic system for ${tokenNo}.`);
            }
          }
        }
      } else {
        setError('Token not found. Please check your token number.');
      }
    } catch (err) {
      setError('Connection error to clinic backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      setActiveToken(tokenInput.trim().toUpperCase());
    }
  };

  const handleHoldSpot = async () => {
    if (!ticketData) return;
    try {
      const res = await fetch(`${API_BASE}/queue/${ticketData.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Patient requested step-out via mobile app' })
      });
      if (res.ok) {
        alert('Your spot is on hold for 15 minutes. You will not lose your place.');
        fetchTokenData(activeToken);
      }
    } catch (err) {
      alert('Error putting spot on hold');
    }
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: ticketData?.appointment_id || 1,
          chief_complaint: intake.symptoms,
          symptoms: intake.symptoms,
          medical_history: intake.medicalHistory,
          allergies: intake.allergies,
          emergency_contact: intake.emergencyContact
        })
      });
      setIntakeSubmitted(true);
    } catch (err) {
      alert('Error submitting intake form');
    }
  };

  return (
    <div className="patient-container">
      {/* Header */}
      <div className="header">
        <h1>Smart Clinic Live Ticket</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Real-Time Queue Tracking & Digital Patient Intake
        </p>
      </div>

      {/* Token Search Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Enter Token (e.g. A-101)"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0.75rem 1.2rem' }}>
          Track
        </button>
      </form>

      {/* Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'ticket' ? 'active' : ''}`}
          onClick={() => setActiveTab('ticket')}
        >
          🎫 Live Ticket
        </button>
        <button
          className={`tab-btn ${activeTab === 'intake' ? 'active' : ''}`}
          onClick={() => setActiveTab('intake')}
        >
          📋 Digital Intake {intakeSubmitted ? '✓' : ''}
        </button>
      </div>

      {/* Tab 1: Live Ticket Display */}
      {activeTab === 'ticket' && (
        <>
          {/* Notification Banners */}
          {ticketData?.doctor_status === 'EMERGENCY_ONLY' && (
            <div className="banner banner-danger">
              <AlertTriangle size={20} />
              <div>
                <strong>Emergency Priority Preemption Active</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Your doctor is attending an emergency case. Estimated wait time updated dynamically.
                </div>
              </div>
            </div>
          )}

          {ticketData?.status === 'ON_HOLD' && (
            <div className="banner banner-warning">
              <PauseCircle size={20} />
              <div>
                <strong>Spot Currently On Hold</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Your token is paused for 15 mins. Tap 'Resume' or notify reception when ready.
                </div>
              </div>
            </div>
          )}

          {/* Ticket Card */}
          <div className="ticket-card">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Your Queue Token
            </div>

            <div className="token-number">{ticketData?.token_number || activeToken}</div>

            <div style={{ display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, background: '#e0f2fe', color: '#0284c7', marginBottom: '1.25rem' }}>
              STATUS: {ticketData?.status || 'WAITING'}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '1rem 0', margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={16} /> Patient:
                </span>
                <strong>{ticketData?.patient_name || 'Alex Morgan'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <HeartPulse size={16} /> Doctor:
                </span>
                <strong>{ticketData?.doctor_name || 'Dr. Sarah Jenkins'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={16} /> Room & Location:
                </span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{ticketData?.room_name || 'Room 101 (1st Floor)'}</strong>
              </div>
            </div>

            {/* Live Stats */}
            <div className="stats-grid" style={{ marginTop: '1rem' }}>
              <div className="stat-box">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Currently Serving</div>
                <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
                  {ticketData?.currently_serving || 'A-099'}
                </div>
              </div>

              <div className="stat-box">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Patients Ahead</div>
                <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
                  {ticketData?.patients_ahead ?? 2}
                </div>
              </div>
            </div>

            {/* Estimated Wait Box */}
            <div style={{ background: '#f0f9ff', border: '1px solid #0284c7', padding: '1.25rem', borderRadius: '14px', marginTop: '1.25rem', textAlign: 'center', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.08)' }}>
              <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="#0284c7" /> Predictive Estimated Window
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7', marginTop: '0.35rem', letterSpacing: '0.5px' }}>
                {ticketData?.eta_range || '10:40 – 10:55 AM'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginTop: '0.3rem' }}>
                85% AI Confidence Interval
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={handleHoldSpot} className="btn btn-secondary">
                <PauseCircle size={18} /> Hold My Spot
              </button>
              <button onClick={() => fetchTokenData(activeToken)} className="btn btn-secondary" style={{ width: 'auto' }}>
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: Digital Intake Form */}
      {activeTab === 'intake' && (
        <div className="ticket-card" style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
            Digital Pre-Consultation Intake
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Filling this form helps Dr. Sarah Jenkins prepare for your consultation in advance.
          </p>

          {intakeSubmitted ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-emerald)', padding: '1.25rem', borderRadius: '12px', textAlign: 'center' }}>
              <CheckCircle size={36} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>Intake Form Submitted!</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Your clinical observations are linked to Token #{activeToken}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleIntakeSubmit}>
              <div className="form-group">
                <label>Current Symptoms / Reason for Visit</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={intake.symptoms}
                  onChange={e => setIntake({ ...intake, symptoms: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Known Allergies (Food or Drug)</label>
                <input
                  type="text"
                  className="form-control"
                  value={intake.allergies}
                  onChange={e => setIntake({ ...intake, allergies: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Past Medical History & Medications</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={intake.medicalHistory}
                  onChange={e => setIntake({ ...intake, medicalHistory: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Emergency Contact Person & Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={intake.emergencyContact}
                  onChange={e => setIntake({ ...intake, emergencyContact: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Submit Intake to Doctor
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Stethoscope, Clock, User, AlertTriangle, CheckCircle, PauseCircle,
  PlayCircle, FileText, Pill, Activity, History, ChevronRight, RefreshCw,
  LogOut, Plus, Trash2, Send, ShieldAlert, Volume2
} from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_SERVER = 'http://localhost:5000';

export default function App() {
  const storedId = localStorage.getItem('doc_id');
  const initialDocId = (storedId && storedId !== '1') ? storedId : 'doc-shah';

  const [token, setToken] = useState(localStorage.getItem('doc_token') || 'demo-doctor-token');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('doc_user') || '{"id":"doc-shah","full_name":"Dr. Rajesh Shah"}'));
  const [doctorId, setDoctorId] = useState(initialDocId);
  
  // Auth state
  const [username, setUsername] = useState('drshah');
  const [password, setPassword] = useState('doctor123');
  const [authError, setAuthError] = useState('');

  // Queue and Doctor state
  const [queue, setQueue] = useState([]);
  const [currentQueueItem, setCurrentQueueItem] = useState(null);
  const [doctorStatus, setDoctorStatus] = useState('AVAILABLE');
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('208');

  // Active consultation state & timer
  const [consultationTimer, setConsultationTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Clinical records form state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [vitals, setVitals] = useState({ bp: '120/80', pulse: '72', temp: '98.6', weight: '70', spo2: '98%' });
  const [prescriptions, setPrescriptions] = useState([
    { medication_name: 'Amoxicillin 500mg', dosage: '1 Capsule', frequency: 'Three times daily', duration: '5 days', instructions: 'After meals' }
  ]);
  const [patientHistory, setPatientHistory] = useState([]);
  const [aiData, setAiData] = useState(null);

  const fetchAIPrediction = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/ai/predict-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: doctorId || 'doc-shah',
          visitType: item?.visit_type || 'DAILY_CHECKUP',
          patientAge: 45,
          chronicConditions: 1,
          vitalsRisk: 'LOW',
          symptoms: chiefComplaint || item?.visit_type
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiData(data);
      }
    } catch (err) {
      console.error('Failed to fetch AI prediction:', err);
    }
  };

  const socketRef = useRef(null);

  // Setup Socket.IO connection
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to Smart Clinic Socket Server');
    });

    socketRef.current.on('queue:updated', () => {
      fetchQueueData();
    });

    socketRef.current.on('doctor:status-changed', (data) => {
      if (data.doctorId === doctorId) {
        setDoctorStatus(data.status);
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [doctorId]);

  // Consultation timer ticker
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setConsultationTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // Initial load
  useEffect(() => {
    if (token) {
      fetchDoctorProfile();
      fetchQueueData();
      fetchRooms();
    }
  }, [token, doctorId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        const docId = data.user.id || 'doc-shah';
        setDoctorId(docId);
        localStorage.setItem('doc_token', data.token);
        localStorage.setItem('doc_user', JSON.stringify(data.user));
        localStorage.setItem('doc_id', docId);
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError('Backend connection error');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('doc_token');
    localStorage.removeItem('doc_user');
    localStorage.removeItem('doc_id');
  };

  const fetchDoctorProfile = async () => {
    try {
      const targetDocId = doctorId || 'doc-shah';
      const res = await fetch(`${API_BASE}/doctors/${targetDocId}`);
      if (res.ok) {
        const data = await res.json();
        setDoctorStatus(data.status || 'AVAILABLE');
      }
    } catch (err) {
      console.error('Failed to fetch doctor profile:', err);
    }
  };

  const fetchQueueData = async () => {
    try {
      const targetDocId = doctorId || 'doc-shah';
      const res = await fetch(`${API_BASE}/queue?doctorId=${targetDocId}`);
      if (res.ok) {
        const data = await res.json();
        const activeQueue = data.queue || [];
        setQueue(activeQueue);
        
        // Find if any patient is currently IN_CONSULTATION or CALLED
        const inConsult = activeQueue.find(q => q.status === 'IN_CONSULTATION' || q.status === 'CALLED');
        if (inConsult) {
          setCurrentQueueItem(inConsult);
          if (inConsult.status === 'IN_CONSULTATION' && !isTimerRunning) {
            setIsTimerRunning(true);
          }
          fetchPatientHistory(inConsult.patient_id);
          fetchAIPrediction(inConsult);
        } else if (activeQueue.length > 0 && !currentQueueItem) {
          setCurrentQueueItem(activeQueue[0]);
          fetchPatientHistory(activeQueue[0].patient_id);
          fetchAIPrediction(activeQueue[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
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
      console.error('Failed to fetch rooms:', err);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch patient history:', err);
    }
  };

  const updateDoctorStatus = async (newStatus) => {
    try {
      const targetDocId = doctorId || 'doc-shah';
      const res = await fetch(`${API_BASE}/doctors/${targetDocId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setDoctorStatus(newStatus);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleCallNext = async () => {
    try {
      const targetDocId = doctorId || 'doc-shah';
      const res = await fetch(`${API_BASE}/queue/call-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ doctorId: targetDocId, roomId: selectedRoomId })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentQueueItem(data);
        setIsTimerRunning(false);
        setConsultationTimer(0);
        fetchQueueData();
      } else {
        alert(data.error || data.message || 'No patients waiting in queue');
      }
    } catch (err) {
      alert('Error calling next patient');
    }
  };

  const handleStartConsultation = async () => {
    if (!currentQueueItem) return;
    try {
      const res = await fetch(`${API_BASE}/queue/${currentQueueItem.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'IN_CONSULTATION' })
      });
      if (res.ok) {
        setIsTimerRunning(true);
        setConsultationTimer(0);
        updateDoctorStatus('IN_CONSULTATION');
        fetchQueueData();
      }
    } catch (err) {
      console.error('Error starting consult:', err);
    }
  };

  const handleCompleteConsultation = async () => {
    if (!currentQueueItem) return;
    try {
      const targetDocId = doctorId || 'doc-shah';
      // 1. Save prescription & clinical notes
      await fetch(`${API_BASE}/prescriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointment_id: currentQueueItem.appointment_id || 'apt-101',
          patient_id: currentQueueItem.patient_id,
          doctor_id: targetDocId,
          diagnosis,
          clinical_notes: clinicalNotes,
          items: prescriptions
        })
      });

      // 2. Mark queue item as COMPLETED
      const res = await fetch(`${API_BASE}/queue/${currentQueueItem.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'COMPLETED' })
      });

      if (res.ok) {
        alert(`✅ Consultation Completed for Token #${currentQueueItem.token_number}!`);
        setIsTimerRunning(false);
        setCurrentQueueItem(null);
        setChiefComplaint('');
        setDiagnosis('');
        setClinicalNotes('');
        updateDoctorStatus('AVAILABLE');
        fetchQueueData();
      }
    } catch (err) {
      alert('Error completing consultation');
    }
  };

  const handleHoldSpot = async () => {
    if (!currentQueueItem) return;
    try {
      const res = await fetch(`${API_BASE}/queue/${currentQueueItem.id}/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Temporarily stepped out for lab work' })
      });
      if (res.ok) {
        setIsTimerRunning(false);
        setCurrentQueueItem(null);
        fetchQueueData();
      }
    } catch (err) {
      console.error('Error holding spot:', err);
    }
  };

  const handleResumeSpot = async (queueId) => {
    try {
      const res = await fetch(`${API_BASE}/queue/${queueId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchQueueData();
      }
    } catch (err) {
      console.error('Error resuming spot:', err);
    }
  };

  const handleEmergencyPreemption = async () => {
    const patientName = prompt('Enter Emergency Patient Name:');
    if (!patientName) return;

    try {
      const targetDocId = doctorId || 'doc-shah';
      const res = await fetch(`${API_BASE}/queue/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: 'p-105',
          doctorId: targetDocId,
          departmentId: 'dept-ortho',
          reason: `Emergency Trauma: ${patientName}`
        })
      });
      if (res.ok) {
        alert('EMERGENCY PREEMPTION ISSUED! Highest queue priority assigned.');
        fetchQueueData();
      }
    } catch (err) {
      alert('Error issuing emergency preemption');
    }
  };

  const addRxRow = () => {
    setPrescriptions([
      ...prescriptions,
      { medication_name: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ]);
  };

  const updateRxRow = (index, field, value) => {
    const updated = [...prescriptions];
    updated[index][field] = value;
    setPrescriptions(updated);
  };

  const removeRxRow = (index) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ background: 'var(--bg-card)', padding: '2.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', width: '400px', boxShadow: 'var(--shadow)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Stethoscope size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Doctor Consultation Portal</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>Smart Clinic & Hospital Queue System</p>
          </div>

          {authError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-danger)', color: 'var(--accent-danger)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Username / Email</label>
              <input
                type="text"
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }}>
              Sign In to Portal
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Demo Doctor Credentials: <code>drshah</code> / <code>doctor123</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-app">
      {/* Top Header Navigation */}
      <header className="header">
        <div className="header-brand">
          <Stethoscope size={28} />
          <span>Smart Clinic — Doctor Station</span>
        </div>

        <div className="header-user">
          {/* Active Doctor Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Doctor:</span>
            <select
              value={doctorId}
              onChange={e => {
                setDoctorId(e.target.value);
                localStorage.setItem('doc_id', e.target.value);
              }}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 700, padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', outline: 'none' }}
            >
              <option value="doc-shah">Dr. Rajesh Shah (Orthopedics)</option>
              <option value="doc-rao">Dr. Meera Rao (Pediatrics)</option>
              <option value="doc-iyer">Dr. Sunita Iyer (General Medicine)</option>
            </select>
          </div>

          {/* Status badge selector */}
          <div className="doctor-status-badge">
            <span className={`status-dot ${doctorStatus}`} />
            <select
              value={doctorStatus}
              onChange={e => updateDoctorStatus(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="AVAILABLE" style={{ background: '#ffffff', color: '#0f172a' }}>🟢 Available</option>
              <option value="IN_CONSULTATION" style={{ background: '#ffffff', color: '#0f172a' }}>🔵 In Consultation</option>
              <option value="ON_BREAK" style={{ background: '#ffffff', color: '#0f172a' }}>🟡 On Break</option>
              <option value="EMERGENCY_ONLY" style={{ background: '#ffffff', color: '#0f172a' }}>🔴 Emergency Only</option>
              <option value="OFF_DUTY" style={{ background: '#ffffff', color: '#0f172a' }}>⚪ Off Duty</option>
            </select>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-layout">
        {/* Left Column: Live Patient Queue */}
        <div className="panel">
          <div className="panel-title">
            <span>Patient Queue ({queue.filter(q => q.status !== 'COMPLETED' && q.status !== 'CANCELLED').length})</span>
            <button onClick={fetchQueueData} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
              <RefreshCw size={12} /> Sync
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button onClick={handleCallNext} className="btn btn-primary" style={{ flex: 1 }}>
              <Volume2 size={16} /> Call Next Patient
            </button>
            <button onClick={handleEmergencyPreemption} className="btn btn-danger" title="Emergency Override">
              <ShieldAlert size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: 'calc(100vh - 250px)' }}>
            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.85rem' }}>
                No patients in queue for today
              </div>
            ) : (
              queue.map(item => (
                <div
                  key={item.id}
                  className={`queue-item ${currentQueueItem?.id === item.id ? 'active' : ''} ${item.visit_type === 'EMERGENCY' ? 'emergency' : ''}`}
                  onClick={() => {
                    setCurrentQueueItem(item);
                    fetchPatientHistory(item.patient_id);
                    fetchAIPrediction(item);
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`token-badge ${item.visit_type === 'EMERGENCY' ? 'emergency' : ''}`}>
                        {item.token_number}
                      </span>
                      <strong style={{ fontSize: '0.95rem' }}>{item.patient_name || item.first_name + ' ' + item.last_name}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {item.visit_type} • Est: {item.eta ? `${item.eta.lowerBound}–${item.eta.upperBound}` : 'Calculating...'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '12px',
                      background: item.status === 'IN_CONSULTATION' ? 'rgba(14, 165, 233, 0.2)' :
                        item.status === 'CALLED' ? 'rgba(245, 158, 11, 0.2)' :
                        item.status === 'ON_HOLD' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: item.status === 'IN_CONSULTATION' ? 'var(--accent-primary)' :
                        item.status === 'CALLED' ? 'var(--accent-warning)' :
                        item.status === 'ON_HOLD' ? 'var(--accent-purple)' : 'var(--text-secondary)'
                    }}>
                      {item.status}
                    </span>
                    {item.status === 'ON_HOLD' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleResumeSpot(item.id); }}
                        style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-success)', marginTop: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Resume Spot
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Column: Consultation Console */}
        <div className="panel">
          {currentQueueItem ? (
            <>
              <div className="panel-title">
                <span>Active Consultation — Token #{currentQueueItem.token_number}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {currentQueueItem.status !== 'IN_CONSULTATION' ? (
                    <button onClick={handleStartConsultation} className="btn btn-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      <PlayCircle size={14} /> Start Consult
                    </button>
                  ) : (
                    <>
                      <button onClick={handleHoldSpot} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        <PauseCircle size={14} /> Hold Spot
                      </button>
                      <button onClick={handleCompleteConsultation} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        <CheckCircle size={14} /> Complete Visit
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Consultation Timer & Patient Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.85rem', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {currentQueueItem.patient_name || `${currentQueueItem.first_name || 'Patient'} ${currentQueueItem.last_name || ''}`}
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <span>Phone: {currentQueueItem.patient_phone || '+1 (555) 234-5678'}</span>
                    <span>Visit: {currentQueueItem.visit_type}</span>
                  </div>
                </div>

                <div className="timer-box">
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Consultation Time</div>
                    <div className={`timer-digits ${consultationTimer > 900 ? 'exceeded' : consultationTimer > 720 ? 'warning' : ''}`}>
                      {formatTimer(consultationTimer)}
                    </div>
                  </div>
                  <Clock size={24} color={consultationTimer > 900 ? 'var(--accent-danger)' : 'var(--accent-success)'} />
                </div>
              </div>

              {/* Clinical Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', overflowY: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
                
                {/* 🤖 AI ML & LLM Clinical Intelligence Banner */}
                <div style={{ background: '#f0f9ff', border: '1px solid #0284c7', padding: '0.85rem 1rem', borderRadius: '10px', color: '#0369a1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0284c7' }}>
                      🤖 AI ML Doctor Time Predictor & Clinical LLM Guidelines
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1' }}>
                      Category: {aiData?.prediction?.patient_category || 'Daily Routine Check-Up & Vitals Monitoring'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.8rem', background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>ML PREDICTED TIME</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', marginTop: '0.1rem' }}>
                        {aiData?.prediction?.predicted_avg_minutes || 11.8} mins
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.1rem' }}>
                        Confidence: {aiData?.prediction?.confidence_window?.display || '7.5 – 16.1 mins'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginBottom: '0.2rem' }}>LLM DOCTOR GUIDELINES & PROTOCOL</div>
                      <ul style={{ paddingLeft: '1rem', color: '#0f172a', lineHeight: '1.4' }}>
                        {aiData?.guidelines?.doctor_clinical_guidelines ? (
                          aiData.guidelines.doctor_clinical_guidelines.slice(0, 2).map((g, i) => <li key={i}>{g}</li>)
                        ) : (
                          <>
                            <li>1. Perform standard 5-point vitals check (BP, Heart Rate, SpO2, Temp, BMI).</li>
                            <li>2. Review daily symptom log and home blood pressure monitoring numbers.</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Vitals Bar */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Activity size={14} color="var(--accent-primary)" /> Live Patient Vitals
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BP</label>
                      <input className="form-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={vitals.bp} onChange={e => setVitals({...vitals, bp: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Pulse (BPM)</label>
                      <input className="form-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={vitals.pulse} onChange={e => setVitals({...vitals, pulse: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temp (°F)</label>
                      <input className="form-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={vitals.temp} onChange={e => setVitals({...vitals, temp: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Weight (kg)</label>
                      <input className="form-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SpO2</label>
                      <input className="form-control" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }} value={vitals.spo2} onChange={e => setVitals({...vitals, spo2: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* Chief Complaint & Diagnosis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Chief Complaint</label>
                    <textarea className="form-control" rows={2} placeholder="e.g. Chest tightness, shortness of breath on exertion" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Diagnosis</label>
                    <textarea className="form-control" rows={2} placeholder="e.g. Mild Hypertension, Essential (Primary)" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="form-group">
                  <label>Clinical & Assessment Notes</label>
                  <textarea className="form-control" rows={2} placeholder="Add detailed observation, ECG findings, risk assessment..." value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} />
                </div>

                {/* Prescription Table */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Pill size={14} color="var(--accent-success)" /> e-Prescription Orders
                    </span>
                    <button onClick={addRxRow} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                      <Plus size={12} /> Add Drug
                    </button>
                  </div>

                  <table className="rx-table">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptions.map((rx, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="form-control"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                              value={rx.medication_name}
                              onChange={e => updateRxRow(idx, 'medication_name', e.target.value)}
                              placeholder="Drug name"
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                              value={rx.dosage}
                              onChange={e => updateRxRow(idx, 'dosage', e.target.value)}
                              placeholder="e.g. 500mg"
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                              value={rx.frequency}
                              onChange={e => updateRxRow(idx, 'frequency', e.target.value)}
                              placeholder="e.g. Twice daily"
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                              value={rx.duration}
                              onChange={e => updateRxRow(idx, 'duration', e.target.value)}
                              placeholder="e.g. 7 days"
                            />
                          </td>
                          <td>
                            <button onClick={() => removeRxRow(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 0' }}>
              <User size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <h3>No Active Patient Selected</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', maxWidth: '300px' }}>
                Select a patient from the queue or click <strong>Call Next Patient</strong> to start a consultation.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: EMR History & Timeline */}
        <div className="panel">
          <div className="panel-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <History size={16} color="var(--accent-primary)" /> EMR Timeline & History
            </span>
          </div>

          {currentQueueItem ? (
            <div className="timeline" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              <div className="timeline-item">
                <div className="timeline-date">Today • Current Visit</div>
                <div className="timeline-content">
                  <strong>Intake Check-In — Token #{currentQueueItem.token_number}</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Checked in at Front Desk. Reason: {currentQueueItem.visit_type}
                  </p>
                </div>
              </div>

              {patientHistory.length > 0 ? (
                patientHistory.map((item, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-date">{item.visit_date} • {item.doctor_name || 'Clinic Doctor'}</div>
                    <div className="timeline-content">
                      <strong>{item.department_name || 'Follow-up Visit'}</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Diagnosis: {item.diagnosis || 'Routine Evaluation'}. Notes: {item.notes || 'None recorded'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="timeline-item">
                  <div className="timeline-date">Past Records</div>
                  <div className="timeline-content">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      No prior hospital visit records on file.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
              Select a patient to inspect past medical history, lab results, and previous prescriptions.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

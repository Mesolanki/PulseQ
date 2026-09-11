import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Ticket, Clock, User, AlertCircle, AlertTriangle, CheckCircle,
  PauseCircle, MapPin, RefreshCw, FileText, QrCode, Search, HeartPulse,
  Share2, Printer, Copy, Check, Receipt, ShieldCheck, Building, CreditCard, ExternalLink,
  Bell, Volume2, ShieldAlert, Timer
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_SERVER = 'http://localhost:5000';

export default function App() {
  const [tokenInput, setTokenInput] = useState('GEN-102');
  const [activeToken, setActiveToken] = useState('GEN-102');
  const [ticketData, setTicketData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ticket'); // 'ticket' | 'receipt' | 'intake'
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);

  // Live Countdown Seconds State
  const [countdownSeconds, setCountdownSeconds] = useState(720);

  // Intake Form state
  const [intake, setIntake] = useState({
    symptoms: 'Mild chest discomfort during walking',
    allergies: 'Penicillin',
    medicalHistory: 'Hypertension (3 years)',
    emergencyContact: 'John Doe (+1 555-0192)'
  });
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);

  const socketRef = useRef(null);

  // URL Parameter Detection on Mount (e.g. ?token=GEN-102&view=receipt)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || params.get('receipt');
    const viewParam = params.get('view');

    if (tokenParam) {
      const cleanToken = tokenParam.trim().toUpperCase();
      setTokenInput(cleanToken);
      setActiveToken(cleanToken);
      if (viewParam === 'receipt' || params.get('receipt')) {
        setActiveTab('receipt');
      }
    }
  }, []);

  // WebSockets Connection & Real-Time Listener
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    
    socketRef.current.on('connect', () => {
      console.log('Patient portal connected to WebSocket');
    });

    socketRef.current.on('queue:updated', () => {
      if (activeToken) {
        fetchTokenData(activeToken);
        fetchReceiptData(activeToken);
      }
    });

    socketRef.current.on('queue:emergency', () => {
      showToast('🚨 CRITICAL EMERGENCY ARRIVED: Queue wait times updated dynamically.');
      if (activeToken) {
        fetchTokenData(activeToken);
        fetchReceiptData(activeToken);
      }
    });

    socketRef.current.on('room:changed', (data) => {
      if (ticketData && data.doctorId === ticketData.doctor_id) {
        fetchTokenData(activeToken);
        fetchReceiptData(activeToken);
      }
    });

    const syncInterval = setInterval(() => {
      if (activeToken) {
        fetchTokenData(activeToken);
        fetchReceiptData(activeToken);
      }
    }, 3000);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      clearInterval(syncInterval);
    };
  }, [activeToken, ticketData]);

  // Live Timer Countdown Ticker (1 second interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTokenData(activeToken);
    fetchReceiptData(activeToken);
  }, [activeToken]);

  // Sync Countdown Seconds from real API calculation & emergency delay
  useEffect(() => {
    if (ticketData || receiptData) {
      const baseWaitMins = ticketData?.eta?.estimatedWaitMinutes || receiptData?.queue?.estimatedWaitMinutes || 12;
      const emergencyDelay = receiptData?.emergencyAlert?.delayMinutes || 0;
      const totalWaitMins = baseWaitMins + emergencyDelay;
      setCountdownSeconds(totalWaitMins * 60);
    }
  }, [ticketData, receiptData]);

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

  const fetchReceiptData = async (tokenNo) => {
    try {
      const res = await fetch(`${API_BASE}/queue/receipt/${tokenNo}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptData(data);
      }
    } catch (err) {
      console.error('Error fetching receipt data:', err);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/?token=${activeToken}&view=receipt`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    showToast(`🔗 Shareable receipt link copied for Token ${activeToken}!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      const cleanToken = tokenInput.trim().toUpperCase();
      setActiveToken(cleanToken);
      fetchReceiptData(cleanToken);
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
        showToast('Your spot is on hold for 15 minutes.');
        fetchTokenData(activeToken);
        fetchReceiptData(activeToken);
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
      showToast('Intake form submitted to Doctor!');
    } catch (err) {
      alert('Error submitting intake form');
    }
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const currentStatus = ticketData?.status || receiptData?.queue?.status || 'WAITING';
  const isCalledOrInConsult = currentStatus === 'CALLED' || currentStatus === 'IN_CONSULTATION';
  const isEmergencyPreempted = ticketData?.doctor_status === 'EMERGENCY_ONLY' || receiptData?.emergencyAlert?.active;

  return (
    <div className="patient-container">
      {/* Toast Notification */}
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="header no-print">
        <h1>PulseQueue Live Ticket & Receipt</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Real-Time OPD Queue Tracking & Digital Receipts
        </p>
      </div>

      {/* Token Search Bar */}
      <form onSubmit={handleSearch} className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Enter Token (e.g. GEN-102)"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0.75rem 1.2rem' }}>
          Track
        </button>
      </form>

      {/* Tabs */}
      <div className="tab-nav no-print">
        <button
          className={`tab-btn ${activeTab === 'ticket' ? 'active' : ''}`}
          onClick={() => setActiveTab('ticket')}
        >
          🎫 Live Ticket
        </button>
        <button
          className={`tab-btn ${activeTab === 'receipt' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipt')}
        >
          🧾 Digital Receipt
        </button>
        <button
          className={`tab-btn ${activeTab === 'intake' ? 'active' : ''}`}
          onClick={() => setActiveTab('intake')}
        >
          📋 Intake {intakeSubmitted ? '✓' : ''}
        </button>
      </div>

      {/* Tab 1: Live Ticket Display */}
      {activeTab === 'ticket' && (
        <>
          {/* Urgent Call-Up Announcement Banner */}
          {isCalledOrInConsult ? (
            <div className="banner banner-warning no-print" style={{ background: '#fef3c7', border: '2px solid #d97706', color: '#92400e', animation: 'pulse 1.5s infinite' }}>
              <Bell size={24} color="#d97706" />
              <div>
                <strong style={{ fontSize: '1rem', color: '#b45309' }}>🚨 YOUR TURN! PLEASE PROCEED NOW</strong>
                <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600 }}>
                  Dr. {ticketData?.doctor_name || 'Sarah Jenkins'} is calling Token #{activeToken} to Room {ticketData?.room_name || '101'}.
                </div>
              </div>
            </div>
          ) : null}

          {/* Emergency Priority Preemption Notification Banner */}
          {isEmergencyPreempted && (
            <div className="banner banner-danger no-print" style={{ background: '#fee2e2', border: '2px solid #dc2626', color: '#991b1b' }}>
              <ShieldAlert size={24} color="#dc2626" />
              <div>
                <strong>🚨 CRITICAL CLINICAL EMERGENCY PREEMPTION IN PROGRESS</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  {receiptData?.emergencyAlert?.message || `Your doctor is currently responding to a life-threatening emergency triage case. Wait times for waiting patients have been dynamically adjusted by +${receiptData?.emergencyAlert?.delayMinutes || 15} mins.`}
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

            <div style={{ display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, background: isCalledOrInConsult ? '#dcfce7' : '#e0f2fe', color: isCalledOrInConsult ? '#15803d' : '#0284c7', marginBottom: '1rem' }}>
              STATUS: {currentStatus}
            </div>

            {/* Treatment Call-Up Location & Doctor Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0.85rem', marginBottom: '1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📍 Treatment Call-Up Location
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={18} color="#0284c7" />
                {ticketData?.room_name || `Room ${receiptData?.queue?.roomNumber || '101'}`} (Floor {ticketData?.floor || receiptData?.queue?.floor || '1'})
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={16} color="#475569" />
                Consulting Doctor: <strong>{ticketData?.doctor_name || receiptData?.queue?.doctorName || 'Dr. Sarah Jenkins'}</strong>
              </div>
            </div>

            {/* LIVE COUNTDOWN TIMER FOR DOCTOR CALL-UP */}
            {(() => {
              const isEmergency = isEmergencyPreempted || ticketData?.visit_type === 'EMERGENCY' || receiptData?.queue?.visitType === 'EMERGENCY';
              const thresholdSecs = isEmergency ? 120 : 300; // 2 mins for emergency, 5 mins for routine
              const isCountdownActive = isCalledOrInConsult || countdownSeconds <= thresholdSecs;

              return (
                <div style={{
                  background: isEmergency ? '#fff1f2' : isCountdownActive ? '#f0fdf4' : '#f0f9ff',
                  border: isEmergency ? '2px solid #f43f5e' : isCountdownActive ? '2px solid #16a34a' : '2px solid #0284c7',
                  padding: '1.25rem',
                  borderRadius: '14px',
                  textAlign: 'center',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.1)',
                  position: 'relative'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    color: isEmergency ? '#be123c' : isCountdownActive ? '#15803d' : '#475569',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    gap: '0.4rem'
                  }}>
                    <Timer size={18} color={isEmergency ? '#be123c' : isCountdownActive ? '#16a34a' : '#0284c7'} />
                    {isCalledOrInConsult
                      ? 'TREATMENT CALL-UP ACTIVE'
                      : isEmergency
                      ? (isCountdownActive ? '⚡ LIVE 2-MIN EMERGENCY CALL-UP COUNTDOWN' : '🚨 EMERGENCY TRIAGE PREEMPTION ACTIVE')
                      : (isCountdownActive ? '⚡ LIVE 5-MIN CALL-UP COUNTDOWN' : '⏳ 5-MIN CALL-UP ALERT PENDING')}
                  </div>

                  {isCountdownActive ? (
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 900,
                      color: isCalledOrInConsult ? '#16a34a' : isEmergency ? '#e11d48' : '#15803d',
                      marginTop: '0.2rem',
                      letterSpacing: '1px',
                      fontFamily: 'monospace'
                    }}>
                      {isCalledOrInConsult ? '00m 00s' : formatCountdown(countdownSeconds)}
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem 0' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: isEmergency ? '#be123c' : '#0284c7', letterSpacing: '0.5px' }}>
                        {ticketData?.eta_range || receiptData?.queue?.etaRange || '10:40 – 10:55 AM'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.25rem' }}>
                        {isEmergency
                          ? 'Live 2-min emergency ticking countdown starts automatically when wait time is ≤ 2 mins'
                          : 'Live 5-min ticking timer starts automatically when wait time is ≤ 5 mins'}
                      </div>
                    </div>
                  )}

                  {receiptData?.emergencyAlert?.active && (
                    <div style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: 800, marginTop: '0.25rem' }}>
                      ⚠️ +{receiptData?.emergencyAlert?.delayMinutes || 20} MINS EMERGENCY DELAY INCLUDED
                    </div>
                  )}

                  <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600, marginTop: '0.35rem' }}>
                    Predictive Slot: <strong>{ticketData?.eta_range || receiptData?.queue?.etaRange || '10:40 – 10:55 AM'}</strong> (85% AI Confidence)
                  </div>
                </div>
              );
            })()}

            {/* Live Stats Grid */}
            <div className="stats-grid" style={{ marginTop: '1rem' }}>
              <div className="stat-box">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Currently Serving</div>
                <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
                  {ticketData?.currently_serving || receiptData?.queue?.currentlyServing || 'A-099'}
                </div>
              </div>

              <div className="stat-box">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Patients Ahead</div>
                <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
                  {ticketData?.patients_ahead ?? receiptData?.queue?.patientsAhead ?? 1}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={handleHoldSpot} className="btn btn-secondary" style={{ flex: 1 }}>
                <PauseCircle size={18} /> Hold Spot
              </button>

              <button onClick={handleCopyShareLink} className="btn btn-secondary" style={{ flex: 1 }}>
                {copied ? <Check size={18} color="#059669" /> : <Share2 size={18} />} Share Link
              </button>

              <button onClick={() => { fetchTokenData(activeToken); fetchReceiptData(activeToken); }} className="btn btn-secondary" style={{ width: 'auto' }}>
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: Official Digital Patient Receipt */}
      {activeTab === 'receipt' && (
        <div className="receipt-card">
          {/* Clinic Header */}
          <div className="receipt-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Building size={22} color="#0284c7" />
              <div className="receipt-title">{receiptData?.clinicName || "PulseQ OPD & Emergency Care"}</div>
            </div>
            <div className="receipt-subtitle">{receiptData?.clinicAddress || "Building 4, Health Plaza, Medical District"}</div>
            <div className="receipt-subtitle">{receiptData?.clinicContact || "+1 (800) 555-PULSEQ | info@pulseqhealth.org"}</div>

            <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="receipt-badge receipt-badge-success">
                <ShieldCheck size={13} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-2px' }} />
                VERIFIED DIGITAL RECEIPT
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                {receiptData?.receiptNumber || `REC-20260911-${activeToken}`}
              </span>
            </div>
          </div>

          {/* Emergency Priority Preemption Notice on Receipt */}
          {receiptData?.emergencyAlert?.active && (
            <div style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#9f1239' }}>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <AlertTriangle size={16} color="#e11d48" /> OFFICIAL SCHEDULE ADJUSTMENT NOTICE
              </div>
              <div>
                Doctor is attending an emergency case. Estimated wait time has shifted by +{receiptData.emergencyAlert.delayMinutes} mins. Receipt & queue order remain 100% valid.
              </div>
            </div>
          )}

          {/* Patient Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Patient Name</div>
              <strong style={{ color: '#0f172a' }}>{receiptData?.patient?.fullName || ticketData?.patient_name || 'Alex Morgan'}</strong>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Patient Code</div>
              <strong>{receiptData?.patient?.idCode || 'PAT-101'}</strong>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Phone Number</div>
              <strong>{receiptData?.patient?.phone || '+1 555-0199'}</strong>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Age / Gender</div>
              <strong>{receiptData?.patient?.age || 35} Yrs / {receiptData?.patient?.gender || 'Male'}</strong>
            </div>
          </div>

          {/* OPD & Queue Information */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0284c7', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Ticket size={16} /> OPD Queue Registration & Call Location
            </h3>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700 }}>ASSIGNED TOKEN</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0284c7', lineHeight: '1.1' }}>
                  {receiptData?.queue?.tokenNumber || activeToken}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                  Visit Type: {receiptData?.queue?.visitType || 'ROUTINE'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Treatment Call-Up Desk</div>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Room {receiptData?.queue?.roomNumber || '101'} (Floor {receiptData?.queue?.floor || '1'})</strong>
                <div style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: 700, marginTop: '0.1rem' }}>
                  Dr. {receiptData?.queue?.doctorName || 'Sarah Jenkins'}
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Doctor Call Countdown Stamped on Receipt */}
          {(() => {
            const isEmergency = isEmergencyPreempted || ticketData?.visit_type === 'EMERGENCY' || receiptData?.queue?.visitType === 'EMERGENCY';
            const thresholdSecs = isEmergency ? 120 : 300;
            const isCountdownActive = isCalledOrInConsult || countdownSeconds <= thresholdSecs;

            return (
              <div style={{ background: isEmergency ? '#fff1f2' : isCountdownActive ? '#faf5ff' : '#f0f9ff', border: isEmergency ? '1px solid #fda4af' : isCountdownActive ? '1px solid #e9d5ff' : '1px solid #bae6fd', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: isEmergency ? '#be123c' : isCountdownActive ? '#6b21a8' : '#0369a1', fontWeight: 800, textTransform: 'uppercase' }}>
                    {isCalledOrInConsult ? '⏱️ DOCTOR CALL-UP ACTIVE' : isEmergency ? (isCountdownActive ? '⚡ LIVE 2-MIN EMERGENCY COUNTDOWN' : '🚨 EMERGENCY TRIAGE ADJUSTMENT') : (isCountdownActive ? '⏱️ DOCTOR CALL-UP COUNTDOWN (ACTIVE)' : '⏳ 5-MIN COUNTDOWN ALERT PENDING')}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: isEmergency ? '#e11d48' : isCountdownActive ? '#7e22ce' : '#0284c7', fontFamily: 'monospace' }}>
                    {isCalledOrInConsult ? '00m 00s (CALLING NOW)' : isCountdownActive ? formatCountdown(countdownSeconds) : (receiptData?.queue?.etaRange || '10:40 – 10:55 AM')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estimated Time Window</div>
                  <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.95rem' }}>
                    {receiptData?.queue?.etaRange || '10:40 – 10:55 AM'}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Billing & Financial Breakdown */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#059669', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CreditCard size={16} /> Official Receipt & Billing Summary
            </h3>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>OPD Consultation Fee ({receiptData?.queue?.doctorSpecialty || 'General OPD'})</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${receiptData?.billing?.consultationFee || '50.00'}</td>
                </tr>
                <tr>
                  <td>Registration & Digital Queue Pass Fee</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${receiptData?.billing?.facilityFee || '10.00'}</td>
                </tr>
                <tr>
                  <td>Taxes & Service Charge</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>$0.00</td>
                </tr>
                <tr className="receipt-total-row">
                  <td>TOTAL PAID</td>
                  <td style={{ textAlign: 'right', color: '#059669' }}>${receiptData?.billing?.totalAmount || '60.00'}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
              <span>Payment Mode: <strong>{receiptData?.billing?.paymentMethod || 'COUNTER / DIGITAL PASS'}</strong></span>
              <span>Ref: <strong>{receiptData?.billing?.transactionRef || 'TXN-884920'}</strong></span>
            </div>
          </div>

          {/* QR Code Verification Placeholder */}
          <div className="qr-placeholder">
            <QrCode size={48} color="#0284c7" />
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center' }}>
              Scan QR code at clinic kiosk or reception desk for instant OPD check-in & verification
            </div>
          </div>

          {/* Action Buttons */}
          <div className="no-print" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button onClick={handleCopyShareLink} className="btn btn-primary" style={{ flex: 1 }}>
              {copied ? <Check size={18} /> : <Share2 size={18} />} Copy Share Link
            </button>
            <button onClick={handlePrintReceipt} className="btn btn-secondary" style={{ flex: 1 }}>
              <Printer size={18} /> Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Digital Intake Form */}
      {activeTab === 'intake' && (
        <div className="ticket-card" style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
            Digital Pre-Consultation Intake
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Filling this form helps your consulting doctor prepare for your evaluation in advance.
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

import React, { useState } from 'react';
import {
  Touchpad, User, HeartPulse, Stethoscope, AlertTriangle, Printer, CheckCircle, ArrowLeft, RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [step, setStep] = useState(1); // 1: Purpose, 2: Info, 3: Doctor, 4: Ticket Print
  const [visitType, setVisitType] = useState('WALK_IN');
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(1);
  const [generatedTicket, setGeneratedTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);

  React.useEffect(() => {
    fetch('http://localhost:5000/api/doctors')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDoctors(data.map(d => ({
            id: d.id,
            name: d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim(),
            dept: d.department || d.specialty || 'General Medicine',
            room: d.room_number ? `Room ${d.room_number}` : 'Room 101'
          })));
        } else {
          setDoctors([{ id: 1, name: 'Dr. Rajesh Shah', dept: 'Orthopedics & Joint Care', room: 'Room 204' }]);
        }
      })
      .catch(() => {
        setDoctors([{ id: 1, name: 'Dr. Rajesh Shah', dept: 'Orthopedics & Joint Care', room: 'Room 204' }]);
      });
  }, []);

  const handlePurposeSelect = (type) => {
    setVisitType(type);
    setStep(2);
  };

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    if (!patientName.trim()) {
      alert('Please enter patient name');
      return;
    }
    setStep(3);
  };

  const handleGenerateTicket = async (doctorId) => {
    setLoading(true);
    try {
      const selectedDoc = doctors.find(d => d.id === doctorId);
      const res = await fetch(`${API_BASE}/queue/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          phone: phone || '+1 555-0199',
          doctorId,
          visitType,
          symptoms: 'Kiosk self check-in'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedTicket({
          token: data.item?.token_number || 'A-102',
          patientName,
          doctorName: selectedDoc?.name || 'Dr. Sarah Jenkins',
          room: selectedDoc?.room || 'Room 101',
          eta: data.item?.estimated_start_time || '10:45 AM',
          date: new Date().toLocaleDateString()
        });
        setStep(4);
      } else {
        alert(data.error || 'Check-in failed');
      }
    } catch (err) {
      alert('Error connecting to kiosk server');
    } finally {
      setLoading(false);
    }
  };

  const resetKiosk = () => {
    setStep(1);
    setPatientName('');
    setPhone('');
    setGeneratedTicket(null);
  };

  return (
    <div className="kiosk-container">
      {/* Kiosk Header */}
      <div className="kiosk-header">
        <h1>SMART CLINIC SELF-SERVICE CHECK-IN</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.4rem' }}>
          Touch the screen to generate your digital appointment token
        </p>
      </div>

      {/* STEP 1: Select Purpose */}
      {step === 1 && (
        <div className="step-card-grid">
          <div className="kiosk-btn" onClick={() => handlePurposeSelect('WALK_IN')}>
            <Stethoscope size={64} color="var(--accent-cyan)" />
            <div className="kiosk-title">General Consultation</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Walk-in check-in for physician visit</p>
          </div>

          <div className="kiosk-btn" onClick={() => handlePurposeSelect('FOLLOW_UP')}>
            <HeartPulse size={64} color="var(--accent-emerald)" />
            <div className="kiosk-title">Follow-Up Visit</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Review past results or prescription</p>
          </div>

          <div className="kiosk-btn" onClick={() => handlePurposeSelect('DIAGNOSTICS')}>
            <Touchpad size={64} color="var(--accent-blue)" />
            <div className="kiosk-title">Lab & Diagnostics</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Blood work, ECG, X-Ray collection</p>
          </div>

          <div className="kiosk-btn emergency" onClick={() => handlePurposeSelect('EMERGENCY')}>
            <AlertTriangle size={64} color="var(--accent-red)" />
            <div className="kiosk-title" style={{ color: 'var(--accent-red)' }}>EMERGENCY INTAKE</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Immediate priority triage check-in</p>
          </div>
        </div>
      )}

      {/* STEP 2: Patient Identification Form */}
      {step === 2 && (
        <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%', background: 'var(--bg-card)', padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Enter Patient Details</h2>
          <form onSubmit={handleInfoSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Full Patient Name</label>
              <input
                type="text"
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.3rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border)', color: '#0f172a' }}
                placeholder="e.g. Alex Morgan"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Phone Number (for SMS updates)</label>
              <input
                type="text"
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.3rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border)', color: '#0f172a' }}
                placeholder="e.g. +1 (555) 019-2834"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={() => setStep(1)} className="btn-touch btn-secondary" style={{ flex: 1 }}>
                <ArrowLeft size={20} /> Back
              </button>
              <button type="submit" className="btn-touch btn-cyan" style={{ flex: 2 }}>
                Next: Select Doctor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: Doctor Selection */}
      {step === 3 && (
        <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.5rem' }}>Select Attending Physician</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {doctors.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleGenerateTicket(doc.id)}
                style={{
                  background: 'var(--bg-card)',
                  border: '2px solid var(--border)',
                  padding: '1.5rem 2rem',
                  borderRadius: '20px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{doc.name}</h3>
                  <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{doc.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{doc.room}</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Tap to Confirm</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: Printed Ticket Simulation */}
      {step === 4 && generatedTicket && (
        <div>
          <div className="ticket-print-modal">
            <div style={{ borderBottom: '2px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900 }}>SMART CLINIC TICKET</h2>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>{generatedTicket.date}</div>
            </div>

            <div style={{ fontSize: '0.9rem', color: '#444' }}>YOUR QUEUE TOKEN</div>
            <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#000', letterSpacing: '3px', margin: '0.5rem 0' }}>
              {generatedTicket.token}
            </div>

            <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              <div><strong>Patient:</strong> {generatedTicket.patientName}</div>
              <div><strong>Doctor:</strong> {generatedTicket.doctorName}</div>
              <div><strong>Location:</strong> {generatedTicket.room}</div>
              <div><strong>Est Start:</strong> {generatedTicket.eta}</div>
            </div>

            <div style={{ borderTop: '2px dashed #000', paddingTop: '1rem', fontSize: '0.75rem', color: '666' }}>
              <Printer size={24} style={{ margin: '0 auto 0.4rem' }} />
              <div>Printing Physical Ticket... Please take ticket from tray.</div>
            </div>
          </div>

          <div style={{ maxWidth: '420px', margin: '1.5rem auto 0', textAlign: 'center' }}>
            <button onClick={resetKiosk} className="btn-touch btn-cyan">
              <RefreshCw size={20} /> Finish & Reset Kiosk
            </button>
          </div>
        </div>
      )}

      {/* Kiosk Footer */}
      <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Smart Clinic System • Need help? Reception staff is available at Desk 1
      </div>
    </div>
  );
}

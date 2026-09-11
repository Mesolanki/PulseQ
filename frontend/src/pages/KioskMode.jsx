import React, { useState, useEffect } from 'react';
import { fetchDoctors, checkInPatient, registerPatient } from '../services/api';

export default function KioskMode() {
  const [step, setStep] = useState(1); // 1: Welcome, 2: Patient Info, 3: Doctor & Reason, 4: Ticket Token Print
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [generatedToken, setGeneratedToken] = useState(null);

  useEffect(() => {
    fetchDoctors().then(docs => {
      setDoctors(docs);
      if (docs.length > 0) setSelectedDoctorId(docs[0].id);
    });
  }, []);

  const handleKioskCheckIn = async (e) => {
    e.preventDefault();
    try {
      // 1. Register patient
      const patient = await registerPatient({
        fullName,
        phone,
        preferredLanguage: 'English'
      });

      // 2. Issue Token
      const doc = doctors.find(d => d.id === selectedDoctorId);
      const deptId = doc ? doc.department_id : 'dept-ortho';

      const tokenRes = await checkInPatient({
        patientId: patient.id,
        doctorId: selectedDoctorId,
        departmentId: deptId,
        visitType: 'ROUTINE',
        isWalkin: true
      });

      setGeneratedToken({
        ...tokenRes,
        doctorName: doc ? doc.full_name : 'Dr. Shah',
        roomNumber: doc ? doc.room_number : '204',
        floor: doc ? doc.floor : '2'
      });

      setStep(4);
    } catch (err) {
      alert(err.message);
    }
  };

  const resetKiosk = () => {
    setStep(1);
    setFullName('');
    setPhone('');
    setGeneratedToken(null);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
      <div className="card" style={{ padding: '36px', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Welcome to Smart Clinic</h1>
            <p style={{ fontSize: '18px', color: 'var(--text-muted)', marginBottom: '32px' }}>
              Self-Service Check-In Terminal & Token Dispenser
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', padding: '20px', fontSize: '22px' }} onClick={() => setStep(2)}>
              👉 TOUCH TO START CHECK-IN
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Enter Patient Details</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Please enter your name and phone number to receive your token ticket.</p>
            <form onSubmit={() => setStep(3)}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '16px' }}>Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '14px', fontSize: '18px' }} 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '16px' }}>Mobile Phone Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '14px', fontSize: '18px' }} 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="e.g. +1 555-0199"
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }}>Next Step 👉</button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Select Doctor or Department</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Choose your consulting physician for today's visit.</p>
            <form onSubmit={handleKioskCheckIn}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '16px' }}>Available Doctors</label>
                <select 
                  className="form-select" 
                  style={{ padding: '14px', fontSize: '18px' }} 
                  value={selectedDoctorId} 
                  onChange={e => setSelectedDoctorId(e.target.value)}
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.department_name} - Room {d.room_number})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                <button type="button" className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(2)}>Back</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 2 }}>🎫 Issue Token</button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && generatedToken && (
          <div style={{ textAlign: 'center' }}>
            <span className="badge badge-routine" style={{ fontSize: '14px', padding: '6px 16px' }}>PRINTED TICKET PREVIEW</span>
            <div style={{ border: '2px dashed var(--primary-teal)', padding: '24px', borderRadius: '16px', margin: '20px 0', background: 'var(--bg-main)' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary-teal-deep)' }}>SMART CLINIC</div>
              <div style={{ fontSize: '54px', fontWeight: '800', fontFamily: 'var(--font-serif)', color: 'var(--primary-teal-deep)', margin: '10px 0' }}>
                {generatedToken.token_number}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>Patient: {fullName}</div>
              <div style={{ fontSize: '16px', marginTop: '6px' }}>Doctor: {generatedToken.doctorName}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-teal-deep)', marginTop: '6px' }}>
                ROOM {generatedToken.roomNumber} · FLOOR {generatedToken.floor}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
                Scan QR or track live on your phone: /q/{generatedToken.token_number}
              </div>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={resetKiosk}>
              Done — Return to Home Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

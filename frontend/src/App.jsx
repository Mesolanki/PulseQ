import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ReceptionDashboard from './pages/ReceptionDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import VirtualWaitingRoom from './pages/VirtualWaitingRoom';
import KioskMode from './pages/KioskMode';
import LiveDisplay from './pages/LiveDisplay';

import socket from './services/socket';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentRole, setCurrentRole] = useState('HOSPITAL_ADMIN'); // Default role
  const [currentView, setCurrentView] = useState('admin'); // admin, reception, doctor, waiting-room, kiosk, display, login
  const [highContrast, setHighContrast] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const handleLoginSuccess = (userObj) => {
    setUser(userObj);
    setCurrentRole(userObj.role);
    if (userObj.role === 'SUPER_ADMIN' || userObj.role === 'HOSPITAL_ADMIN') {
      setCurrentView('admin');
    } else if (userObj.role === 'RECEPTIONIST') {
      setCurrentView('reception');
    } else if (userObj.role === 'DOCTOR') {
      setCurrentView('doctor');
    } else if (userObj.role === 'KIOSK') {
      setCurrentView('kiosk');
    } else {
      setCurrentView('admin');
    }
  };

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    if (!highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  };

  if (currentView === 'display') {
    return <LiveDisplay />;
  }

  if (currentView === 'kiosk') {
    return (
      <div className="app-container">
        <Header 
          user={user} 
          currentRole="KIOSK" 
          onSelectRole={() => setCurrentView('login')} 
          highContrast={highContrast} 
          onToggleContrast={toggleHighContrast}
          socketConnected={socketConnected}
        />
        <main className="main-content">
          <KioskMode />
        </main>
      </div>
    );
  }

  if (currentView === 'waiting-room') {
    return (
      <div className="app-container">
        <Header 
          user={user} 
          currentRole="PATIENT" 
          onSelectRole={() => setCurrentView('login')} 
          highContrast={highContrast} 
          onToggleContrast={toggleHighContrast}
          socketConnected={socketConnected}
        />
        <main className="main-content">
          <VirtualWaitingRoom tokenParam="ORTH-103" />
        </main>
      </div>
    );
  }

  if (currentView === 'login') {
    return (
      <div className="app-container">
        <Header 
          user={user} 
          currentRole={currentRole} 
          onSelectRole={() => setCurrentView('login')} 
          highContrast={highContrast} 
          onToggleContrast={toggleHighContrast}
          socketConnected={socketConnected}
        />
        <main className="main-content">
          <Login onLoginSuccess={handleLoginSuccess} onSelectView={setCurrentView} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header 
        user={user} 
        currentRole={currentRole} 
        onSelectRole={() => setCurrentView('login')} 
        highContrast={highContrast} 
        onToggleContrast={toggleHighContrast}
        socketConnected={socketConnected}
      />

      {/* Role Navigation Bar */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '8px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('admin')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            🏢 Executive Admin Dashboard
          </button>
          <button 
            className={`btn ${currentView === 'reception' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('reception')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            📋 Reception & Check-In Desk
          </button>
          <button 
            className={`btn ${currentView === 'doctor' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('doctor')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            🩺 Doctor Consultation Station
          </button>
          <button 
            className={`btn ${currentView === 'waiting-room' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('waiting-room')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            📱 Patient Virtual Waiting Room
          </button>
          <button 
            className={`btn ${currentView === 'kiosk' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('kiosk')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            🖥️ Self-Service Kiosk
          </button>
          <button 
            className={`btn ${currentView === 'display' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('display')}
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            📺 Lobby Live TV Display
          </button>
        </div>
      </div>

      <main className="main-content">
        {currentView === 'admin' && <AdminDashboard />}
        {currentView === 'reception' && <ReceptionDashboard />}
        {currentView === 'doctor' && <DoctorDashboard user={user} />}
      </main>
    </div>
  );
}

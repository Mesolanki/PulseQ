import React, { useState, useEffect } from 'react';
import ReceptionPortal from '../reception-web/src/App.jsx';
import DoctorPortal from '../doctor-web/src/App.jsx';
import PatientPortal from '../patient-web/src/App.jsx';
import AdminPortal from '../admin-web/src/App.jsx';
import KioskPortal from '../kiosk-web/src/App.jsx';
import DisplayPortal from '../waiting-display-web/src/App.jsx';
import { 
  Building2, Stethoscope, UserCheck, Ticket, Touchpad, Tv, 
  Activity, ShieldCheck, Share2, Check, RefreshCw 
} from 'lucide-react';

export default function App() {
  // Portal options: 'reception', 'doctor', 'patient', 'admin', 'kiosk', 'display'
  const [activePortal, setActivePortal] = useState('reception');
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync URL parameter ?portal=... on mount and browser back/forward buttons
  useEffect(() => {
    const parseUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const portalParam = params.get('portal');
      const tokenParam = params.get('token') || params.get('receipt');

      if (tokenParam) {
        setActivePortal('patient');
      } else if (portalParam && ['reception', 'doctor', 'patient', 'admin', 'kiosk', 'display'].includes(portalParam.toLowerCase())) {
        setActivePortal(portalParam.toLowerCase());
      }
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  // Switch Portal and update browser address bar URL seamlessly
  const handlePortalSwitch = (portalKey) => {
    setActivePortal(portalKey);
    const url = new URL(window.location);
    url.searchParams.set('portal', portalKey);
    window.history.pushState({}, '', url);
  };

  const copyShareableLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?portal=${activePortal}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      
      {/* MASTER SUITE TOP NAVIGATION BAR */}
      <header style={{ 
        background: '#ffffff', 
        borderBottom: '1px solid #e2e8f0', 
        position: 'sticky', 
        top: 0, 
        zIndex: 9999, 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)' 
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '10px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '12px' 
        }}>
          
          {/* Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              background: '#0284c7', 
              color: '#ffffff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: '800'
            }}>
              <Activity size={22} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                PulseQueue
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                Smart Clinic Unified Master Suite
              </div>
            </div>
          </div>

          {/* Master 6 Portal Switcher Tabs */}
          <nav style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px', background: '#f1f5f9', borderRadius: '10px' }}>
            <button 
              onClick={() => handlePortalSwitch('reception')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'reception' ? '#0284c7' : 'transparent',
                color: activePortal === 'reception' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'reception' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <UserCheck size={16} /> 📋 Reception Desk
            </button>

            <button 
              onClick={() => handlePortalSwitch('doctor')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'doctor' ? '#0284c7' : 'transparent',
                color: activePortal === 'doctor' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'doctor' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <Stethoscope size={16} /> 🩺 Doctor Station
            </button>

            <button 
              onClick={() => handlePortalSwitch('patient')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'patient' ? '#0284c7' : 'transparent',
                color: activePortal === 'patient' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'patient' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <Ticket size={16} /> 📱 Patient Ticket & Receipt
            </button>

            <button 
              onClick={() => handlePortalSwitch('admin')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'admin' ? '#0284c7' : 'transparent',
                color: activePortal === 'admin' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'admin' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <Building2 size={16} /> 🏢 Executive Admin
            </button>

            <button 
              onClick={() => handlePortalSwitch('kiosk')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'kiosk' ? '#0284c7' : 'transparent',
                color: activePortal === 'kiosk' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'kiosk' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <Touchpad size={16} /> 🖥️ Self-Service Kiosk
            </button>

            <button 
              onClick={() => handlePortalSwitch('display')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: activePortal === 'display' ? '#0284c7' : 'transparent',
                color: activePortal === 'display' ? '#ffffff' : '#475569',
                boxShadow: activePortal === 'display' ? '0 2px 4px rgba(2,132,199,0.3)' : 'none'
              }}
            >
              <Tv size={16} /> 📺 Lobby TV Display
            </button>
          </nav>

          {/* Quick Actions & Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={copyShareableLink}
              title="Copy link to this portal view"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {copiedLink ? <Check size={14} color="#059669" /> : <Share2 size={14} />}
              {copiedLink ? 'Link Copied!' : 'Share Portal Link'}
            </button>
          </div>

        </div>
      </header>

      {/* ACTIVE PORTAL RENDER CONTAINER */}
      <main style={{ flex: 1 }}>
        {activePortal === 'reception' && <ReceptionPortal />}
        {activePortal === 'doctor' && <DoctorPortal />}
        {activePortal === 'patient' && <PatientPortal />}
        {activePortal === 'admin' && <AdminPortal />}
        {activePortal === 'kiosk' && <KioskPortal />}
        {activePortal === 'display' && <DisplayPortal />}
      </main>

      {/* UNIFIED FOOTER */}
      <footer style={{ 
        background: '#ffffff', 
        borderTop: '1px solid #e2e8f0', 
        padding: '14px 24px', 
        textAlign: 'center', 
        fontSize: '12px', 
        color: '#64748b' 
      }}>
        PulseQueue Smart Outpatient Queue Intelligence System &copy; 2026 · Unified Master Suite · Single Entry Link Active
      </footer>

    </div>
  );
}

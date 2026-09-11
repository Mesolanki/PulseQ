const API_BASE = ''; // Uses Vite proxy to http://localhost:5000

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
}

export async function fetchQueue(departmentId = '', doctorId = '') {
  const query = new URLSearchParams();
  if (departmentId) query.append('departmentId', departmentId);
  if (doctorId) query.append('doctorId', doctorId);
  
  const res = await fetch(`${API_BASE}/api/queue?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function checkInPatient(data) {
  const res = await fetch(`${API_BASE}/api/queue/check-in`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Check-in failed');
  }
  return res.json();
}

export async function callNextPatient(doctorId) {
  const res = await fetch(`${API_BASE}/api/queue/call-next`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ doctorId })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || err.error || 'Failed to call patient');
  }
  return res.json();
}

export async function startConsultation(queueEntryId) {
  const res = await fetch(`${API_BASE}/api/queue/${queueEntryId}/start-consult`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to start consultation');
  return res.json();
}

export async function completeConsultation(queueEntryId, notes = '') {
  const res = await fetch(`${API_BASE}/api/queue/${queueEntryId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes })
  });
  if (!res.ok) throw new Error('Failed to complete consultation');
  return res.json();
}

export async function holdMySpot(queueEntryId, gracePeriodMinutes = 10) {
  const res = await fetch(`${API_BASE}/api/queue/${queueEntryId}/hold`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ gracePeriodMinutes })
  });
  if (!res.ok) throw new Error('Failed to hold spot');
  return res.json();
}

export async function resumeSpot(queueEntryId) {
  const res = await fetch(`${API_BASE}/api/queue/${queueEntryId}/resume`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to resume spot');
  return res.json();
}

export async function insertEmergency(data) {
  const res = await fetch(`${API_BASE}/api/queue/emergency`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to insert emergency');
  }
  return res.json();
}

export async function updateDoctorStatus(doctorId, status) {
  const res = await fetch(`${API_BASE}/api/doctors/${doctorId}/status`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update doctor status');
  return res.json();
}

export async function fetchDoctors() {
  const res = await fetch(`${API_BASE}/api/doctors`);
  if (!res.ok) throw new Error('Failed to fetch doctors');
  return res.json();
}

export async function fetchRooms() {
  const res = await fetch(`${API_BASE}/api/rooms`);
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

export async function assignDoctorToRoom(doctorId, roomNumber, floor) {
  const res = await fetch(`${API_BASE}/api/rooms/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ doctorId, roomNumber, floor })
  });
  if (!res.ok) throw new Error('Failed to assign room');
  return res.json();
}

export async function fetchAppointments() {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch appointments');
  return res.json();
}

export async function createAppointment(data) {
  const res = await fetch(`${API_BASE}/api/appointments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to book appointment');
  }
  return res.json();
}

export async function savePrescription(data) {
  const res = await fetch(`${API_BASE}/api/prescriptions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save prescription');
  return res.json();
}

export async function fetchPatientHistory(patientId) {
  const res = await fetch(`${API_BASE}/api/prescriptions/patient/${patientId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchDailyReport() {
  const res = await fetch(`${API_BASE}/api/reports/daily`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettings(settingsArray) {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ settings: settingsArray })
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function fetchVirtualWaitingRoom(token) {
  const res = await fetch(`${API_BASE}/api/queue/virtual-waiting-room/${token}`);
  if (!res.ok) throw new Error('Token not found');
  return res.json();
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE}/api/audit`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function registerPatient(data) {
  const res = await fetch(`${API_BASE}/api/patients`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to register patient');
  }
  return res.json();
}

export async function fetchPatients() {
  const res = await fetch(`${API_BASE}/api/patients`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function submitIntakeForm(data) {
  const res = await fetch(`${API_BASE}/api/intake`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to submit intake form');
  return res.json();
}

export async function fetchIntakeForm(queueEntryId) {
  const res = await fetch(`${API_BASE}/api/intake/${queueEntryId}`);
  if (!res.ok) return null;
  return res.json();
}

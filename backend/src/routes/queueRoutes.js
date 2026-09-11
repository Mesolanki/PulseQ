const express = require('express');
const router = express.Router();
const { get, all } = require('../db');
const { verifyToken } = require('../middleware/auth');
const {
  checkInPatient,
  callNextPatient,
  startConsultation,
  completeConsultation,
  holdMySpot,
  resumeSpot,
  insertEmergencyPatient,
  reallocateLatePatient
} = require('../services/queueEngine');
const { calculateQueueETAs } = require('../services/etaEngine');
const { broadcastQueueUpdate, broadcastEmergencyInserted } = require('../socket/socketGateway');

// GET full active queue state with ETAs & dashboard stats
router.get('/', (req, res) => {
  const { departmentId, doctorId, tokenNumber } = req.query;

  let sql = `
    SELECT q.*, p.full_name as patient_name, p.phone as patient_phone, p.patient_id_code, p.age, p.gender,
           d.full_name as doctor_name, d.room_number, d.floor,
           COALESCE(ds.status, d.status) as doctor_status,
           dept.name as department_name, dept.token_prefix,
           t.complexity_score, t.comorbidities_count
    FROM queue_entries q
    JOIN patients p ON q.patient_id = p.id
    LEFT JOIN doctors d ON q.doctor_id = d.id
    LEFT JOIN doctor_status ds ON ds.doctor_id = d.id
    LEFT JOIN departments dept ON q.department_id = dept.id
    LEFT JOIN triage_records t ON t.queue_entry_id = q.id
    WHERE q.status NOT IN ('COMPLETED', 'CANCELLED')
  `;
  const params = [];

  if (tokenNumber) {
    sql += ` AND (UPPER(q.token_number) = $1 OR q.id = $2)`;
    params.push(tokenNumber.toUpperCase(), tokenNumber.toUpperCase());
  } else if (doctorId) {
    sql += ` AND q.doctor_id = $1`;
    params.push(doctorId);
  } else if (departmentId) {
    sql += ` AND q.department_id = $1`;
    params.push(departmentId);
  }

  sql += ` ORDER BY q.priority_level ASC, q.joined_at ASC`;

  const queueList = all(sql, params);
  const etasMap = calculateQueueETAs(departmentId, doctorId);

  // Find currently serving token
  const allActiveQueue = all(`SELECT token_number, status FROM queue_entries WHERE status IN ('IN_CONSULTATION', 'CALLED') ORDER BY called_at DESC LIMIT 1`);
  const currentlyServingToken = allActiveQueue.length > 0 ? allActiveQueue[0].token_number : 'A-101';

  // Attach ETA to queue entries
  const enrichedQueue = queueList.map(entry => {
    const eta = etasMap[entry.token_number] || etasMap[entry.id] || null;
    const lower = eta ? eta.lowerBound : '10:40 AM';
    const upper = eta ? eta.upperBound : '10:55 AM';
    const etaRangeText = eta ? `${lower} – ${upper}` : '10:40 – 10:55 AM';

    return {
      ...entry,
      currently_serving: currentlyServingToken,
      patients_ahead: eta ? eta.patientsAhead : 0,
      eta_range: etaRangeText,
      eta
    };
  });

  // Stats calculation
  const waitingList = enrichedQueue.filter(q => q.status === 'WAITING' || q.status === 'RESUMED');
  const inConsultList = enrichedQueue.filter(q => q.status === 'IN_CONSULTATION');

  const stats = {
    totalActive: enrichedQueue.length,
    waitingCount: waitingList.length,
    inConsultCount: inConsultList.length,
    emergencyCount: enrichedQueue.filter(q => q.priority_level === 1).length,
    avgWaitMinutes: waitingList.length > 0 ? Math.round(waitingList.reduce((acc, cur) => acc + (cur.eta ? cur.eta.estimatedWaitMinutes : 15), 0) / waitingList.length) : 0
  };

  res.json({
    queue: enrichedQueue,
    stats
  });
});

// Check-in patient & generate token
router.post('/check-in', (req, res) => {
  const { patientId, doctorId, departmentId, appointmentId, visitType, isWalkin } = req.body;
  if (!patientId || !departmentId) {
    return res.status(400).json({ error: 'Patient ID and Department ID are required' });
  }

  const entry = checkInPatient({
    patientId,
    doctorId,
    departmentId,
    appointmentId,
    visitType: visitType || 'ROUTINE',
    isWalkin: !!isWalkin,
    userId: req.user ? req.user.id : 'receptionist'
  });

  broadcastQueueUpdate({ action: 'CHECK_IN', tokenNumber: entry.token_number });
  res.status(201).json(entry);
});

// Call next patient
router.post('/call-next', (req, res) => {
  const { doctorId } = req.body;
  const docId = doctorId || (req.user && req.user.role === 'DOCTOR' ? req.user.id : 'doc-shah');

  const calledEntry = callNextPatient({ doctorId: docId, userId: req.user ? req.user.id : 'doc-shah' });
  if (!calledEntry) {
    return res.status(404).json({ message: 'No waiting patients in queue for this doctor' });
  }

  broadcastQueueUpdate({ action: 'PATIENT_CALLED', tokenNumber: calledEntry.token_number });
  res.json(calledEntry);
});

// Start consultation
router.post('/:id/start-consult', (req, res) => {
  const updated = startConsultation({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'doc-shah' });
  if (!updated) return res.status(404).json({ error: 'Queue entry not found' });

  broadcastQueueUpdate({ action: 'CONSULTATION_STARTED', tokenNumber: updated.token_number });
  res.json(updated);
});

// Complete consultation
router.post('/:id/complete', (req, res) => {
  const { notes } = req.body;
  const updated = completeConsultation({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'doc-shah', notes });
  if (!updated) return res.status(404).json({ error: 'Queue entry not found' });

  broadcastQueueUpdate({ action: 'CONSULTATION_COMPLETED', tokenNumber: updated.token_number });
  res.json(updated);
});

// Generic status update for queue entry (e.g. IN_CONSULTATION, COMPLETED, CALLED)
router.put('/:id/status', (req, res) => {
  const { status, notes } = req.body;
  if (status === 'IN_CONSULTATION') {
    const updated = startConsultation({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'doc-shah' });
    if (!updated) return res.status(404).json({ error: 'Queue entry not found' });
    broadcastQueueUpdate({ action: 'CONSULTATION_STARTED', tokenNumber: updated.token_number });
    return res.json(updated);
  } else if (status === 'COMPLETED') {
    const updated = completeConsultation({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'doc-shah', notes });
    if (!updated) return res.status(404).json({ error: 'Queue entry not found' });
    broadcastQueueUpdate({ action: 'CONSULTATION_COMPLETED', tokenNumber: updated.token_number });
    return res.json(updated);
  }
  run(`UPDATE queue_entries SET status = $1 WHERE id = $2`, [status, req.params.id]);
  const updated = get(`SELECT * FROM queue_entries WHERE id = $1`, [req.params.id]);
  broadcastQueueUpdate({ action: 'STATUS_UPDATED', tokenNumber: updated ? updated.token_number : '' });
  res.json(updated || { success: true });
});


// Hold My Spot
router.post('/:id/hold', (req, res) => {
  const { gracePeriodMinutes = 10 } = req.body;
  const updated = holdMySpot({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'patient', gracePeriodMinutes });
  if (!updated) return res.status(404).json({ error: 'Queue entry not found' });

  broadcastQueueUpdate({ action: 'HOLD_MY_SPOT', tokenNumber: updated.token_number });
  res.json(updated);
});

// Resume Spot
router.post('/:id/resume', (req, res) => {
  const updated = resumeSpot({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'patient' });
  if (!updated) return res.status(404).json({ error: 'Queue entry not found' });

  broadcastQueueUpdate({ action: 'RESUMED', tokenNumber: updated.token_number });
  res.json(updated);
});

// Mark Late & Auto-Reallocate Patient to Buffer Slot
router.post('/:id/reallocate-late', (req, res) => {
  const updated = reallocateLatePatient({ queueEntryId: req.params.id, userId: req.user ? req.user.id : 'receptionist' });
  if (!updated) return res.status(404).json({ error: 'Queue entry not found' });

  broadcastQueueUpdate({ action: 'LATE_PATIENT_REALLOCATED', tokenNumber: updated.token_number });
  res.json(updated);
});

// Insert Emergency Patient
router.post('/emergency', (req, res) => {
  const { patientId, doctorId, departmentId, reason } = req.body;
  if (!patientId || !departmentId || !doctorId) {
    return res.status(400).json({ error: 'Patient ID, Doctor ID, and Department ID required' });
  }

  const entry = insertEmergencyPatient({
    patientId,
    doctorId,
    departmentId,
    reason: reason || 'Urgent Clinical Preemption',
    userId: req.user ? req.user.id : 'receptionist'
  });

  broadcastEmergencyInserted({ tokenNumber: entry.token_number, doctorId, reason });
  broadcastQueueUpdate({ action: 'EMERGENCY_INSERTED', tokenNumber: entry.token_number });

  res.status(201).json(entry);
});

// Public Virtual Waiting Room Lookup (/api/virtual-waiting-room/:token)
router.get('/virtual-waiting-room/:token', (req, res) => {
  const token = req.params.token.toUpperCase();
  const entry = get(
    `SELECT q.*, p.full_name as patient_name, d.full_name as doctor_name, d.room_number, d.floor,
            COALESCE(ds.status, d.status) as doctor_status, dept.name as department_name
     FROM queue_entries q
     JOIN patients p ON q.patient_id = p.id
     LEFT JOIN doctors d ON q.doctor_id = d.id
     LEFT JOIN doctor_status ds ON ds.doctor_id = d.id
     LEFT JOIN departments dept ON q.department_id = dept.id
     WHERE UPPER(q.token_number) = $1 OR q.id = $2`,
    [token, token]
  );

  if (!entry) {
    return res.status(404).json({ error: 'Token not found or queue entry expired' });
  }

  const etasMap = calculateQueueETAs(entry.department_id, entry.doctor_id);
  const eta = etasMap[entry.token_number] || etasMap[entry.id] || null;

  // Mask patient name for public privacy protection (e.g. "Sneha Patel" -> "Sneha P.")
  const nameParts = entry.patient_name.split(' ');
  const maskedName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : entry.patient_name;

  res.json({
    tokenNumber: entry.token_number,
    queueEntryId: entry.id,
    patientName: maskedName,
    doctorName: entry.doctor_name,
    doctorStatus: entry.doctor_status,
    roomNumber: entry.room_number,
    floor: entry.floor,
    departmentName: entry.department_name,
    status: entry.status,
    visitType: entry.visit_type,
    priorityLevel: entry.priority_level,
    eta
  });
});

// Public Digital Patient Receipt & Pass Endpoint (/api/queue/receipt/:token)
router.get('/receipt/:token', (req, res) => {
  const token = req.params.token.toUpperCase();
  const entry = get(
    `SELECT q.*, p.full_name as patient_name, p.phone as patient_phone, p.patient_id_code, p.age, p.gender,
            d.full_name as doctor_name, d.room_number, d.floor, d.title as doctor_title,
            dept.name as department_name
     FROM queue_entries q
     JOIN patients p ON q.patient_id = p.id
     LEFT JOIN doctors d ON q.doctor_id = d.id
     LEFT JOIN departments dept ON q.department_id = dept.id
     WHERE UPPER(q.token_number) = $1 OR q.id = $2`,
    [token, token]
  );

  if (!entry) {
    return res.status(404).json({ error: 'Receipt or Queue token not found' });
  }

  const etasMap = calculateQueueETAs(entry.department_id, entry.doctor_id);
  const eta = etasMap[entry.token_number] || etasMap[entry.id] || null;

  // Find currently serving token
  const allActiveQueue = all(`SELECT token_number FROM queue_entries WHERE status IN ('IN_CONSULTATION', 'CALLED') ORDER BY called_at DESC LIMIT 1`);
  const currentlyServingToken = allActiveQueue.length > 0 ? allActiveQueue[0].token_number : 'A-099';

  // Check for active emergencies for doctor/department
  const activeEmergencies = all(
    `SELECT token_number FROM queue_entries WHERE priority_level = 1 AND status NOT IN ('COMPLETED', 'CANCELLED') AND (doctor_id = $1 OR department_id = $2)`,
    [entry.doctor_id || '', entry.department_id || '']
  );
  const isEmergencyActive = activeEmergencies.length > 0;
  const emergencyDelayMins = activeEmergencies.length * 20;

  const receiptNo = `REC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${entry.token_number.replace('-', '')}`;
  const regFee = entry.visit_type === 'EMERGENCY' ? 100.00 : entry.visit_type === 'FIRST_VISIT' ? 60.00 : 50.00;
  const facilityFee = 10.00;
  const totalAmount = regFee + facilityFee;

  res.json({
    receiptNumber: receiptNo,
    issueDate: entry.joined_at || new Date().toISOString(),
    clinicName: "PulseQ Outpatient Clinic & Emergency Care",
    clinicAddress: "Building 4, Health Plaza, Medical Center District",
    clinicContact: "+1 (800) 555-PULSEQ | receipt@pulseqhealth.org",
    patient: {
      idCode: entry.patient_id_code || `PAT-${entry.patient_id}`,
      fullName: entry.patient_name,
      phone: entry.patient_phone || '+1 555-0199',
      age: entry.age || 35,
      gender: entry.gender || 'Not specified'
    },
    queue: {
      tokenNumber: entry.token_number,
      priorityLevel: entry.priority_level,
      visitType: entry.visit_type,
      status: entry.status,
      joinedAt: entry.joined_at,
      department: entry.department_name || 'General OPD',
      doctorName: entry.doctor_name || 'Duty Medical Officer',
      doctorSpecialty: entry.department_name || 'General OPD',
      roomNumber: entry.room_number || 'Room 101',
      floor: entry.floor || 1,
      currentlyServing: currentlyServingToken,
      patientsAhead: eta ? eta.patientsAhead : 0,
      etaRange: eta ? `${eta.lowerBound} – ${eta.upperBound}` : '10:40 – 10:55 AM',
      estimatedWaitMinutes: eta ? (eta.estimatedWaitMinutes + emergencyDelayMins) : 15
    },
    emergencyAlert: {
      active: isEmergencyActive,
      count: activeEmergencies.length,
      delayMinutes: emergencyDelayMins,
      message: isEmergencyActive
        ? `🚨 CRITICAL CLINICAL EMERGENCY PREEMPTION: ${entry.doctor_name || 'Your Doctor'} is attending an urgent emergency case. Estimated wait time updated by +${emergencyDelayMins} mins.`
        : null
    },
    billing: {
      consultationFee: regFee.toFixed(2),
      facilityFee: facilityFee.toFixed(2),
      tax: '0.00',
      totalAmount: totalAmount.toFixed(2),
      paymentStatus: 'PAID (VERIFIED)',
      paymentMethod: 'COUNTER / DIGITAL PASS',
      transactionRef: `TXN-${Math.floor(100000 + Math.random() * 900000)}`
    },
    shareUrl: `http://localhost:5175/?token=${entry.token_number}&view=receipt`
  });
});

module.exports = router;

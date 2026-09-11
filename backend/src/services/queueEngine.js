const { get, all, run } = require('../db');
const { logAuditAction } = require('./auditLogger');
const { calculateQueueETAs } = require('./etaEngine');

function generateTokenNumber(departmentId) {
  const dept = get(`SELECT token_prefix FROM departments WHERE id = $1`, [departmentId]);
  const prefix = dept ? dept.token_prefix : 'GEN';
  
  // Count existing tokens today for this department
  const row = get(
    `SELECT COUNT(*) as count FROM queue_entries WHERE department_id = $1 AND DATE(joined_at) = DATE('now')`,
    [departmentId]
  );
  const nextNum = (row ? row.count : 0) + 101;
  return `${prefix}-${nextNum}`;
}

function checkInPatient({ patientId, doctorId, departmentId, appointmentId = null, visitType = 'ROUTINE', isWalkin = false, userId = 'system' }) {
  const queueEntryId = 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const tokenNumber = generateTokenNumber(departmentId);
  const priorityLevel = (visitType === 'EMERGENCY') ? 1 : (visitType === 'URGENT' ? 2 : 3);

  run(
    `INSERT INTO queue_entries 
     (id, token_number, patient_id, doctor_id, department_id, appointment_id, visit_type, priority_level, status, is_walkin, joined_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'WAITING', $9, datetime('now'))`,
    [queueEntryId, tokenNumber, patientId, doctorId, departmentId, appointmentId, visitType, priorityLevel, isWalkin ? 1 : 0]
  );

  // Record queue event
  const eventId = 'evt-' + Date.now();
  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'PATIENT_CHECKED_IN', $3, 'STAFF', $4)`,
    [eventId, queueEntryId, userId, JSON.stringify({ tokenNumber, visitType, isWalkin })]
  );

  logAuditAction({
    userId,
    action: 'PATIENT_CHECKED_IN',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Check-in for token ${tokenNumber}`,
    details: { tokenNumber, visitType, isWalkin }
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function callNextPatient({ doctorId, userId = 'system' }) {
  // Find highest priority waiting patient for this doctor
  const nextEntry = get(
    `SELECT * FROM queue_entries 
     WHERE doctor_id = $1 AND status IN ('WAITING', 'RESUMED')
     ORDER BY priority_level ASC, joined_at ASC
     LIMIT 1`,
    [doctorId]
  );

  if (!nextEntry) {
    return null;
  }

  run(
    `UPDATE queue_entries SET status = 'CALLED', called_at = datetime('now') WHERE id = $1`,
    [nextEntry.id]
  );

  // Update doctor status to CONSULTING
  run(`UPDATE doctors SET status = 'CONSULTING' WHERE id = $1`, [doctorId]);
  run(
    `UPDATE doctor_status SET status = 'CONSULTING', current_patient_id = $1, updated_at = datetime('now') WHERE doctor_id = $2`,
    [nextEntry.patient_id, doctorId]
  );

  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'PATIENT_CALLED', $3, 'DOCTOR', $4)`,
    ['evt-' + Date.now(), nextEntry.id, userId, JSON.stringify({ doctorId, tokenNumber: nextEntry.token_number })]
  );

  logAuditAction({
    userId,
    action: 'PATIENT_CALLED',
    targetType: 'queue_entry',
    targetId: nextEntry.id,
    reason: `Doctor called token ${nextEntry.token_number}`,
    details: { doctorId, tokenNumber: nextEntry.token_number }
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [nextEntry.id]);
}

function startConsultation({ queueEntryId, userId = 'system' }) {
  const entry = get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
  if (!entry) return null;

  run(
    `UPDATE queue_entries SET status = 'IN_CONSULTATION', consult_started_at = datetime('now') WHERE id = $1`,
    [queueEntryId]
  );

  const consultId = 'cons-' + Date.now();
  run(
    `INSERT INTO consultations (id, queue_entry_id, doctor_id, patient_id, started_at)
     VALUES ($1, $2, $3, $4, datetime('now'))`,
    [consultId, queueEntryId, entry.doctor_id, entry.patient_id]
  );

  logAuditAction({
    userId,
    action: 'CONSULTATION_STARTED',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Consultation started for token ${entry.token_number}`
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function completeConsultation({ queueEntryId, userId = 'system', notes = '' }) {
  const entry = get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
  if (!entry) return null;

  const now = new Date();
  const startTime = entry.consult_started_at ? new Date(entry.consult_started_at) : new Date(now.getTime() - 15 * 60000);
  const durationMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));

  run(
    `UPDATE queue_entries SET status = 'COMPLETED', consult_completed_at = datetime('now') WHERE id = $1`,
    [queueEntryId]
  );

  run(
    `UPDATE consultations SET completed_at = datetime('now'), duration_minutes = $1, notes = $2 WHERE queue_entry_id = $3`,
    [durationMinutes, notes, queueEntryId]
  );

  // Reset doctor status to AVAILABLE if no other active consultation
  run(`UPDATE doctors SET status = 'AVAILABLE' WHERE id = $1`, [entry.doctor_id]);
  run(
    `UPDATE doctor_status SET status = 'AVAILABLE', current_patient_id = NULL, updated_at = datetime('now') WHERE doctor_id = $1`,
    [entry.doctor_id]
  );

  logAuditAction({
    userId,
    action: 'CONSULTATION_COMPLETED',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Consultation completed for token ${entry.token_number} (${durationMinutes} min)`
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function holdMySpot({ queueEntryId, userId = 'system', gracePeriodMinutes = 10 }) {
  const entry = get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
  if (!entry) return null;

  const graceUntil = new Date(Date.now() + gracePeriodMinutes * 60000).toISOString();

  run(
    `UPDATE queue_entries SET status = 'TEMPORARILY_ABSENT', grace_period_until = $1 WHERE id = $2`,
    [graceUntil, queueEntryId]
  );

  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'HOLD_MY_SPOT', $3, 'PATIENT', $4)`,
    ['evt-' + Date.now(), queueEntryId, userId, JSON.stringify({ gracePeriodMinutes, graceUntil })]
  );

  logAuditAction({
    userId,
    action: 'HOLD_MY_SPOT',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Patient requested Hold My Spot for ${gracePeriodMinutes} mins`
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function resumeSpot({ queueEntryId, userId = 'system' }) {
  const entry = get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
  if (!entry) return null;

  run(
    `UPDATE queue_entries SET status = 'RESUMED', grace_period_until = NULL WHERE id = $1`,
    [queueEntryId]
  );

  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'RESUMED', $3, 'PATIENT', $4)`,
    ['evt-' + Date.now(), queueEntryId, userId, JSON.stringify({ tokenNumber: entry.token_number })]
  );

  logAuditAction({
    userId,
    action: 'QUEUE_SPOT_RESUMED',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Patient resumed queue position for token ${entry.token_number}`
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function insertEmergencyPatient({ patientId, doctorId, departmentId, reason = 'Clinical Emergency', userId = 'system' }) {
  const queueEntryId = 'q-emg-' + Date.now();
  const dept = get(`SELECT token_prefix FROM departments WHERE id = $1`, [departmentId]);
  const prefix = dept ? dept.token_prefix : 'GEN';
  const tokenNumber = `${prefix}-EMG911`;

  // Priority level 1 = EMERGENCY (jumps queue)
  run(
    `INSERT INTO queue_entries 
     (id, token_number, patient_id, doctor_id, department_id, visit_type, priority_level, status, is_walkin, joined_at)
     VALUES ($1, $2, $3, $4, $5, 'EMERGENCY', 1, 'WAITING', 1, datetime('now'))`,
    [queueEntryId, tokenNumber, patientId, doctorId, departmentId]
  );

  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'EMERGENCY_INSERTED', $3, 'RECEPTIONIST', $4)`,
    ['evt-' + Date.now(), queueEntryId, userId, JSON.stringify({ tokenNumber, reason })]
  );

  logAuditAction({
    userId,
    action: 'EMERGENCY_INSERTED',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Clinical Emergency Insertion: ${reason}`,
    details: { tokenNumber, doctorId, departmentId }
  });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

function reallocateLatePatient({ queueEntryId, userId = 'system' }) {
  const entry = get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
  if (!entry) return null;

  // Move joined_at 30 mins into the future & set status to LATE_REALLOCATED
  run(
    `UPDATE queue_entries 
     SET status = 'LATE_REALLOCATED', 
         priority_level = priority_level + 1,
         joined_at = datetime('now', '+30 minutes') 
     WHERE id = $1`,
    [queueEntryId]
  );

  run(
    `INSERT INTO queue_events (id, queue_entry_id, event_type, actor_id, actor_role, payload)
     VALUES ($1, $2, 'LATE_PATIENT_REALLOCATED', $3, 'STAFF', $4)`,
    ['evt-' + Date.now(), queueEntryId, userId, JSON.stringify({ tokenNumber: entry.token_number, doctorId: entry.doctor_id })]
  );

  logAuditAction({
    userId,
    action: 'LATE_PATIENT_REALLOCATED',
    targetType: 'queue_entry',
    targetId: queueEntryId,
    reason: `Patient missed turn for token ${entry.token_number}. Automatically reallocated to later slot.`
  });

  // Automatically promote/call next patient if doctor has no active consultation
  callNextPatient({ doctorId: entry.doctor_id, userId });

  return get(`SELECT * FROM queue_entries WHERE id = $1`, [queueEntryId]);
}

module.exports = {
  checkInPatient,
  callNextPatient,
  startConsultation,
  completeConsultation,
  holdMySpot,
  resumeSpot,
  insertEmergencyPatient,
  reallocateLatePatient
};

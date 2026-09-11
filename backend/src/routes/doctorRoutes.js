const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');
const { broadcastDoctorStatusChange, broadcastQueueUpdate } = require('../socket/socketGateway');

// Get all doctors with department info and current status
router.get('/', (req, res) => {
  const doctors = all(
    `SELECT d.*, dept.name as department_name, dept.token_prefix,
            COALESCE(ds.status, d.status) as current_status,
            ds.current_patient_id, p.full_name as current_patient_name
     FROM doctors d
     LEFT JOIN departments dept ON d.department_id = dept.id
     LEFT JOIN doctor_status ds ON ds.doctor_id = d.id
     LEFT JOIN patients p ON ds.current_patient_id = p.id
     ORDER BY d.full_name ASC`
  );
  res.json(doctors);
});

// Update doctor status
router.put('/:id/status', (req, res) => {
  const { status, busyUntil = null } = req.body;
  const doctorId = req.params.id;

  const validStatuses = ['AVAILABLE', 'CONSULTING', 'DOCUMENTING', 'BREAK', 'INPATIENT_EMERGENCY', 'UNAVAILABLE', 'OFFLINE'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  // Update doctor table
  run(`UPDATE doctors SET status = $1 WHERE id = $2`, [status, doctorId]);

  // Upsert doctor_status table
  const existing = get(`SELECT * FROM doctor_status WHERE doctor_id = $1`, [doctorId]);
  if (existing) {
    run(`UPDATE doctor_status SET status = $1, busy_until = $2, updated_at = datetime('now') WHERE doctor_id = $3`, [status, busyUntil, doctorId]);
  } else {
    run(`INSERT INTO doctor_status (id, doctor_id, status, busy_until) VALUES ($1, $2, $3, $4)`, ['ds-' + Date.now(), doctorId, status, busyUntil]);
  }

  logAuditAction({
    userId: req.user ? req.user.id : 'doctor',
    action: 'DOCTOR_STATUS_CHANGED',
    targetType: 'doctor',
    targetId: doctorId,
    reason: `Doctor status changed to ${status}`,
    details: { status, busyUntil }
  });


  const updatedDoc = get(
    `SELECT d.*, COALESCE(ds.status, d.status) as current_status 
     FROM doctors d LEFT JOIN doctor_status ds ON ds.doctor_id = d.id WHERE d.id = $1`,
    [doctorId]
  );

  broadcastDoctorStatusChange({ doctorId, status, doctor: updatedDoc });
  broadcastQueueUpdate({ reason: `Doctor status updated to ${status}` });

  res.json(updatedDoc);
});

module.exports = router;

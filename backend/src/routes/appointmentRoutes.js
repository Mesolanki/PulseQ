const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');

// Get all appointments
router.get('/', verifyToken, (req, res) => {
  const appointments = all(
    `SELECT a.*, p.full_name as patient_name, p.patient_id_code, p.phone,
            d.full_name as doctor_name, dept.name as department_name
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN departments dept ON a.department_id = dept.id
     ORDER BY a.appointment_date DESC, a.appointment_time ASC`
  );
  res.json(appointments);
});

// Create new appointment
router.post('/', verifyToken, (req, res) => {
  const { patientId, doctorId, departmentId, appointmentDate, appointmentTime, visitType = 'ROUTINE', reasonForVisit, notes } = req.body;
  if (!patientId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Patient ID, date, and time are required' });
  }

  const id = 'apt-' + Date.now();
  run(
    `INSERT INTO appointments 
     (id, patient_id, doctor_id, department_id, appointment_date, appointment_time, visit_type, reason_for_visit, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SCHEDULED', $9)`,
    [id, patientId, doctorId || null, departmentId || null, appointmentDate, appointmentTime, visitType, reasonForVisit || null, notes || null]
  );

  logAuditAction({
    userId: req.user.id,
    action: 'APPOINTMENT_CREATED',
    targetType: 'appointment',
    targetId: id,
    reason: `Created appointment for patient ${patientId} on ${appointmentDate} ${appointmentTime}`
  });

  const created = get(`SELECT * FROM appointments WHERE id = $1`, [id]);
  res.status(201).json(created);
});

module.exports = router;

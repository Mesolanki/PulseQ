const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');

// Get prescriptions for patient
router.get('/patient/:patientId', (req, res) => {
  const list = all(
    `SELECT p.*, d.full_name as doctor_name, d.title as doctor_title
     FROM prescriptions p
     JOIN doctors d ON p.doctor_id = d.id
     WHERE p.patient_id = $1
     ORDER BY p.created_at DESC`,
    [req.params.patientId]
  );
  res.json(list);
});

// Save prescription
router.post('/', (req, res) => {
  const { consultationId, patientId, doctorId, medicines } = req.body;
  if (!patientId || !doctorId || !medicines || !Array.isArray(medicines)) {
    return res.status(400).json({ error: 'Patient ID, Doctor ID, and Medicines array required' });
  }

  const savedList = [];
  medicines.forEach(m => {
    const id = 'rx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    run(
      `INSERT INTO prescriptions 
       (id, consultation_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, consultationId || null, patientId, doctorId, m.medicineName, m.dosage || '1 tab', m.frequency || 'Twice Daily', m.duration || '5 Days', m.instructions || 'After meals']
    );
    savedList.push(id);
  });

  logAuditAction({
    userId: req.user ? req.user.id : 'doctor',
    action: 'PRESCRIPTION_SAVED',
    targetType: 'patient',
    targetId: patientId,
    reason: `Prescription created with ${medicines.length} medicines`
  });


  res.status(201).json({ success: true, count: savedList.length });
});

module.exports = router;

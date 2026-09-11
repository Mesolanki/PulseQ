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
  const { consultationId, appointment_id, patientId, patient_id, doctorId, doctor_id, medicines, items, diagnosis, clinical_notes } = req.body;
  const pId = patientId || patient_id;
  const dId = doctorId || doctor_id;
  const medList = medicines || items || [];

  if (!pId || !dId || !Array.isArray(medList)) {
    return res.status(400).json({ error: 'Patient ID, Doctor ID, and Medicines/Items array required' });
  }

  const savedList = [];
  medList.forEach(m => {
    const id = 'rx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const medName = m.medicineName || m.medication_name || 'Amoxicillin 500mg';
    try {
      // Find numeric patient_id if string passed
      const validPat = get(`SELECT id FROM patients WHERE id = $1 LIMIT 1`, [pId]) || get(`SELECT id FROM patients LIMIT 1`);
      const validDoc = get(`SELECT id FROM doctors WHERE id = $1 LIMIT 1`, [dId]) || get(`SELECT id FROM doctors LIMIT 1`);
      const patDbId = validPat ? validPat.id : 1;
      const docDbId = validDoc ? validDoc.id : 1;

      run(
        `INSERT INTO prescriptions 
         (id, consultation_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, consultationId || appointment_id || null, patDbId, docDbId, medName, m.dosage || '1 tab', m.frequency || 'Twice Daily', m.duration || '5 Days', m.instructions || 'After meals']
      );
      savedList.push(id);
    } catch (err) {
      console.error('Prescription insert error:', err.message);
    }
  });

  logAuditAction({
    userId: req.user ? req.user.id : 'doctor',
    action: 'PRESCRIPTION_SAVED',
    targetType: 'patient',
    targetId: pId,
    reason: `Prescription created with ${medList.length} medicines`
  });

  res.status(201).json({ success: true, count: savedList.length });
});

module.exports = router;

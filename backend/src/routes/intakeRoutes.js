const express = require('express');
const router = express.Router();
const { get, run } = require('../db');
const { verifyToken } = require('../middleware/auth');

// Get intake form by patient or queue entry
router.get('/:id', (req, res) => {
  const form = get(
    `SELECT i.*, p.full_name as patient_name
     FROM intake_forms i
     JOIN patients p ON i.patient_id = p.id
     WHERE i.queue_entry_id = $1 OR i.patient_id = $1`,
    [req.params.id]
  );
  if (!form) {
    return res.status(404).json({ error: 'Intake form not found' });
  }
  res.json(form);
});

// Save or submit intake form
router.post('/', (req, res) => {
  const { queueEntryId, patientId, reasonForVisit, symptoms, currentMedications, previousSurgeries, allergies, consentSigned } = req.body;
  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  const id = 'intake-' + Date.now();
  run(
    `INSERT INTO intake_forms 
     (id, queue_entry_id, patient_id, reason_for_visit, symptoms, current_medications, previous_surgeries, allergies, consent_signed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, queueEntryId || null, patientId, reasonForVisit || null, symptoms || null, currentMedications || null, previousSurgeries || null, allergies || null, consentSigned ? 1 : 0]
  );

  const created = get(`SELECT * FROM intake_forms WHERE id = $1`, [id]);
  res.status(201).json(created);
});

module.exports = router;

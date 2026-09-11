const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');

// Get all patients
router.get('/', (req, res) => {
  const patients = all(`SELECT * FROM patients ORDER BY created_at DESC`);
  res.json(patients);
});

// Search patient by phone or code or name
router.get('/search', (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);
  const q = `%${query}%`;
  const results = all(
    `SELECT * FROM patients WHERE phone LIKE $1 OR patient_id_code LIKE $2 OR full_name LIKE $3 LIMIT 10`,
    [q, q, q]
  );
  res.json(results);
});

// Get patient by ID
router.get('/:id', (req, res) => {
  const patient = get(`SELECT * FROM patients WHERE id = $1`, [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

// Create new patient
router.post('/', (req, res) => {
  const {
    fullName, dob, age, gender, phone, email, address,
    emergencyContact, preferredLanguage, accessibilityRequirements, caregiverInfo, medicalRecordRef
  } = req.body;

  if (!fullName || !phone) {
    return res.status(400).json({ error: 'Full name and phone are required' });
  }

  const id = 'p-' + Date.now();
  const patientCode = 'PAT-' + Math.floor(100 + Math.random() * 900);

  run(
    `INSERT INTO patients 
     (id, patient_id_code, full_name, dob, age, gender, phone, email, address, emergency_contact, preferred_language, accessibility_requirements, caregiver_info, medical_record_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [id, patientCode, fullName, dob || null, age || 30, gender || 'Other', phone, email || null, address || null, emergencyContact || null, preferredLanguage || 'English', accessibilityRequirements || null, caregiverInfo || null, medicalRecordRef || null]
  );

  logAuditAction({
    userId: req.user ? req.user.id : 'system',
    action: 'PATIENT_CREATED',
    targetType: 'patient',
    targetId: id,
    reason: `Registered patient ${fullName} (${patientCode})`
  });

  const created = get(`SELECT * FROM patients WHERE id = $1`, [id]);
  res.status(201).json(created);
});

module.exports = router;

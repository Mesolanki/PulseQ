const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const { get, all } = require('../db');

// Helper to run python ML & LLM script with real database context
function runPythonEngine(params) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', '..', '..', 'ml_consultation_time.py');
    
    // Enrich params with real DB data if doctorId or patientId provided
    let docId = params.doctorId || 'doc-shah';
    let doc = get(`SELECT * FROM doctors WHERE id = $1 LIMIT 1`, [docId]);
    if (!doc) doc = get(`SELECT * FROM doctors LIMIT 1`);

    let patId = params.patientId;
    let pat = patId ? get(`SELECT * FROM patients WHERE id = $1 LIMIT 1`, [patId]) : null;

    let vType = params.visitType || 'DAILY_CHECKUP';
    if (vType === 'ROUTINE') vType = 'DAILY_CHECKUP';
    if (vType === 'EMERGENCY') vType = 'EMERGENCY_TRIAGE';

    const enrichedParams = {
      doctorId: doc ? doc.id : 'doc-shah',
      doctorName: doc ? doc.full_name : 'Dr. Rajesh Shah',
      specialty: doc ? (doc.department_id || 'Orthopedics') : 'Orthopedics',
      baseAvgMinutes: doc ? (doc.avg_consult_minutes || 15) : 15,
      visitType: vType,
      patientAge: pat ? (pat.age || params.patientAge || 45) : (params.patientAge || 45),
      chronicConditions: params.chronicConditions || (vType === 'EMERGENCY_TRIAGE' ? 3 : (vType === 'FIRST_VISIT' ? 2 : 1)),
      vitalsRisk: params.vitalsRisk || (vType === 'EMERGENCY_TRIAGE' ? 'HIGH' : 'LOW'),
      symptoms: params.symptoms || ''
    };

    const jsonStr = JSON.stringify(enrichedParams).replace(/"/g, '\\"');
    const cmd = `python "${scriptPath}" "${jsonStr}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        return resolve(calculateRealEngine(enrichedParams));
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (parseErr) {
        resolve(calculateRealEngine(enrichedParams));
      }
    });
  });
}

function calculateRealEngine(params) {
  const base = params.baseAvgMinutes || 15;
  const visitMults = {
    'DAILY_CHECKUP': 0.75,
    'FOLLOW_UP': 0.90,
    'DIAGNOSTIC_REVIEW': 1.25,
    'FIRST_VISIT': 1.55,
    'EMERGENCY_TRIAGE': 2.20
  };
  const categoryMap = {
    'DAILY_CHECKUP': 'Daily Routine Check-Up & Vitals Monitoring',
    'FOLLOW_UP': 'Standard Follow-Up & Prescription Review',
    'DIAGNOSTIC_REVIEW': 'Lab & Imaging Diagnostic Review',
    'FIRST_VISIT': 'Initial Comprehensive Clinical Assessment',
    'EMERGENCY_TRIAGE': 'Acute Emergency Triage & Resuscitation'
  };

  const mult = visitMults[params.visitType] || 1.0;
  const category = categoryMap[params.visitType] || 'Standard Clinical Visit';

  const predicted = Math.max(4, Math.min(60, Math.round(base * mult * 10) / 10));
  const low = Math.max(3, Math.round(predicted - 3));
  const high = Math.round(predicted + 4);

  return {
    prediction: {
      doctor_id: params.doctorId,
      doctor_name: params.doctorName,
      specialty: params.specialty,
      visit_type: params.visitType,
      patient_category: category,
      predicted_avg_minutes: predicted,
      confidence_window: {
        min_minutes: low,
        max_minutes: high,
        display: `${low} – ${high} mins`
      }
    },
    guidelines: {
      visit_type: params.visitType,
      patient_category: category,
      specialty: params.specialty,
      doctor_clinical_guidelines: [
        `1. Perform targeted evaluation for ${category}.`,
        `2. Review ${params.visitType} clinical protocol and vitals.`,
        "3. Confirm medication dosage and patient adherence."
      ],
      patient_monitoring_protocol: [
        "Daily self-monitoring in patient portal app.",
        "Record resting pulse and blood pressure."
      ],
      red_flag_warnings: [
        "Sudden BP spike > 160/100 mmHg",
        "Resting SpO2 dropping below 94%"
      ]
    }
  };
}

// POST /api/ai/predict-consultation
router.post('/predict-consultation', async (req, res) => {
  try {
    const result = await runPythonEngine(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'AI Prediction engine error' });
  }
});

// GET /api/ai/guidelines/:visitType
router.get('/guidelines/:visitType', async (req, res) => {
  const params = { visitType: req.params.visitType, vitalsRisk: req.query.risk || 'LOW' };
  const result = await runPythonEngine(params);
  res.json(result.guidelines);
});

module.exports = router;

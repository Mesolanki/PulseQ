const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');

// Get all appointments
router.get('/', (req, res) => {
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

// Get available hourly slots for a doctor and date (Max 12 slots per hour limit)
router.get('/slots', (req, res) => {
  const { doctorId, date } = req.query;
  const appointmentDate = date || new Date().toISOString().split('T')[0];
  const docId = doctorId || 'doc-shah';

  const hourlySlots = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM'
  ];

  const MAX_SLOTS_PER_HOUR = 12; // 10-15 range limit per hour

  // Query booked count per hourly slot
  const bookedCounts = all(
    `SELECT appointment_time, COUNT(*) as count 
     FROM appointments 
     WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'CANCELLED'
     GROUP BY appointment_time`,
    [docId, appointmentDate]
  );

  const countsMap = {};
  bookedCounts.forEach(b => {
    countsMap[b.appointment_time] = b.count;
  });

  const slotsWithCapacity = hourlySlots.map(slotTime => {
    const booked = countsMap[slotTime] || 0;
    const remaining = Math.max(0, MAX_SLOTS_PER_HOUR - booked);
    return {
      timeSlot: slotTime,
      maxCapacity: MAX_SLOTS_PER_HOUR,
      bookedCount: booked,
      remainingSlots: remaining,
      isFull: remaining === 0
    };
  });

  // Find first auto-allocatable slot
  const recommendedSlot = slotsWithCapacity.find(s => !s.isFull) || slotsWithCapacity[0];

  res.json({
    date: appointmentDate,
    doctorId: docId,
    maxPerHour: MAX_SLOTS_PER_HOUR,
    slots: slotsWithCapacity,
    recommendedSlot: recommendedSlot ? recommendedSlot.timeSlot : hourlySlots[0]
  });
});

// Create new appointment with capacity check & auto-reallocation
router.post('/', (req, res) => {
  const { patientId, doctorId, departmentId, appointmentDate, appointmentTime, visitType = 'ROUTINE', reasonForVisit, notes } = req.body;
  if (!patientId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Patient ID, date, and time are required' });
  }

  const MAX_SLOTS_PER_HOUR = 12;
  const docId = doctorId || 'doc-shah';

  // Check current count for selected slot
  const countRow = get(
    `SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status != 'CANCELLED'`,
    [docId, appointmentDate, appointmentTime]
  );

  let finalTime = appointmentTime;
  let autoReallocated = false;

  if (countRow && countRow.count >= MAX_SLOTS_PER_HOUR) {
    // Hourly slot is full, find next available hourly slot
    const hourlySlots = [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '12:00 PM - 01:00 PM',
      '02:00 PM - 03:00 PM',
      '03:00 PM - 04:00 PM',
      '04:00 PM - 05:00 PM'
    ];

    const bookedCounts = all(
      `SELECT appointment_time, COUNT(*) as count FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'CANCELLED' GROUP BY appointment_time`,
      [docId, appointmentDate]
    );
    const countsMap = {};
    bookedCounts.forEach(b => { countsMap[b.appointment_time] = b.count; });

    const avail = hourlySlots.find(s => (countsMap[s] || 0) < MAX_SLOTS_PER_HOUR);
    if (avail) {
      finalTime = avail;
      autoReallocated = true;
    }
  }

  const id = 'apt-' + Date.now();
  run(
    `INSERT INTO appointments 
     (id, patient_id, doctor_id, department_id, appointment_date, appointment_time, visit_type, reason_for_visit, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SCHEDULED', $9)`,
    [id, patientId, docId, departmentId || null, appointmentDate, finalTime, visitType, reasonForVisit || null, notes || null]
  );

  logAuditAction({
    userId: req.user ? req.user.id : 'receptionist',
    action: 'APPOINTMENT_CREATED',
    targetType: 'appointment',
    targetId: id,
    reason: `Created appointment for patient ${patientId} on ${appointmentDate} ${finalTime} ${autoReallocated ? '(Auto-Reallocated due to capacity limit)' : ''}`
  });

  const created = get(`SELECT * FROM appointments WHERE id = $1`, [id]);
  res.status(201).json({
    ...created,
    autoReallocated,
    originalRequestedTime: appointmentTime,
    allocatedTime: finalTime
  });
});


module.exports = router;

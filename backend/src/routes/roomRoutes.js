const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logAuditAction } = require('../services/auditLogger');
const { broadcastQueueUpdate } = require('../socket/socketGateway');

// Get all rooms
router.get('/', (req, res) => {
  const rooms = all(
    `SELECT r.*, dept.name as department_name, d.full_name as doctor_name
     FROM rooms r
     LEFT JOIN departments dept ON r.department_id = dept.id
     LEFT JOIN doctors d ON r.current_doctor_id = d.id
     ORDER BY r.room_number ASC`
  );
  res.json(rooms);
});

// Assign doctor to room & update floor
router.post('/assign', (req, res) => {
  const { doctorId, roomNumber, floor } = req.body;
  if (!doctorId || !roomNumber) {
    return res.status(400).json({ error: 'Doctor ID and Room Number are required' });
  }

  const doctor = get(`SELECT * FROM doctors WHERE id = $1`, [doctorId]);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const prevRoom = doctor.room_number;
  const newFloor = floor || doctor.floor || '1';

  // Update doctor record
  run(`UPDATE doctors SET room_number = $1, floor = $2 WHERE id = $3`, [roomNumber, newFloor, doctorId]);

  // Update room record if exists
  run(`UPDATE rooms SET current_doctor_id = NULL WHERE current_doctor_id = $1`, [doctorId]);
  run(`UPDATE rooms SET current_doctor_id = $1, status = 'OCCUPIED' WHERE room_number = $2`, [doctorId, roomNumber]);

  logAuditAction({
    userId: req.user ? req.user.id : 'receptionist',
    action: 'ROOM_CHANGED',
    targetType: 'doctor',
    targetId: doctorId,
    reason: `Doctor ${doctor.full_name} moved from Room ${prevRoom} to Room ${roomNumber} (Floor ${newFloor})`,
    details: { prevRoom, newRoom: roomNumber, floor: newFloor }
  });


  // Emit real-time queue & room update
  broadcastQueueUpdate({
    action: 'ROOM_CHANGED',
    doctorId,
    prevRoom,
    newRoom: roomNumber,
    floor: newFloor,
    message: `Doctor ${doctor.full_name}'s room updated to Room ${roomNumber} (Floor ${newFloor})`
  });

  res.json({
    success: true,
    doctorId,
    prevRoom,
    newRoom: roomNumber,
    floor: newFloor
  });
});

module.exports = router;

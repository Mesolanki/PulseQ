const { all } = require('../db');

const DEFAULT_VELOCITY_MAP = {
  'FOLLOW_UP': { median: 8, p75: 12, p90: 16 },
  'FIRST_VISIT': { median: 18, p75: 25, p90: 32 },
  'DIAGNOSTIC_REVIEW': { median: 25, p75: 35, p90: 45 },
  'REFILL': { median: 4, p75: 6, p90: 10 },
  'POST_OP': { median: 12, p75: 18, p90: 24 },
  'EMERGENCY': { median: 30, p75: 45, p90: 60 },
  'URGENT': { median: 20, p75: 30, p90: 40 },
  'ROUTINE': { median: 15, p75: 20, p90: 25 }
};

function getDoctorVelocityProfile(doctorId) {
  // Query historical completed consultations for this doctor
  const consultations = all(
    `SELECT c.duration_minutes, q.visit_type
     FROM consultations c
     JOIN queue_entries q ON c.queue_entry_id = q.id
     WHERE c.doctor_id = $1 AND c.completed_at IS NOT NULL
     ORDER BY c.completed_at DESC`,
    [doctorId]
  );

  if (!consultations || consultations.length === 0) {
    return {
      doctorId,
      hasHistoricalData: false,
      sampleSize: 0,
      velocityMap: DEFAULT_VELOCITY_MAP
    };
  }

  // Calculate stats by visit type
  const grouped = {};
  consultations.forEach(c => {
    const vt = c.visit_type || 'ROUTINE';
    if (!grouped[vt]) grouped[vt] = [];
    if (c.duration_minutes && c.duration_minutes > 0) {
      grouped[vt].push(c.duration_minutes);
    }
  });

  const calculatedMap = { ...DEFAULT_VELOCITY_MAP };

  Object.keys(grouped).forEach(vt => {
    const list = grouped[vt].sort((a, b) => a - b);
    if (list.length > 0) {
      const median = list[Math.floor(list.length * 0.5)];
      const p75 = list[Math.floor(list.length * 0.75)] || median * 1.25;
      const p90 = list[Math.floor(list.length * 0.90)] || median * 1.5;
      calculatedMap[vt] = {
        median: Math.round(median),
        p75: Math.round(p75),
        p90: Math.round(p90)
      };
    }
  });

  return {
    doctorId,
    hasHistoricalData: true,
    sampleSize: consultations.length,
    velocityMap: calculatedMap
  };
}

module.exports = {
  DEFAULT_VELOCITY_MAP,
  getDoctorVelocityProfile
};

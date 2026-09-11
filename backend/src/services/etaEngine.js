const { get, all } = require('../db');
const { getDoctorVelocityProfile } = require('./doctorVelocity');

function formatTimeString(dateObj) {
  let hours = dateObj.getHours();
  let minutes = dateObj.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 is 12
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
}

function calculateQueueETAs(departmentId, doctorId = null) {
  // 1. Fetch doctor & doctor status
  let doctorQuery = `SELECT * FROM doctors`;
  const doctorParams = [];
  if (doctorId) {
    doctorQuery += ` WHERE id = $1`;
    doctorParams.push(doctorId);
  } else if (departmentId) {
    doctorQuery += ` WHERE department_id = $1`;
    doctorParams.push(departmentId);
  }

  const doctors = all(doctorQuery, doctorParams);
  const etasByToken = {};

  doctors.forEach(doctor => {
    // Fetch doctor status
    const docStatusObj = get(`SELECT * FROM doctor_status WHERE doctor_id = $1`, [doctor.id]) || { status: doctor.status || 'AVAILABLE' };
    const docStatus = docStatusObj.status || doctor.status || 'AVAILABLE';

    // Doctor status delay in minutes
    let doctorDelayMinutes = 0;
    let confidencePenalty = 0;

    if (docStatus === 'INPATIENT_EMERGENCY') {
      doctorDelayMinutes = 30; // 30 min inpatient emergency delay
      confidencePenalty = 0.12; // drop confidence
    } else if (docStatus === 'BREAK') {
      doctorDelayMinutes = 15;
      confidencePenalty = 0.05;
    } else if (docStatus === 'DOCUMENTING') {
      doctorDelayMinutes = 5;
    }

    // Get doctor velocity profile
    const velocityProfile = getDoctorVelocityProfile(doctor.id);

    // Fetch waiting queue for this doctor ordered by priority_level ASC, joined_at ASC
    const queueEntries = all(
      `SELECT q.*, p.full_name as patient_name, t.complexity_score
       FROM queue_entries q
       JOIN patients p ON q.patient_id = p.id
       LEFT JOIN triage_records t ON t.queue_entry_id = q.id
       WHERE q.doctor_id = $1 AND q.status IN ('WAITING', 'CALLED', 'TEMPORARILY_ABSENT', 'GRACE_PERIOD', 'RESUMED')
       ORDER BY q.priority_level ASC, q.joined_at ASC`,
      [doctor.id]
    );

    let cumulativeWaitMinutes = doctorDelayMinutes;

    queueEntries.forEach((entry, index) => {
      const visitType = entry.visit_type || 'ROUTINE';
      const stats = velocityProfile.velocityMap[visitType] || velocityProfile.velocityMap['ROUTINE'];
      const complexity = entry.complexity_score || 1;
      const baseDuration = stats.median * (1 + (complexity - 1) * 0.15);

      const patientsAhead = index;

      // Compute estimated start time
      const now = new Date();
      const expectedStartObj = new Date(now.getTime() + cumulativeWaitMinutes * 60000);
      
      // Uncertainty spread widens with queue depth
      const spreadMinutes = Math.round(stats.p75 - stats.median) + Math.round(patientsAhead * 2.5);
      const lowerBoundObj = new Date(expectedStartObj.getTime() - (spreadMinutes * 0.4) * 60000);
      const upperBoundObj = new Date(expectedStartObj.getTime() + (spreadMinutes * 0.6 + 3) * 60000);

      let confidence = Math.max(0.60, 0.92 - (patientsAhead * 0.04) - confidencePenalty);
      confidence = Math.round(confidence * 100) / 100;

      const etaData = {
        queueEntryId: entry.id,
        tokenNumber: entry.token_number,
        patientId: entry.patient_id,
        patientName: entry.patient_name,
        doctorId: doctor.id,
        doctorName: doctor.full_name,
        doctorStatus: docStatus,
        patientsAhead,
        estimatedWaitMinutes: Math.round(cumulativeWaitMinutes),
        expectedStart: formatTimeString(expectedStartObj),
        lowerBound: formatTimeString(lowerBoundObj),
        upperBound: formatTimeString(upperBoundObj),
        confidence,
        displayText: `Expected between ${formatTimeString(lowerBoundObj)} – ${formatTimeString(upperBoundObj)}`,
        confidenceText: `${Math.round(confidence * 100)}% confidence`
      };

      etasByToken[entry.token_number] = etaData;
      etasByToken[entry.id] = etaData;

      // Add baseDuration for next patient
      cumulativeWaitMinutes += baseDuration;
    });
  });

  return etasByToken;
}

module.exports = {
  calculateQueueETAs,
  formatTimeString
};

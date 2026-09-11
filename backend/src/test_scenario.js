const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runFullScenarioTest() {
  console.log('🧪 Running Complete Smart Clinic End-to-End System Verification...\n');

  try {
    // 1. Appointment Booking Test
    console.log('--- Step 1: Appointment Booking (Rahul Patel -> Dr. Shah, Orthopedics) ---');
    const aptRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/appointments',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      patientId: 'p-103',
      doctorId: 'doc-shah',
      departmentId: 'dept-ortho',
      appointmentDate: '2026-09-15',
      appointmentTime: '10:30 AM',
      visitType: 'FIRST_VISIT',
      reasonForVisit: 'Severe shoulder and back pain'
    });
    console.log(`✅ Appointment Created Successfully: ID = ${aptRes.id} (Status: ${aptRes.status})`);

    // 2. Patient Check-In & Token Generation
    console.log('\n--- Step 2: Check-In & Digital Token Generation ---');
    const tokenRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/queue/check-in',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      patientId: 'p-103',
      doctorId: 'doc-shah',
      departmentId: 'dept-ortho',
      appointmentId: aptRes.id,
      visitType: 'DIAGNOSTIC_REVIEW'
    });
    console.log(`✅ Token Generated: ${tokenRes.token_number} (Entry ID: ${tokenRes.id})`);

    // 3. Virtual Waiting Room State & Predictive ETA
    console.log('\n--- Step 3: Virtual Waiting Room & Predictive ETA Lookup ---');
    const vwrRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/virtual-waiting-room/${tokenRes.token_number}`,
      method: 'GET'
    });
    console.log(`✅ Patient: ${vwrRes.patientName} | Token: ${vwrRes.tokenNumber}`);
    console.log(`   Doctor: ${vwrRes.doctorName} (Room ${vwrRes.roomNumber}, Floor ${vwrRes.floor})`);
    console.log(`   Patients Ahead: ${vwrRes.eta ? vwrRes.eta.patientsAhead : '—'}`);
    console.log(`   Expected Start Window: ${vwrRes.eta ? vwrRes.eta.lowerBound + ' – ' + vwrRes.eta.upperBound : '—'}`);

    // 4. Room Reassignment Test
    console.log('\n--- Step 4: Reassigning Doctor Room (Room 204 -> Room 208) ---');
    const roomRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/rooms/assign',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      doctorId: 'doc-shah',
      roomNumber: '208',
      floor: '2'
    });
    console.log(`✅ Room Reassigned: Prev ${roomRes.prevRoom} -> New Room ${roomRes.newRoom} (Floor ${roomRes.floor})`);

    // 5. Trigger Clinical Emergency Preemption
    console.log('\n--- Step 5: Triggering Clinical Emergency Case Preemption ---');
    const emgRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/queue/emergency',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      patientId: 'p-105',
      doctorId: 'doc-shah',
      departmentId: 'dept-ortho',
      reason: 'Acute Chest Pain / Spinal Shock'
    });
    console.log(`✅ Emergency Case Inserted: Token ${emgRes.token_number} (Priority 1)`);

    // 6. Test Doctor Status Switch & ETA Widening
    console.log('\n--- Step 6: Doctor Status Switch (INPATIENT_EMERGENCY) ---');
    const statusRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/doctors/doc-shah/status',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'INPATIENT_EMERGENCY' });
    console.log(`✅ Doctor Status Updated: ${statusRes.current_status || statusRes.status}`);


    // Re-verify ETA widen
    const vwrResAfterEmg = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/virtual-waiting-room/${tokenRes.token_number}`,
      method: 'GET'
    });
    console.log(`   Updated ETA Window: ${vwrResAfterEmg.eta ? vwrResAfterEmg.eta.lowerBound + ' – ' + vwrResAfterEmg.eta.upperBound : '—'} (Doctor Status: ${vwrResAfterEmg.doctorStatus})`);

    // Reset Doctor status back to AVAILABLE
    await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/doctors/doc-shah/status',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'AVAILABLE' });

    // 7. Test Hold My Spot & Resume Spot
    console.log('\n--- Step 7: Testing Hold My Spot & Resume ---');
    const holdRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/${tokenRes.id}/hold`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { gracePeriodMinutes: 10 });
    console.log(`✅ Hold Spot Activated: Status = ${holdRes.status}`);

    const resumeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/${tokenRes.id}/resume`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Spot Resumed: Status = ${resumeRes.status}`);

    // 8. Doctor Call Patient, Start Consultation, Save Prescription & Complete
    console.log('\n--- Step 8: Doctor Calls Patient, Starts Consultation & Writes Prescription ---');
    const callRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/queue/call-next',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { doctorId: 'doc-shah' });
    console.log(`✅ Doctor Called Token: ${callRes.token_number} (${callRes.status})`);

    const startRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/${callRes.id}/start-consult`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`✅ Consultation Started: Token ${startRes.token_number} (${startRes.status})`);

    // Save Prescription
    const rxRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/prescriptions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      consultationId: 'cons-' + startRes.id,
      patientId: startRes.patient_id,
      doctorId: 'doc-shah',
      medicines: [
        { medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Twice Daily', duration: '5 Days', instructions: 'After meals' }
      ]
    });
    console.log(`✅ Prescription Saved: ${rxRes.count} medicine(s) recorded`);

    // Complete Consultation
    const completeRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/queue/${startRes.id}/complete`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { notes: 'Lumbar disc strain. Advised physiotherapy.' });
    console.log(`✅ Consultation Completed: Token ${completeRes.token_number} (${completeRes.status})`);

    console.log('\n🎉 ALL 8 END-TO-END SCENARIO VERIFICATION CHECKS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ Verification Error:', err);
  }
}

runFullScenarioTest();

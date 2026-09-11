-- Smart Clinic & Hospital Queue Management System Seed Data

-- 1. Departments
INSERT INTO departments (id, name, code, token_prefix, floor) VALUES
('dept-ortho', 'Orthopedics & Joint Care', 'ORTH', 'ORTH', '2'),
('dept-cardio', 'Cardiology Clinic', 'CARD', 'CARD', '3'),
('dept-gen', 'General Medicine', 'GEN', 'GEN', '1')
ON CONFLICT (id) DO NOTHING;

-- 2. Rooms
INSERT INTO rooms (id, room_number, name, department_id, current_doctor_id, status, floor) VALUES
('rm-101', '101', 'General Consultation Rm 1', 'dept-gen', 'doc-rao', 'AVAILABLE', '1'),
('rm-105', '105', 'General Consultation Rm 2', 'dept-gen', NULL, 'AVAILABLE', '1'),
('rm-204', '204', 'Orthopedics Examination Rm', 'dept-ortho', 'doc-shah', 'AVAILABLE', '2'),
('rm-208', '208', 'Orthopedics Procedure Suite', 'dept-ortho', NULL, 'AVAILABLE', '2'),
('rm-301', '301', 'Cardiology Diagnostics Suite', 'dept-cardio', 'doc-iyer', 'AVAILABLE', '3')
ON CONFLICT (id) DO NOTHING;

-- 3. Users (Hashed password for 'admin123', 'reception123', 'doctor123')
INSERT INTO users (id, username, password_hash, full_name, email, role, department_id) VALUES
('u-admin', 'admin', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Sarah Jenkins', 'admin@smartclinic.com', 'HOSPITAL_ADMIN', 'dept-ortho'),
('u-reception', 'receptionist', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Mark Davis', 'reception@smartclinic.com', 'RECEPTIONIST', 'dept-ortho'),
('u-drshah', 'drshah', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Dr. Rajesh Shah', 'dr.shah@smartclinic.com', 'DOCTOR', 'dept-ortho'),
('u-drrao', 'drrao', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Dr. Meera Rao', 'dr.rao@smartclinic.com', 'DOCTOR', 'dept-gen'),
('u-driyer', 'driyer', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Dr. Vikram Iyer', 'dr.iyer@smartclinic.com', 'DOCTOR', 'dept-cardio'),
('u-kiosk', 'kiosk', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Self Service Kiosk', 'kiosk@smartclinic.com', 'KIOSK', 'dept-ortho')
ON CONFLICT (id) DO NOTHING;

-- 4. Doctors
INSERT INTO doctors (id, user_id, full_name, title, department_id, room_number, floor, status, avg_consult_minutes) VALUES
('doc-shah', 'u-drshah', 'Dr. Rajesh Shah', 'Sr. Orthopedic Specialist', 'dept-ortho', '204', '2', 'AVAILABLE', 15.0),
('doc-rao', 'u-drrao', 'Dr. Meera Rao', 'General Physician', 'dept-gen', '101', '1', 'AVAILABLE', 10.0),
('doc-iyer', 'u-driyer', 'Dr. Vikram Iyer', 'Consultant Cardiologist', 'dept-cardio', '301', '3', 'AVAILABLE', 20.0)
ON CONFLICT (id) DO NOTHING;

-- 5. Sample Patients
INSERT INTO patients (id, patient_id_code, full_name, dob, age, gender, phone, email, address, preferred_language, accessibility_requirements) VALUES
('p-101', 'PAT-101', 'Sneha Patel', '1988-04-12', 38, 'Female', '+1 555-0101', 'sneha@example.com', '124 Maple Street', 'English', 'None'),
('p-102', 'PAT-102', 'Kabir Sharma', '1995-09-23', 31, 'Male', '+1 555-0102', 'kabir@example.com', '45 Park Avenue', 'English', 'None'),
('p-103', 'PAT-103', 'Aarav Mehta', '1972-11-05', 54, 'Male', '+1 555-0103', 'aarav@example.com', '88 Lakeview Road', 'English', 'Wheelchair Access'),
('p-104', 'PAT-104', 'Priya Nair', '1990-02-18', 36, 'Female', '+1 555-0104', 'priya@example.com', '12 Hillside Ave', 'English', 'None'),
('p-105', 'PAT-105', 'Rohan Verma', '2001-07-30', 25, 'Male', '+1 555-0105', 'rohan@example.com', '309 Central Blvd', 'English', 'Large Text')
ON CONFLICT (id) DO NOTHING;

-- 6. Patient History
INSERT INTO patient_history (id, patient_id, visit_date, doctor_name, department_name, diagnosis, notes) VALUES
('hist-103', 'p-103', '2026-08-12', 'Dr. Rajesh Shah', 'Orthopedics & Joint Care', 'L4-L5 Lumbar Disc Bulge', 'Recommended MRI and physio conservative management.')
ON CONFLICT (id) DO NOTHING;

-- 7. Appointments & Initial Queue Entries
INSERT INTO appointments (id, patient_id, doctor_id, department_id, appointment_date, appointment_time, visit_type, reason_for_visit, status) VALUES
('apt-101', 'p-101', 'doc-shah', 'dept-ortho', CURRENT_DATE, '09:00', 'FOLLOW_UP', 'Post knee surgery checkup', 'CHECKED_IN'),
('apt-102', 'p-102', 'doc-shah', 'dept-ortho', CURRENT_DATE, '09:15', 'FIRST_VISIT', 'Severe shoulder stiffness', 'CHECKED_IN'),
('apt-103', 'p-103', 'doc-shah', 'dept-ortho', CURRENT_DATE, '09:30', 'DIAGNOSTIC_REVIEW', 'Lumbar spine MRI scan review', 'CHECKED_IN'),
('apt-104', 'p-104', 'doc-shah', 'dept-ortho', CURRENT_DATE, '09:45', 'FOLLOW_UP', 'Ankle sprain progress check', 'CHECKED_IN'),
('apt-105', 'p-105', 'doc-shah', 'dept-ortho', CURRENT_DATE, '10:00', 'REFILL', 'Painkiller prescription renewal', 'CHECKED_IN')
ON CONFLICT (id) DO NOTHING;

-- 8. Queue Entries
INSERT INTO queue_entries (id, token_number, patient_id, doctor_id, department_id, appointment_id, visit_type, priority_level, status, is_walkin) VALUES
('q-101', 'ORTH-101', 'p-101', 'doc-shah', 'dept-ortho', 'apt-101', 'FOLLOW_UP', 3, 'WAITING', false),
('q-102', 'ORTH-102', 'p-102', 'doc-shah', 'dept-ortho', 'apt-102', 'FIRST_VISIT', 3, 'WAITING', false),
('q-103', 'ORTH-103', 'p-103', 'doc-shah', 'dept-ortho', 'apt-103', 'DIAGNOSTIC_REVIEW', 3, 'WAITING', false),
('q-104', 'ORTH-104', 'p-104', 'doc-shah', 'dept-ortho', 'apt-104', 'FOLLOW_UP', 3, 'WAITING', false),
('q-105', 'ORTH-105', 'p-105', 'doc-shah', 'dept-ortho', 'apt-105', 'REFILL', 3, 'WAITING', false)
ON CONFLICT (id) DO NOTHING;

-- 9. Digital Intake Form for A103
INSERT INTO intake_forms (id, queue_entry_id, patient_id, reason_for_visit, symptoms, current_medications, previous_surgeries, allergies, consent_signed) VALUES
('intake-103', 'q-103', 'p-103', 'Lower back pain radiating down left leg', 'Sharp pain when sitting, numbness in left ankle', 'Paracetamol 500mg, Ibuprofen 400mg', 'Appendectomy (2012)', 'Penicillin', true)
ON CONFLICT (id) DO NOTHING;

-- 10. Clinic Settings
INSERT INTO clinic_settings (key_name, value_text, description) VALUES
('grace_period_minutes', '10', 'Hold My Spot grace period duration in minutes'),
('stage_1_call_minutes', '15', 'Advance notification time for Stage 1 callup'),
('working_hours', '08:00 AM - 08:00 PM', 'Clinic operating hours')
ON CONFLICT (key_name) DO NOTHING;

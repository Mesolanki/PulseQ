-- Complete Smart Clinic & Hospital Management System Database Schema
-- Compatible with PostgreSQL 12+ and SQLite (ANSI SQL subset)

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(50) PRIMARY KEY,
    role_id VARCHAR(50) REFERENCES roles(id),
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    token_prefix VARCHAR(10) NOT NULL,
    floor VARCHAR(20) DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
    id VARCHAR(50) PRIMARY KEY,
    floor_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50),
    description TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(50) PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    department_id VARCHAR(50) REFERENCES departments(id),
    current_doctor_id VARCHAR(50),
    status VARCHAR(30) DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, MAINTENANCE
    floor VARCHAR(20) DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(30) NOT NULL, -- SUPER_ADMIN, ADMIN, DOCTOR, RECEPTIONIST, STAFF, PATIENT, KIOSK
    department_id VARCHAR(50) REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    patient_id_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    dob DATE,
    age INT,
    gender VARCHAR(20),
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    emergency_contact VARCHAR(100),
    preferred_language VARCHAR(30) DEFAULT 'English',
    accessibility_requirements TEXT,
    caregiver_info TEXT,
    consent BOOLEAN DEFAULT TRUE,
    medical_record_ref VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id),
    full_name VARCHAR(100) NOT NULL,
    title VARCHAR(50) DEFAULT 'Dr.',
    department_id VARCHAR(50) REFERENCES departments(id),
    room_number VARCHAR(20) NOT NULL,
    floor VARCHAR(20) DEFAULT '1',
    status VARCHAR(30) DEFAULT 'AVAILABLE', -- AVAILABLE, CONSULTING, DOCUMENTING, BREAK, INPATIENT_EMERGENCY, UNAVAILABLE
    avg_consult_minutes REAL DEFAULT 15.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_status (
    id VARCHAR(50) PRIMARY KEY,
    doctor_id VARCHAR(50) NOT NULL REFERENCES doctors(id),
    status VARCHAR(30) NOT NULL,
    busy_until TIMESTAMP,
    current_patient_id VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
    doctor_id VARCHAR(50) REFERENCES doctors(id),
    department_id VARCHAR(50) REFERENCES departments(id),
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR(20) NOT NULL,
    visit_type VARCHAR(30) NOT NULL, -- FIRST_VISIT, FOLLOW_UP, POST_OP, REFILL, DIAGNOSTIC_REVIEW, URGENT, EMERGENCY, ROUTINE
    reason_for_visit TEXT,
    status VARCHAR(30) DEFAULT 'SCHEDULED', -- SCHEDULED, CHECKED_IN, WAITING, CALLED, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW, ON_HOLD
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_entries (
    id VARCHAR(50) PRIMARY KEY,
    token_number VARCHAR(30) NOT NULL,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
    doctor_id VARCHAR(50) REFERENCES doctors(id),
    department_id VARCHAR(50) REFERENCES departments(id),
    appointment_id VARCHAR(50) REFERENCES appointments(id),
    visit_type VARCHAR(30) NOT NULL,
    priority_level INT DEFAULT 3, -- 1: EMERGENCY, 2: URGENT, 3: ROUTINE
    status VARCHAR(30) DEFAULT 'WAITING', -- WAITING, CALLED, TEMPORARILY_ABSENT, GRACE_PERIOD, RESUMED, IN_CONSULTATION, COMPLETED, CANCELLED, NO_SHOW, ON_HOLD
    is_walkin BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP,
    consult_started_at TIMESTAMP,
    consult_completed_at TIMESTAMP,
    grace_period_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_events (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    event_type VARCHAR(50) NOT NULL, -- PATIENT_REGISTERED, APPOINTMENT_CREATED, PATIENT_CHECKED_IN, TOKEN_CREATED, PATIENT_CALLED, PATIENT_STARTED, PATIENT_COMPLETED, EMERGENCY_CREATED, ROOM_CHANGED, etc.
    actor_id VARCHAR(50),
    actor_role VARCHAR(30),
    payload TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS triage_records (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    patient_id VARCHAR(50) REFERENCES patients(id),
    triage_level VARCHAR(20) DEFAULT 'ROUTINE',
    complexity_score INT DEFAULT 1,
    comorbidities_count INT DEFAULT 0,
    diagnostic_review_needed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultations (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    doctor_id VARCHAR(50) REFERENCES doctors(id),
    patient_id VARCHAR(50) REFERENCES patients(id),
    appointment_id VARCHAR(50) REFERENCES appointments(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_minutes REAL,
    diagnosis TEXT,
    notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id VARCHAR(50) PRIMARY KEY,
    consultation_id VARCHAR(50) REFERENCES consultations(id),
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
    doctor_id VARCHAR(50) NOT NULL REFERENCES doctors(id),
    medicine_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_history (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(id),
    visit_date DATE NOT NULL,
    doctor_name VARCHAR(100),
    department_name VARCHAR(100),
    diagnosis TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_cases (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    patient_id VARCHAR(50) REFERENCES patients(id),
    doctor_id VARCHAR(50) REFERENCES doctors(id),
    level VARCHAR(20) DEFAULT 'EMERGENCY',
    reason TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intake_forms (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    patient_id VARCHAR(50) REFERENCES patients(id),
    reason_for_visit TEXT,
    symptoms TEXT,
    current_medications TEXT,
    previous_surgeries TEXT,
    allergies TEXT,
    questionnaire_json TEXT,
    consent_signed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accessibility_preferences (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id),
    high_contrast BOOLEAN DEFAULT FALSE,
    large_text BOOLEAN DEFAULT FALSE,
    audio_announcements BOOLEAN DEFAULT TRUE,
    preferred_language VARCHAR(30) DEFAULT 'English',
    quiet_room_needed BOOLEAN DEFAULT FALSE,
    wheelchair_access BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eta_predictions (
    id VARCHAR(50) PRIMARY KEY,
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    expected_start VARCHAR(30),
    lower_bound VARCHAR(30),
    upper_bound VARCHAR(30),
    confidence REAL DEFAULT 0.85,
    patients_ahead INT DEFAULT 0,
    estimated_wait_minutes INT DEFAULT 0,
    model_version VARCHAR(30) DEFAULT 'v1-deterministic',
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id),
    queue_entry_id VARCHAR(50) REFERENCES queue_entries(id),
    type VARCHAR(30) NOT NULL,
    channel VARCHAR(20) DEFAULT 'WEB',
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    reason TEXT,
    details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinic_settings (
    key_name VARCHAR(50) PRIMARY KEY,
    value_text TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS working_hours (
    id VARCHAR(50) PRIMARY KEY,
    day_of_week VARCHAR(20) NOT NULL,
    open_time VARCHAR(20) NOT NULL,
    close_time VARCHAR(20) NOT NULL,
    is_open BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

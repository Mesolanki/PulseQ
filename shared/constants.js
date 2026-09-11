// Shared Constants for Smart Clinic Ecosystem

export const API_BASE_URL = 'http://localhost:5000';
export const SOCKET_URL = 'http://localhost:5000';

export const VISIT_TYPES = [
  'FIRST_VISIT',
  'FOLLOW_UP',
  'POST_OP',
  'REFILL',
  'DIAGNOSTIC_REVIEW',
  'ROUTINE',
  'URGENT',
  'EMERGENCY'
];

export const DOCTOR_STATUSES = [
  'AVAILABLE',
  'CONSULTING',
  'DOCUMENTING',
  'BREAK',
  'INPATIENT_EMERGENCY',
  'UNAVAILABLE'
];

export const QUEUE_STATUSES = [
  'WAITING',
  'CALLED',
  'TEMPORARILY_ABSENT',
  'GRACE_PERIOD',
  'RESUMED',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'ON_HOLD'
];

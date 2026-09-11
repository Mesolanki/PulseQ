"""
In-memory hospital simulation.

This stands in for a real EMR / triage feed. In a real deployment this module
would be replaced by connectors into the hospital's actual systems (HL7/FHIR
feeds, a triage board, room-booking software, etc). For the hackathon it
generates believable, controllable "live" activity so the prediction engine
and UI have something real to react to.
"""
from __future__ import annotations

import random
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Priority(int, Enum):
    EMERGENCY = 1
    URGENT = 2
    ROUTINE = 3


PRIORITY_LABELS = {
    Priority.EMERGENCY: "Emergency",
    Priority.URGENT: "Urgent",
    Priority.ROUTINE: "Routine",
}

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditi", "Diya", "Kabir", "Meera", "Rohan", "Anaya",
    "Ishaan", "Priya", "Arjun", "Sneha", "Kunal", "Tara", "Yash", "Nisha",
]


@dataclass
class Doctor:
    id: str
    name: str
    room: str
    avg_consult_minutes: float  # this doctor's historical average
    status: str = "free"  # "free" | "busy"
    current_patient_id: Optional[str] = None
    busy_until: float = 0.0  # epoch seconds


@dataclass
class Patient:
    id: str
    name: str
    priority: Priority
    joined_at: float
    status: str = "waiting"  # waiting | in_consult | done | no_show
    doctor_id: Optional[str] = None
    consult_started_at: Optional[float] = None
    consult_ended_at: Optional[float] = None
    is_walkin: bool = False
    # filled in by the prediction engine each tick
    eta_low: Optional[int] = None
    eta_high: Optional[int] = None


class Hospital:
    """Holds all mutable state for the demo. One instance per server process."""

    def __init__(self) -> None:
        self.doctors: dict[str, Doctor] = {}
        self.patients: dict[str, Patient] = {}
        self._name_pool = FIRST_NAMES.copy()
        random.shuffle(self._name_pool)
        self._seed_doctors()
        self._seed_initial_patients()

    # ---------- setup ----------

    def _seed_doctors(self) -> None:
        seed = [
            ("Dr. Rao", "Room 1", 9.0),
            ("Dr. Shah", "Room 2", 13.0),
            ("Dr. Iyer", "Room 3", 7.5),
        ]
        for name, room, avg in seed:
            d = Doctor(id=str(uuid.uuid4())[:8], name=name, room=room, avg_consult_minutes=avg)
            self.doctors[d.id] = d

    def _seed_initial_patients(self) -> None:
        for _ in range(6):
            self.add_patient(priority=Priority.ROUTINE, is_walkin=False)
        self._assign_free_doctors()

    def _next_name(self) -> str:
        if not self._name_pool:
            self._name_pool = FIRST_NAMES.copy()
            random.shuffle(self._name_pool)
        return self._name_pool.pop()

    # ---------- mutation API (called by FastAPI routes) ----------

    def add_patient(self, priority: Priority = Priority.ROUTINE, is_walkin: bool = False) -> Patient:
        p = Patient(
            id=str(uuid.uuid4())[:8],
            name=self._next_name(),
            priority=priority,
            joined_at=time.time(),
            is_walkin=is_walkin,
        )
        self.patients[p.id] = p
        return p

    def trigger_emergency(self) -> Patient:
        """A walk-in emergency that jumps to the front of the queue."""
        return self.add_patient(priority=Priority.EMERGENCY, is_walkin=True)

    def trigger_walkin(self) -> Patient:
        return self.add_patient(priority=Priority.ROUTINE, is_walkin=True)

    def mark_no_show(self, patient_id: str) -> bool:
        p = self.patients.get(patient_id)
        if not p or p.status != "waiting":
            return False
        p.status = "no_show"
        return True

    def reset(self) -> None:
        self.__init__()

    # ---------- queue mechanics ----------

    def waiting_queue(self) -> list[Patient]:
        """Patients still waiting, ordered the way they'll actually be seen:
        higher priority first, then first-come-first-served within a priority."""
        waiting = [p for p in self.patients.values() if p.status == "waiting"]
        waiting.sort(key=lambda p: (p.priority.value, p.joined_at))
        return waiting

    def _assign_free_doctors(self) -> None:
        queue = self.waiting_queue()
        free_doctors = [d for d in self.doctors.values() if d.status == "free"]
        for doctor in free_doctors:
            if not queue:
                break
            patient = queue.pop(0)
            self._start_consult(doctor, patient)

    def _start_consult(self, doctor: Doctor, patient: Patient) -> None:
        now = time.time()
        # sample a realistic duration around this doctor's average
        minutes = max(2.0, random.gauss(doctor.avg_consult_minutes, doctor.avg_consult_minutes * 0.25))
        doctor.status = "busy"
        doctor.current_patient_id = patient.id
        doctor.busy_until = now + minutes * 60
        patient.status = "in_consult"
        patient.doctor_id = doctor.id
        patient.consult_started_at = now

    def tick(self) -> None:
        """Advance the simulation by one step. Call this periodically."""
        now = time.time()
        for doctor in self.doctors.values():
            if doctor.status == "busy" and now >= doctor.busy_until:
                patient = self.patients.get(doctor.current_patient_id)
                if patient:
                    patient.status = "done"
                    patient.consult_ended_at = now
                doctor.status = "free"
                doctor.current_patient_id = None
        self._assign_free_doctors()

    # ---------- read helpers for the API layer ----------

    def doctor_avg_minutes(self) -> float:
        vals = [d.avg_consult_minutes for d in self.doctors.values()]
        return sum(vals) / len(vals) if vals else 10.0

    def free_doctor_count(self) -> int:
        return sum(1 for d in self.doctors.values() if d.status == "free")

    def patients_ahead(self, patient: Patient) -> int:
        count = 0
        for p in self.waiting_queue():
            if p.id == patient.id:
                break
            count += 1
        return count

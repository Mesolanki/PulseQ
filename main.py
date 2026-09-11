"""
FastAPI backend for the outpatient queue predictor demo.

Run with:  uvicorn main:app --reload --port 8000
Frontend expects this on http://localhost:8000
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from prediction import engine
from simulator import Hospital, Priority

app = FastAPI(title="Outpatient Queue Predictor")

# Wide open for the hackathon demo -- lock this down before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)



hospital = Hospital()

TICK_SECONDS = 4


# ---------- response shapes ----------

class PatientOut(BaseModel):
    id: str
    name: str
    priority: str
    status: str
    is_walkin: bool
    waiting_minutes: int
    eta_low: int | None = None
    eta_high: int | None = None
    doctor: str | None = None


class DoctorOut(BaseModel):
    id: str
    name: str
    room: str
    status: str
    avg_consult_minutes: float
    current_patient: str | None = None
    minutes_remaining: int | None = None


class StateOut(BaseModel):
    server_time: str
    model_backend: str
    doctors: list[DoctorOut]
    waiting: list[PatientOut]
    in_consult: list[PatientOut]
    dashboard: dict


# ---------- helpers ----------

def _refresh_predictions() -> None:
    now = time.time()
    hour = datetime.now().hour
    free_doctors = hospital.free_doctor_count()
    avg_consult = hospital.doctor_avg_minutes()
    for patient in hospital.waiting_queue():
        ahead = hospital.patients_ahead(patient)
        low, high = engine.predict_range(
            position_ahead=ahead,
            priority=patient.priority.value,
            free_doctors=free_doctors,
            avg_consult_min=avg_consult,
            hour_of_day=hour,
        )
        patient.eta_low, patient.eta_high = low, high


def _serialize_patient(p) -> PatientOut:
    now = time.time()
    doctor_name = hospital.doctors[p.doctor_id].name if p.doctor_id else None
    return PatientOut(
        id=p.id,
        name=p.name,
        priority=p.priority.name.title(),
        status=p.status,
        is_walkin=p.is_walkin,
        waiting_minutes=int((now - p.joined_at) / 60),
        eta_low=p.eta_low,
        eta_high=p.eta_high,
        doctor=doctor_name,
    )


def _serialize_doctor(d) -> DoctorOut:
    remaining = None
    if d.status == "busy":
        remaining = max(0, int((d.busy_until - time.time()) / 60))
    return DoctorOut(
        id=d.id,
        name=d.name,
        room=d.room,
        status=d.status,
        avg_consult_minutes=round(d.avg_consult_minutes, 1),
        current_patient=hospital.patients[d.current_patient_id].name if d.current_patient_id else None,
        minutes_remaining=remaining,
    )


def _dashboard_stats() -> dict:
    waiting = hospital.waiting_queue()
    all_waits = [int((time.time() - p.joined_at) / 60) for p in waiting]
    return {
        "patients_waiting": len(waiting),
        "doctors_free": hospital.free_doctor_count(),
        "doctors_total": len(hospital.doctors),
        "longest_wait_minutes": max(all_waits) if all_waits else 0,
        "avg_wait_minutes": round(sum(all_waits) / len(all_waits), 1) if all_waits else 0,
        "emergency_in_queue": sum(1 for p in waiting if p.priority == Priority.EMERGENCY),
    }


# ---------- background loop ----------

@app.on_event("startup")
async def startup() -> None:
    engine.train()

    async def loop() -> None:
        while True:
            hospital.tick()
            _refresh_predictions()
            await asyncio.sleep(TICK_SECONDS)

    asyncio.create_task(loop())


# ---------- routes ----------

@app.get("/api/state", response_model=StateOut)
def get_state():
    _refresh_predictions()
    waiting = [_serialize_patient(p) for p in hospital.waiting_queue()]
    in_consult = [
        _serialize_patient(p) for p in hospital.patients.values() if p.status == "in_consult"
    ]
    return StateOut(
        server_time=datetime.now().isoformat(),
        model_backend=engine.backend_name,
        doctors=[_serialize_doctor(d) for d in hospital.doctors.values()],
        waiting=waiting,
        in_consult=in_consult,
        dashboard=_dashboard_stats(),
    )


@app.post("/api/events/walkin", response_model=PatientOut)
def event_walkin():
    p = hospital.trigger_walkin()
    _refresh_predictions()
    return _serialize_patient(p)


@app.post("/api/events/emergency", response_model=PatientOut)
def event_emergency():
    p = hospital.trigger_emergency()
    _refresh_predictions()
    return _serialize_patient(p)


@app.post("/api/events/noshow/{patient_id}")
def event_no_show(patient_id: str):
    ok = hospital.mark_no_show(patient_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Patient not found or not currently waiting")
    return {"ok": True}


@app.post("/api/reset")
def reset():
    hospital.reset()
    _refresh_predictions()
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True, "model_backend": engine.backend_name}

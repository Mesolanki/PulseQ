# Not a token — a promise

A working prototype for **P09: Outpatient queue unpredictability** — a live,
range-based wait-time prediction system with a patient view and a staff
demo-control panel, built to actually run and react live in front of judges.

## What's here

```
queue-predictor/
├── backend/
│   ├── simulator.py     # in-memory "hospital": doctors, patients, queue logic
│   ├── prediction.py    # trains a model on synthetic data, predicts a wait RANGE
│   ├── main.py           # FastAPI app: /api/state, event-injection endpoints
│   └── requirements.txt
└── frontend/
    └── index.html        # single-file React app (CDN React, no build step)
```

No real hospital data is available for a hackathon, so `prediction.py`
generates a synthetic-but-realistic training set that mirrors the same
dynamics you'd expect from real triage data (queue position, priority, doctor
speed, time of day), trains an XGBoost regressor on it (falls back to
scikit-learn, then to a plain rule-based formula if neither is installed —
the demo never breaks), and serves live predictions as a **range**, not a
fake-precise single number.

`simulator.py` is a stand-in for a real EMR/triage feed. Swap its data source
for a real one later; everything downstream (prediction, API, UI) stays the same.

## Run it

**Backend** (needs Python 3.10+):
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** — no build step, just open the file:
```bash
open frontend/index.html      # macOS
# or just double-click it / open it in a browser
```

The frontend polls `http://localhost:8000` every 3 seconds. If you see a red
"can't reach the backend" card, the API isn't running yet.

## Demo script (2–3 minutes)

1. Open the **patient view** — point out the waiting room updating live, and
   that estimates are shown as a range ("15–25 min") with a "safe to step
   away" / "stay nearby" signal, not a fake-precise countdown.
2. Switch to the **staff / demo panel** tab.
3. Click **"+ Emergency (jumps queue)"** — switch back to patient view and
   show every estimate shift in real time as the new patient jumps to the front.
4. Click **"+ Walk-in patient"** a couple of times to show organic congestion
   building, and point at the **Congestion** indicator on the staff panel
   moving from Low → Moderate → High.
5. Mark someone a **no-show** from the dropdown and show the queue recompute.
6. Close on the model backend line at the bottom of the patient view
   ("Model backend: xgboost") and explain the fallback chain — the system is
   designed to degrade gracefully, never go blank.

## What to say about the ML honestly

Be upfront that this is trained on **synthetic data generated to mirror
realistic hospital dynamics**, not real historical wait times — no real
hospital hands that over for a hackathon. What's real and demonstrable:
the live feature pipeline (queue position, priority, doctor load, time of
day), the model training and serving path, and the range-based, fallback-safe
prediction approach. That's the part a real deployment would keep; only the
training data source changes.

## Natural next steps (mention as roadmap, don't over-promise as built)

- SMS / missed-call fallback channel for patients without smartphones
- QR check-in so patients can leave and safely re-enter the queue
- Multi-language UI (especially relevant for a Gujarat-based deployment)
- Swap the synthetic dataset for a real historical export once a partner
  hospital provides one, retrain the same pipeline unchanged
- WebSocket push instead of polling, once the demo needs sub-second updates

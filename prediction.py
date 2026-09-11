"""
Prediction engine.

Real hospitals don't hand out historical wait-time datasets to hackathon
teams, so we generate a synthetic-but-realistic training set that mirrors
the same dynamics as the live simulator (triage priority, queue position,
doctor speed, time of day), train a small gradient-boosted model on it, and
use it to score the live queue. A rule-based estimate is always computed
alongside it and used as a fallback if the model can't be trained or loaded
-- the live demo should never go blank because a model failed to import.

The output is a RANGE (low, high), not a single number: a fake-precise
minute count is more likely to be wrong and less trustworthy than an honest
band. The range widens with queue depth, since uncertainty compounds the
further out a prediction reaches.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

import numpy as np

try:
    from xgboost import XGBRegressor
    _HAS_XGBOOST = True
except Exception:  # pragma: no cover - keeps the demo alive without xgboost
    _HAS_XGBOOST = False

try:
    from sklearn.ensemble import GradientBoostingRegressor
    _HAS_SKLEARN = True
except Exception:  # pragma: no cover
    _HAS_SKLEARN = False


FEATURE_NAMES = ["position_ahead", "priority", "free_doctors", "avg_consult_min", "hour_of_day"]


def _generate_synthetic_dataset(n: int = 4000, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    """Simulate n synthetic historical visits with a plausible generating process.

    This is a stand-in for a real hospital's historical wait-time logs. Swap
    this out for a query against real historical data as soon as it exists --
    the rest of the pipeline (feature names, training, serving) stays the same.
    """
    rng = np.random.default_rng(seed)
    position_ahead = rng.integers(0, 20, size=n)
    priority = rng.choice([1, 2, 3], size=n, p=[0.08, 0.22, 0.70])
    free_doctors = rng.integers(0, 4, size=n)
    avg_consult_min = rng.normal(10, 2.5, size=n).clip(4, 20)
    hour_of_day = rng.integers(8, 18, size=n)

    # Ground-truth generating process: more people ahead -> longer wait,
    # more free doctors -> shorter wait, higher urgency -> jumps the queue,
    # slower doctors -> longer wait, midday congestion bump, plus noise.
    base = position_ahead * avg_consult_min / np.maximum(free_doctors + 1, 1)
    priority_effect = np.select([priority == 1, priority == 2, priority == 3], [-8, -2, 0])
    midday_bump = np.where((hour_of_day >= 11) & (hour_of_day <= 14), 6, 0)
    noise = rng.normal(0, 4, size=n)
    wait_minutes = (base + priority_effect + midday_bump + noise).clip(0, 180)

    X = np.column_stack([position_ahead, priority, free_doctors, avg_consult_min, hour_of_day])
    y = wait_minutes
    return X, y


@dataclass
class PredictionEngine:
    model: object = None
    residual_std: float = 8.0
    backend_name: str = "rule-based"

    def train(self) -> None:
        X, y = _generate_synthetic_dataset()
        split = int(len(X) * 0.85)
        X_train, X_val = X[:split], X[split:]
        y_train, y_val = y[:split], y[split:]

        model = None
        backend_name = "rule-based"
        try:
            if _HAS_XGBOOST:
                model = XGBRegressor(
                    n_estimators=120,
                    max_depth=4,
                    learning_rate=0.08,
                    subsample=0.9,
                    reg_lambda=1.0,
                )
                model.fit(X_train, y_train)
                backend_name = "xgboost"
            elif _HAS_SKLEARN:
                model = GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.08)
                model.fit(X_train, y_train)
                backend_name = "sklearn-gbr"
        except Exception:
            model = None
            backend_name = "rule-based"

        if model is not None:
            preds = model.predict(X_val)
            residuals = y_val - preds
            self.residual_std = float(np.std(residuals)) if len(residuals) else 8.0
        self.model = model
        self.backend_name = backend_name

    def _rule_based_minutes(self, position_ahead: int, priority: int, free_doctors: int, avg_consult_min: float) -> float:
        effective_doctors = max(free_doctors, 1)
        priority_discount = {1: 0.2, 2: 0.6, 3: 1.0}[priority]
        return (position_ahead * avg_consult_min / effective_doctors) * priority_discount

    def predict_range(self, position_ahead: int, priority: int, free_doctors: int,
                       avg_consult_min: float, hour_of_day: int) -> tuple[int, int]:
        if self.model is not None:
            X = np.array([[position_ahead, priority, free_doctors, avg_consult_min, hour_of_day]])
            point = float(self.model.predict(X)[0])
        else:
            point = self._rule_based_minutes(position_ahead, priority, free_doctors, avg_consult_min)

        point = max(point, 0.0)
        # uncertainty grows with how far out the prediction reaches
        spread = self.residual_std * (1 + math.sqrt(position_ahead)) * 0.5
        low = max(0, round(point - spread))
        high = round(point + spread) + 1
        if high <= low:
            high = low + 3
        return int(low), int(high)


engine = PredictionEngine()

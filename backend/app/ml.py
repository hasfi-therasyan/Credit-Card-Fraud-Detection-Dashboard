from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = ROOT / "data" / "creditcard.csv"


@dataclass(frozen=True)
class ScoredRow:
    transaction_id: str
    fraud_probability: float
    risk_level: str
    reasons: List[str]
    amount: Optional[float]
    timestamp_utc: Optional[pd.Timestamp]


def _risk_level(p: float) -> str:
    if p >= 0.8:
        return "High Risk"
    if p >= 0.4:
        return "Medium Risk"
    return "Low Risk"


def _sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _preprocess_like_kaggle(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Expect Kaggle-style columns: Time, V1..V28, Amount. (Class may exist but will be ignored for scoring.)
    Adds Amount_Scaled and Time_Scaled, drops Amount & Time.
    """
    meta: Dict[str, Any] = {}
    if "Amount" not in df.columns or "Time" not in df.columns:
        raise ValueError("CSV must contain Kaggle columns: Time and Amount (plus V1..V28).")

    # Keep a copy for explainability
    meta["amount_series"] = df["Amount"].astype(float, errors="ignore")
    meta["time_series"] = df["Time"].astype(float, errors="ignore")

    scaler = StandardScaler()
    df = df.copy()
    df["Amount_Scaled"] = scaler.fit_transform(df[["Amount"]].astype(float))
    df["Time_Scaled"] = scaler.fit_transform(df[["Time"]].astype(float))
    df = df.drop([c for c in ["Amount", "Time", "Class"] if c in df.columns], axis=1, errors="ignore")

    # Ensure stable column order
    df = df.reindex(sorted(df.columns), axis=1)
    return df, meta


_MODEL: Optional[RandomForestClassifier] = None
_MODEL_FEATURES: Optional[List[str]] = None


def _train_fallback_model() -> Tuple[RandomForestClassifier, List[str]]:
    if not DATASET_PATH.exists():
        raise RuntimeError(f"Dataset not found at {DATASET_PATH}. Place Kaggle creditcard.csv there.")

    raw = pd.read_csv(DATASET_PATH)
    # Quick training: sample to keep dev server responsive
    raw = raw.sample(n=min(len(raw), 120_000), random_state=42)
    X, _meta = _preprocess_like_kaggle(raw.drop(columns=["Class"]))
    y = raw["Class"].astype(int)

    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced_subsample",
    )
    model.fit(X, y)
    return model, list(X.columns)


def get_model() -> Tuple[RandomForestClassifier, List[str]]:
    global _MODEL, _MODEL_FEATURES
    if _MODEL is None or _MODEL_FEATURES is None:
        _MODEL, _MODEL_FEATURES = _train_fallback_model()
    return _MODEL, _MODEL_FEATURES


def _compute_reasons(
    *,
    amount: Optional[float],
    time_sec: Optional[float],
    amount_z: Optional[float],
    is_burst: bool,
) -> List[str]:
    reasons: List[str] = []

    if amount is not None and amount_z is not None and amount_z >= 3.0:
        reasons.append("Nominal transaksi tidak normal (jauh di atas rata-rata).")

    if time_sec is not None:
        hour = int((time_sec % 86400) // 3600)
        if hour <= 5:
            reasons.append("Transaksi terjadi di jam tidak biasa (midnight–subuh).")

    if is_burst:
        reasons.append("Frekuensi transaksi terlalu cepat (burst dalam waktu singkat).")

    if not reasons:
        reasons.append("Pola transaksi memiliki deviasi dari baseline normal.")

    return reasons


def score_transactions_from_csv_bytes(csv_bytes: bytes) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Returns:
      - scored dataframe with columns required for dashboard
      - upload metadata (sha, counts, business insights)
    """
    sha = _sha256_bytes(csv_bytes)
    df_raw = pd.read_csv(pd.io.common.BytesIO(csv_bytes))

    # Create transaction_id if absent
    if "transaction_id" in df_raw.columns:
        tx_ids = df_raw["transaction_id"].astype(str).fillna("")
    elif "TransactionID" in df_raw.columns:
        tx_ids = df_raw["TransactionID"].astype(str).fillna("")
    else:
        tx_ids = pd.Series([f"TX-{i+1:06d}" for i in range(len(df_raw))])

    X, meta = _preprocess_like_kaggle(df_raw)
    model, features = get_model()
    X = X.reindex(columns=features, fill_value=0.0)

    prob = model.predict_proba(X)[:, 1].astype(float)
    risk = np.vectorize(_risk_level)(prob)

    # Explainability heuristics
    amount_series = pd.to_numeric(meta.get("amount_series", pd.Series([np.nan] * len(df_raw))), errors="coerce")
    time_series = pd.to_numeric(meta.get("time_series", pd.Series([np.nan] * len(df_raw))), errors="coerce")
    amount_z = (amount_series - amount_series.mean()) / (amount_series.std(ddof=0) + 1e-9)
    # Burst: time delta < 10s compared to previous (file-order)
    dt = time_series.diff().fillna(np.inf)
    is_burst = (dt >= 0) & (dt <= 10)

    reasons = [
        _compute_reasons(
            amount=None if np.isnan(a) else float(a),
            time_sec=None if np.isnan(t) else float(t),
            amount_z=None if np.isnan(z) else float(z),
            is_burst=bool(b),
        )
        for a, t, z, b in zip(amount_series.to_numpy(), time_series.to_numpy(), amount_z.to_numpy(), is_burst.to_numpy())
    ]

    out = pd.DataFrame(
        {
            "transaction_id": tx_ids,
            "amount": amount_series.fillna(0.0).astype(float),
            "time_sec": time_series.fillna(0.0).astype(float),
            "fraud_probability": prob,
            "risk_level": risk,
            "reasons": [json.dumps(r, ensure_ascii=False) for r in reasons],
        }
    )

    # Business-oriented insights (simple, deterministic)
    midnight_count = int(
        (((out["time_sec"] % 86400) // 3600) <= 5).sum()
    )
    high_risk_count = int((out["risk_level"] == "High Risk").sum())
    avg_susp = float(out.loc[out["risk_level"] != "Low Risk", "amount"].mean()) if len(out) else 0.0
    avg_all = float(out["amount"].mean()) if len(out) else 0.0
    mult = (avg_susp / avg_all) if avg_all > 0 else 0.0

    insights = [
        f"Most suspicious cases happen during midnight transactions: {midnight_count} transaksi (00:00–05:59).",
        f"High-risk transactions detected: {high_risk_count} transaksi.",
        f"Average suspicious amount exceeds normal behavior by {mult:.1f}x (proxy).",
    ]

    meta_out: Dict[str, Any] = {
        "sha256": sha,
        "total": int(len(out)),
        "high_risk": high_risk_count,
        "insights": insights,
    }
    return out, meta_out


from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional

import os

import anyio
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from backend.app.audit import log_activity
from backend.app.db import get_session, init_db
from backend.app.ml import score_transactions_from_csv_bytes
from backend.app.models import (
    ActivityLog,
    InvestigationStatus,
    RiskLevel,
    Role,
    TransactionRecord,
    UploadFileRecord,
)


app = FastAPI(title="FraudShield Analytics API", version="0.1.0")

_cors_env = os.environ.get("FRAUDSHIELD_CORS_ORIGINS", "")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


def _role_sim(role: Optional[str]) -> Role:
    if not role:
        return Role.analyst
    if role.lower() in ("auditor", "audit"):
        return Role.auditor
    return Role.analyst


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}


@app.post("/api/upload")
async def upload_csv(
    file: UploadFile = File(...),
    role: Optional[str] = Query(default="Analyst"),
    session: Session = Depends(get_session),
) -> dict:
    user_id = "USR001"
    role_enum = _role_sim(role)

    try:
        content = await file.read()
        # Offload CPU-heavy scoring so the event loop stays responsive.
        scored, meta = await anyio.to_thread.run_sync(score_transactions_from_csv_bytes, content)

        upload = UploadFileRecord(
            filename=file.filename or "transactions.csv",
            size_bytes=len(content),
            sha256=meta["sha256"],
            uploaded_by=user_id,
            role=role_enum,
            status="SUCCESS",
        )
        session.add(upload)
        session.commit()
        session.refresh(upload)

        # Persist transactions
        for i, row in scored.iterrows():
            tx = TransactionRecord(
                upload_id=upload.id,
                transaction_id=str(row["transaction_id"]),
                timestamp_utc=None,  # Kaggle time is relative; keep null for now
                amount=float(row["amount"]),
                fraud_probability=float(row["fraud_probability"]),
                risk_level=RiskLevel(row["risk_level"]),
                flagged_reasons_json=str(row["reasons"]),
                reviewed=False,
                investigation_status=InvestigationStatus.pending,
                investigator_notes="",
            )
            session.add(tx)
        session.commit()

        log_activity(
            session,
            user_id=user_id,
            role=role_enum,
            action="UPLOAD",
            resource="transactions_csv",
            status="SUCCESS",
            details=json.dumps(
                {"filename": upload.filename, "sha256": upload.sha256, "total": meta["total"]},
                ensure_ascii=False,
            ),
        )

        return {
            "upload": {
                "id": upload.id,
                "uploaded_at": upload.uploaded_at.isoformat(),
                "filename": upload.filename,
                "size_bytes": upload.size_bytes,
                "sha256": upload.sha256,
            },
            "summary": summary(session=session),
            "insights": meta.get("insights", []),
        }
    except Exception as e:
        log_activity(
            session,
            user_id=user_id,
            role=role_enum,
            action="UPLOAD",
            resource="transactions_csv",
            status="FAILED",
            details=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/summary")
def summary(
    upload_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
) -> dict:
    stmt = select(TransactionRecord)
    if upload_id is not None:
        stmt = stmt.where(TransactionRecord.upload_id == upload_id)
    txs = session.exec(stmt).all()
    total = len(txs)
    fraud = sum(1 for t in txs if t.risk_level == RiskLevel.high)
    medium = sum(1 for t in txs if t.risk_level == RiskLevel.medium)
    rate = (fraud / total) if total else 0.0

    # Estimated prevented losses: proxy = sum(amount) of high risk * 0.9
    prevented = sum((t.amount or 0.0) for t in txs if t.risk_level == RiskLevel.high) * 0.9

    return {
        "total_transactions": total,
        "total_fraud_detected": fraud,
        "total_medium_risk": medium,
        "fraud_detection_rate": rate,
        "estimated_prevented_losses": prevented,
    }


@app.get("/api/uploads")
def uploads(session: Session = Depends(get_session)) -> List[dict]:
    rows = session.exec(select(UploadFileRecord).order_by(UploadFileRecord.uploaded_at.desc())).all()
    return [
        {
            "id": r.id,
            "uploaded_at": r.uploaded_at.isoformat(),
            "filename": r.filename,
            "size_bytes": r.size_bytes,
            "sha256": r.sha256,
            "uploaded_by": r.uploaded_by,
            "role": r.role,
            "status": r.status,
        }
        for r in rows
    ]


@app.get("/api/activity")
def activity(session: Session = Depends(get_session), limit: int = Query(default=100, ge=1, le=500)) -> List[dict]:
    rows = session.exec(select(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(limit)).all()
    return [
        {
            "timestamp": r.timestamp.isoformat(),
            "user_id": r.user_id,
            "role": r.role,
            "action": r.action,
            "resource": r.resource,
            "status": r.status,
            "details": r.details,
        }
        for r in rows
    ]


@app.get("/api/transactions")
def list_transactions(
    session: Session = Depends(get_session),
    q: Optional[str] = Query(default=None, description="Search transaction_id contains"),
    risk: Optional[str] = Query(default=None, description="Low Risk|Medium Risk|High Risk"),
    min_amount: Optional[float] = Query(default=None),
    max_amount: Optional[float] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    upload_id: Optional[int] = Query(default=None),
) -> dict:
    stmt = select(TransactionRecord).order_by(TransactionRecord.fraud_probability.desc())
    if upload_id is not None:
        stmt = stmt.where(TransactionRecord.upload_id == upload_id)
    if q:
        stmt = stmt.where(TransactionRecord.transaction_id.contains(q))
    if risk:
        stmt = stmt.where(TransactionRecord.risk_level == RiskLevel(risk))
    if min_amount is not None:
        stmt = stmt.where(TransactionRecord.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(TransactionRecord.amount <= max_amount)

    total = len(session.exec(stmt).all())
    rows = session.exec(stmt.offset(offset).limit(limit)).all()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "transaction_id": r.transaction_id,
                "amount": r.amount,
                "fraud_probability": r.fraud_probability,
                "risk_level": r.risk_level,
                "why_flagged": json.loads(r.flagged_reasons_json or "[]"),
                "reviewed": r.reviewed,
                "investigation_status": r.investigation_status,
                "notes": r.investigator_notes,
                "updated_at": r.updated_at.isoformat(),
            }
            for r in rows
        ],
    }


@app.post("/api/transactions/{tx_id}/review")
def mark_reviewed(
    tx_id: int,
    reviewed: bool = Query(default=True),
    status: InvestigationStatus = Query(default=InvestigationStatus.under_review),
    role: Optional[str] = Query(default="Auditor"),
    session: Session = Depends(get_session),
) -> dict:
    user_id = "USR001"
    role_enum = _role_sim(role)
    tx = session.get(TransactionRecord, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.reviewed = reviewed
    tx.investigation_status = status
    tx.updated_at = datetime.utcnow()
    session.add(tx)
    session.commit()

    log_activity(
        session,
        user_id=user_id,
        role=role_enum,
        action="UPDATE",
        resource=f"transaction/{tx.transaction_id}",
        status="SUCCESS",
        details=json.dumps({"reviewed": reviewed, "status": status}, ensure_ascii=False),
    )
    return {"ok": True}


@app.post("/api/transactions/{tx_id}/note")
def add_note(
    tx_id: int,
    note: str = Query(..., min_length=1, max_length=2000),
    role: Optional[str] = Query(default="Auditor"),
    session: Session = Depends(get_session),
) -> dict:
    user_id = "USR001"
    role_enum = _role_sim(role)
    tx = session.get(TransactionRecord, tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx.investigator_notes = note
    tx.updated_at = datetime.utcnow()
    session.add(tx)
    session.commit()

    log_activity(
        session,
        user_id=user_id,
        role=role_enum,
        action="COMMENT",
        resource=f"transaction/{tx.transaction_id}",
        status="SUCCESS",
        details="Investigator note updated",
    )
    return {"ok": True}


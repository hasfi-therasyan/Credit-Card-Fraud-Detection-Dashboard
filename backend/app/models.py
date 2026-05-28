from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class Role(str, Enum):
    analyst = "Analyst"
    auditor = "Auditor"


class InvestigationStatus(str, Enum):
    pending = "Pending"
    under_review = "Under Review"
    resolved = "Resolved"


class RiskLevel(str, Enum):
    low = "Low Risk"
    medium = "Medium Risk"
    high = "High Risk"


class UploadFileRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    filename: str
    size_bytes: int
    sha256: str = Field(index=True)
    uploaded_by: str = Field(default="USR001")
    role: Role = Field(default=Role.analyst)
    status: str = Field(default="SUCCESS")


class TransactionRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    upload_id: int = Field(index=True)

    transaction_id: str = Field(index=True)
    timestamp_utc: Optional[datetime] = Field(default=None, index=True)
    amount: Optional[float] = None

    fraud_probability: float = Field(index=True)
    risk_level: RiskLevel = Field(index=True)

    # Explainability (human readable)
    flagged_reasons_json: str = Field(default="[]")  # JSON list[str]

    # Audit workflow fields
    reviewed: bool = Field(default=False, index=True)
    investigation_status: InvestigationStatus = Field(default=InvestigationStatus.pending, index=True)
    investigator_notes: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    user_id: str = Field(default="USR001", index=True)
    role: Role = Field(default=Role.analyst, index=True)
    action: str
    resource: str
    status: str = Field(default="SUCCESS")
    details: str = Field(default="")


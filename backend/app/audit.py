from __future__ import annotations

from sqlmodel import Session

from backend.app.models import ActivityLog, Role


def log_activity(
    session: Session,
    *,
    user_id: str,
    role: Role,
    action: str,
    resource: str,
    status: str = "SUCCESS",
    details: str = "",
) -> None:
    session.add(
        ActivityLog(
            user_id=user_id,
            role=role,
            action=action,
            resource=resource,
            status=status,
            details=details,
        )
    )
    session.commit()


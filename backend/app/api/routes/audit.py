from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.audit import AuditLogRead

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogRead])
def list_audit_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    action_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Журнал действий. Admin видит всё, user — только свои."""
    from app.models.audit_log import AuditLog
    from sqlalchemy import desc

    q = db.query(AuditLog)
    if current_user.role != "admin":
        q = q.filter(AuditLog.actor_user_id == current_user.id)
    if action_type:
        q = q.filter(AuditLog.action_type == action_type)
    rows = q.order_by(desc(AuditLog.performed_at)).offset(offset).limit(limit).all()
    return [AuditLogRead.model_validate(r) for r in rows]

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.approval import (
    ApprovalActionRequest,
    ApprovalDecisionResponse,
    ApprovalStagesResponse,
    DeanPendingDocument,
    PendingStageDocument,
)
from app.services.approval_workflow_service import ApprovalWorkflowService, STAGE_DEAN_REVIEW
from app.services.file_service import FileService

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _assert_same_university(actor: User, obj) -> None:
    if (
        actor.role in ("dean", "department")
        and actor.university_id
        and obj.owner
        and obj.owner.university_id
        and actor.university_id != obj.owner.university_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Документ принадлежит студенту другого вуза",
        )


def _student_display_fields(db: Session, obj) -> tuple[str | None, str | None]:
    sw = (getattr(obj, "student_wallet_address", None) or "").strip()
    if sw:
        st = (
            db.query(User)
            .filter(func.lower(User.wallet_address) == func.lower(sw))
            .first()
        )
        if st:
            return st.email, st.full_name
    owner = obj.owner
    if owner:
        return owner.email, owner.full_name
    return None, None


@router.get("/documents/{obj_id}/stages", response_model=ApprovalStagesResponse)
def get_document_stages(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).get_object(current_user, obj_id)
    payload = ApprovalWorkflowService(db).get_document_stages(obj, current_user)
    return ApprovalStagesResponse(**payload)


@router.post("/documents/{obj_id}/approve", response_model=ApprovalDecisionResponse)
@router.patch("/documents/{obj_id}/approve", response_model=ApprovalDecisionResponse)
def approve_current_stage(
    obj_id: UUID,
    body: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).get_object(current_user, obj_id)
    _assert_same_university(current_user, obj)
    out = ApprovalWorkflowService(db).approve_current_stage(
        document=obj,
        actor=current_user,
        comment=body.comment,
    )
    return ApprovalDecisionResponse(**out)


@router.post("/documents/{obj_id}/reject", response_model=ApprovalDecisionResponse)
def reject_current_stage(
    obj_id: UUID,
    body: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment_text = (body.comment or "").strip()
    if not comment_text:
        raise HTTPException(
            status_code=422,
            detail="Причина отклонения обязательна",
        )
    obj = FileService(db).get_object(current_user, obj_id)
    _assert_same_university(current_user, obj)
    out = ApprovalWorkflowService(db).reject_current_stage(
        document=obj,
        actor=current_user,
        comment=comment_text,
    )
    return ApprovalDecisionResponse(**out)


@router.get("/pending", response_model=list[PendingStageDocument])
def list_pending_by_stage(
    stage_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ApprovalWorkflowService(db)
    docs = service.list_pending_documents_for_stage(current_user, stage_code=stage_code)
    result = []
    for obj in docs:
        current = service.get_document_stages(obj).get("current_stage_code")
        result.append(
            PendingStageDocument(
                id=obj.id,
                file_name=obj.file_name,
                status=obj.status,
                owner_email=obj.owner.email if obj.owner else None,
                created_at=obj.created_at,
                current_stage_code=current,
            )
        )
    return result


@router.get("/pending-for-dean", response_model=list[DeanPendingDocument])
def list_pending_for_dean(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "dean":
        raise HTTPException(
            status_code=403,
            detail="Доступно только пользователям с ролью «Деканат»",
        )
    service = ApprovalWorkflowService(db)
    docs = service.list_pending_documents_for_stage(current_user, stage_code=STAGE_DEAN_REVIEW)
    out: list[DeanPendingDocument] = []
    for obj in docs:
        owner_email, owner_full_name = _student_display_fields(db, obj)
        out.append(
            DeanPendingDocument(
                id=obj.id,
                file_name=obj.file_name,
                title=obj.title,
                owner_email=owner_email,
                owner_full_name=owner_full_name,
                uploaded_by_email=obj.uploaded_by.email if obj.uploaded_by else None,
                created_at=obj.created_at,
                status=obj.status,
                document_type=obj.document_type,
            )
        )
    return out

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.approval import (
    ApprovalActionRequest,
    ApprovalDecisionResponse,
    ApprovalStagesResponse,
    PendingStageDocument,
)
from app.services.approval_workflow_service import ApprovalWorkflowService
from app.services.file_service import FileService

router = APIRouter(prefix="/approvals", tags=["approvals"])


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
    obj = FileService(db).get_object(current_user, obj_id)
    out = ApprovalWorkflowService(db).reject_current_stage(
        document=obj,
        actor=current_user,
        comment=body.comment,
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

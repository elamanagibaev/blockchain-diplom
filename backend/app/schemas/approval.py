from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ApprovalActionRequest(BaseModel):
    comment: str | None = None


class ApprovalStageState(BaseModel):
    stage_id: int
    stage_code: str
    title: str
    stage_order: int
    allowed_roles: list[str]
    state: str
    acted_by: str | None = None
    acted_at: datetime | None = None
    comment: str | None = None
    can_act: bool = False


class ApprovalStagesResponse(BaseModel):
    document_id: str
    document_status: str
    current_stage_code: str | None = None
    all_stages_completed: bool
    ready_for_final_registration: bool = False
    stages: list[ApprovalStageState]


class ApprovalDecisionResponse(BaseModel):
    status: str
    completed: bool | None = None
    next_stage_code: str | None = None
    rejected_stage_code: str | None = None


class PendingStageDocument(BaseModel):
    id: UUID
    file_name: str
    status: str
    owner_email: str | None = None
    created_at: datetime
    current_stage_code: str | None = None


class DeanPendingDocument(BaseModel):
    id: UUID
    file_name: str
    title: str | None = None
    owner_email: str | None = None
    owner_full_name: str | None = None
    uploaded_by_email: str | None = None
    created_at: datetime
    status: str
    document_type: str | None = None

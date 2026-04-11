from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus, is_ledger_registered_status
from app.models.approval_action import ApprovalAction
from app.models.approval_stage_definition import ApprovalStageDefinition
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.services.diploma_automation_service import DiplomaAutomationService
from app.services.document_event_service import DocumentEventService
from app.services.pipeline_service import PipelineService

ACTION_APPROVE = "APPROVE"
ACTION_REJECT = "REJECT"

logger = logging.getLogger(__name__)

# Двухэтапная модель: кафедра → деканат.
# Администратор НЕ участвует в согласовании (см. _check_actor_can_act, can_act).
# Регистратор исключён из workflow.
STAGE_DEPARTMENT_REVIEW = "DEPARTMENT_REVIEW"
STAGE_DEAN_REVIEW = "DEAN_REVIEW"

DEFAULT_APPROVAL_STAGES = [
    {
        "code": STAGE_DEPARTMENT_REVIEW,
        "title": "Проверка кафедрой",
        "stage_order": 1,
        "allowed_roles": ["department"],
    },
    {
        "code": STAGE_DEAN_REVIEW,
        "title": "Согласование деканатом",
        "stage_order": 2,
        "allowed_roles": ["dean"],
    },
]


class ApprovalWorkflowService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def ensure_stage_definitions(self) -> None:
        """Upsert по code: DEPARTMENT_REVIEW (1) и DEAN_REVIEW (2); временный сдвиг stage_order из‑за UNIQUE."""
        rows = list(self.db.query(ApprovalStageDefinition).all())
        for i, row in enumerate(rows):
            row.stage_order = 1000 + i
        self.db.flush()
        for stage_data in DEFAULT_APPROVAL_STAGES:
            existing = (
                self.db.query(ApprovalStageDefinition)
                .filter(ApprovalStageDefinition.code == stage_data["code"])
                .first()
            )
            if existing:
                existing.stage_order = stage_data["stage_order"]
                existing.allowed_roles = list(stage_data["allowed_roles"])
                existing.title = stage_data["title"]
                existing.is_active = True
            else:
                self.db.add(
                    ApprovalStageDefinition(
                        code=stage_data["code"],
                        title=stage_data["title"],
                        stage_order=stage_data["stage_order"],
                        allowed_roles=list(stage_data["allowed_roles"]),
                        is_active=True,
                    )
                )
        self.db.flush()

    def reset_document_actions(self, document_id: UUID) -> None:
        self.db.query(ApprovalAction).filter(ApprovalAction.document_id == document_id).delete()
        self.db.flush()

    @staticmethod
    def passes_university_filter(actor: User, doc: DigitalObject) -> bool:
        """
        Для dean/department: если у актора нет university_id — видит все документы этапа.
        Если university_id задан — видит документы своего вуза и документы с owner.university_id IS NULL.
        """
        if actor.role not in ("dean", "department"):
            return True
        if not getattr(actor, "university_id", None):
            return True
        owner = doc.owner
        owner_uni = owner.university_id if owner else None
        if owner_uni is None:
            return True
        return owner_uni == actor.university_id

    def skip_department_stage_after_submit(self, document: DigitalObject, actor: User) -> None:
        """После подачи кафедрой: этап DEPARTMENT_REVIEW считается подтверждённым, очередь — DEAN_REVIEW (без commit)."""
        self.ensure_stage_definitions()
        if document.status != LifecycleStatus.UNDER_REVIEW.value:
            return
        stage = self._current_stage(document.id)
        if not stage or stage.code != STAGE_DEPARTMENT_REVIEW:
            return
        self.db.add(
            ApprovalAction(
                document_id=document.id,
                stage_definition_id=stage.id,
                actor_user_id=actor.id,
                action=ACTION_APPROVE,
                comment="Отправлено кафедрой",
                action_metadata={"stage_code": STAGE_DEPARTMENT_REVIEW, "auto": True},
            )
        )
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=actor.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "decision": "approved",
                "step": "department_approved",
                "automatic": True,
                "workflow": "two_stage_department_dean",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "stage_code": stage.code,
                "comment": "Отправлено кафедрой",
            },
        )
        PipelineService(self.db).on_department_approved(document, actor)
        self.db.flush()

    def _get_stage_definitions(self) -> list[ApprovalStageDefinition]:
        stages = (
            self.db.query(ApprovalStageDefinition)
            .filter(ApprovalStageDefinition.is_active == True)
            .order_by(ApprovalStageDefinition.stage_order.asc())
            .all()
        )
        if not stages:
            raise HTTPException(status_code=500, detail="Approval stages are not configured")
        return stages

    def _latest_actions_by_stage(self, document_id: UUID) -> dict[int, ApprovalAction]:
        actions = (
            self.db.query(ApprovalAction)
            .filter(ApprovalAction.document_id == document_id)
            .order_by(ApprovalAction.created_at.asc())
            .all()
        )
        latest: dict[int, ApprovalAction] = {}
        for action in actions:
            latest[action.stage_definition_id] = action
        return latest

    def _current_stage(self, document_id: UUID) -> ApprovalStageDefinition | None:
        stages = self._get_stage_definitions()
        latest = self._latest_actions_by_stage(document_id)
        for stage in stages:
            stage_action = latest.get(stage.id)
            if not stage_action or stage_action.action != ACTION_APPROVE:
                return stage
        return None

    def _check_actor_can_act(self, actor: User, stage: ApprovalStageDefinition) -> None:
        """Только роли из allowed_roles; admin не может подтверждать этапы согласования."""
        allowed_roles = list(stage.allowed_roles or [])
        if actor.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Роль '{actor.role}' не может выполнять этап согласования '{stage.code}'",
            )

    def get_document_stages(self, document: DigitalObject, actor: User | None = None) -> dict:
        self.ensure_stage_definitions()
        stages = self._get_stage_definitions()
        latest = self._latest_actions_by_stage(document.id)
        current = self._current_stage(document.id)
        if document.status in (
            LifecycleStatus.DEAN_APPROVED.value,
            LifecycleStatus.APPROVED.value,
            LifecycleStatus.ASSIGNED_TO_OWNER.value,
            LifecycleStatus.REGISTERED.value,
            LifecycleStatus.REGISTERED_ON_CHAIN.value,
        ) or is_ledger_registered_status(document.status):
            current = None

        output = []
        for stage in stages:
            stage_action = latest.get(stage.id)
            state = "PENDING"
            acted_by = None
            acted_at = None
            comment = None
            if document.status in (
                LifecycleStatus.DEAN_APPROVED.value,
                LifecycleStatus.APPROVED.value,
                LifecycleStatus.ASSIGNED_TO_OWNER.value,
                LifecycleStatus.REGISTERED.value,
                LifecycleStatus.REGISTERED_ON_CHAIN.value,
            ):
                state = "APPROVED"
                if stage_action:
                    if stage_action.action == ACTION_REJECT:
                        state = "REJECTED"
                    acted_by = str(stage_action.actor_user_id) if stage_action.actor_user_id else None
                    acted_at = stage_action.created_at
                    comment = stage_action.comment
            elif stage_action:
                if stage_action.action == ACTION_APPROVE:
                    state = "APPROVED"
                elif stage_action.action == ACTION_REJECT:
                    state = "REJECTED"
                acted_by = str(stage_action.actor_user_id) if stage_action.actor_user_id else None
                acted_at = stage_action.created_at
                comment = stage_action.comment
            if current and stage.id == current.id and state == "PENDING":
                state = "CURRENT"
            allowed = stage.allowed_roles or []
            can_act = bool(
                actor
                and state == "CURRENT"
                and actor.role in allowed
            )
            output.append(
                {
                    "stage_id": stage.id,
                    "stage_code": stage.code,
                    "title": stage.title,
                    "stage_order": stage.stage_order,
                    "allowed_roles": allowed,
                    "state": state,
                    "acted_by": acted_by,
                    "acted_at": acted_at,
                    "comment": comment,
                    "can_act": can_act,
                }
            )

        return {
            "document_id": str(document.id),
            "document_status": document.status,
            "current_stage_code": current.code if current else None,
            "all_stages_completed": current is None,
            "ready_for_final_registration": document.status
            in (LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value)
            and not getattr(document, "blockchain_tx_hash", None),
            "stages": output,
        }

    def approve_current_stage(
        self,
        document: DigitalObject,
        actor: User,
        comment: str | None = None,
    ) -> dict:
        self.ensure_stage_definitions()
        if document.status != LifecycleStatus.UNDER_REVIEW.value:
            raise HTTPException(status_code=400, detail=f"Document is not under review: {document.status}")
        stage = self._current_stage(document.id)
        if not stage:
            raise HTTPException(status_code=400, detail="All approval stages are already completed")
        self._check_actor_can_act(actor, stage)

        self.db.add(
            ApprovalAction(
                document_id=document.id,
                stage_definition_id=stage.id,
                actor_user_id=actor.id,
                action=ACTION_APPROVE,
                comment=(comment or "").strip() or None,
                action_metadata={"stage_code": stage.code},
            )
        )
        step_label = "department_approved" if stage.code == STAGE_DEPARTMENT_REVIEW else "dean_approved"
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=actor.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "decision": "approved",
                "step": step_label,
                "automatic": False,
                "workflow": "two_stage_department_dean",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "stage_code": stage.code,
                "comment": (comment or "").strip() or None,
            },
        )
        self.db.flush()

        pipeline = PipelineService(self.db)
        if stage.code == STAGE_DEPARTMENT_REVIEW:
            pipeline.on_department_approved(document, actor)
        elif stage.code == STAGE_DEAN_REVIEW:
            pipeline.on_deanery_approved(document, actor)

        next_stage = self._current_stage(document.id)
        if next_stage is None:
            # Диплом не возвращается на кафедру: фиксируем согласование деканата и сразу автоматика 4→5.
            document.status = LifecycleStatus.DEAN_APPROVED.value
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)

            auto_ok = False
            try:
                auto_ok = DiplomaAutomationService(self.db).finalize_after_dean_if_ready(document, actor)
                self.db.refresh(document)
            except Exception:
                logger.exception(
                    "Post-dean automation failed for document %s — rollback текущей сессии (события dean APPROVAL уже в БД)",
                    document.id,
                )
                self.db.rollback()
                document = (
                    self.db.query(DigitalObject)
                    .filter(DigitalObject.id == document.id)
                    .first()
                )

            return {"status": document.status, "completed": True, "automation_completed": auto_ok}

        self.db.commit()
        self.db.refresh(document)
        return {"status": document.status, "completed": False, "next_stage_code": next_stage.code}

    def reject_current_stage(self, document: DigitalObject, actor: User, comment: str | None = None) -> dict:
        self.ensure_stage_definitions()
        if document.status != LifecycleStatus.UNDER_REVIEW.value:
            raise HTTPException(status_code=400, detail=f"Document is not under review: {document.status}")
        stage = self._current_stage(document.id)
        if not stage:
            raise HTTPException(status_code=400, detail="All approval stages are already completed")
        self._check_actor_can_act(actor, stage)

        self.db.add(
            ApprovalAction(
                document_id=document.id,
                stage_definition_id=stage.id,
                actor_user_id=actor.id,
                action=ACTION_REJECT,
                comment=(comment or "").strip() or None,
                action_metadata={"stage_code": stage.code},
            )
        )
        document.status = LifecycleStatus.REJECTED.value
        self.db.add(document)
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=actor.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={"decision": "rejected", "stage_code": stage.code, "comment": (comment or "").strip() or None},
        )
        self.db.commit()
        self.db.refresh(document)
        return {"status": document.status, "rejected_stage_code": stage.code}

    def list_pending_documents_for_stage(self, actor: User, stage_code: str) -> list[DigitalObject]:
        self.ensure_stage_definitions()
        stage = (
            self.db.query(ApprovalStageDefinition)
            .filter(ApprovalStageDefinition.code == stage_code, ApprovalStageDefinition.is_active == True)
            .first()
        )
        if not stage:
            raise HTTPException(status_code=404, detail=f"Unknown stage code: {stage_code}")
        self._check_actor_can_act(actor, stage)

        docs = (
            self.db.query(DigitalObject)
            .options(
                joinedload(DigitalObject.owner).joinedload(User.university),
                joinedload(DigitalObject.uploaded_by),
            )
            .filter(DigitalObject.status == LifecycleStatus.UNDER_REVIEW.value)
            .order_by(DigitalObject.created_at.desc())
            .all()
        )
        result: list[DigitalObject] = []
        for doc in docs:
            current = self._current_stage(doc.id)
            if current and current.code == stage_code:
                if not self.passes_university_filter(actor, doc):
                    continue
                result.append(doc)
        return result

    def list_pending_documents_visible_for_actor(self, actor: User) -> list[DigitalObject]:
        """Документы на текущем этапе, видимые согласующему (без admin — не согласующий)."""
        self.ensure_stage_definitions()
        docs = (
            self.db.query(DigitalObject)
            .options(
                joinedload(DigitalObject.owner).joinedload(User.university),
                joinedload(DigitalObject.uploaded_by),
            )
            .filter(DigitalObject.status == LifecycleStatus.UNDER_REVIEW.value)
            .order_by(DigitalObject.created_at.desc())
            .all()
        )
        result: list[DigitalObject] = []
        for doc in docs:
            stage = self._current_stage(doc.id)
            if not stage:
                continue
            if actor.role in (stage.allowed_roles or []):
                if not self.passes_university_filter(actor, doc):
                    continue
                result.append(doc)
        return result

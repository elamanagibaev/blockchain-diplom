from __future__ import annotations

from io import BytesIO
from typing import Literal, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session, joinedload

from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.models.verification_log import VerificationLog
from app.services.document_event_service import DocumentEventService
from app.utils.hashing import sha256_file

VerifyStatus = Literal["VALID", "INVALID", "NOT_FOUND"]


def _on_chain_authentic(obj: DigitalObject) -> bool:
    return (
        obj.status == LifecycleStatus.REGISTERED_ON_CHAIN.value
        and bool(obj.blockchain_tx_hash)
    )


class VerificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def verify_file_upload(
        self, upload: UploadFile, user: Optional[User]
    ) -> tuple[str, Optional[DigitalObject], VerifyStatus]:
        raw = upload.file.read()
        sha = sha256_file(BytesIO(raw))
        uid = user.id if user else None

        DocumentEventService(self.db).record(
            document_id=None,
            action=DocumentEventAction.VERIFY_REQUEST.value,
            user_id=uid,
            metadata={"method": "file_upload", "sha256_hash": sha},
        )

        obj = (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner))
            .filter(DigitalObject.sha256_hash == sha)
            .first()
        )

        self.db.add(
            VerificationLog(
                digital_object_id=obj.id if obj else None,
                requested_by_id=uid,
                sha256_hash=sha,
                is_verified=bool(obj and _on_chain_authentic(obj)),
                notes=None,
            )
        )

        if not obj:
            DocumentEventService(self.db).record(
                document_id=None,
                action=DocumentEventAction.VERIFY_FAILED.value,
                user_id=uid,
                metadata={"method": "file_upload", "reason": "not_found", "sha256_hash": sha},
            )
            self.db.commit()
            return sha, None, "NOT_FOUND"

        if not _on_chain_authentic(obj):
            DocumentEventService(self.db).record(
                document_id=obj.id,
                action=DocumentEventAction.VERIFY_FAILED.value,
                user_id=uid,
                metadata={
                    "method": "file_upload",
                    "reason": "not_registered_on_chain",
                    "status": obj.status,
                    "sha256_hash": sha,
                },
            )
            self.db.commit()
            return sha, obj, "INVALID"

        DocumentEventService(self.db).record(
            document_id=obj.id,
            action=DocumentEventAction.VERIFY_SUCCESS.value,
            user_id=uid,
            metadata={"method": "file_upload", "sha256_hash": sha},
        )
        self.db.commit()
        return sha, obj, "VALID"

    def verify_by_hash_public(
        self, sha: str, requested_by_id: Optional[UUID] = None, method: str = "hash_lookup"
    ) -> tuple[Optional[DigitalObject], VerifyStatus]:
        DocumentEventService(self.db).record(
            document_id=None,
            action=DocumentEventAction.VERIFY_REQUEST.value,
            user_id=requested_by_id,
            metadata={"method": method, "sha256_hash": sha},
        )

        obj = (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner))
            .filter(DigitalObject.sha256_hash == sha)
            .first()
        )

        self.db.add(
            VerificationLog(
                digital_object_id=obj.id if obj else None,
                requested_by_id=requested_by_id,
                sha256_hash=sha,
                is_verified=bool(obj and _on_chain_authentic(obj)),
                notes=None,
            )
        )

        if not obj:
            DocumentEventService(self.db).record(
                document_id=None,
                action=DocumentEventAction.VERIFY_FAILED.value,
                user_id=requested_by_id,
                metadata={"method": method, "reason": "not_found", "sha256_hash": sha},
            )
            self.db.commit()
            return None, "NOT_FOUND"

        if not _on_chain_authentic(obj):
            DocumentEventService(self.db).record(
                document_id=obj.id,
                action=DocumentEventAction.VERIFY_FAILED.value,
                user_id=requested_by_id,
                metadata={
                    "method": method,
                    "reason": "not_registered_on_chain",
                    "status": obj.status,
                    "sha256_hash": sha,
                },
            )
            self.db.commit()
            return obj, "INVALID"

        DocumentEventService(self.db).record(
            document_id=obj.id,
            action=DocumentEventAction.VERIFY_SUCCESS.value,
            user_id=requested_by_id,
            metadata={"method": method, "sha256_hash": sha},
        )
        self.db.commit()
        return obj, "VALID"

    def verify_by_hash(self, sha: str) -> Optional[DigitalObject]:
        return self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()

import mimetypes
import re
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.action_history import ActionHistory
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.storage.base import StorageBackend
from app.storage.local_storage import LocalStorageBackend
from app.storage.minio_storage import MinioStorageBackend
from app.utils.hashing import sha256_file
from app.models.verification_log import VerificationLog

settings = get_settings()

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB (demo safety)
ALLOWED_MIME_PREFIXES = ("application/pdf", "image/", "text/")


def _infer_document_type(mime: str, filename: str) -> str:
    """Infer document type for display."""
    if "pdf" in mime or filename.lower().endswith(".pdf"):
        return "document"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("text/"):
        return "text"
    return "file"


def _safe_filename(name: str) -> str:
    # Avoid path traversal and weird characters; keep it readable.
    name = name.replace("\\", "_").replace("/", "_")
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", name)[:200] or "file"


def get_storage_backend() -> StorageBackend:
    if settings.FILE_STORAGE_BACKEND == "minio":
        return MinioStorageBackend()
    return LocalStorageBackend()


class FileService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.storage = get_storage_backend()

    def _validate_mime(self, mime: str) -> None:
        if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed: {mime}",
            )

    def register_file(self, user: User, file: UploadFile, description: str | None) -> DigitalObject:
        raw = file.file.read()
        if len(raw) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        filename = _safe_filename(file.filename or "file")
        mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        self._validate_mime(mime)

        sha = sha256_file(BytesIO(raw))

        # Optional business rule: prevent duplicates by hash for same owner
        existing = (
            self.db.query(DigitalObject)
            .filter(DigitalObject.owner_id == user.id, DigitalObject.sha256_hash == sha)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="This file hash is already registered by you")

        storage_key = self.storage.save(BytesIO(raw), filename)

        doc_type = _infer_document_type(mime, filename)
        title = description or filename

        obj = DigitalObject(
            owner_id=user.id,
            file_name=filename,
            title=title,
            mime_type=mime,
            size_bytes=len(raw),
            storage_key=storage_key,
            sha256_hash=sha,
            description=description,
            document_type=doc_type,
            owner_wallet_address=user.wallet_address,
            visibility="public",
            status="REGISTERED",
        )
        self.db.add(obj)
        self.db.flush()

        self.db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="REGISTER",
                performed_by_id=user.id,
                details="Initial registration (off-chain)",
            )
        )
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_objects(self, user: User) -> list[DigitalObject]:
        q = self.db.query(DigitalObject)
        if user.role != "admin":
            q = q.filter(DigitalObject.owner_id == user.id)
        return q.order_by(DigitalObject.created_at.desc()).all()

    def list_objects_global(
        self, q_search: str | None = None, status_filter: str | None = None
    ) -> list[DigitalObject]:
        """List all documents for global patent registry."""
        query = self.db.query(DigitalObject).options(joinedload(DigitalObject.owner))
        if q_search:
            ql = q_search.lower()
            query = query.filter(
                or_(
                    DigitalObject.file_name.ilike(f"%{ql}%"),
                    DigitalObject.sha256_hash.ilike(f"%{ql}%"),
                    DigitalObject.title.ilike(f"%{ql}%"),
                )
            )
        if status_filter:
            query = query.filter(DigitalObject.status == status_filter)
        return query.order_by(DigitalObject.created_at.desc()).all()

    def get_object(self, user: User, obj_id, require_owner: bool = False) -> DigitalObject:
        """Get object by id. If require_owner=False, any authenticated user can view (for global registry)."""
        obj = self.db.query(DigitalObject).filter(DigitalObject.id == obj_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail="Object not found")
        if require_owner and user.role != "admin" and obj.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if user.role != "admin" and obj.owner_id != user.id and obj.visibility != "public":
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return obj

    def get_history(self, user: User, obj_id) -> list[ActionHistory]:
        obj = self.get_object(user, obj_id, require_owner=False)
        return (
            self.db.query(ActionHistory)
            .filter(ActionHistory.digital_object_id == obj.id)
            .order_by(ActionHistory.performed_at.asc())
            .all()
        )

    def metrics(self, user: User) -> dict[str, int]:
        # aggregated counts for dashboard
        total_q = self.db.query(DigitalObject)
        if user.role != "admin":
            total_q = total_q.filter(DigitalObject.owner_id == user.id)
        total = total_q.count()

        on_chain = total_q.filter(DigitalObject.blockchain_tx_hash != None).count()

        verified_q = self.db.query(VerificationLog).filter(VerificationLog.is_verified == True)
        invalid_q = self.db.query(VerificationLog).filter(VerificationLog.is_verified == False)
        if user.role != "admin":
            verified_q = verified_q.join(DigitalObject).filter(DigitalObject.owner_id == user.id)
            invalid_q = invalid_q.join(DigitalObject).filter(DigitalObject.owner_id == user.id)
        verified = verified_q.count()
        invalid = invalid_q.count()

        return {"total": total, "on_chain": on_chain, "verified": verified, "invalid": invalid}

    def get_download_url(self, user: User, obj_id: UUID) -> str:
        obj = self.get_object(user, obj_id, require_owner=True)  # only owner can download
        return self.storage.get_url(obj.storage_key)

    def get_recent_activity(self, user: User, limit: int = 10) -> list[dict]:
        """Return recent actions across user's documents for dashboard."""
        q = self.db.query(ActionHistory).join(DigitalObject)
        if user.role != "admin":
            q = q.filter(DigitalObject.owner_id == user.id)
        actions = (
            q.order_by(ActionHistory.performed_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": a.id,
                "action_type": a.action_type,
                "performed_at": a.performed_at,
                "file_name": a.digital_object.file_name,
                "object_id": a.digital_object_id,
                "details": a.details,
            }
            for a in actions
        ]


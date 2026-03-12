import mimetypes
import os
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
from app.models.blockchain_event import BlockchainEvent
from app.services.audit_service import AuditService

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


def get_storage_backend(backend: str = "auto") -> StorageBackend:
    """backend: 'auto' (from config), 'local', or 'minio'."""
    if backend == "minio":
        return MinioStorageBackend()
    if backend == "local" or (backend == "auto" and settings.FILE_STORAGE_BACKEND != "minio"):
        return LocalStorageBackend()
    return MinioStorageBackend()


def _storage_for_obj(obj: DigitalObject) -> StorageBackend:
    """Return the storage backend where this object's file lives."""
    backend = getattr(obj, "storage_backend", None) or "local"
    return get_storage_backend(backend)


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

        # Global uniqueness: file hash must be unique across all users
        existing = self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Документ с таким хэшем уже зарегистрирован в системе. Один файл не может принадлежать разным пользователям.",
            )

        # Всегда сохраняем в локальное хранилище при загрузке. В MinIO попадут только
        # файлы, прошедшие регистрацию в блокчейне (при approve админом).
        local_storage = LocalStorageBackend()
        storage_key = local_storage.save(BytesIO(raw), filename)

        doc_type = _infer_document_type(mime, filename)
        title = description or filename

        obj = DigitalObject(
            owner_id=user.id,
            file_name=filename,
            title=title,
            mime_type=mime,
            size_bytes=len(raw),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description=description,
            document_type=doc_type,
            owner_wallet_address=user.wallet_address,
            visibility="public",
            status="UPLOADED",
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
        AuditService(self.db).log_document_upload(user, obj.id, sha)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_objects(self, user: User) -> list[DigitalObject]:
        q = self.db.query(DigitalObject)
        if user.role != "admin":
            q = q.filter(DigitalObject.owner_id == user.id)
        return q.order_by(DigitalObject.created_at.desc()).all()

    def list_objects_global(
        self,
        q_search: str | None = None,
        status_filter: str | None = None,
        owner_wallet: str | None = None,
        tx_hash: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> list[DigitalObject]:
        """List all documents for global patent registry with search and filters."""
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
        if owner_wallet and owner_wallet.strip():
            w = owner_wallet.strip()
            query = query.join(User, DigitalObject.owner_id == User.id).filter(
                or_(
                    DigitalObject.owner_wallet_address.ilike(f"%{w}%"),
                    User.wallet_address.ilike(f"%{w}%"),
                )
            )
        if tx_hash and tx_hash.strip():
            query = query.filter(DigitalObject.blockchain_tx_hash.ilike(f"%{tx_hash.strip()}%"))

        order_col = DigitalObject.created_at
        if sort_by == "blockchain_registered_at":
            order_col = DigitalObject.blockchain_registered_at
        elif sort_by == "file_name":
            order_col = DigitalObject.file_name
        elif sort_by == "status":
            order_col = DigitalObject.status
        if sort_order == "asc":
            query = query.order_by(order_col.asc().nullslast())
        else:
            query = query.order_by(order_col.desc().nullslast())
        return query.all()

    def submit_for_registration(self, user: User, obj_id: UUID) -> DigitalObject:
        """User submits document for admin approval to register on blockchain."""
        obj = self.get_object(user, obj_id, require_owner=True)
        if obj.blockchain_tx_hash:
            raise HTTPException(status_code=400, detail="Документ уже зарегистрирован в блокчейне")
        if obj.status not in ("UPLOADED", "REGISTERED", "REJECTED"):
            raise HTTPException(
                status_code=400,
                detail="Можно подать заявку только для загруженных или отклонённых документов",
            )
        obj.status = "PENDING_APPROVAL"
        self.db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="SUBMIT_FOR_REGISTRATION",
                performed_by_id=user.id,
                details="Заявка на регистрацию в блокчейне",
            )
        )
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_pending_registrations(self) -> list[DigitalObject]:
        """List documents with PENDING_APPROVAL for admin."""
        return (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner))
            .filter(DigitalObject.status == "PENDING_APPROVAL")
            .order_by(DigitalObject.created_at.desc())
            .all()
        )

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
        return _storage_for_obj(obj).get_url(obj.storage_key)

    def get_download_stream(self, user: User, obj_id: UUID):
        """Yield (chunk_generator, filename, mime_type) for streaming download."""
        obj = self.get_object(user, obj_id, require_owner=True)
        storage = _storage_for_obj(obj)
        return storage.get_stream(obj.storage_key), obj.file_name, obj.mime_type

    def migrate_file_to_minio(self, obj: DigitalObject) -> None:
        """
        После успешной регистрации в блокчейне копирует файл из local в MinIO.
        Вызывается из admin approve. MinIO должен быть сконфигурирован.
        """
        if getattr(obj, "storage_backend", None) == "minio":
            return  # уже в MinIO
        if settings.FILE_STORAGE_BACKEND != "minio":
            return  # MinIO не используется
        local = LocalStorageBackend()
        path = os.path.join(local.base_path, obj.storage_key)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Local file not found: {path}")
        minio_backend = MinioStorageBackend()
        with open(path, "rb") as f:
            minio_backend.put_with_key(obj.storage_key, f)
        obj.storage_backend = "minio"
        self.db.add(obj)
        try:
            os.remove(path)
        except OSError:
            pass  # не критично, файл уже в MinIO

    def transfer_document(
        self, user: User, obj_id: UUID, to_wallet_address: str
    ) -> DigitalObject:
        """Передать документ другому пользователю по wallet address."""
        obj = self.get_object(user, obj_id, require_owner=True)
        if not obj:
            raise HTTPException(status_code=404, detail="Object not found")

        to_wallet = to_wallet_address.strip()
        if not to_wallet.startswith("0x") or len(to_wallet) != 42:
            raise HTTPException(status_code=400, detail="Некорректный wallet address")

        new_owner = self.db.query(User).filter(User.wallet_address == to_wallet).first()
        if not new_owner:
            raise HTTPException(
                status_code=404,
                detail="Пользователь с таким wallet address не найден в системе",
            )
        if new_owner.id == user.id:
            raise HTTPException(status_code=400, detail="Нельзя передать документ самому себе")

        from_wallet = obj.owner_wallet_address or (obj.owner.wallet_address if obj.owner else None)
        obj.owner_id = new_owner.id
        obj.owner_wallet_address = to_wallet
        obj.status = "TRANSFERRED"

        tx_hash: str | None = None
        if obj.blockchain_object_id:
            try:
                from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError
                client = BlockchainClient()
                tx_hash = client.transfer_ownership(str(obj.id), to_wallet)
            except BlockchainNotConfiguredError:
                pass
            except Exception:
                self.db.rollback()
                raise HTTPException(status_code=500, detail="Ошибка обновления ownership в блокчейне")

        if tx_hash:
            self.db.add(
                BlockchainEvent(
                    action_type="TRANSFER",
                    document_id=obj.id,
                    tx_hash=tx_hash,
                    from_wallet=from_wallet,
                    to_wallet=to_wallet,
                    initiator_user_id=user.id,
                )
            )

        self.db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="TRANSFER",
                performed_by_id=user.id,
                details=f"Transferred from {from_wallet} to {to_wallet}",
            )
        )
        AuditService(self.db).log_transfer(user, obj_id, from_wallet or "", to_wallet, new_owner.id)
        self.db.commit()
        self.db.refresh(obj)
        return obj

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


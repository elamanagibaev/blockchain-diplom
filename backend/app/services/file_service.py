import logging
import mimetypes
import os
import re
from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from web3 import Web3

from app.core.config import get_settings
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.storage.base import StorageBackend
from app.storage.local_storage import LocalStorageBackend
from app.storage.minio_storage import MinioStorageBackend
from app.utils.hashing import sha256_file
from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.models.verification_log import VerificationLog
from app.models.blockchain_event import BlockchainEvent
from app.services.document_event_service import DocumentEventService
from app.services.approval_workflow_service import ApprovalWorkflowService
from app.services.pipeline_service import PipelineService

settings = get_settings()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB (demo safety)
ALLOWED_MIME_PREFIXES = ("application/pdf", "image/", "text/")
ALLOWED_MIME_EXACT = frozenset(
    {
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)


def _infer_document_type(mime: str, filename: str) -> str:
    """Infer document type for display."""
    fn = filename.lower()
    if "pdf" in mime or fn.endswith(".pdf"):
        return "document"
    if mime in ALLOWED_MIME_EXACT or fn.endswith(".doc") or fn.endswith(".docx"):
        return "document"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("text/"):
        return "text"
    return "file"


def _normalize_mime_for_upload(mime: str, filename: str) -> str:
    """Браузеры часто шлют application/octet-stream для Office-файлов."""
    fn = filename.lower()
    if mime == "application/octet-stream":
        if fn.endswith(".docx"):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if fn.endswith(".doc"):
            return "application/msword"
    return mime


def normalize_student_wallet(addr: str) -> str:
    """EVM-адрес для выпускника (on-chain owner); обязателен при загрузке диплома."""
    raw = (addr or "").strip()
    if len(raw) != 42 or not raw.startswith("0x"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите корректный student_wallet (0x и 40 hex-символов)",
        )
    try:
        return Web3.to_checksum_address(raw)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Некорректный формат student_wallet",
        )


def _safe_filename(name: str) -> str:
    """Sanitize uploaded filename: allow Cyrillic and Latin letters, block path/control chars."""
    name = (name or "").strip() or "file"
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(r'[\x00-\x1f<>:"|?*]', "_", name)
    if name in (".", ".."):
        name = "file"
    return name[:255] or "file"


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

    @staticmethod
    def _is_under_review_status(status: str | None) -> bool:
        if not status:
            return False
        if status == LifecycleStatus.UNDER_REVIEW.value:
            return True
        # legacy rows
        return status == "PENDING_APPROVAL"

    def _under_review_reader(self, user: User, obj: DigitalObject) -> bool:
        """department / dean / registrar may follow a document on review (read metadata / file / events)."""
        if not self._is_under_review_status(obj.status):
            return False
        if user.role not in ("department", "dean", "registrar"):
            return False
        if user.role == "department":
            return obj.owner_id == user.id or getattr(obj, "uploaded_by_id", None) == user.id
        return True

    def _passes_visibility_or_reviewer(self, user: User, obj: DigitalObject) -> bool:
        if user.role == "admin":
            return True
        if obj.owner_id == user.id:
            return True
        if getattr(obj, "uploaded_by_id", None) == user.id:
            return True
        if getattr(obj, "visibility", None) == "public":
            return True
        return self._under_review_reader(user, obj)

    def assert_can_read_document_file(self, user: User, obj: DigitalObject) -> None:
        """Who may download or open the binary (incl. dean/registrar while UNDER_REVIEW)."""
        if user.role == "admin" or obj.owner_id == user.id:
            return
        if getattr(obj, "uploaded_by_id", None) == user.id:
            return
        if self._under_review_reader(user, obj):
            return
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    def _validate_mime(self, mime: str) -> None:
        if mime in ALLOWED_MIME_EXACT:
            return
        if not any(mime.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed: {mime}",
            )

    def register_file(self, user: User, file: UploadFile, description: str, student_wallet: str) -> DigitalObject:
        # Дублируем проверку маршрута: загрузку выполняет только кафедра (упрощённый workflow).
        if user.role != "department":
            raise HTTPException(
                status_code=403,
                detail="Загрузка документа доступна только роли department (кафедра).",
            )
        desc = (description or "").strip()
        if not desc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Введите название документа",
            )
        sw = normalize_student_wallet(student_wallet)

        raw = file.file.read()
        if len(raw) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        filename = _safe_filename(file.filename or "file")
        mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        mime = _normalize_mime_for_upload(mime, filename)
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
        # файлы после финальной on-chain регистрации (администратор).
        local_storage = LocalStorageBackend()
        storage_key = local_storage.save(BytesIO(raw), filename)

        doc_type = _infer_document_type(mime, filename)
        title = desc

        obj = DigitalObject(
            owner_id=user.id,
            uploaded_by_id=user.id,
            file_name=filename,
            title=title,
            mime_type=mime,
            size_bytes=len(raw),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description=desc,
            document_type=doc_type,
            owner_wallet_address=user.wallet_address,
            visibility="public",
            student_wallet_address=sw,
            status=LifecycleStatus.FROZEN.value,
        )
        self.db.add(obj)
        self.db.flush()
        ev = DocumentEventService(self.db)
        ev.record(
            document_id=obj.id,
            user_id=user.id,
            action=DocumentEventAction.UPLOAD.value,
            metadata={
                "file_name": filename,
                "mime_type": mime,
                "size_bytes": len(raw),
                "uploaded_by_id": str(user.id),
                "uploaded_by_wallet": user.wallet_address,
                "student_wallet": sw,
            },
        )
        ev.record(
            document_id=obj.id,
            user_id=user.id,
            action=DocumentEventAction.FREEZE.value,
            metadata={"sha256_hash": sha},
        )
        PipelineService(self.db).on_upload_fixed(obj, user.id)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_objects(self, user: User) -> list[DigitalObject]:
        q = self.db.query(DigitalObject).options(
            joinedload(DigitalObject.owner),
            joinedload(DigitalObject.uploaded_by),
        )
        if user.role == "department":
            q = q.filter(DigitalObject.uploaded_by_id == user.id)
        elif user.role != "admin":
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
        query = self.db.query(DigitalObject).options(
            joinedload(DigitalObject.owner),
            joinedload(DigitalObject.uploaded_by),
        )
        # До отправки на рассмотрение документ в FROZEN / UPLOADED и не виден в общем реестре
        query = query.filter(
            DigitalObject.status.notin_(
                [LifecycleStatus.FROZEN.value, LifecycleStatus.UPLOADED.value]
            )
        )
        if q_search:
            ql = q_search.lower()
            query = query.filter(
                or_(
                    DigitalObject.file_name.ilike(f"%{ql}%"),
                    DigitalObject.sha256_hash.ilike(f"%{ql}%"),
                    DigitalObject.title.ilike(f"%{ql}%"),
                    DigitalObject.description.ilike(f"%{ql}%"),
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
        """Подача на согласование деканату (упрощённая модель: загрузку выполняет кафедра)."""
        if user.role != "department":
            raise HTTPException(
                status_code=403,
                detail="Подачу на согласование может инициировать только роль department (кафедра).",
            )
        obj = self.get_object(user, obj_id, require_owner=True)
        if obj.blockchain_tx_hash:
            raise HTTPException(status_code=400, detail="Документ уже зарегистрирован в блокчейне")
        if not (getattr(obj, "student_wallet_address", None) or "").strip():
            raise HTTPException(
                status_code=400,
                detail="Укажите кошелёк выпускника (student_wallet) при загрузке диплома перед подачей на согласование",
            )
        allowed = (
            LifecycleStatus.FROZEN.value,
            LifecycleStatus.UPLOADED.value,
            LifecycleStatus.REJECTED.value,
        )
        if obj.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail="Можно подать заявку только для документов в статусе заморозки или после отклонения",
            )
        obj.status = LifecycleStatus.UNDER_REVIEW.value
        workflow = ApprovalWorkflowService(self.db)
        workflow.ensure_stage_definitions()
        workflow.reset_document_actions(obj.id)
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=user.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={"step": "submit_for_review", "workflow": "single_stage_dean"},
        )
        PipelineService(self.db).on_submit_for_review(obj, user.id)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_pending_registrations(self) -> list[DigitalObject]:
        """Документы после деканата без on-chain (автоматика не сработала)."""
        return (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner), joinedload(DigitalObject.uploaded_by))
            .filter(
                DigitalObject.status.in_(
                    [LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value]
                )
            )
            .order_by(DigitalObject.created_at.desc())
            .all()
        )

    def get_object(self, user: User, obj_id, require_owner: bool = False) -> DigitalObject:
        """Get object by id. If require_owner=False, any authenticated user can view (for global registry)."""
        obj = (
            self.db.query(DigitalObject)
            .options(joinedload(DigitalObject.owner), joinedload(DigitalObject.uploaded_by))
            .filter(DigitalObject.id == obj_id)
            .first()
        )
        if not obj:
            raise HTTPException(status_code=404, detail="Object not found")
        if require_owner and user.role != "admin" and obj.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        if not require_owner and not self._passes_visibility_or_reviewer(user, obj):
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return obj

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
        obj = self.get_object(user, obj_id, require_owner=False)
        self.assert_can_read_document_file(user, obj)
        return _storage_for_obj(obj).get_url(obj.storage_key)

    def get_download_stream(self, user: User, obj_id: UUID):
        """Yield (chunk_generator, filename, mime_type) for streaming download."""
        obj = self.get_object(user, obj_id, require_owner=False)
        self.assert_can_read_document_file(user, obj)
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
        """Передать документ другому пользователю по адресу кошелька (сначала транзакция в блокчейне)."""
        obj = self.get_object(user, obj_id, require_owner=True)

        if not obj.blockchain_tx_hash:
            raise HTTPException(
                status_code=400,
                detail="Передача возможна только после регистрации документа в блокчейне",
            )

        raw = (to_wallet_address or "").strip()
        if len(raw) != 42 or not raw.startswith("0x"):
            raise HTTPException(
                status_code=400,
                detail="Некорректный адрес кошелька (ожидается 0x и 40 шестнадцатеричных символов)",
            )
        try:
            to_wallet = Web3.to_checksum_address(raw)
        except Exception:
            raise HTTPException(status_code=400, detail="Некорректный формат адреса кошелька")

        new_owner = (
            self.db.query(User)
            .filter(func.lower(User.wallet_address) == func.lower(to_wallet))
            .first()
        )
        if not new_owner:
            raise HTTPException(
                status_code=404,
                detail="Пользователь с таким адресом кошелька не найден в системе",
            )
        if new_owner.id == user.id:
            raise HTTPException(status_code=400, detail="Нельзя передать документ самому себе")

        from_wallet = obj.owner_wallet_address or (obj.owner.wallet_address if obj.owner else None)
        chain_object_id = str(obj.blockchain_object_id or obj.id)

        from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError

        try:
            client = BlockchainClient()
            tx_hash = client.transfer_ownership(chain_object_id, to_wallet)
        except BlockchainNotConfiguredError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Блокчейн не настроен, передача невозможна: {e}",
            )
        except Exception as e:
            logger.exception("Blockchain transfer_ownership failed for object %s", obj_id)
            raise HTTPException(
                status_code=500,
                detail=f"Ошибка передачи в блокчейне: {type(e).__name__}: {str(e)}",
            )

        obj.owner_id = new_owner.id
        obj.owner_wallet_address = to_wallet
        obj.status = LifecycleStatus.TRANSFERRED.value

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
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=user.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "kind": "ownership_transfer",
                "tx_hash": tx_hash,
                "from_wallet": from_wallet,
                "to_wallet": to_wallet,
            },
        )

        self.db.commit()
        self.db.refresh(obj)
        return obj

    def assign_student_wallet(self, actor: User, obj_id: UUID, wallet_address: str) -> DigitalObject:
        """Этап 5: привязка кошелька выпускника (владелец или администратор)."""
        raw = (wallet_address or "").strip()
        student_wallet = normalize_student_wallet(raw)
        obj = self.get_object(actor, obj_id)
        if actor.role != "admin" and obj.owner_id != actor.id:
            raise HTTPException(status_code=403, detail="Только владелец или администратор")
        if obj.status == LifecycleStatus.ASSIGNED_TO_OWNER.value:
            raise HTTPException(status_code=400, detail="Документ уже закреплён за выпускником")
        if obj.status not in (
            LifecycleStatus.REGISTERED_ON_CHAIN.value,
            LifecycleStatus.REGISTERED.value,
        ):
            raise HTTPException(
                status_code=400,
                detail="Привязка доступна после регистрации в реестре",
            )
        matched_owner = (
            self.db.query(User)
            .filter(func.lower(User.wallet_address) == func.lower(student_wallet))
            .first()
        )
        previous_owner_id = obj.owner_id
        previous_owner_wallet = obj.owner_wallet_address or (obj.owner.wallet_address if obj.owner else None)
        PipelineService(self.db).on_assign_student(obj, student_wallet, actor.id)
        obj.owner_wallet_address = student_wallet
        if matched_owner:
            obj.owner_id = matched_owner.id
        obj.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=actor.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "step": "owner_assigned",
                "automatic": False,
                "assigned_by": "manual",
                "source": "student_wallet_from_upload",
                "previous_owner_id": str(previous_owner_id) if previous_owner_id else None,
                "previous_owner_wallet": previous_owner_wallet,
                "new_owner_id": str(obj.owner_id) if obj.owner_id else None,
                "new_owner_wallet": student_wallet,
                "owner_user_found": bool(matched_owner),
            },
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj


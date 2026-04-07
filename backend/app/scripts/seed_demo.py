"""
Демо-данные для защиты: пользователи по ролям и документы в разных стадиях жизненного цикла.

Запуск из каталога backend:
    python -m app.scripts.seed_demo

Идемпотентность: повторный запуск не дублирует пользователей и файлы с тем же именем у владельца.
"""
from __future__ import annotations

import hashlib
import os
import sys
from io import BytesIO
from uuid import UUID

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import HTTPException

from app.constants.document_events import DocumentEventAction
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.services.approval_workflow_service import ApprovalWorkflowService
from app.services.document_event_service import DocumentEventService
from app.services.file_service import FileService
from app.storage.local_storage import LocalStorageBackend
from app.utils.wallet import generate_evm_wallet, encrypt_private_key

settings = get_settings()

# Основной набор для демонстрации (роли согласованы с approval-workflow)
DEMO_USERS = [
    ("demo.owner@blockproof.local", "Demo2026!", "user"),  # загрузчик / владелец документа
    ("demo.dept@blockproof.local", "Demo2026!", "department"),  # согласующий 1 — кафедра
    ("demo.dean@blockproof.local", "Demo2026!", "dean"),  # согласующий 2 — деканат
    ("admin@example.com", "admin", "admin"),
]

# Совместимость со старыми инструкциями
LEGACY_USERS = [
    ("patentee@ip.ru", "patentee123", "user"),
    ("inventor@example.com", "inventor123", "user"),
]

# Старый набор PDF у patentee (совместимость со старыми инструкциями)
LEGACY_PATENTEE_FILES = [
    ("Заявка_на_изобретение.pdf", "application/pdf"),
    ("Описание_изобретения.pdf", "application/pdf"),
    ("Формула_изобретения.pdf", "application/pdf"),
    ("Реферат.pdf", "application/pdf"),
    ("Диаграммные_материалы.pdf", "application/pdf"),
]

# Имена файлов — латиница, стабильные для чеклиста
DOC_FROZEN = "DEMO_01_FROZEN.pdf"
DOC_STAGE1 = "DEMO_02_ETAP1_kafedra.pdf"
DOC_STAGE2 = "DEMO_03_ETAP2_dekan.pdf"
DOC_APPROVED = "DEMO_04_APPROVED.pdf"


def _pdf_bytes(seed: int, label: str) -> bytes:
    base = (
        b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
    )
    return base + f"\n<!-- seed={seed} {label} -->\n".encode("utf-8") + b"\n" * (40 + seed)


def _ensure_user(db, email: str, password: str, role: str) -> User | None:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return None
    address, pk_hex = generate_evm_wallet()
    encrypted = encrypt_private_key(pk_hex, settings.SECRET_KEY)
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=role,
        wallet_address=address,
        wallet_encrypted_private_key=encrypted,
    )
    db.add(user)
    db.flush()
    print(f"  Создан: {email} / {password} (роль {role})")
    return user


def create_users(db) -> None:
    for email, password, role in DEMO_USERS + LEGACY_USERS:
        _ensure_user(db, email, password, role)


def _get_owner(db) -> User | None:
    return db.query(User).filter(User.email == "demo.owner@blockproof.local").first()


def _get_dept(db) -> User | None:
    return db.query(User).filter(User.email == "demo.dept@blockproof.local").first()


def _get_dean(db) -> User | None:
    return db.query(User).filter(User.email == "demo.dean@blockproof.local").first()


def create_frozen_document(
    db,
    owner: User,
    filename: str,
    description: str,
    content_seed: int,
) -> DigitalObject | None:
    existing = (
        db.query(DigitalObject)
        .filter(DigitalObject.owner_id == owner.id, DigitalObject.file_name == filename)
        .first()
    )
    if existing:
        print(f"  Уже существует документ {filename} — сценарий не меняем")
        return None

    raw = _pdf_bytes(content_seed, filename)
    sha = hashlib.sha256(raw).hexdigest()
    dup = db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
    if dup:
        print(f"  Коллизия SHA-256 для {filename}, пропуск")
        return None

    storage = LocalStorageBackend()
    storage_key = storage.save(BytesIO(raw), filename)
    obj = DigitalObject(
        owner_id=owner.id,
        file_name=filename,
        title=description[:255],
        mime_type="application/pdf",
        size_bytes=len(raw),
        storage_key=storage_key,
        storage_backend="local",
        sha256_hash=sha,
        description=description,
        document_type="document",
        visibility="public",
        owner_wallet_address=owner.wallet_address,
        status="FROZEN",
        ai_check_status="skipped",
    )
    db.add(obj)
    db.flush()
    ev = DocumentEventService(db)
    ev.record(
        document_id=obj.id,
        user_id=owner.id,
        action=DocumentEventAction.UPLOAD.value,
        metadata={"file_name": filename, "mime_type": "application/pdf", "size_bytes": len(raw), "seed": "demo"},
    )
    ev.record(
        document_id=obj.id,
        user_id=owner.id,
        action=DocumentEventAction.FREEZE.value,
        metadata={"sha256_hash": sha},
    )
    db.commit()
    db.refresh(obj)
    print(f"  Создан документ {filename} (FROZEN), id={obj.id}")
    return obj


def _submit(db, owner: User, obj_id: UUID) -> None:
    fs = FileService(db)
    try:
        fs.submit_for_registration(owner, obj_id)
        print(f"  → подача на согласование: {obj_id}")
    except HTTPException as e:
        print(f"  Ошибка submit_for_registration: {e.detail}")


def _approve(db, doc: DigitalObject, actor: User, label: str) -> None:
    ws = ApprovalWorkflowService(db)
    try:
        ws.approve_current_stage(doc, actor, comment=None)
        print(f"  → {label}: этап подтверждён ({doc.id})")
    except HTTPException as e:
        print(f"  Ошибка approve ({label}): {e.detail}")


def create_legacy_patentee_frozen_docs(db) -> int:
    """Пять FROZEN-документов для patentee@ip.ru (как в ранних версиях seed)."""
    patentee = db.query(User).filter(User.email == "patentee@ip.ru").first()
    if not patentee:
        return 0
    storage = LocalStorageBackend()
    count = 0
    for i, (filename, mime) in enumerate(LEGACY_PATENTEE_FILES):
        existing = (
            db.query(DigitalObject)
            .filter(DigitalObject.owner_id == patentee.id, DigitalObject.file_name == filename)
            .first()
        )
        if existing:
            continue
        raw = _pdf_bytes(100 + i, f"legacy-{filename}")
        sha = hashlib.sha256(raw).hexdigest()
        storage_key = storage.save(BytesIO(raw), filename)
        obj = DigitalObject(
            owner_id=patentee.id,
            file_name=filename,
            title=filename,
            mime_type=mime,
            size_bytes=len(raw),
            storage_key=storage_key,
            storage_backend="local",
            sha256_hash=sha,
            description=f"Демо (legacy): {filename}",
            document_type="document",
            visibility="public",
            owner_wallet_address=patentee.wallet_address,
            status="FROZEN",
            ai_check_status="skipped",
        )
        db.add(obj)
        db.flush()
        ev = DocumentEventService(db)
        ev.record(
            document_id=obj.id,
            user_id=patentee.id,
            action=DocumentEventAction.UPLOAD.value,
            metadata={"legacy_seed": True, "file_name": filename},
        )
        ev.record(
            document_id=obj.id,
            user_id=patentee.id,
            action=DocumentEventAction.FREEZE.value,
            metadata={"sha256_hash": sha},
        )
        count += 1
        print(f"  [legacy] Создан {filename}")
    if count:
        db.commit()
    return count


def seed_scenario_documents(db, owner: User, dept: User, dean: User) -> None:
    """Создаёт четыре документа с разным состоянием workflow (идемпотентно по имени файла)."""

    # 1) Только FROZEN — для живой подачи на согласование
    o1 = create_frozen_document(
        db,
        owner,
        DOC_FROZEN,
        "Демо: документ для подачи на согласование (начните сценарий здесь)",
        1,
    )
    if o1 is None:
        pass

    # 2) UNDER_REVIEW, текущий этап — кафедра
    o2 = create_frozen_document(
        db,
        owner,
        DOC_STAGE1,
        "Демо: ожидает согласования на кафедре (этап 1)",
        2,
    )
    if o2:
        _submit(db, owner, o2.id)

    # 3) UNDER_REVIEW, текущий этап — деканат (после кафедры)
    o3 = create_frozen_document(
        db,
        owner,
        DOC_STAGE2,
        "Демо: ожидает согласования в деканате (этап 2)",
        3,
    )
    if o3:
        _submit(db, owner, o3.id)
        d3 = db.query(DigitalObject).filter(DigitalObject.id == o3.id).first()
        if d3 and d3.status == "UNDER_REVIEW":
            _approve(db, d3, dept, "кафедра")

    # 4) APPROVED — очередь финальной on-chain регистрации
    o4 = create_frozen_document(
        db,
        owner,
        DOC_APPROVED,
        "Демо: полное внутреннее согласование, очередь on-chain",
        4,
    )
    if o4:
        _submit(db, owner, o4.id)
        d4 = db.query(DigitalObject).filter(DigitalObject.id == o4.id).first()
        if d4 and d4.status == "UNDER_REVIEW":
            _approve(db, d4, dept, "кафедра")
            d4 = db.query(DigitalObject).filter(DigitalObject.id == o4.id).first()
        if d4 and d4.status == "UNDER_REVIEW":
            _approve(db, d4, dean, "деканат")


def run() -> None:
    print("Запуск seed_demo.py...")
    db = SessionLocal()
    try:
        print("Пользователи:")
        create_users(db)
        db.commit()

        owner = _get_owner(db)
        dept = _get_dept(db)
        dean = _get_dean(db)
        if not owner or not dept or not dean:
            print("Не найдены demo.owner / demo.dept / demo.dean — проверьте DEMO_USERS")
            return

        print("Документы (сценарии):")
        seed_scenario_documents(db, owner, dept, dean)

        print("Документы (legacy patentee@ip.ru):")
        n_legacy = create_legacy_patentee_frozen_docs(db)
        print(f"  Создано новых: {n_legacy}")

        print("\n=== Учётные записи для демо ===")
        print("  Владелец / загрузчик:  demo.owner@blockproof.local / Demo2026!")
        print("  Согласующий 1 (кафедра): demo.dept@blockproof.local / Demo2026!")
        print("  Согласующий 2 (деканат): demo.dean@blockproof.local / Demo2026!")
        print("  Администратор:          admin@example.com / admin")
        print("  (legacy) patentee@ip.ru / patentee123 — дополнительные FROZEN-файлы")
        print("\n=== Файлы у demo.owner (основной сценарий) ===")
        for fn in (DOC_FROZEN, DOC_STAGE1, DOC_STAGE2, DOC_APPROVED):
            doc = (
                db.query(DigitalObject)
                .filter(DigitalObject.owner_id == owner.id, DigitalObject.file_name == fn)
                .first()
            )
            if doc:
                print(f"  {fn}: status={doc.status} id={doc.id}")
        print("\nДокументация: docs/demo-checklist.md, docs/document-lifecycle.md, …")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

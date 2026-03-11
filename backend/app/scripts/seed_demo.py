"""
Скрипт для создания демо-данных к защите диплома.
Создаёт пользователей и медицинские документы для демонстрации платформы.
"""
import hashlib
import os
import sys

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from io import BytesIO

from app.db.session import SessionLocal
from app.models.user import User
from app.models.digital_object import DigitalObject
from app.models.action_history import ActionHistory
from app.core.security import get_password_hash
from app.storage.base import StorageBackend
from app.storage.local_storage import LocalStorageBackend


DEMO_FILES = [
    ("Результаты_анализа_крови.pdf", "application/pdf"),
    ("Медицинское_заключение.pdf", "application/pdf"),
    ("Выписка_из_стационара.pdf", "application/pdf"),
    ("Направление_на_МРТ.pdf", "application/pdf"),
    ("Диагностический_отчёт.pdf", "application/pdf"),
]


def create_users(db):
    users_data = [
        ("admin@example.com", "admin", "admin"),
        ("doctor@clinic.ru", "doctor123", "user"),
        ("patient@example.com", "patient123", "user"),
    ]
    created = []
    for email, password, role in users_data:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                role=role,
            )
            db.add(user)
            db.flush()
            created.append((email, password))
            print(f"  Создан пользователь: {email} / {password}")
    return created


def create_demo_documents(db, storage: StorageBackend):
    doctor = db.query(User).filter(User.email == "doctor@clinic.ru").first()
    if not doctor:
        print("  Пропуск документов: пользователь doctor@clinic.ru не найден")
        return 0

    count = 0
    for i, (filename, mime) in enumerate(DEMO_FILES):
        # Минимальный PDF-заголовок + уникальный контент для каждого файла
        base = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        content = base + f"\n<!-- Demo doc #{i}: {filename} -->\n".encode("utf-8") + b"\n" * 50
        sha = hashlib.sha256(content).hexdigest()

        existing = db.query(DigitalObject).filter(
            DigitalObject.owner_id == doctor.id,
            DigitalObject.file_name == filename,
        ).first()
        if existing:
            continue

        storage_key = storage.save(BytesIO(content), filename)
        obj = DigitalObject(
            owner_id=doctor.id,
            file_name=filename,
            mime_type=mime,
            size_bytes=len(content),
            storage_key=storage_key,
            sha256_hash=sha,
            description=f"Демо-документ: {filename}",
            status="REGISTERED",
        )
        db.add(obj)
        db.flush()
        db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="REGISTER",
                performed_by_id=doctor.id,
                details="Создан демо-скриптом seed_demo.py",
            )
        )
        count += 1
        print(f"  Создан документ: {filename}")

    return count


def run():
    print("Запуск seed_demo.py...")
    db = SessionLocal()
    try:
        print("Пользователи:")
        create_users(db)
        db.commit()

        print("Демо-документы:")
        storage = LocalStorageBackend()
        n = create_demo_documents(db, storage)
        db.commit()
        print(f"Создано документов: {n}")

        print("\nДемо-доступ:")
        print("  admin@example.com / admin")
        print("  doctor@clinic.ru / doctor123")
        print("  patient@example.com / patient123")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

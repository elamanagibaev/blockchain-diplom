"""
Скрипт для создания демо-данных к защите диплома.
Создаёт пользователей и патентные документы для демонстрации платформы.
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
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.storage.base import StorageBackend
from app.storage.local_storage import LocalStorageBackend
from app.utils.wallet import generate_evm_wallet, encrypt_private_key

settings = get_settings()


DEMO_FILES = [
    ("Заявка_на_изобретение.pdf", "application/pdf"),
    ("Описание_изобретения.pdf", "application/pdf"),
    ("Формула_изобретения.pdf", "application/pdf"),
    ("Реферат.pdf", "application/pdf"),
    ("Диаграммные_материалы.pdf", "application/pdf"),
]


def create_users(db):
    users_data = [
        ("admin@example.com", "admin", "admin"),
        ("patentee@ip.ru", "patentee123", "user"),
        ("inventor@example.com", "inventor123", "user"),
    ]
    created = []
    for email, password, role in users_data:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
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
            created.append((email, password))
            print(f"  Создан пользователь: {email} / {password}")
    return created


def create_demo_documents(db, storage: StorageBackend):
    patentee = db.query(User).filter(User.email == "patentee@ip.ru").first()
    if not patentee:
        print("  Пропуск документов: пользователь patentee@ip.ru не найден")
        return 0

    count = 0
    for i, (filename, mime) in enumerate(DEMO_FILES):
        # Минимальный PDF-заголовок + уникальный контент для каждого файла
        base = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        content = base + f"\n<!-- Demo doc #{i}: {filename} -->\n".encode("utf-8") + b"\n" * 50
        sha = hashlib.sha256(content).hexdigest()

        existing = db.query(DigitalObject).filter(
            DigitalObject.owner_id == patentee.id,
            DigitalObject.file_name == filename,
        ).first()
        if existing:
            continue

        storage_key = storage.save(BytesIO(content), filename)
        obj = DigitalObject(
            owner_id=patentee.id,
            file_name=filename,
            title=filename,
            mime_type=mime,
            size_bytes=len(content),
            storage_key=storage_key,
            sha256_hash=sha,
            description=f"Демо: {filename}",
            document_type="document",
            visibility="public",
            owner_wallet_address=patentee.wallet_address,
            status="REGISTERED",
        )
        db.add(obj)
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
        print("  patentee@ip.ru / patentee123")
        print("  inventor@example.com / inventor123")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

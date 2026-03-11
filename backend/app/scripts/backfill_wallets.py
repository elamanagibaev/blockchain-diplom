"""
Backfill wallets for existing users that don't have one.
Run after migration 0002: python -m app.scripts.backfill_wallets
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.utils.wallet import generate_evm_wallet, encrypt_private_key

settings = get_settings()


def run():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.wallet_address.is_(None)).all()
        for u in users:
            address, pk_hex = generate_evm_wallet()
            encrypted = encrypt_private_key(pk_hex, settings.SECRET_KEY)
            u.wallet_address = address
            u.wallet_encrypted_private_key = encrypted
            db.add(u)
            print(f"  Назначен wallet пользователю: {u.email}")
        db.commit()

        # Backfill owner_wallet_address on digital_objects
        objs = db.query(DigitalObject).filter(DigitalObject.owner_wallet_address.is_(None)).all()
        for o in objs:
            if o.owner and o.owner.wallet_address:
                o.owner_wallet_address = o.owner.wallet_address
                db.add(o)
        db.commit()
        print(f"Обработано пользователей: {len(users)}, документов: {len(objs)}")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()

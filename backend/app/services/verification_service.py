from io import BytesIO
from typing import Optional

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.action_history import ActionHistory
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.models.verification_log import VerificationLog
from app.utils.hashing import sha256_file


class VerificationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def verify_uploaded_file(self, user: Optional[User], file: UploadFile) -> tuple[str, Optional[DigitalObject]]:
        raw = file.file.read()
        sha = sha256_file(BytesIO(raw))

        obj = self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()
        is_verified = obj is not None

        self.db.add(
            VerificationLog(
                digital_object_id=obj.id if obj else None,
                requested_by_id=user.id if user else None,
                sha256_hash=sha,
                is_verified=is_verified,
                notes=None if is_verified else "Hash not found in registry",
            )
        )

        if obj:
            self.db.add(
                ActionHistory(
                    digital_object_id=obj.id,
                    action_type="VERIFY",
                    performed_by_id=user.id if user else None,
                    details="Verification request (off-chain)",
                )
            )

        self.db.commit()
        return sha, obj

    def verify_by_hash(self, sha: str) -> Optional[DigitalObject]:
        return self.db.query(DigitalObject).filter(DigitalObject.sha256_hash == sha).first()


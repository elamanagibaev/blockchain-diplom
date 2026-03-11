from app.db.session import Base  # noqa: F401

#Ensure model discovery for Alembic
from app.models.user import User  # noqa: F401
from app.models.digital_object import DigitalObject  # noqa: F401
from app.models.action_history import ActionHistory  # noqa: F401
from app.models.verification_log import VerificationLog  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
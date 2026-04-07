from app.db.session import Base  # noqa: F401

#Ensure model discovery for Alembic
from app.models.user import User  # noqa: F401
from app.models.digital_object import DigitalObject  # noqa: F401
from app.models.verification_log import VerificationLog  # noqa: F401
from app.models.blockchain_event import BlockchainEvent  # noqa: F401
from app.models.document_event import DocumentEvent  # noqa: F401
from app.models.approval_stage_definition import ApprovalStageDefinition  # noqa: F401
from app.models.approval_action import ApprovalAction  # noqa: F401
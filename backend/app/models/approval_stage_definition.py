from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base


class ApprovalStageDefinition(Base):
    __tablename__ = "approval_stage_definitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    stage_order = Column(Integer, nullable=False, unique=True, index=True)
    allowed_roles = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, nullable=False, default=True)

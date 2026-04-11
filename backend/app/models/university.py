from sqlalchemy import Boolean, Column, Integer, String

from app.db.session import Base


class University(Base):
    __tablename__ = "universities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    short_name = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()

class UserModel(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    google_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)

    # User status management
    is_active = Column(Boolean, default=True, nullable=False)

    # Auditing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<UserModel(email='{self.email}', is_active={self.is_active})>"

class TagModel(Base):
    __tablename__ = 'tags'

    id = Column(String, primary_key=True)
    category = Column(String, nullable=False)
    name_translations = Column(JSON, nullable=False) # e.g., {"en": "Pothole", "es": "Bache"}
    is_active = Column(Boolean, default=True, nullable=False)

class SubmissionModel(Base):
    __tablename__ = 'submissions'

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    device_timestamp = Column(DateTime, nullable=False)
    server_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    # status = Column(String, default="pending", nullable=False)

    items = relationship("SubmissionItemModel", backref="submission", cascade="all, delete-orphan")

class SubmissionItemModel(Base):
    __tablename__ = 'submission_items'

    id = Column(String, primary_key=True)
    submission_id = Column(String, ForeignKey('submissions.id'), nullable=False)
    tag_id = Column(String, ForeignKey('tags.id'), nullable=False)
    item_type = Column(String, nullable=False)
    content_payload = Column(JSON, nullable=False)

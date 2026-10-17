from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Integer, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from pgvector.sqlalchemy import Vector

class Base(DeclarativeBase): pass


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__='users'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
    email: Mapped[str]=mapped_column(String(255),unique=True,index=True)
    password_hash: Mapped[str]=mapped_column(String(255))
    name: Mapped[str]=mapped_column(String(150))
    role: Mapped[str]=mapped_column(String(50),default='operator')
    created_at: Mapped[datetime]=mapped_column(DateTime,default=_utc_now_naive)

class Transformation(Base):
    __tablename__='transformations'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
    user_id: Mapped[str]=mapped_column(ForeignKey('users.id'),index=True)
    title: Mapped[str]=mapped_column(String(500),default='New Transformation')
    summary: Mapped[str|None]=mapped_column(Text,nullable=True)
    status: Mapped[str]=mapped_column(String(50),default='draft',index=True)
    configuration: Mapped[dict]=mapped_column(JSON,default=dict)
    canonical_content: Mapped[dict|None]=mapped_column(JSON,nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=_utc_now_naive)

class UploadedFile(Base):
    __tablename__='uploaded_files'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
    transformation_id: Mapped[str]=mapped_column(ForeignKey('transformations.id'),index=True)
    filename: Mapped[str]=mapped_column(String(500))
    object_key: Mapped[str]=mapped_column(String(1000))
    content_type: Mapped[str]=mapped_column(String(200))
    extracted_text: Mapped[str|None]=mapped_column(Text,nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime,default=_utc_now_naive)

class DocumentChunk(Base):
    __tablename__='document_chunks'
    id: Mapped[str]=mapped_column(String(36),primary_key=True,default=lambda:str(uuid4()))
    source_id: Mapped[str]=mapped_column(ForeignKey('uploaded_files.id'),index=True)
    transformation_id: Mapped[str]=mapped_column(ForeignKey('transformations.id'),index=True)
    chunk_index: Mapped[int]=mapped_column(Integer)
    content: Mapped[str]=mapped_column(Text)
    embedding: Mapped[list[float]]=mapped_column(Vector(768).with_variant(JSON, 'sqlite'))
    created_at: Mapped[datetime]=mapped_column(DateTime,default=_utc_now_naive)
    __table_args__=(Index('ix_document_chunks_transformation_index','transformation_id','chunk_index'),)

class GeneratedOutput(Base):
    __tablename__ = 'generated_outputs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    transformation_id: Mapped[str] = mapped_column(ForeignKey('transformations.id'), index=True)
    output_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(500), default='Generated output')
    content: Mapped[str] = mapped_column(Text)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default='needs_review', index=True)
    reviewer_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, onupdate=_utc_now_naive)


class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    transformation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    output_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, index=True)


class OAuthLoginCode(Base):
    __tablename__ = 'oauth_login_codes'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="Viewer/Auditor") # Admin, Procurement Officer, Viewer/Auditor
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_number = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    issuing_authority = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    status = Column(String(50), default="ACTIVE") # ACTIVE, EVALUATION, CLOSED
    submission_deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    requirements = relationship("Requirement", back_populates="tender", cascade="all, delete-orphan")
    bidders = relationship("Bidder", back_populates="tender", cascade="all, delete-orphan")

class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    code = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    mandatory = Column(Boolean, default=True)
    source_clause = Column(String(100), nullable=True)
    source_page = Column(Integer, nullable=True)
    threshold_value = Column(String(255), nullable=True)

    tender = relationship("Tender", back_populates="requirements")
    verifications = relationship("VerificationResult", back_populates="requirement", cascade="all, delete-orphan")

class Bidder(Base):
    __tablename__ = "bidders"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    legal_name = Column(String(255), nullable=False)
    archetype = Column(String(50), nullable=True) # Clean, Missing-doc, Mismatch, Expired-cert, Borderline
    pan = Column(String(20), nullable=True)
    gstin = Column(String(30), nullable=True)
    udyam_number = Column(String(50), nullable=True)
    bid_amount_inr = Column(Float, nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, QUALIFIED, REJECTED, CLARIFICATION_REQUESTED
    compliance_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="Low") # Low, Medium, High
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tender = relationship("Tender", back_populates="bidders")
    documents = relationship("Document", back_populates="bidder", cascade="all, delete-orphan")
    verifications = relationship("VerificationResult", back_populates="bidder", cascade="all, delete-orphan")
    decisions = relationship("OfficerDecision", back_populates="bidder", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_uuid = Column(String(36), unique=True, index=True, nullable=True)
    bidder_id = Column(Integer, ForeignKey("bidders.id"), nullable=False)
    document_type = Column(String(100), nullable=False) # PAN, GST_CERTIFICATE, UDYAM_CERTIFICATE, BIS_LICENSE, etc.
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    flaw_injected = Column(String(50), default="NO") # NO, YES, MISSING
    mime_type = Column(String(100), default="application/pdf")
    file_size = Column(Integer, default=0)
    extracted_text = Column(Text, nullable=True)
    extracted_json = Column(Text, nullable=True) # JSON payload string
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    bidder = relationship("Bidder", back_populates="documents")

class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(Integer, primary_key=True, index=True)
    bidder_id = Column(Integer, ForeignKey("bidders.id"), nullable=False)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    status = Column(String(50), nullable=False) # PASS, FAIL, MISSING, MISMATCH, MANUAL_REVIEW
    source_type = Column(String(50), nullable=False, default="synthetic") # official, licensed_sandbox, synthetic
    evidence_text = Column(Text, nullable=True)
    raw_source_data = Column(Text, nullable=True) # JSON representation of source verification response
    failure_reason = Column(Text, nullable=True)
    checked_at = Column(DateTime, default=datetime.datetime.utcnow)

    bidder = relationship("Bidder", back_populates="verifications")
    requirement = relationship("Requirement", back_populates="verifications")

class OfficerDecision(Base):
    __tablename__ = "officer_decisions"

    id = Column(Integer, primary_key=True, index=True)
    bidder_id = Column(Integer, ForeignKey("bidders.id"), nullable=False)
    officer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False) # QUALIFIED, REJECTED, CLARIFICATION_REQUESTED
    comments = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    bidder = relationship("Bidder", back_populates="decisions")
    officer = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    actor_id = Column(Integer, nullable=True)
    actor_email = Column(String(255), nullable=True)
    action_type = Column(String(100), nullable=False) # VERIFICATION_RUN, DECISION_RECORDED, USER_MUTATION, CONFIG_CHANGE, DOCUMENT_VIEW
    entity_type = Column(String(100), nullable=True) # Bidder, Tender, Document, User
    entity_id = Column(String(100), nullable=True)
    details_json = Column(Text, nullable=True)
    prev_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)

class DocumentAccessLog(Base):
    __tablename__ = "document_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    user_id = Column(Integer, nullable=False)
    user_email = Column(String(255), nullable=False)
    tender_id = Column(Integer, nullable=True)
    bidder_id = Column(Integer, nullable=False)
    document_id = Column(Integer, nullable=False)
    document_name = Column(String(255), nullable=False)
    action_type = Column(String(50), default="VIEW") # VIEW, DOWNLOAD
    status = Column(String(50), default="ALLOWED") # ALLOWED, DENIED
    denial_reason = Column(Text, nullable=True)

class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, nullable=False)
    blacklisted_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)


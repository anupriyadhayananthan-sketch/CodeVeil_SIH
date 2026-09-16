import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "Viewer/Auditor"
    captcha_token: Optional[str] = None
    captcha_id: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime.datetime
    last_login: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    captcha_token: Optional[str] = None
    captcha_id: Optional[str] = None

class ResetPasswordSubmit(BaseModel):
    reset_token: str
    new_password: str

# CAPTCHA Schemas
class CaptchaConfigResponse(BaseModel):
    provider: str
    site_key: Optional[str] = None
    disabled: bool

class CaptchaChallengeResponse(BaseModel):
    captcha_id: str
    prompt: str
    svg: str

class CaptchaStatusResponse(BaseModel):
    captcha_required: bool
    provider: str
    failed_attempts: int

# Requirement Schemas
class RequirementOut(BaseModel):
    id: int
    tender_id: int
    code: str
    title: str
    description: str
    mandatory: bool
    source_clause: Optional[str] = None
    source_page: Optional[int] = None
    threshold_value: Optional[str] = None

    class Config:
        from_attributes = True

# Verification Result Schemas
class VerificationResultOut(BaseModel):
    id: int
    bidder_id: int
    requirement_id: int
    status: str # PASS, FAIL, MISSING, MISMATCH, MANUAL_REVIEW
    source_type: str # official, licensed_sandbox, synthetic
    evidence_text: Optional[str] = None
    raw_source_data: Optional[str] = None
    failure_reason: Optional[str] = None
    checked_at: datetime.datetime
    requirement: Optional[RequirementOut] = None

    class Config:
        from_attributes = True

# Document Schemas
class DocumentOut(BaseModel):
    id: int
    doc_uuid: Optional[str] = None
    bidder_id: int
    document_type: str
    filename: str
    flaw_injected: str
    mime_type: str
    file_size: int
    uploaded_at: datetime.datetime
    extracted_text: Optional[str] = None
    extracted_json: Optional[str] = None

    class Config:
        from_attributes = True

# Officer Decision Schemas
class DecisionCreate(BaseModel):
    bidder_id: int
    decision: str # QUALIFIED, REJECTED, CLARIFICATION_REQUESTED
    comments: str

class DecisionOut(BaseModel):
    id: int
    bidder_id: int
    officer_id: int
    decision: str
    comments: str
    timestamp: datetime.datetime
    officer_name: Optional[str] = None

    class Config:
        from_attributes = True

# Bidder Schemas
class BidderOut(BaseModel):
    id: int
    tender_id: int
    legal_name: str
    archetype: Optional[str] = None
    pan: Optional[str] = None
    gstin: Optional[str] = None
    udyam_number: Optional[str] = None
    bid_amount_inr: Optional[float] = None
    status: str
    compliance_score: float
    risk_level: str
    created_at: datetime.datetime
    documents: List[DocumentOut] = []
    verifications: List[VerificationResultOut] = []
    decisions: List[DecisionOut] = []

    class Config:
        from_attributes = True

# Tender Schemas
class TenderOut(BaseModel):
    id: int
    tender_number: str
    title: str
    issuing_authority: str
    category: str
    status: str
    submission_deadline: Optional[datetime.datetime] = None
    is_closed: bool = False
    effective_status: str = "OPEN"
    created_at: datetime.datetime
    requirements: List[RequirementOut] = []
    bidders: List[BidderOut] = []

    class Config:
        from_attributes = True

# Audit Log Schema
class AuditLogOut(BaseModel):
    id: int
    timestamp: datetime.datetime
    actor_id: Optional[int] = None
    actor_email: Optional[str] = None
    action_type: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details_json: Optional[str] = None
    prev_hash: str
    current_hash: str

    class Config:
        from_attributes = True

# Document Access Log Schema
class DocumentAccessLogOut(BaseModel):
    id: int
    timestamp: datetime.datetime
    user_id: int
    user_email: str
    tender_id: Optional[int] = None
    bidder_id: int
    document_id: int
    document_name: str
    action_type: str
    status: str = "ALLOWED"
    denial_reason: Optional[str] = None

    class Config:
        from_attributes = True

class TempDocumentTokenResponse(BaseModel):
    document_id: str
    temp_token: str
    expires_in_seconds: int


# Collusion & Risk Intelligence Schemas
class PriceRiggingResult(BaseModel):
    tender_number: str
    mean_price: float
    std_price: float
    cov_percent: float
    spread_percent: float
    skewness: float
    rigging_risk_flag: bool
    risk_reason: str
    price_distribution: List[Dict[str, Any]]

class NetworkNode(BaseModel):
    id: str
    label: str
    node_type: str # bidder, director, address, bank_account

class NetworkEdge(BaseModel):
    source: str
    target: str
    relationship: str

class ShellNetworkGraph(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    clusters: List[Dict[str, Any]]

class MLRiskMetrics(BaseModel):
    model_type: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    feature_importance: Dict[str, float]

# Accuracy Suite Schema
class AccuracyBenchmarkReport(BaseModel):
    timestamp: str
    total_bidders: int
    total_requirements_evaluated: int
    exact_matches: int
    overall_accuracy_pct: float
    precision: float
    recall: float
    f1_score: float
    archetype_results: List[Dict[str, Any]]

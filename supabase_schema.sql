-- CodeVeil PostgreSQL / Supabase Schema DDL
-- Generated for SIH26100 GeM Procurement Compliance Platform

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Viewer/Auditor',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.tenders (
    id SERIAL PRIMARY KEY,
    tender_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    issuing_authority VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    submission_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_officer_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.requirements (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    mandatory BOOLEAN DEFAULT TRUE,
    source_clause VARCHAR(100),
    source_page INTEGER,
    threshold_value VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS public.bidders (
    id SERIAL PRIMARY KEY,
    tender_id INTEGER NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    archetype VARCHAR(50),
    pan VARCHAR(20),
    gstin VARCHAR(30),
    udyam_number VARCHAR(50),
    bid_amount_inr DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'PENDING',
    compliance_score DOUBLE PRECISION DEFAULT 0.0,
    risk_level VARCHAR(20) DEFAULT 'Low',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    last_report_sent_at TIMESTAMP WITH TIME ZONE,
    last_report_status VARCHAR(50)
);

-- Additive migration for existing Supabase deployment
ALTER TABLE public.bidders ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.bidders ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bidders ADD COLUMN IF NOT EXISTS last_report_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.bidders ADD COLUMN IF NOT EXISTS last_report_status VARCHAR(50);

CREATE TABLE IF NOT EXISTS public.documents (
    id SERIAL PRIMARY KEY,
    doc_uuid VARCHAR(36) UNIQUE,
    bidder_id INTEGER NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    flaw_injected VARCHAR(50) DEFAULT 'NO',
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    file_size INTEGER DEFAULT 0,
    extracted_text TEXT,
    extracted_json TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.verification_results (
    id SERIAL PRIMARY KEY,
    bidder_id INTEGER NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'synthetic',
    evidence_text TEXT,
    raw_source_data TEXT,
    failure_reason TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.officer_decisions (
    id SERIAL PRIMARY KEY,
    bidder_id INTEGER NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    officer_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL,
    comments TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor_id INTEGER,
    actor_email VARCHAR(255),
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    details_json TEXT,
    prev_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_access_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tender_id INTEGER,
    bidder_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) DEFAULT 'VIEW',
    status VARCHAR(50) DEFAULT 'ALLOWED',
    denial_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.token_blacklist (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    blacklisted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_hashes (
    id SERIAL PRIMARY KEY,
    file_hash VARCHAR(64) NOT NULL,
    first_bidder_id INTEGER NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    first_tender_id INTEGER REFERENCES public.tenders(id) ON DELETE SET NULL,
    document_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.document_integrity_flags (
    id SERIAL PRIMARY KEY,
    document_id INTEGER UNIQUE NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    bidder_id INTEGER NOT NULL REFERENCES public.bidders(id) ON DELETE CASCADE,
    tamper_risk VARCHAR(20) DEFAULT 'LOW',
    metadata_flag BOOLEAN DEFAULT FALSE,
    duplicate_hash_flag BOOLEAN DEFAULT FALSE,
    details_json TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tenders_number ON public.tenders(tender_number);
CREATE INDEX IF NOT EXISTS idx_bidders_tender ON public.bidders(tender_id);
CREATE INDEX IF NOT EXISTS idx_requirements_tender ON public.requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_documents_bidder ON public.documents(bidder_id);
CREATE INDEX IF NOT EXISTS idx_verifications_bidder ON public.verification_results(bidder_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_document_hashes_hash ON public.document_hashes(file_hash);
CREATE INDEX IF NOT EXISTS idx_integrity_flags_doc ON public.document_integrity_flags(document_id);

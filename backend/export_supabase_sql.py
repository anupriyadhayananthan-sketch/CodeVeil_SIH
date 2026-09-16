import os
import sys
import json
import sqlite3
import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def export_supabase_sql():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_db_path = os.path.join(base_dir, "backend", "codeveil.db")
    
    # Check if SQLite DB exists, if not seed it first
    if not os.path.exists(sqlite_db_path):
        print("SQLite database not found. Running seed.py to generate clean dataset...")
        from seed import seed_database
        seed_database()

    print(f"Connecting to local SQLite database: {sqlite_db_path}")
    conn = sqlite3.connect(sqlite_db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. GENERATE DDL (supabase_schema.sql)
    schema_sql = """-- CodeVeil PostgreSQL / Supabase Schema DDL
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tenders_number ON public.tenders(tender_number);
CREATE INDEX IF NOT EXISTS idx_bidders_tender ON public.bidders(tender_id);
CREATE INDEX IF NOT EXISTS idx_requirements_tender ON public.requirements(tender_id);
CREATE INDEX IF NOT EXISTS idx_documents_bidder ON public.documents(bidder_id);
CREATE INDEX IF NOT EXISTS idx_verifications_bidder ON public.verification_results(bidder_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
"""

    schema_file = os.path.join(base_dir, "supabase_schema.sql")
    with open(schema_file, "w", encoding="utf-8") as f:
        f.write(schema_sql)
    print(f"Generated PostgreSQL DDL schema: {schema_file}")

    # 2. GENERATE SEED DATA (supabase_seed.sql)
    tables = [
        "users",
        "tenders",
        "requirements",
        "bidders",
        "documents",
        "verification_results",
        "officer_decisions",
        "audit_logs",
        "document_access_logs",
        "token_blacklist"
    ]

    seed_statements = ["-- CodeVeil Supabase Dataset Seed SQL\n-- Preserves exact synthetic procurement datasets & verification findings\n"]

    for table in tables:
        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()
        if not rows:
            continue
        
        columns = [column[0] for column in cursor.description]
        col_list = ", ".join([f'"{col}"' for col in columns])
        
        seed_statements.append(f"-- Seeding {table} ({len(rows)} rows)")
        for row in rows:
            vals = []
            for col in columns:
                val = row[col]
                if val is None:
                    vals.append("NULL")
                elif isinstance(val, bool):
                    vals.append("TRUE" if val else "FALSE")
                elif isinstance(val, (int, float)):
                    vals.append(str(val))
                else:
                    # Escape single quotes for SQL string literal
                    escaped_str = str(val).replace("'", "''")
                    vals.append(f"'{escaped_str}'")
            
            val_list = ", ".join(vals)
            seed_statements.append(f'INSERT INTO public.{table} ({col_list}) VALUES ({val_list}) ON CONFLICT DO NOTHING;')
        
        # Reset serial sequence for auto-incrementing IDs
        seed_statements.append(f"SELECT setval('public.{table}_id_seq', (SELECT MAX(id) FROM public.{table}));\n")

    seed_file = os.path.join(base_dir, "supabase_seed.sql")
    with open(seed_file, "w", encoding="utf-8") as f:
        f.write("\n".join(seed_statements))
    print(f"Generated PostgreSQL seed SQL: {seed_file}")

    # 3. GENERATE RLS SECURITY POLICIES (supabase_rls_security.sql)
    rls_sql = """-- CodeVeil Supabase Row Level Security (RLS) & Authorization Policies

-- 1. Enable Row Level Security on all application tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bidders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officer_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;

-- 2. TENDERS & REQUIREMENTS POLICIES (Public read, officer write)
DROP POLICY IF EXISTS "Public and authenticated users can view tenders" ON public.tenders;
CREATE POLICY "Public and authenticated users can view tenders"
ON public.tenders FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Officers can create tenders" ON public.tenders;
CREATE POLICY "Officers can create tenders"
ON public.tenders FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public and authenticated users can view requirements" ON public.requirements;
CREATE POLICY "Public and authenticated users can view requirements"
ON public.requirements FOR SELECT
USING (true);

-- 3. BIDDERS & VERIFICATIONS POLICIES (Authenticated user read access)
DROP POLICY IF EXISTS "Authenticated users can view bidders" ON public.bidders;
CREATE POLICY "Authenticated users can view bidders"
ON public.bidders FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view verification results" ON public.verification_results;
CREATE POLICY "Authenticated users can view verification results"
ON public.verification_results FOR SELECT
TO authenticated
USING (true);

-- 4. DOCUMENTS & DECISIONS POLICIES
DROP POLICY IF EXISTS "Authenticated users can view document metadata" ON public.documents;
CREATE POLICY "Authenticated users can view document metadata"
ON public.documents FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Officers and auditors can view decisions" ON public.officer_decisions;
CREATE POLICY "Officers and auditors can view decisions"
ON public.officer_decisions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Officers can record decisions" ON public.officer_decisions;
CREATE POLICY "Officers can record decisions"
ON public.officer_decisions FOR INSERT
TO authenticated
WITH CHECK (true);

-- 5. USERS & PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.users;
CREATE POLICY "Users can view own profile or admins view all"
ON public.users FOR SELECT
TO authenticated
USING (email = auth.email() OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.email = auth.email() AND u.role = 'Admin'
));

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
TO authenticated
USING (email = auth.email());

-- 6. AUDIT & CONFIDENTIAL ACCESS LOG POLICIES (Strict role-restricted)
DROP POLICY IF EXISTS "Auditors and Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Auditors and Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.email = auth.email() AND u.role IN ('Admin', 'Viewer/Auditor', 'Procurement Officer')
));

DROP POLICY IF EXISTS "Authenticated users can append audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can append audit logs"
ON public.audit_logs FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Auditors and Admins view document access logs" ON public.document_access_logs;
CREATE POLICY "Auditors and Admins view document access logs"
ON public.document_access_logs FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.users u WHERE u.email = auth.email() AND u.role IN ('Admin', 'Viewer/Auditor')
));

DROP POLICY IF EXISTS "Authenticated users record document access" ON public.document_access_logs;
CREATE POLICY "Authenticated users record document access"
ON public.document_access_logs FOR INSERT
TO authenticated, service_role
WITH CHECK (true);

-- 7. TOKEN BLACKLIST POLICY (Service Role only)
DROP POLICY IF EXISTS "Service role manages token blacklist" ON public.token_blacklist;
CREATE POLICY "Service role manages token blacklist"
ON public.token_blacklist FOR ALL
TO service_role
USING (true);
"""

    rls_file = os.path.join(base_dir, "supabase_rls_security.sql")
    with open(rls_file, "w", encoding="utf-8") as f:
        f.write(rls_sql)
    print(f"Generated RLS Security policies: {rls_file}")

    conn.close()
    print("\n[SUCCESS] Supabase SQL migration package generated successfully!")

if __name__ == "__main__":
    export_supabase_sql()

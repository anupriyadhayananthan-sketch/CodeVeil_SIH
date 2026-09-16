-- CodeVeil Supabase Row Level Security (RLS) & Authorization Policies

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

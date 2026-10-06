-- =============================================================================
-- MULTI-COLLEGE & MULTI-DEPARTMENT MARKSANALYZER PLATFORM
-- FULL SUPABASE DATABASE SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- Paste this entire script into your Supabase SQL Editor and run it.
-- =============================================================================

-- Enable pgcrypto / uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. COLLEGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    university_name TEXT NOT NULL,
    college_logo_url TEXT,
    university_logo_url TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. DEPARTMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_department_per_college UNIQUE (college_id, name)
);

-- -----------------------------------------------------------------------------
-- 3. STUDENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    usn TEXT NOT NULL,
    name TEXT NOT NULL,
    semester TEXT,
    year TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. ANALYSIS_RECORDS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    semester TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    exam_cycle TEXT NOT NULL,
    excel_file_url TEXT,
    analysis_json JSONB NOT NULL,
    pdf_url TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. SUBJECT_RESULTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id TEXT NOT NULL REFERENCES public.analysis_records(id) ON DELETE CASCADE,
    subject_code TEXT NOT NULL,
    subject_name TEXT,
    faculty TEXT,
    appeared INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    average NUMERIC(5,2) NOT NULL DEFAULT 0,
    pass_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- 6. OTP_CODES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    target_id TEXT,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. PENDING_REGISTRATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'college' or 'department'
    payload_json JSONB NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 8. AUDIT_LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id TEXT,
    target_type TEXT,
    target_id TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR HIGH QUERY PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_colleges_id ON public.colleges(id);
CREATE INDEX IF NOT EXISTS idx_colleges_email ON public.colleges(email);

CREATE INDEX IF NOT EXISTS idx_departments_id ON public.departments(id);
CREATE INDEX IF NOT EXISTS idx_departments_college_id ON public.departments(college_id);
CREATE INDEX IF NOT EXISTS idx_departments_email ON public.departments(email);

CREATE INDEX IF NOT EXISTS idx_students_dept_id ON public.students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_usn ON public.students(usn);

CREATE INDEX IF NOT EXISTS idx_analysis_college_id ON public.analysis_records(college_id);
CREATE INDEX IF NOT EXISTS idx_analysis_department_id ON public.analysis_records(department_id);
CREATE INDEX IF NOT EXISTS idx_analysis_dept_sem_cycle ON public.analysis_records(department_id, semester, exam_cycle);

CREATE INDEX IF NOT EXISTS idx_subject_results_analysis_id ON public.subject_results(analysis_id);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email_purpose ON public.otp_codes(email, purpose);
CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON public.pending_registrations(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) - STRICT ZERO-PUBLIC-ACCESS POLICIES
-- With RLS enabled and NO public policies, the anon key CANNOT read or write anything.
-- The server uses the Supabase service role key, which bypasses RLS safely.
-- -----------------------------------------------------------------------------
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- STORAGE BUCKETS (logos: public read | analysis-files: private)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'logos',
    'logos',
    true,
    5242880, -- 5 MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'analysis-files',
    'analysis-files',
    false,
    52428800, -- 50 MB
    ARRAY[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Allow public read on logos bucket only
DROP POLICY IF EXISTS "Public Read Logos" ON storage.objects;
CREATE POLICY "Public Read Logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

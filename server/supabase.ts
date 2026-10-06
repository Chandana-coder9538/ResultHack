import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Read connection configuration from environment variables on the server side only
const PROJECT_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLISHABLE_KEY || process.env.SUPABASE_KEY || '';

let supabaseClient: SupabaseClient | null = null;
let supabaseSchemaReady: boolean | null = null;
let lastSchemaCheckTimestamp = 0;
let hasLoggedSchemaNotice = false;

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- MarksAnalyzer Multi-College & Multi-Department Production Schema
-- ============================================================================

-- Enable pgcrypto for UUID generation if not already active
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Colleges
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  university_name TEXT NOT NULL,
  college_logo_url TEXT,
  university_logo_url TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Departments (FK to colleges, cascade delete)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_college_dept_name UNIQUE (college_id, name)
);

-- 3. Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  usn TEXT NOT NULL,
  name TEXT NOT NULL,
  semester TEXT,
  year TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_dept_student_usn UNIQUE (department_id, usn)
);

-- 4. Analysis Records
CREATE TABLE IF NOT EXISTS analysis_records (
  id TEXT PRIMARY KEY,
  college_id UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  exam_cycle TEXT NOT NULL,
  scheme TEXT DEFAULT '2022',
  excel_file_url TEXT,
  analysis_json JSONB NOT NULL,
  pdf_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Subject Results
CREATE TABLE IF NOT EXISTS subject_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id TEXT NOT NULL REFERENCES analysis_records(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  faculty TEXT,
  appeared INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  average NUMERIC(5,2) DEFAULT 0.00,
  pass_percentage NUMERIC(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. OTP Codes (Hashed verification codes)
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  target_id TEXT,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pending Registrations
CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id TEXT,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_departments_college_id ON departments(college_id);
CREATE INDEX IF NOT EXISTS idx_students_dept_id ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_college_id ON analysis_records(college_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_dept_id ON analysis_records(department_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_composite ON analysis_records(department_id, semester, exam_cycle);
CREATE INDEX IF NOT EXISTS idx_subject_results_analysis_id ON subject_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_purpose ON otp_codes(email, purpose);

-- Enable Row Level Security (RLS)
ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Provision Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-files', 'analysis-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Public read access for logos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public read logos'
  ) THEN
    CREATE POLICY "Public read logos" ON storage.objects
      FOR SELECT USING (bucket_id = 'logos');
  END IF;
END $$;`;

export function isSupabaseConfigured(): boolean {
  return Boolean(PROJECT_URL && SERVICE_KEY && PROJECT_URL.startsWith('http'));
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(PROJECT_URL, SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Checks whether Supabase database tables are initialized and reachable.
 * Caches positive/negative state to prevent repetitive failed queries.
 */
export async function isSupabaseReady(forceCheck = false): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const now = Date.now();
  if (!forceCheck && supabaseSchemaReady !== null && (now - lastSchemaCheckTimestamp < 45000)) {
    return supabaseSchemaReady;
  }

  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { data, error } = await sb.from('colleges').select('id').limit(1);
    lastSchemaCheckTimestamp = now;

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist')
      ) {
        supabaseSchemaReady = false;
        if (!hasLoggedSchemaNotice) {
          hasLoggedSchemaNotice = true;
          console.log(
            '[Supabase Info] Supabase project credentials detected. Remote tables (public.colleges, etc.) are pending migration in Supabase SQL editor. Running seamlessly on resilient local database mode.'
          );
        }
        return false;
      }
      // Authorization or connection errors
      supabaseSchemaReady = false;
      return false;
    }

    supabaseSchemaReady = true;
    return true;
  } catch (err: any) {
    supabaseSchemaReady = false;
    lastSchemaCheckTimestamp = now;
    return false;
  }
}

/**
 * Centralized, non-disruptive error handler that handles missing table codes gracefully
 */
function handleSupabaseNotice(context: string, error: any) {
  if (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    error?.message?.includes('schema cache') ||
    error?.message?.includes('does not exist')
  ) {
    supabaseSchemaReady = false;
    lastSchemaCheckTimestamp = Date.now();
    return;
  }
  console.warn(`[Supabase Notice] ${context}: ${error?.message || error}`);
}

export async function getSupabaseDiagnostics(forceCheck = false) {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      configured: false,
      ready: false,
      projectUrl: '',
      message: 'Supabase environment variables (PROJECT_URL, PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY) not set.',
      schemaSql: SUPABASE_SQL_SCHEMA,
    };
  }

  const ready = await isSupabaseReady(forceCheck);
  const safeProjectRef = PROJECT_URL.replace(/https?:\/\//, '').split('.')[0] || 'supabase';

  return {
    configured: true,
    ready,
    projectRef: safeProjectRef,
    projectUrl: PROJECT_URL,
    message: ready
      ? 'Supabase database tables verified and fully operational.'
      : 'Supabase credentials connected. Database tables have not yet been created in your Supabase project. Paste the provided SQL schema in Supabase SQL Editor to enable remote tables.',
    schemaSql: SUPABASE_SQL_SCHEMA,
  };
}

// -----------------------------------------------------------------------------
// COLLEGE OPERATIONS
// -----------------------------------------------------------------------------

export async function supabaseListColleges() {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('colleges')
      .select('id, name, university_name, college_logo_url, university_logo_url, email, email_verified, created_at, departments(count)')
      .order('name', { ascending: true });

    if (error) {
      handleSupabaseNotice('listColleges', error);
      return null;
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      universityName: c.university_name,
      collegeLogoUrl: c.college_logo_url,
      universityLogoUrl: c.university_logo_url,
      email: c.email,
      emailVerified: c.email_verified,
      departmentsCount: c.departments?.[0]?.count || 0,
      createdAt: c.created_at,
    }));
  } catch (err: any) {
    handleSupabaseNotice('listColleges', err);
    return null;
  }
}

export async function supabaseGetCollegeById(id: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('colleges')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getCollegeById', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      universityName: data.university_name,
      collegeLogoUrl: data.college_logo_url,
      universityLogoUrl: data.university_logo_url,
      email: data.email,
      passwordHash: data.password_hash,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
      failedLoginAttempts: data.failed_attempts || 0,
      lockoutUntil: data.lockout_until,
    };
  } catch (err: any) {
    handleSupabaseNotice('getCollegeById', err);
    return null;
  }
}

export async function supabaseGetCollegeByEmail(email: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('colleges')
      .select('*')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getCollegeByEmail', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      universityName: data.university_name,
      collegeLogoUrl: data.college_logo_url,
      universityLogoUrl: data.university_logo_url,
      email: data.email,
      passwordHash: data.password_hash,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
      failedLoginAttempts: data.failed_attempts || 0,
      lockoutUntil: data.lockout_until,
    };
  } catch (err: any) {
    handleSupabaseNotice('getCollegeByEmail', err);
    return null;
  }
}

export async function supabaseGetCollegeByName(name: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('colleges')
      .select('*')
      .ilike('name', name.trim())
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getCollegeByName', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      universityName: data.university_name,
      collegeLogoUrl: data.college_logo_url,
      universityLogoUrl: data.university_logo_url,
      email: data.email,
      passwordHash: data.password_hash,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    handleSupabaseNotice('getCollegeByName', err);
    return null;
  }
}

export async function supabaseCreateCollege(college: {
  name: string;
  universityName: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('colleges')
      .insert([
        {
          name: college.name,
          university_name: college.universityName,
          college_logo_url: college.collegeLogoUrl || null,
          university_logo_url: college.universityLogoUrl || null,
          email: college.email.trim().toLowerCase(),
          password_hash: college.passwordHash,
          email_verified: college.emailVerified,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      handleSupabaseNotice('createCollege', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      universityName: data.university_name,
      collegeLogoUrl: data.college_logo_url,
      universityLogoUrl: data.university_logo_url,
      email: data.email,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    handleSupabaseNotice('createCollege', err);
    return null;
  }
}

export async function supabaseUpdateCollegeFailedLogin(
  id: string,
  failedAttempts: number,
  lockoutUntil?: string | null
) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb
      .from('colleges')
      .update({
        failed_attempts: failedAttempts,
        lockout_until: lockoutUntil || null,
      })
      .eq('id', id);
  } catch (err: any) {
    handleSupabaseNotice('updateCollegeFailedLogin', err);
  }
}

export async function supabaseDeleteCollege(id: string) {
  if (!(await isSupabaseReady())) return false;
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('colleges').delete().eq('id', id);
    if (error) {
      handleSupabaseNotice('deleteCollege', error);
      return false;
    }
    return true;
  } catch (err: any) {
    handleSupabaseNotice('deleteCollege', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// DEPARTMENT OPERATIONS
// -----------------------------------------------------------------------------

export async function supabaseListDepartments(collegeId: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('departments')
      .select('*')
      .eq('college_id', collegeId)
      .order('name', { ascending: true });

    if (error) {
      handleSupabaseNotice('listDepartments', error);
      return null;
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      collegeId: d.college_id,
      name: d.name,
      email: d.email,
      emailVerified: d.email_verified,
      createdAt: d.created_at,
      failedLoginAttempts: d.failed_attempts || 0,
      lockoutUntil: d.lockout_until,
    }));
  } catch (err: any) {
    handleSupabaseNotice('listDepartments', err);
    return null;
  }
}

export async function supabaseGetDepartmentById(id: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('departments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getDepartmentById', error);
      return null;
    }

    return {
      id: data.id,
      collegeId: data.college_id,
      name: data.name,
      email: data.email,
      passwordHash: data.password_hash,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
      failedLoginAttempts: data.failed_attempts || 0,
      lockoutUntil: data.lockout_until,
    };
  } catch (err: any) {
    handleSupabaseNotice('getDepartmentById', err);
    return null;
  }
}

export async function supabaseGetDepartmentByEmail(email: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('departments')
      .select('*')
      .ilike('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getDepartmentByEmail', error);
      return null;
    }

    return {
      id: data.id,
      collegeId: data.college_id,
      name: data.name,
      email: data.email,
      passwordHash: data.password_hash,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
      failedLoginAttempts: data.failed_attempts || 0,
      lockoutUntil: data.lockout_until,
    };
  } catch (err: any) {
    handleSupabaseNotice('getDepartmentByEmail', err);
    return null;
  }
}

export async function supabaseCreateDepartment(dept: {
  collegeId: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('departments')
      .insert([
        {
          college_id: dept.collegeId,
          name: dept.name,
          email: dept.email.trim().toLowerCase(),
          password_hash: dept.passwordHash,
          email_verified: dept.emailVerified,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      handleSupabaseNotice('createDepartment', error);
      return null;
    }

    return {
      id: data.id,
      collegeId: data.college_id,
      name: data.name,
      email: data.email,
      emailVerified: data.email_verified,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    handleSupabaseNotice('createDepartment', err);
    return null;
  }
}

export async function supabaseUpdateDepartmentFailedLogin(
  id: string,
  failedAttempts: number,
  lockoutUntil?: string | null
) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb
      .from('departments')
      .update({
        failed_attempts: failedAttempts,
        lockout_until: lockoutUntil || null,
      })
      .eq('id', id);
  } catch (err: any) {
    handleSupabaseNotice('updateDepartmentFailedLogin', err);
  }
}

export async function supabaseDeleteDepartment(id: string) {
  if (!(await isSupabaseReady())) return false;
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { error } = await sb.from('departments').delete().eq('id', id);
    if (error) {
      handleSupabaseNotice('deleteDepartment', error);
      return false;
    }
    return true;
  } catch (err: any) {
    handleSupabaseNotice('deleteDepartment', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// PENDING REGISTRATIONS
// -----------------------------------------------------------------------------

export async function supabaseSavePendingRegistration(
  type: 'college' | 'department',
  email: string,
  payload: any
) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // Clean previous pending for this email & type
    await sb
      .from('pending_registrations')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('type', type);

    const { data, error } = await sb
      .from('pending_registrations')
      .insert([
        {
          type,
          email: email.toLowerCase(),
          payload_json: payload,
        },
      ])
      .select()
      .single();

    if (error) {
      handleSupabaseNotice('savePendingRegistration', error);
      return null;
    }
    return data?.id;
  } catch (err: any) {
    handleSupabaseNotice('savePendingRegistration', err);
    return null;
  }
}

export async function supabaseGetPendingRegistration(
  email: string,
  type: 'college' | 'department'
) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('pending_registrations')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('getPendingRegistration', error);
      return null;
    }
    return data.payload_json;
  } catch (err: any) {
    handleSupabaseNotice('getPendingRegistration', err);
    return null;
  }
}

export async function supabaseDeletePendingRegistration(
  email: string,
  type: 'college' | 'department'
) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb
      .from('pending_registrations')
      .delete()
      .eq('email', email.toLowerCase())
      .eq('type', type);
  } catch (err: any) {
    handleSupabaseNotice('deletePendingRegistration', err);
  }
}

// -----------------------------------------------------------------------------
// OTP CODES
// -----------------------------------------------------------------------------

export async function supabaseSaveOtp(
  email: string,
  purpose: string,
  codeHash: string,
  targetId?: string
) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate any older unused OTPs for same email & purpose
    await sb
      .from('otp_codes')
      .update({ used: true })
      .eq('email', email.toLowerCase())
      .eq('purpose', purpose)
      .eq('used', false);

    await sb.from('otp_codes').insert([
      {
        email: email.toLowerCase(),
        purpose,
        target_id: targetId || null,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        used: false,
      },
    ]);
  } catch (err: any) {
    handleSupabaseNotice('saveOtp', err);
  }
}

export async function supabaseVerifyOtp(
  email: string,
  purpose: string,
  rawCode: string
): Promise<{ valid: boolean; error?: string }> {
  if (!(await isSupabaseReady())) return { valid: false, error: 'Database uninitialized' };
  const sb = getSupabase();
  if (!sb) return { valid: false, error: 'Database uninitialized' };

  try {
    const targetHash = crypto.createHash('sha256').update(rawCode.trim()).digest('hex');

    const { data, error } = await sb
      .from('otp_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('purpose', purpose)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) handleSupabaseNotice('verifyOtp', error);
      return { valid: false, error: 'No active verification code found. Please request a new code.' };
    }

    // Check expiration
    if (new Date() > new Date(data.expires_at)) {
      return { valid: false, error: 'Verification code has expired (10-minute window exceeded). Please request a new code.' };
    }

    // Check max attempts (5 allowed)
    if (data.attempts >= 5) {
      await sb.from('otp_codes').update({ used: true }).eq('id', data.id);
      return { valid: false, error: 'Too many incorrect attempts. Code has been revoked for security. Please request a fresh code.' };
    }

    // Verify hash match
    if (data.code_hash !== targetHash) {
      const nextAttempts = data.attempts + 1;
      await sb.from('otp_codes').update({ attempts: nextAttempts }).eq('id', data.id);
      const remaining = 5 - nextAttempts;
      return {
        valid: false,
        error: `Incorrect code entered. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      };
    }

    // Mark as used
    await sb.from('otp_codes').update({ used: true }).eq('id', data.id);
    return { valid: true };
  } catch (err: any) {
    handleSupabaseNotice('verifyOtp', err);
    return { valid: false, error: 'Failed to verify code.' };
  }
}

// -----------------------------------------------------------------------------
// ANALYSIS RECORDS & SUBJECT RESULTS
// -----------------------------------------------------------------------------

export async function supabaseSaveAnalysisRecord(data: {
  id: string;
  collegeId: string;
  departmentId: string;
  semester: string;
  academicYear: string;
  examCycle: string;
  scheme?: string;
  excelFileUrl?: string;
  pdfUrl?: string;
  analysisJson: any;
  createdBy?: string;
}) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { error: recordError } = await sb.from('analysis_records').upsert([
      {
        id: data.id,
        college_id: data.collegeId,
        department_id: data.departmentId,
        semester: data.semester,
        academic_year: data.academicYear,
        exam_cycle: data.examCycle,
        scheme: data.scheme || '2022',
        excel_file_url: data.excelFileUrl || null,
        pdf_url: data.pdfUrl || null,
        analysis_json: data.analysisJson,
        created_by: data.createdBy || 'system',
      },
    ]);

    if (recordError) {
      handleSupabaseNotice('saveAnalysisRecord', recordError);
      return;
    }

    // Save individual subject results
    const subjectSummaries = data.analysisJson?.semesterSummary?.subjectSummaries || [];
    if (Array.isArray(subjectSummaries) && subjectSummaries.length > 0) {
      await sb.from('subject_results').delete().eq('analysis_id', data.id);

      const rows = subjectSummaries.map((sub: any) => ({
        analysis_id: data.id,
        subject_code: sub.subjectCode,
        subject_name: sub.subjectName || null,
        faculty: sub.facultyName || null,
        appeared: sub.totalStudents || 0,
        passed: (sub.totalStudents || 0) - (sub.failCount || 0),
        failed: sub.failCount || 0,
        average: Number(sub.averageMarks?.toFixed(2) || 0),
        pass_percentage: Number(sub.passPercentage?.toFixed(2) || 0),
      }));

      const { error: subjError } = await sb.from('subject_results').insert(rows);
      if (subjError) {
        handleSupabaseNotice('subject_results insert', subjError);
      }
    }

    // Upsert students roster
    const allStudents = data.analysisJson?.semesterSummary?.allStudents || [];
    if (Array.isArray(allStudents) && allStudents.length > 0) {
      const studentRows = allStudents.slice(0, 500).map((st: any) => ({
        department_id: data.departmentId,
        usn: st.studentId,
        name: st.studentName,
        semester: data.semester,
        year: data.academicYear,
      }));

      try {
        await sb.from('students').upsert(studentRows, { onConflict: 'department_id,usn' });
      } catch {
        // Non-blocking
      }
    }
  } catch (err: any) {
    handleSupabaseNotice('saveAnalysisRecord', err);
  }
}

export async function supabaseGetAnalysisRecord(id: string, collegeId?: string, departmentId?: string) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    let query = sb.from('analysis_records').select('*').eq('id', id);
    if (collegeId) query = query.eq('college_id', collegeId);
    if (departmentId) query = query.eq('department_id', departmentId);

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      if (error) handleSupabaseNotice('getAnalysisRecord', error);
      return null;
    }

    return {
      id: data.id,
      collegeId: data.college_id,
      departmentId: data.department_id,
      semester: data.semester,
      academicYear: data.academic_year,
      examCycle: data.exam_cycle,
      scheme: data.scheme || '2022',
      excelFileUrl: data.excel_file_url,
      pdfUrl: data.pdf_url,
      analysisJson: data.analysis_json,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    handleSupabaseNotice('getAnalysisRecord', err);
    return null;
  }
}

export async function supabaseListAnalysisRecords(filters: {
  collegeId?: string;
  departmentId?: string;
  semester?: string;
  academic_year?: string;
  exam_cycle?: string;
  search?: string;
}) {
  if (!(await isSupabaseReady())) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    let query = sb
      .from('analysis_records')
      .select('id, college_id, department_id, semester, academic_year, exam_cycle, scheme, excel_file_url, pdf_url, created_at, analysis_json')
      .order('created_at', { ascending: false });

    if (filters.collegeId) query = query.eq('college_id', filters.collegeId);
    if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
    if (filters.semester) query = query.eq('semester', filters.semester);
    if (filters.academic_year) query = query.eq('academic_year', filters.academic_year);
    if (filters.exam_cycle) query = query.eq('exam_cycle', filters.exam_cycle);

    const { data, error } = await query;
    if (error || !data) {
      handleSupabaseNotice('listAnalysisRecords', error);
      return null;
    }

    return data.map((row: any) => {
      const summary = row.analysis_json?.semesterSummary;
      return {
        id: row.id,
        analysisResultId: row.id,
        semester: row.semester,
        academicYear: row.academic_year,
        examCycle: row.exam_cycle,
        scheme: row.scheme || row.analysis_json?.config?.semesterDetails?.scheme || '2022',
        department: row.analysis_json?.config?.semesterDetails?.department || 'Academic Department',
        uploadedAt: row.created_at,
        originalFilename: row.analysis_json?.fileName || 'analysis_record.xlsx',
        fileName: row.analysis_json?.fileName || 'analysis_record.xlsx',
        totalStudents: summary?.totalUniqueStudents || 0,
        totalSubjects: row.analysis_json?.detectedSubjects?.length || 0,
        overallPassPercentage: summary?.overallPassPercentage || 0,
        cohortMeanPercentage: summary?.averageSemesterPercentage || 0,
        excelFileUrl: row.excel_file_url,
        pdfUrl: row.pdf_url,
        hasExcelBlob: Boolean(row.excel_file_url),
        createdAt: row.created_at,
        collegeId: row.college_id,
        departmentId: row.department_id,
      };
    });
  } catch (err: any) {
    handleSupabaseNotice('listAnalysisRecords', err);
    return null;
  }
}

export async function supabaseDeleteAnalysisRecord(id: string, collegeId?: string, departmentId?: string) {
  if (!(await isSupabaseReady())) return false;
  const sb = getSupabase();
  if (!sb) return false;

  try {
    let query = sb.from('analysis_records').delete().eq('id', id);
    if (collegeId) query = query.eq('college_id', collegeId);
    if (departmentId) query = query.eq('department_id', departmentId);

    const { error } = await query;
    if (error) {
      handleSupabaseNotice('deleteAnalysisRecord', error);
      return false;
    }
    return true;
  } catch (err: any) {
    handleSupabaseNotice('deleteAnalysisRecord', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// AUDIT LOGS
// -----------------------------------------------------------------------------

export async function supabaseRecordAuditLog(
  action: string,
  actorId?: string,
  targetType?: string,
  targetId?: string,
  ip?: string
) {
  if (!(await isSupabaseReady())) return;
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from('audit_logs').insert([
      {
        action,
        actor_id: actorId || null,
        target_type: targetType || null,
        target_id: targetId || null,
        ip: ip || null,
      },
    ]);
  } catch (err: any) {
    handleSupabaseNotice('recordAuditLog', err);
  }
}

// -----------------------------------------------------------------------------
// STORAGE BUCKETS (logos & analysis-files)
// -----------------------------------------------------------------------------

export async function supabaseUploadLogo(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const cleanExt = filename.split('.').pop() || 'png';
    const uniqueKey = `logo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${cleanExt}`;

    const { data, error } = await sb.storage
      .from('logos')
      .upload(uniqueKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error || !data) {
      console.warn('[Supabase Storage] Logo upload notice:', error?.message || error);
      return null;
    }

    const { data: publicData } = sb.storage.from('logos').getPublicUrl(uniqueKey);
    return publicData?.publicUrl || null;
  } catch (err: any) {
    console.warn('[Supabase Storage] Notice uploading logo:', err?.message || err);
    return null;
  }
}

export async function supabaseUploadAnalysisFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const cleanExt = filename.split('.').pop() || 'xlsx';
    const uniqueKey = `analysis_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${cleanExt}`;

    const { data, error } = await sb.storage
      .from('analysis-files')
      .upload(uniqueKey, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error || !data) {
      console.warn('[Supabase Storage] Analysis file notice:', error?.message || error);
      return null;
    }

    return uniqueKey;
  } catch (err: any) {
    console.warn('[Supabase Storage] Notice uploading analysis file:', err?.message || err);
    return null;
  }
}

export async function supabaseGetSignedAnalysisUrl(storageKey: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.storage
      .from('analysis-files')
      .createSignedUrl(storageKey, 3600); // 1 hour expiration

    if (error || !data) return null;
    return data.signedUrl;
  } catch (err: any) {
    console.warn('[Supabase Storage] Notice creating signed URL:', err?.message || err);
    return null;
  }
}

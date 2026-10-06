import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Read connection configuration from environment variables on the server side only
const PROJECT_URL = process.env.PROJECT_URL || process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLISHABLE_KEY || process.env.SUPABASE_KEY || '';

let supabaseClient: SupabaseClient | null = null;

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

// -----------------------------------------------------------------------------
// COLLEGE OPERATIONS
// -----------------------------------------------------------------------------

export async function supabaseListColleges() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('colleges')
    .select('id, name, university_name, college_logo_url, university_logo_url, email, email_verified, created_at, departments(count)')
    .order('name', { ascending: true });

  if (error) {
    console.error('[SUPABASE ERROR] listColleges:', error);
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
}

export async function supabaseGetCollegeById(id: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('colleges')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

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
}

export async function supabaseGetCollegeByEmail(email: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('colleges')
    .select('*')
    .ilike('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) return null;

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
}

export async function supabaseGetCollegeByName(name: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('colleges')
    .select('*')
    .ilike('name', name.trim())
    .maybeSingle();

  if (error || !data) return null;

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
  const sb = getSupabase();
  if (!sb) return null;

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
    console.error('[SUPABASE ERROR] createCollege:', error);
    throw new Error(error?.message || 'Failed to create college');
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
}

export async function supabaseUpdateCollegeFailedLogin(
  id: string,
  failedAttempts: number,
  lockoutUntil?: string | null
) {
  const sb = getSupabase();
  if (!sb) return;

  await sb
    .from('colleges')
    .update({
      failed_attempts: failedAttempts,
      lockout_until: lockoutUntil || null,
    })
    .eq('id', id);
}

export async function supabaseDeleteCollege(id: string) {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from('colleges').delete().eq('id', id);
  if (error) {
    console.error('[SUPABASE ERROR] deleteCollege:', error);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// DEPARTMENT OPERATIONS
// -----------------------------------------------------------------------------

export async function supabaseListDepartments(collegeId: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('departments')
    .select('*')
    .eq('college_id', collegeId)
    .order('name', { ascending: true });

  if (error) {
    console.error('[SUPABASE ERROR] listDepartments:', error);
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
}

export async function supabaseGetDepartmentById(id: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('departments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

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
}

export async function supabaseGetDepartmentByEmail(email: string) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('departments')
    .select('*')
    .ilike('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error || !data) return null;

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
}

export async function supabaseCreateDepartment(dept: {
  collegeId: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
}) {
  const sb = getSupabase();
  if (!sb) return null;

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
    console.error('[SUPABASE ERROR] createDepartment:', error);
    throw new Error(error?.message || 'Failed to create department');
  }

  return {
    id: data.id,
    collegeId: data.college_id,
    name: data.name,
    email: data.email,
    emailVerified: data.email_verified,
    createdAt: data.created_at,
  };
}

export async function supabaseUpdateDepartmentFailedLogin(
  id: string,
  failedAttempts: number,
  lockoutUntil?: string | null
) {
  const sb = getSupabase();
  if (!sb) return;

  await sb
    .from('departments')
    .update({
      failed_attempts: failedAttempts,
      lockout_until: lockoutUntil || null,
    })
    .eq('id', id);
}

export async function supabaseDeleteDepartment(id: string) {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from('departments').delete().eq('id', id);
  if (error) {
    console.error('[SUPABASE ERROR] deleteDepartment:', error);
    return false;
  }
  return true;
}

// -----------------------------------------------------------------------------
// PENDING REGISTRATIONS
// -----------------------------------------------------------------------------

export async function supabaseSavePendingRegistration(
  type: 'college' | 'department',
  email: string,
  payload: any
) {
  const sb = getSupabase();
  if (!sb) return null;

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
    console.error('[SUPABASE ERROR] savePendingRegistration:', error);
    return null;
  }
  return data?.id;
}

export async function supabaseGetPendingRegistration(
  email: string,
  type: 'college' | 'department'
) {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('pending_registrations')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.payload_json;
}

export async function supabaseDeletePendingRegistration(
  email: string,
  type: 'college' | 'department'
) {
  const sb = getSupabase();
  if (!sb) return;

  await sb
    .from('pending_registrations')
    .delete()
    .eq('email', email.toLowerCase())
    .eq('type', type);
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
  const sb = getSupabase();
  if (!sb) return;

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
}

export async function supabaseVerifyOtp(
  email: string,
  purpose: string,
  rawCode: string
): Promise<{ valid: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { valid: false, error: 'Database uninitialized' };

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
  excelFileUrl?: string;
  pdfUrl?: string;
  analysisJson: any;
  createdBy?: string;
}) {
  const sb = getSupabase();
  if (!sb) return;

  const { error: recordError } = await sb.from('analysis_records').upsert([
    {
      id: data.id,
      college_id: data.collegeId,
      department_id: data.departmentId,
      semester: data.semester,
      academic_year: data.academicYear,
      exam_cycle: data.examCycle,
      excel_file_url: data.excelFileUrl || null,
      pdf_url: data.pdfUrl || null,
      analysis_json: data.analysisJson,
      created_by: data.createdBy || 'system',
    },
  ]);

  if (recordError) {
    console.error('[SUPABASE ERROR] saveAnalysisRecord:', recordError);
    return;
  }

  // Save individual subject results
  const subjectSummaries = data.analysisJson?.semesterSummary?.subjectSummaries || [];
  if (Array.isArray(subjectSummaries) && subjectSummaries.length > 0) {
    // Clear old subject results for this analysis
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
      console.warn('[SUPABASE WARNING] subject_results insert:', subjError);
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
}

export async function supabaseGetAnalysisRecord(id: string, collegeId?: string, departmentId?: string) {
  const sb = getSupabase();
  if (!sb) return null;

  let query = sb.from('analysis_records').select('*').eq('id', id);
  if (collegeId) query = query.eq('college_id', collegeId);
  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    collegeId: data.college_id,
    departmentId: data.department_id,
    semester: data.semester,
    academicYear: data.academic_year,
    examCycle: data.exam_cycle,
    excelFileUrl: data.excel_file_url,
    pdfUrl: data.pdf_url,
    analysisJson: data.analysis_json,
    createdAt: data.created_at,
  };
}

export async function supabaseListAnalysisRecords(filters: {
  collegeId?: string;
  departmentId?: string;
  semester?: string;
  academic_year?: string;
  exam_cycle?: string;
  search?: string;
}) {
  const sb = getSupabase();
  if (!sb) return null;

  let query = sb
    .from('analysis_records')
    .select('id, college_id, department_id, semester, academic_year, exam_cycle, excel_file_url, pdf_url, created_at, analysis_json')
    .order('created_at', { ascending: false });

  if (filters.collegeId) query = query.eq('college_id', filters.collegeId);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.semester) query = query.eq('semester', filters.semester);
  if (filters.academic_year) query = query.eq('academic_year', filters.academic_year);
  if (filters.exam_cycle) query = query.eq('exam_cycle', filters.exam_cycle);

  const { data, error } = await query;
  if (error || !data) {
    console.error('[SUPABASE ERROR] listAnalysisRecords:', error);
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
      scheme: row.analysis_json?.config?.semesterDetails?.scheme || '2022',
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
}

export async function supabaseDeleteAnalysisRecord(id: string, collegeId?: string, departmentId?: string) {
  const sb = getSupabase();
  if (!sb) return false;

  let query = sb.from('analysis_records').delete().eq('id', id);
  if (collegeId) query = query.eq('college_id', collegeId);
  if (departmentId) query = query.eq('department_id', departmentId);

  const { error } = await query;
  if (error) {
    console.error('[SUPABASE ERROR] deleteAnalysisRecord:', error);
    return false;
  }
  return true;
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
  } catch (err) {
    console.warn('[SUPABASE] Could not write audit log:', err);
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
      console.warn('[SUPABASE STORAGE] Logo upload failed:', error);
      return null;
    }

    const { data: publicData } = sb.storage.from('logos').getPublicUrl(uniqueKey);
    return publicData?.publicUrl || null;
  } catch (err) {
    console.error('[SUPABASE STORAGE] Error uploading logo:', err);
    return null;
  }
}

export async function supabaseUploadAnalysisFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
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
      console.warn('[SUPABASE STORAGE] Analysis file upload failed:', error);
      return null;
    }

    return uniqueKey;
  } catch (err) {
    console.error('[SUPABASE STORAGE] Error uploading analysis file:', err);
    return null;
  }
}

export async function supabaseGetSignedAnalysisUrl(storageKey: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.storage
      .from('analysis-files')
      .createSignedUrl(storageKey, 3600); // 1 hour expiration

    if (error || !data) return null;
    return data.signedUrl;
  } catch (err) {
    console.error('[SUPABASE STORAGE] Error creating signed URL:', err);
    return null;
  }
}

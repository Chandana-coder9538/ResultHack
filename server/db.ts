import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import { parseExcelBuffer, RawParsedRow } from './parser.js';
import {
  aggregateSemesterData,
  DEFAULT_GRADING_BANDS,
  DEFAULT_SUBJECT_CONFIG,
} from './engine.js';
import { AnalysisPayload, AnalysisConfig, SemesterDetails, GradingBandConfig, SubjectConfig } from '../src/types/analyzer.js';
import { encryptData, decryptData, encryptBuffer, decryptBuffer } from './security.js';

export interface CollegeRecord {
  id: string;
  name: string;
  universityName: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
  failedLoginAttempts: number;
  lockoutUntil?: string | null;
}

export interface CollegeItem {
  id: string;
  name: string;
  universityName: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  email: string;
  emailVerified: boolean;
  departmentsCount?: number;
  createdAt: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
}

export interface DepartmentRecord {
  id: string;
  collegeId: string;
  name: string;
  code?: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
  failedLoginAttempts: number;
  lockoutUntil?: string | null;
}

export interface DepartmentItem {
  id: string;
  collegeId: string;
  name: string;
  code?: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
}

export type DbOtpPurpose =
  | 'college_register'
  | 'dept_register'
  | 'reset'
  | 'dept_reset'
  | 'college_delete'
  | 'dept_delete';

export interface StoredOtpRecord {
  id: string;
  email: string;
  codeHash: string;
  purpose: DbOtpPurpose;
  targetId?: string;
  attempts: number;
  dataJson?: string;
  expiresAt: string;
  resendAvailableAt: string;
  used: boolean;
  createdAt: string;
}

export interface StoredSessionRecord {
  uploadId: string;
  fileName: string;
  uploadedAt: string;
  totalStudents: number;
  totalSubjects: number;
  overallPassPercentage: number;
  cohortMeanPercentage: number;
  rawRows: RawParsedRow[];
  parsedWarnings: any[];
  config: AnalysisConfig;
  latestPayload: AnalysisPayload;
  createdAt: string;
  updatedAt: string;
  fileHash?: string;
  collegeId?: string;
  departmentId?: string;
}

export interface StoredUploadRecord {
  id: string;
  semester?: string;
  academicYear?: string;
  examCycle?: string;
  scheme?: string;
  department?: string;
  uploadedAt?: string;
  originalFilename?: string;
  excelBlob?: string; // AES-256-GCM encrypted base64 string
  excelBuffer?: Buffer; // Decrypted raw buffer in-memory
  analysisResultId?: string;
  uploadId?: string;
  createdAt?: string;
  fileHash?: string;
  collegeId?: string;
  departmentId?: string;
}

export interface UploadHistoryItem {
  id: string;
  uploadId: string;
  analysisResultId: string;
  semester: string;
  academicYear: string;
  examCycle: string;
  scheme?: string;
  department: string;
  uploadedAt: string;
  originalFilename: string;
  fileName: string;
  totalStudents: number;
  totalSubjects: number;
  overallPassPercentage: number;
  cohortMeanPercentage: number;
  hasExcelBlob: boolean;
  createdAt: string;
  updatedAt: string;
  collegeId?: string;
  departmentId?: string;
}

export interface AnalysisSummaryItem {
  uploadId: string;
  fileName: string;
  uploadedAt: string;
  totalStudents: number;
  totalSubjects: number;
  overallPassPercentage: number;
  cohortMeanPercentage: number;
  createdAt: string;
  updatedAt: string;
  collegeId?: string;
  departmentId?: string;
}

export interface HistoryFilterParams {
  semester?: string;
  academic_year?: string;
  academicYear?: string;
  exam_cycle?: string;
  examCycle?: string;
  scheme?: string;
  department?: string;
  search?: string;
  college_id?: string;
  collegeId?: string;
  department_id?: string;
  departmentId?: string;
}

export interface DuplicateCheckParams {
  fileHash?: string;
  fileName?: string;
  rawRows?: RawParsedRow[];
  semesterDetails?: SemesterDetails;
  gradingBands?: GradingBandConfig;
  collegeId?: string;
  departmentId?: string;
}

export const DEFAULT_COLLEGE_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="#1e3a8a"/>
  <circle cx="50" cy="50" r="38" stroke="#60a5fa" stroke-width="3" fill="#0f172a"/>
  <path d="M50 24L74 36L50 48L26 36L50 24Z" fill="#38bdf8"/>
  <path d="M34 44V58C34 66 50 72 50 72C50 72 66 66 66 58V44L50 52L34 44Z" fill="#2563eb" stroke="#93c5fd" stroke-width="2"/>
  <circle cx="50" cy="62" r="3" fill="#f8fafc"/>
</svg>
`)}`;

export const DEFAULT_UNIVERSITY_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="#701a75"/>
  <circle cx="50" cy="50" r="38" stroke="#f472b6" stroke-width="3" fill="#3b0764"/>
  <path d="M50 20L58 38H78L62 50L68 68L50 56L32 68L38 50L22 38H42L50 20Z" fill="#fbbf24"/>
  <circle cx="50" cy="50" r="10" fill="#4a044e" stroke="#fde047" stroke-width="2"/>
</svg>
`)}`;

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'marks_analyzer.sqlite');

/**
 * Initialize SQLite database engine with file persistence and migration
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed to load existing SQLite database, creating new one:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables schema
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS colleges (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      university_name TEXT NOT NULL,
      college_logo_url TEXT,
      university_logo_url TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_colleges_email ON colleges(email);
    CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(name);

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      college_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until TEXT DEFAULT NULL,
      UNIQUE(college_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_departments_college_id ON departments(college_id);
    CREATE INDEX IF NOT EXISTS idx_departments_email ON departments(email);

    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      target_id TEXT,
      attempts INTEGER DEFAULT 0,
      data_json TEXT,
      expires_at TEXT NOT NULL,
      resend_available_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose);

    CREATE TABLE IF NOT EXISTS pending_registrations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_email ON pending_registrations(email);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_id TEXT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      upload_id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      total_students INTEGER NOT NULL,
      total_subjects INTEGER NOT NULL,
      overall_pass_percentage REAL NOT NULL,
      cohort_mean_percentage REAL NOT NULL,
      raw_rows_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      semester TEXT,
      academic_year TEXT,
      exam_cycle TEXT,
      scheme TEXT,
      department TEXT,
      uploaded_at TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      excel_blob TEXT NOT NULL,
      analysis_result_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_uploads_analysis_id ON uploads(analysis_result_id);
  `);

  // Ensure scheme, file_hash, college_id, and department_id columns exist on tables
  const addColumnSafe = (table: string, column: string, type: string) => {
    try {
      dbInstance!.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    } catch {
      // Column already exists
    }
  };

  addColumnSafe('uploads', 'scheme', 'TEXT');
  addColumnSafe('uploads', 'file_hash', 'TEXT');
  addColumnSafe('uploads', 'college_id', 'TEXT');
  addColumnSafe('uploads', 'department_id', 'TEXT');

  addColumnSafe('analyses', 'file_hash', 'TEXT');
  addColumnSafe('analyses', 'college_id', 'TEXT');
  addColumnSafe('analyses', 'department_id', 'TEXT');

  addColumnSafe('otp_codes', 'target_id', 'TEXT');
  addColumnSafe('otp_codes', 'attempts', 'INTEGER DEFAULT 0');

  // Schema indexes
  try {
    dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploads_tenant ON uploads(college_id, department_id);`);
    dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_analyses_tenant ON analyses(college_id, department_id);`);
    dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploads_file_hash ON uploads(file_hash);`);
    dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_analyses_file_hash ON analyses(file_hash);`);
  } catch {}

  persistDatabase();
  return dbInstance;
}

/**
 * Persist in-memory SQLite database to physical disk file
 */
export function persistDatabase() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Error persisting SQLite database to disk:', err);
  }
}

/**
 * Key-Value Application Settings (e.g. SMTP config, system settings)
 */
export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1');
  stmt.bind([key.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return row.value ? String(row.value) : null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  stmt.run([key.trim(), value, now]);
  stmt.free();
  persistDatabase();
}

// ==========================================
// COLLEGE MANAGEMENT FUNCTIONS
// ==========================================

export async function listColleges(search?: string): Promise<CollegeItem[]> {
  const db = await getDatabase();
  let query = `
    SELECT 
      c.id, c.name, c.university_name, c.college_logo_url, c.university_logo_url,
      c.email, c.email_verified, c.created_at, c.failed_login_attempts, c.lockout_until,
      COUNT(d.id) AS departments_count
    FROM colleges c
    LEFT JOIN departments d ON c.id = d.college_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (search && search.trim()) {
    query += ` AND (LOWER(c.name) LIKE LOWER(?) OR LOWER(c.university_name) LIKE LOWER(?) OR LOWER(c.email) LIKE LOWER(?))`;
    const s = `%${search.trim()}%`;
    params.push(s, s, s);
  }
  query += ` GROUP BY c.id ORDER BY c.created_at ASC`;

  const stmt = db.prepare(query);
  if (params.length > 0) stmt.bind(params);

  const results: CollegeItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      name: row.name,
      universityName: row.university_name,
      collegeLogoUrl: row.college_logo_url || DEFAULT_COLLEGE_LOGO_SVG,
      universityLogoUrl: row.university_logo_url || DEFAULT_UNIVERSITY_LOGO_SVG,
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      departmentsCount: Number(row.departments_count) || 0,
      createdAt: row.created_at,
      failedLoginAttempts: Number(row.failed_login_attempts) || 0,
      lockoutUntil: row.lockout_until || null,
    });
  }
  stmt.free();
  return results;
}

export async function getCollegeById(id: string): Promise<CollegeRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM colleges WHERE id = ? LIMIT 1');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    name: row.name,
    universityName: row.university_name,
    collegeLogoUrl: row.college_logo_url || DEFAULT_COLLEGE_LOGO_SVG,
    universityLogoUrl: row.university_logo_url || DEFAULT_UNIVERSITY_LOGO_SVG,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function getCollegeByEmail(email: string): Promise<CollegeRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM colleges WHERE LOWER(email) = LOWER(?) LIMIT 1');
  stmt.bind([email.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    name: row.name,
    universityName: row.university_name,
    collegeLogoUrl: row.college_logo_url || DEFAULT_COLLEGE_LOGO_SVG,
    universityLogoUrl: row.university_logo_url || DEFAULT_UNIVERSITY_LOGO_SVG,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function getCollegeByName(name: string): Promise<CollegeRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM colleges WHERE LOWER(name) = LOWER(?) LIMIT 1');
  stmt.bind([name.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    name: row.name,
    universityName: row.university_name,
    collegeLogoUrl: row.college_logo_url || DEFAULT_COLLEGE_LOGO_SVG,
    universityLogoUrl: row.university_logo_url || DEFAULT_UNIVERSITY_LOGO_SVG,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function createCollege(data: {
  name: string;
  universityName: string;
  collegeLogoUrl?: string;
  universityLogoUrl?: string;
  email: string;
  passwordHash: string;
  emailVerified?: boolean;
}): Promise<CollegeRecord> {
  const cleanName = data.name.trim();
  const cleanEmail = data.email.trim().toLowerCase();

  // Enforce duplicate prevention
  const existingName = await getCollegeByName(cleanName);
  if (existingName) {
    throw new Error(`College "${cleanName}" is already registered. Please login or select it.`);
  }
  const existingEmail = await getCollegeByEmail(cleanEmail);
  if (existingEmail) {
    throw new Error(`A college with email "${cleanEmail}" already exists.`);
  }
  const existingDept = await getDepartmentByEmail(cleanEmail);
  if (existingDept) {
    throw new Error(`Email "${cleanEmail}" is already registered as a department email.`);
  }

  const db = await getDatabase();
  const id = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO colleges (
      id, name, university_name, college_logo_url, university_logo_url,
      email, password_hash, email_verified, created_at, failed_login_attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    cleanName,
    data.universityName.trim(),
    data.collegeLogoUrl || DEFAULT_COLLEGE_LOGO_SVG,
    data.universityLogoUrl || DEFAULT_UNIVERSITY_LOGO_SVG,
    cleanEmail,
    data.passwordHash,
    data.emailVerified ? 1 : 0,
    now,
    0,
  ]);
  stmt.free();

  // Do not insert any default department - college begins clean with 0 departments until explicitly registered
  persistDatabase();

  return {
    id,
    name: cleanName,
    universityName: data.universityName.trim(),
    collegeLogoUrl: data.collegeLogoUrl || DEFAULT_COLLEGE_LOGO_SVG,
    universityLogoUrl: data.universityLogoUrl || DEFAULT_UNIVERSITY_LOGO_SVG,
    email: cleanEmail,
    passwordHash: data.passwordHash,
    emailVerified: Boolean(data.emailVerified),
    createdAt: now,
    failedLoginAttempts: 0,
    lockoutUntil: null,
  };
}

export async function updateCollegePassword(id: string, passwordHash: string): Promise<boolean> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE colleges SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?');
  stmt.run([passwordHash, id]);
  stmt.free();
  persistDatabase();
  return true;
}

export async function updateCollegeLockout(id: string, failedAttempts: number, lockoutUntil: string | null): Promise<void> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE colleges SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?');
  stmt.run([failedAttempts, lockoutUntil, id]);
  stmt.free();
  persistDatabase();
}

export async function resetCollegeFailedAttempts(id: string): Promise<void> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE colleges SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persistDatabase();
}

// ==========================================
// DEPARTMENT MANAGEMENT FUNCTIONS
// ==========================================

export async function listDepartments(collegeId: string): Promise<DepartmentItem[]> {
  const db = await getDatabase();
  const stmt = db.prepare(`
    SELECT id, college_id, name, code, email, email_verified, created_at, failed_login_attempts, lockout_until
    FROM departments
    WHERE college_id = ?
    ORDER BY created_at ASC
  `);
  stmt.bind([collegeId]);
  const list: DepartmentItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    list.push({
      id: row.id,
      collegeId: row.college_id,
      name: row.name,
      code: row.code || '',
      email: row.email,
      emailVerified: Boolean(row.email_verified),
      createdAt: row.created_at,
      failedLoginAttempts: Number(row.failed_login_attempts) || 0,
      lockoutUntil: row.lockout_until || null,
    });
  }
  stmt.free();
  return list;
}

export async function getDepartmentById(id: string): Promise<DepartmentRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM departments WHERE id = ? LIMIT 1');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    collegeId: row.college_id,
    name: row.name,
    code: row.code || '',
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function getDepartmentByEmail(email: string): Promise<DepartmentRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM departments WHERE LOWER(email) = LOWER(?) LIMIT 1');
  stmt.bind([email.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    collegeId: row.college_id,
    name: row.name,
    code: row.code || '',
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function getDepartmentByName(collegeId: string, name: string): Promise<DepartmentRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM departments WHERE college_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1');
  stmt.bind([collegeId, name.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    collegeId: row.college_id,
    name: row.name,
    code: row.code || '',
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function getDepartmentByCode(collegeId: string, code: string): Promise<DepartmentRecord | null> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT * FROM departments WHERE college_id = ? AND LOWER(TRIM(code)) = LOWER(TRIM(?)) LIMIT 1');
  stmt.bind([collegeId, code.trim()]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    collegeId: row.college_id,
    name: row.name,
    code: row.code || '',
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    failedLoginAttempts: Number(row.failed_login_attempts) || 0,
    lockoutUntil: row.lockout_until || null,
  };
}

export async function createDepartment(data: {
  collegeId: string;
  name: string;
  code?: string;
  email: string;
  passwordHash: string;
  emailVerified?: boolean;
}): Promise<DepartmentRecord> {
  const cleanName = data.name.trim();
  const cleanCode = data.code ? data.code.trim().toUpperCase() : '';
  const cleanEmail = data.email.trim().toLowerCase();

  // Enforce duplicate department prevention
  const existingName = await getDepartmentByName(data.collegeId, cleanName);
  if (existingName) {
    throw new Error(`A department named "${cleanName}" already exists in this college.`);
  }
  if (cleanCode) {
    const existingCode = await getDepartmentByCode(data.collegeId, cleanCode);
    if (existingCode) {
      throw new Error(`A department with code "${cleanCode}" already exists in this college.`);
    }
  }
  const existingEmail = await getDepartmentByEmail(cleanEmail);
  if (existingEmail) {
    throw new Error(`Department email "${cleanEmail}" is already registered.`);
  }
  const existingCollege = await getCollegeByEmail(cleanEmail);
  if (existingCollege) {
    throw new Error(`Email "${cleanEmail}" is registered as a college email. Department must use its own email.`);
  }

  const db = await getDatabase();
  const id = `dept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO departments (
      id, college_id, name, code, email, password_hash, email_verified, created_at, failed_login_attempts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    data.collegeId,
    cleanName,
    cleanCode,
    cleanEmail,
    data.passwordHash,
    data.emailVerified ? 1 : 0,
    now,
    0,
  ]);
  stmt.free();
  persistDatabase();

  return {
    id,
    collegeId: data.collegeId,
    name: cleanName,
    code: cleanCode,
    email: cleanEmail,
    passwordHash: data.passwordHash,
    emailVerified: Boolean(data.emailVerified),
    createdAt: now,
    failedLoginAttempts: 0,
    lockoutUntil: null,
  };
}

export async function deleteDepartment(departmentId: string): Promise<{ success: boolean; deletedDepartment: DepartmentRecord }> {
  const db = await getDatabase();
  const dept = await getDepartmentById(departmentId);
  if (!dept) {
    throw new Error('Department not found or already deleted.');
  }

  // 1. Delete all uploads belonging to this department
  const delUploadsStmt = db.prepare('DELETE FROM uploads WHERE department_id = ?');
  delUploadsStmt.run([departmentId]);
  delUploadsStmt.free();

  // 2. Delete all analyses belonging to this department
  const delAnalysesStmt = db.prepare('DELETE FROM analyses WHERE department_id = ?');
  delAnalysesStmt.run([departmentId]);
  delAnalysesStmt.free();

  // 3. Delete department record
  const delDeptStmt = db.prepare('DELETE FROM departments WHERE id = ?');
  delDeptStmt.run([departmentId]);
  delDeptStmt.free();

  persistDatabase();
  return { success: true, deletedDepartment: dept };
}

export async function deleteCollege(collegeId: string): Promise<{ success: boolean; deletedCollege: CollegeRecord }> {
  const db = await getDatabase();
  const college = await getCollegeById(collegeId);
  if (!college) {
    throw new Error('College not found or already deleted.');
  }

  // Enforce: all departments must be deleted first before deleting the college
  const deptCountStmt = db.prepare('SELECT COUNT(*) as count FROM departments WHERE college_id = ?');
  deptCountStmt.bind([collegeId]);
  let deptCount = 0;
  if (deptCountStmt.step()) {
    deptCount = Number(deptCountStmt.getAsObject().count) || 0;
  }
  deptCountStmt.free();

  if (deptCount > 0) {
    throw new Error(
      `Cannot delete college: There are still ${deptCount} active department(s) registered under "${college.name}". All departments must be deleted first before deleting the college institution.`
    );
  }

  // 1. Delete all uploads for this college
  const delUploadsStmt = db.prepare('DELETE FROM uploads WHERE college_id = ?');
  delUploadsStmt.run([collegeId]);
  delUploadsStmt.free();

  // 2. Delete all analyses for this college
  const delAnalysesStmt = db.prepare('DELETE FROM analyses WHERE college_id = ?');
  delAnalysesStmt.run([collegeId]);
  delAnalysesStmt.free();

  // 3. Delete the college record
  const delColStmt = db.prepare('DELETE FROM colleges WHERE id = ?');
  delColStmt.run([collegeId]);
  delColStmt.free();

  persistDatabase();
  return { success: true, deletedCollege: college };
}

/**
 * Permanently purge all departments and associated analysis uploads across all colleges
 * to start completely fresh with 0 departments.
 */
export async function removeAllDepartmentsForFreshStart(): Promise<{ removedCount: number }> {
  const db = await getDatabase();
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM departments');
  let count = 0;
  if (countStmt.step()) {
    count = Number(countStmt.getAsObject().count) || 0;
  }
  countStmt.free();

  db.run('DELETE FROM departments');
  db.run('DELETE FROM uploads WHERE department_id IS NOT NULL');
  db.run('DELETE FROM analyses WHERE department_id IS NOT NULL');
  persistDatabase();
  console.log(`[Fresh Start] Successfully purged all ${count} department(s) and associated marks analyses.`);
  return { removedCount: count };
}

export async function updateDepartmentPassword(id: string, passwordHash: string): Promise<boolean> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE departments SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?');
  stmt.run([passwordHash, id]);
  stmt.free();
  persistDatabase();
  return true;
}

export async function updateDepartmentLockout(id: string, failedAttempts: number, lockoutUntil: string | null): Promise<void> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE departments SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?');
  stmt.run([failedAttempts, lockoutUntil, id]);
  stmt.free();
  persistDatabase();
}

export async function resetDepartmentFailedAttempts(id: string): Promise<void> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE departments SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persistDatabase();
}

// ==========================================
// OTP CODE STORAGE & VERIFICATION
// ==========================================

export async function saveOtpRecord(record: {
  email: string;
  codeHash: string;
  purpose: DbOtpPurpose;
  targetId?: string;
  dataJson?: string;
  expiresInSeconds?: number;
}): Promise<StoredOtpRecord> {
  const db = await getDatabase();
  const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (record.expiresInSeconds || 600) * 1000).toISOString(); // 10 minutes (or 5 minutes for delete)
  const resendAvailableAt = new Date(now.getTime() + 60 * 1000).toISOString(); // 60 seconds
  const nowIso = now.toISOString();

  // Invalidate any previously unused OTPs for the same email and purpose
  const invalStmt = db.prepare('UPDATE otp_codes SET used = 1 WHERE LOWER(email) = LOWER(?) AND purpose = ? AND used = 0');
  invalStmt.run([record.email.trim(), record.purpose]);
  invalStmt.free();

  const stmt = db.prepare(`
    INSERT INTO otp_codes (
      id, email, code_hash, purpose, target_id, attempts, data_json, expires_at, resend_available_at, used, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    id,
    record.email.trim().toLowerCase(),
    record.codeHash,
    record.purpose,
    record.targetId || null,
    0,
    record.dataJson || null,
    expiresAt,
    resendAvailableAt,
    0,
    nowIso,
  ]);
  stmt.free();
  persistDatabase();

  return {
    id,
    email: record.email.trim().toLowerCase(),
    codeHash: record.codeHash,
    purpose: record.purpose,
    targetId: record.targetId,
    attempts: 0,
    dataJson: record.dataJson,
    expiresAt,
    resendAvailableAt,
    used: false,
    createdAt: nowIso,
  };
}

export async function getValidOtpRecord(
  email: string,
  purpose: DbOtpPurpose,
  targetId?: string
): Promise<StoredOtpRecord | null> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  let query = `
    SELECT * FROM otp_codes 
    WHERE LOWER(email) = LOWER(?) AND purpose = ? AND used = 0 AND expires_at > ?
  `;
  const params: any[] = [email.trim(), purpose, nowIso];

  if (targetId) {
    query += ' AND target_id = ?';
    params.push(targetId);
  }

  query += ' ORDER BY created_at DESC LIMIT 1';

  const stmt = db.prepare(query);
  stmt.bind(params);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    email: row.email,
    codeHash: row.code_hash,
    purpose: row.purpose,
    targetId: row.target_id || undefined,
    attempts: Number(row.attempts) || 0,
    dataJson: row.data_json || undefined,
    expiresAt: row.expires_at,
    resendAvailableAt: row.resend_available_at,
    used: Boolean(row.used),
    createdAt: row.created_at,
  };
}

export async function incrementOtpAttempts(id: string): Promise<{ attempts: number; maxAttemptsReached: boolean }> {
  const db = await getDatabase();
  const selectStmt = db.prepare('SELECT attempts FROM otp_codes WHERE id = ?');
  selectStmt.bind([id]);
  let currentAttempts = 0;
  if (selectStmt.step()) {
    currentAttempts = Number(selectStmt.getAsObject().attempts) || 0;
  }
  selectStmt.free();

  const newAttempts = currentAttempts + 1;
  const isLocked = newAttempts >= 5;

  const updateStmt = db.prepare('UPDATE otp_codes SET attempts = ?, used = ? WHERE id = ?');
  updateStmt.run([newAttempts, isLocked ? 1 : 0, id]);
  updateStmt.free();
  persistDatabase();

  return { attempts: newAttempts, maxAttemptsReached: isLocked };
}

export async function markOtpUsed(id: string): Promise<void> {
  const db = await getDatabase();
  const stmt = db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?');
  stmt.run([id]);
  stmt.free();
  persistDatabase();
}

export async function canResendOtp(
  email: string,
  purpose: DbOtpPurpose
): Promise<{ canResend: boolean; waitSeconds: number }> {
  const db = await getDatabase();
  const stmt = db.prepare(`
    SELECT resend_available_at FROM otp_codes 
    WHERE LOWER(email) = LOWER(?) AND purpose = ? AND used = 0 
    ORDER BY created_at DESC LIMIT 1
  `);
  stmt.bind([email.trim(), purpose]);
  if (!stmt.step()) {
    stmt.free();
    return { canResend: true, waitSeconds: 0 };
  }
  const row = stmt.getAsObject() as any;
  stmt.free();

  const resendAvailableAt = new Date(row.resend_available_at).getTime();
  const now = Date.now();
  if (now >= resendAvailableAt) {
    return { canResend: true, waitSeconds: 0 };
  }
  const waitSeconds = Math.ceil((resendAvailableAt - now) / 1000);
  return { canResend: false, waitSeconds };
}

export async function savePendingRegistration(
  type: 'college' | 'department',
  email: string,
  payload: any
): Promise<string> {
  const db = await getDatabase();
  const id = `pend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const cleanEmail = email.trim().toLowerCase();

  // A previously unverified pending registration for the same email is overwritten, never duplicated
  const delStmt = db.prepare('DELETE FROM pending_registrations WHERE LOWER(email) = ? AND type = ?');
  delStmt.run([cleanEmail, type]);
  delStmt.free();

  const stmt = db.prepare(`
    INSERT INTO pending_registrations (id, type, payload_json, email, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run([id, type, JSON.stringify(payload), cleanEmail, now]);
  stmt.free();
  persistDatabase();

  return id;
}

export async function getPendingRegistration(
  email: string,
  type: 'college' | 'department'
): Promise<{ id: string; type: string; payload: any; email: string; createdAt: string } | null> {
  const db = await getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM pending_registrations
    WHERE LOWER(email) = ? AND type = ?
    ORDER BY created_at DESC LIMIT 1
  `);
  stmt.bind([email.trim().toLowerCase(), type]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as any;
  stmt.free();
  return {
    id: row.id,
    type: row.type,
    email: row.email,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  };
}

export async function deletePendingRegistration(email: string, type?: string): Promise<void> {
  const db = await getDatabase();
  if (type) {
    const stmt = db.prepare('DELETE FROM pending_registrations WHERE LOWER(email) = ? AND type = ?');
    stmt.run([email.trim().toLowerCase(), type]);
    stmt.free();
  } else {
    const stmt = db.prepare('DELETE FROM pending_registrations WHERE LOWER(email) = ?');
    stmt.run([email.trim().toLowerCase()]);
    stmt.free();
  }
  persistDatabase();
}

export async function logAuditAction(params: {
  action: string;
  actorId?: string;
  targetType: string;
  targetId: string;
  ip?: string;
}): Promise<void> {
  try {
    const db = await getDatabase();
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, action, actor_id, target_type, target_id, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      params.action,
      params.actorId || 'system',
      params.targetType,
      params.targetId,
      params.ip || 'unknown',
      now,
    ]);
    stmt.free();
    persistDatabase();
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// ==========================================
// ANALYSIS SESSIONS & UPLOADS
// ==========================================

/**
 * Save or update analysis session in SQLite database with tenant isolation
 */
export async function saveAnalysisSession(
  session: StoredSessionRecord,
  fileHash?: string,
  collegeId?: string,
  departmentId?: string
): Promise<void> {
  const db = await getDatabase();

  const resolvedCollegeId = collegeId || session.collegeId || null;
  const resolvedDeptId = departmentId || session.departmentId || null;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analyses (
      upload_id,
      file_name,
      uploaded_at,
      total_students,
      total_subjects,
      overall_pass_percentage,
      cohort_mean_percentage,
      raw_rows_json,
      warnings_json,
      config_json,
      payload_json,
      created_at,
      updated_at,
      file_hash,
      college_id,
      department_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    session.uploadId,
    session.fileName,
    session.uploadedAt,
    session.totalStudents,
    session.totalSubjects,
    session.overallPassPercentage,
    session.cohortMeanPercentage,
    encryptData(JSON.stringify(session.rawRows)),
    encryptData(JSON.stringify(session.parsedWarnings)),
    encryptData(JSON.stringify(session.config)),
    encryptData(JSON.stringify(session.latestPayload)),
    session.createdAt,
    session.updatedAt,
    fileHash || session.fileHash || null,
    resolvedCollegeId,
    resolvedDeptId,
  ]);

  stmt.free();
  persistDatabase();
}

/**
 * Retrieve a single analysis session by uploadId from SQLite with tenant scoping
 */
export async function getAnalysisSession(
  uploadId: string,
  collegeId?: string,
  departmentId?: string
): Promise<StoredSessionRecord | null> {
  const db = await getDatabase();
  const cleanId = String(uploadId || '').trim();
  if (!cleanId) return null;

  let query = 'SELECT * FROM analyses WHERE upload_id = ?';
  const params: any[] = [cleanId];
  if (collegeId) {
    query += ' AND college_id = ?';
    params.push(collegeId);
  }
  if (departmentId) {
    query += ' AND department_id = ?';
    params.push(departmentId);
  }

  const stmt = db.prepare(query);
  stmt.bind(params);

  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();

    try {
      const rawRows = JSON.parse(decryptData(row.raw_rows_json));
      const parsedWarnings = JSON.parse(decryptData(row.warnings_json));
      const config = JSON.parse(decryptData(row.config_json));
      let latestPayload: AnalysisPayload;
      try {
        latestPayload = JSON.parse(decryptData(row.payload_json));
      } catch {
        latestPayload = aggregateSemesterData(
          rawRows,
          config?.gradingBands || DEFAULT_GRADING_BANDS,
          config?.subjectsConfig || {},
          parsedWarnings || [],
          row.upload_id,
          row.file_name,
          config?.semesterDetails
        );
      }

      return {
        uploadId: row.upload_id,
        fileName: row.file_name,
        uploadedAt: row.uploaded_at,
        totalStudents: row.total_students,
        totalSubjects: row.total_subjects,
        overallPassPercentage: row.overall_pass_percentage,
        cohortMeanPercentage: row.cohort_mean_percentage,
        rawRows,
        parsedWarnings,
        config,
        latestPayload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        fileHash: row.file_hash || undefined,
        collegeId: row.college_id,
        departmentId: row.department_id,
      };
    } catch (err) {
      console.error('Error parsing SQLite record for uploadId:', cleanId, err);
    }
  } else {
    stmt.free();
  }

  // Fallback: check uploads table
  let upQuery = 'SELECT * FROM uploads WHERE (id = ? OR analysis_result_id = ?)';
  const upParams: any[] = [cleanId, cleanId];
  if (collegeId) {
    upQuery += ' AND college_id = ?';
    upParams.push(collegeId);
  }
  if (departmentId) {
    upQuery += ' AND department_id = ?';
    upParams.push(departmentId);
  }
  upQuery += ' LIMIT 1';

  const upStmt = db.prepare(upQuery);
  upStmt.bind(upParams);

  if (upStmt.step()) {
    const upRow = upStmt.getAsObject() as any;
    upStmt.free();

    if (upRow.analysis_result_id && upRow.analysis_result_id !== cleanId) {
      return getAnalysisSession(upRow.analysis_result_id, collegeId, departmentId);
    }

    if (upRow.excel_blob && upRow.excel_blob !== 'NO_BLOB') {
      try {
        const excelBuffer = decryptBuffer(upRow.excel_blob);
        const parsed = parseExcelBuffer(excelBuffer);
        if (parsed.validRows && parsed.validRows.length > 0) {
          const fallbackSubjectsConfig: Record<string, SubjectConfig> = {};
          parsed.detectedSubjects.forEach((subCode) => {
            fallbackSubjectsConfig[subCode] = DEFAULT_SUBJECT_CONFIG(
              subCode,
              parsed.subjectBlocks?.[subCode]?.blockType
            );
          });

          const semesterDetails: SemesterDetails = {
            semester: upRow.semester || '4th Sem',
            semType: 'Even Semester',
            examination: upRow.exam_cycle || 'June / July 2025',
            academicYear: upRow.academic_year || '2025-26',
            scheme: upRow.scheme || '2022',
            department: upRow.department || 'Academic Department',
          };

          const targetAnalysisId = upRow.analysis_result_id || upRow.id || cleanId;
          const originalFilename = upRow.original_filename || 'archived_marks.xlsx';

          const analysisPayload = aggregateSemesterData(
            parsed.validRows,
            DEFAULT_GRADING_BANDS,
            fallbackSubjectsConfig,
            parsed.warnings,
            targetAnalysisId,
            originalFilename,
            semesterDetails
          );

          const now = new Date().toISOString();
          const synthesizedRecord: StoredSessionRecord = {
            uploadId: targetAnalysisId,
            fileName: originalFilename,
            uploadedAt: upRow.uploaded_at || now,
            totalStudents: analysisPayload.semesterSummary.totalUniqueStudents,
            totalSubjects: analysisPayload.detectedSubjects.length,
            overallPassPercentage: analysisPayload.semesterSummary.overallPassPercentage,
            cohortMeanPercentage: analysisPayload.semesterSummary.averageSemesterPercentage || 0,
            rawRows: parsed.validRows,
            parsedWarnings: parsed.warnings,
            config: {
              gradingBands: DEFAULT_GRADING_BANDS,
              subjectsConfig: fallbackSubjectsConfig,
              semesterDetails,
            },
            latestPayload: analysisPayload,
            createdAt: upRow.created_at || now,
            updatedAt: now,
            fileHash: upRow.file_hash || undefined,
            collegeId: upRow.college_id,
            departmentId: upRow.department_id,
          };

          await saveAnalysisSession(synthesizedRecord, upRow.file_hash, upRow.college_id, upRow.department_id);
          return synthesizedRecord;
        }
      } catch (synthErr) {
        console.error('Failed to auto-synthesize analysis from archived Excel blob:', synthErr);
      }
    }
  } else {
    upStmt.free();
  }

  return null;
}

/**
 * List all saved analyses from SQLite sorted by creation date (newest first)
 */
export async function listAllAnalyses(collegeId?: string, departmentId?: string): Promise<AnalysisSummaryItem[]> {
  const db = await getDatabase();
  let query = `
    SELECT 
      upload_id, file_name, uploaded_at, total_students, total_subjects,
      overall_pass_percentage, cohort_mean_percentage, created_at, updated_at,
      college_id, department_id
    FROM analyses
    WHERE 1=1
  `;
  const params: any[] = [];
  if (collegeId) {
    query += ' AND college_id = ?';
    params.push(collegeId);
  }
  if (departmentId) {
    query += ' AND department_id = ?';
    params.push(departmentId);
  }
  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  if (params.length > 0) stmt.bind(params);

  const results: AnalysisSummaryItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      uploadId: row.upload_id,
      fileName: row.file_name,
      uploadedAt: row.uploaded_at,
      totalStudents: row.total_students,
      totalSubjects: row.total_subjects,
      overallPassPercentage: row.overall_pass_percentage,
      cohortMeanPercentage: row.cohort_mean_percentage,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collegeId: row.college_id,
      departmentId: row.department_id,
    });
  }
  stmt.free();
  return results;
}

/**
 * Save raw encrypted Excel upload record into uploads table with tenant scoping
 */
export async function saveUploadArchive(
  upload: StoredUploadRecord,
  fileHash?: string,
  collegeId?: string,
  departmentId?: string
): Promise<void> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();
  let encryptedBlob = upload.excelBlob;
  if (!encryptedBlob && upload.excelBuffer) {
    encryptedBlob = encryptBuffer(upload.excelBuffer);
  }

  const resolvedHash = fileHash || upload.fileHash || (upload.excelBuffer ? crypto.createHash('sha256').update(upload.excelBuffer).digest('hex') : null);
  const resolvedCollegeId = collegeId || upload.collegeId || null;
  const resolvedDeptId = departmentId || upload.departmentId || null;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO uploads (
      id,
      semester,
      academic_year,
      exam_cycle,
      scheme,
      department,
      uploaded_at,
      original_filename,
      excel_blob,
      analysis_result_id,
      created_at,
      file_hash,
      college_id,
      department_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    upload.id || upload.analysisResultId || `up_${Date.now()}`,
    upload.semester ?? '4th Sem',
    upload.academicYear ?? '2025-26',
    upload.examCycle ?? 'June / July 2025',
    upload.scheme ?? '2022',
    upload.department ?? 'Academic Department',
    upload.uploadedAt ?? nowIso,
    upload.originalFilename ?? 'marks.xlsx',
    encryptedBlob ?? null,
    upload.analysisResultId ?? upload.id ?? null,
    upload.createdAt ?? nowIso,
    resolvedHash,
    resolvedCollegeId,
    resolvedDeptId,
  ]);

  stmt.free();
  persistDatabase();
}

/**
 * Retrieve uploaded Excel archive record by upload ID or analysis result ID with tenant check
 */
export async function getUploadById(
  idOrAnalysisId: string,
  collegeId?: string,
  departmentId?: string
): Promise<StoredUploadRecord | null> {
  const db = await getDatabase();
  let query = 'SELECT * FROM uploads WHERE (id = ? OR analysis_result_id = ?)';
  const params: any[] = [idOrAnalysisId, idOrAnalysisId];
  if (collegeId) {
    query += ' AND college_id = ?';
    params.push(collegeId);
  }
  if (departmentId) {
    query += ' AND department_id = ?';
    params.push(departmentId);
  }
  query += ' LIMIT 1';

  const stmt = db.prepare(query);
  stmt.bind(params);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as any;
  stmt.free();

  let excelBuffer: Buffer | undefined;
  if (row.excel_blob && typeof row.excel_blob === 'string') {
    try {
      excelBuffer = decryptBuffer(row.excel_blob);
    } catch (decErr) {
      console.error('Failed to decrypt archived excel blob:', decErr);
    }
  }

  return {
    id: row.id,
    semester: row.semester || '4th Sem',
    academicYear: row.academic_year || '2025-26',
    examCycle: row.exam_cycle || 'June / July 2025',
    scheme: row.scheme || '2022',
    department: row.department || 'Academic Department',
    uploadedAt: row.uploaded_at,
    originalFilename: row.original_filename,
    excelBlob: row.excel_blob,
    excelBuffer,
    analysisResultId: row.analysis_result_id,
    createdAt: row.created_at,
    collegeId: row.college_id,
    departmentId: row.department_id,
  };
}

/**
 * Filterable and searchable history of all uploads with metadata scoped by department/college
 */
export async function listUploadHistory(filters?: HistoryFilterParams): Promise<UploadHistoryItem[]> {
  const db = await getDatabase();

  let query = `
    SELECT 
      u.id,
      u.semester,
      u.academic_year,
      u.exam_cycle,
      u.scheme,
      u.department,
      u.uploaded_at,
      u.original_filename,
      u.analysis_result_id,
      u.created_at,
      u.college_id,
      u.department_id,
      COALESCE(a.total_students, 0) AS total_students,
      COALESCE(a.total_subjects, 0) AS total_subjects,
      COALESCE(a.overall_pass_percentage, 0.0) AS overall_pass_percentage,
      COALESCE(a.cohort_mean_percentage, 0.0) AS cohort_mean_percentage,
      COALESCE(a.updated_at, u.created_at) AS updated_at,
      (CASE WHEN u.excel_blob IS NOT NULL AND length(u.excel_blob) > 20 THEN 1 ELSE 0 END) AS has_excel_blob
    FROM uploads u
    LEFT JOIN analyses a ON u.analysis_result_id = a.upload_id
    WHERE 1=1
  `;

  const bindParams: any[] = [];

  const collegeFilter = (filters?.college_id || filters?.collegeId)?.trim();
  if (collegeFilter) {
    query += ' AND u.college_id = ?';
    bindParams.push(collegeFilter);
  }

  const deptIdFilter = (filters?.department_id || filters?.departmentId)?.trim();
  if (deptIdFilter) {
    query += ' AND u.department_id = ?';
    bindParams.push(deptIdFilter);
  }

  const semesterFilter = filters?.semester?.trim();
  if (semesterFilter && semesterFilter !== 'all') {
    query += ' AND LOWER(u.semester) LIKE LOWER(?)';
    bindParams.push(`%${semesterFilter}%`);
  }

  const yearFilter = (filters?.academic_year || filters?.academicYear)?.trim();
  if (yearFilter && yearFilter !== 'all') {
    query += ' AND LOWER(u.academic_year) LIKE LOWER(?)';
    bindParams.push(`%${yearFilter}%`);
  }

  const cycleFilter = (filters?.exam_cycle || filters?.examCycle)?.trim();
  if (cycleFilter && cycleFilter !== 'all') {
    query += ' AND LOWER(u.exam_cycle) LIKE LOWER(?)';
    bindParams.push(`%${cycleFilter}%`);
  }

  const schemeFilter = filters?.scheme?.trim();
  if (schemeFilter && schemeFilter !== 'all') {
    query += ' AND LOWER(COALESCE(u.scheme, \'2022\')) LIKE LOWER(?)';
    bindParams.push(`%${schemeFilter}%`);
  }

  const deptFilter = filters?.department?.trim();
  if (deptFilter && deptFilter !== 'all') {
    query += ' AND LOWER(u.department) LIKE LOWER(?)';
    bindParams.push(`%${deptFilter}%`);
  }

  const searchFilter = filters?.search?.trim();
  if (searchFilter) {
    query += ' AND (LOWER(u.original_filename) LIKE LOWER(?) OR LOWER(u.semester) LIKE LOWER(?) OR LOWER(u.academic_year) LIKE LOWER(?) OR LOWER(COALESCE(u.scheme, \'2022\')) LIKE LOWER(?) OR LOWER(u.department) LIKE LOWER(?))';
    const s = `%${searchFilter}%`;
    bindParams.push(s, s, s, s, s);
  }

  query += ' ORDER BY u.created_at DESC';

  const stmt = db.prepare(query);
  if (bindParams.length > 0) {
    stmt.bind(bindParams);
  }

  const results: UploadHistoryItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      uploadId: row.analysis_result_id || row.id,
      analysisResultId: row.analysis_result_id || row.id,
      semester: row.semester || '4th Sem',
      academicYear: row.academic_year || '2025-26',
      examCycle: row.exam_cycle || 'June / July 2025',
      scheme: row.scheme || '2022',
      department: row.department || 'Academic Department',
      uploadedAt: row.uploaded_at,
      originalFilename: row.original_filename,
      fileName: row.original_filename,
      totalStudents: Number(row.total_students) || 0,
      totalSubjects: Number(row.total_subjects) || 0,
      overallPassPercentage: Number(row.overall_pass_percentage) || 0,
      cohortMeanPercentage: Number(row.cohort_mean_percentage) || 0,
      hasExcelBlob: Boolean(row.has_excel_blob),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collegeId: row.college_id,
      departmentId: row.department_id,
    });
  }

  stmt.free();
  return results;
}

/**
 * Delete an analysis and its archived upload from SQLite database by uploadId (scoped)
 */
export async function deleteAnalysisSession(
  uploadId: string,
  collegeId?: string,
  departmentId?: string
): Promise<boolean> {
  const db = await getDatabase();
  const cleanId = String(uploadId || '').trim();
  if (!cleanId) return false;

  let query = 'SELECT id, analysis_result_id FROM uploads WHERE (id = ? OR analysis_result_id = ?)';
  const params: any[] = [cleanId, cleanId];
  if (collegeId) {
    query += ' AND college_id = ?';
    params.push(collegeId);
  }
  if (departmentId) {
    query += ' AND department_id = ?';
    params.push(departmentId);
  }

  const linkedUp = db.prepare(query);
  linkedUp.bind(params);
  let linkedUploadId = cleanId;
  let linkedAnalysisId = cleanId;
  let foundAny = false;

  while (linkedUp.step()) {
    foundAny = true;
    const row = linkedUp.getAsObject() as any;
    if (row.id) linkedUploadId = row.id;
    if (row.analysis_result_id) linkedAnalysisId = row.analysis_result_id;
  }
  linkedUp.free();

  let aQuery = 'SELECT upload_id FROM analyses WHERE (upload_id = ? OR upload_id = ?)';
  const aParams: any[] = [cleanId, linkedAnalysisId];
  if (collegeId) {
    aQuery += ' AND college_id = ?';
    aParams.push(collegeId);
  }
  if (departmentId) {
    aQuery += ' AND department_id = ?';
    aParams.push(departmentId);
  }

  const checkA = db.prepare(aQuery);
  checkA.bind(aParams);
  if (checkA.step()) {
    foundAny = true;
  }
  checkA.free();

  if (!foundAny) return false;

  let delUpQuery = 'DELETE FROM uploads WHERE (analysis_result_id = ? OR id = ? OR id = ?)';
  const delUpParams: any[] = [linkedAnalysisId, linkedUploadId, cleanId];
  if (collegeId) {
    delUpQuery += ' AND college_id = ?';
    delUpParams.push(collegeId);
  }
  if (departmentId) {
    delUpQuery += ' AND department_id = ?';
    delUpParams.push(departmentId);
  }
  const deleteUploadsStmt = db.prepare(delUpQuery);
  deleteUploadsStmt.run(delUpParams);
  deleteUploadsStmt.free();

  let delAnaQuery = 'DELETE FROM analyses WHERE (upload_id = ? OR upload_id = ?)';
  const delAnaParams: any[] = [linkedAnalysisId, cleanId];
  if (collegeId) {
    delAnaQuery += ' AND college_id = ?';
    delAnaParams.push(collegeId);
  }
  if (departmentId) {
    delAnaQuery += ' AND department_id = ?';
    delAnaParams.push(departmentId);
  }
  const deleteStmt = db.prepare(delAnaQuery);
  deleteStmt.run(delAnaParams);
  deleteStmt.free();

  persistDatabase();
  return true;
}

/**
 * Normalizes semester strings into standard format (e.g. '4sem', '6sem')
 */
export function normalizeSemester(sem?: string): string {
  if (!sem) return '';
  const clean = sem.trim().toLowerCase();
  if (/\b(viii|8th|8)\b/.test(clean)) return '8sem';
  if (/\b(vii|7th|7)\b/.test(clean)) return '7sem';
  if (/\b(vi|6th|6)\b/.test(clean)) return '6sem';
  if (/\b(v|5th|5)\b/.test(clean)) return '5sem';
  if (/\b(iv|4th|4)\b/.test(clean)) return '4sem';
  if (/\b(iii|3rd|3)\b/.test(clean)) return '3sem';
  if (/\b(ii|2nd|2)\b/.test(clean)) return '2sem';
  if (/\b(i|1st|1)\b/.test(clean)) return '1sem';
  const match = clean.match(/(\d+)/);
  if (match) return `${match[1]}sem`;
  return clean.replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes academic year into a standard 4-digit span (e.g. '2025-2026')
 */
export function normalizeAcademicYear(yr?: string): string {
  if (!yr) return '';
  const digits = yr.replace(/[^0-9]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (digits.length >= 2) {
    let start = digits[0];
    let end = digits[1];
    if (start.length === 2) start = '20' + start;
    if (end.length === 2) end = '20' + end;
    return `${start}-${end}`;
  }
  return yr.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes strings and compares academic semester details for equality
 */
export function areInputsMatching(
  incoming?: SemesterDetails,
  existing?: SemesterDetails
): boolean {
  if (!incoming || !existing) return true;

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const semIn = normalizeSemester(incoming.semester);
  const semEx = normalizeSemester(existing.semester);
  if (semIn && semEx && semIn !== semEx) {
    return false;
  }

  const yrIn = normalizeAcademicYear(incoming.academicYear);
  const yrEx = normalizeAcademicYear(existing.academicYear);
  if (yrIn && yrEx && yrIn !== yrEx && !yrIn.includes(yrEx) && !yrEx.includes(yrIn)) {
    return false;
  }

  const examIn = norm(incoming.examination);
  const examEx = norm(existing.examination);
  if (examIn && examEx && examIn !== examEx) {
    return false;
  }

  const scIn = norm(incoming.scheme);
  const scEx = norm(existing.scheme);
  if (scIn && scEx && scIn !== scEx) {
    return false;
  }

  return true;
}

/**
 * Searches the SQLite database to find if an identical spreadsheet and inputs were already analyzed.
 * Tenant-scoped by collegeId and departmentId.
 */
export async function findExistingAnalysis(params: DuplicateCheckParams): Promise<StoredSessionRecord | null> {
  const db = await getDatabase();
  const collegeId = params.collegeId;
  const departmentId = params.departmentId;

  // 1. Check by exact file SHA-256 hash
  if (params.fileHash) {
    let hashQuery = `
      SELECT upload_id FROM analyses WHERE file_hash = ?
    `;
    const hashParams: any[] = [params.fileHash];
    if (collegeId) {
      hashQuery += ' AND college_id = ?';
      hashParams.push(collegeId);
    }
    if (departmentId) {
      hashQuery += ' AND department_id = ?';
      hashParams.push(departmentId);
    }
    hashQuery += ' ORDER BY 1 DESC LIMIT 10';

    const hashStmt = db.prepare(hashQuery);
    hashStmt.bind(hashParams);
    const candidateIds: string[] = [];
    while (hashStmt.step()) {
      const row = hashStmt.getAsObject() as any;
      if (row.upload_id) candidateIds.push(row.upload_id);
    }
    hashStmt.free();

    for (const id of candidateIds) {
      const session = await getAnalysisSession(id, collegeId, departmentId);
      if (session && areInputsMatching(params.semesterDetails, session.config?.semesterDetails)) {
        return session;
      }
    }
  }

  // 2. Check by student cohort rows signature
  if (params.rawRows && params.rawRows.length > 0) {
    const incomingStudentCount = params.rawRows.length;
    const incomingUSNs = new Set(
      params.rawRows
        .map((r) => String(r.studentId || (r as any).usn || '').trim().toUpperCase())
        .filter((u) => u.length >= 3)
    );

    let countQuery = 'SELECT upload_id FROM analyses WHERE total_students = ?';
    const countParams: any[] = [incomingStudentCount];
    if (collegeId) {
      countQuery += ' AND college_id = ?';
      countParams.push(collegeId);
    }
    if (departmentId) {
      countQuery += ' AND department_id = ?';
      countParams.push(departmentId);
    }
    countQuery += ' ORDER BY created_at DESC LIMIT 10';

    const countStmt = db.prepare(countQuery);
    countStmt.bind(countParams);
    const candidateIds: string[] = [];
    while (countStmt.step()) {
      const row = countStmt.getAsObject() as any;
      if (row.upload_id) candidateIds.push(row.upload_id);
    }
    countStmt.free();

    for (const id of candidateIds) {
      const session = await getAnalysisSession(id, collegeId, departmentId);
      if (session && session.rawRows && session.rawRows.length === incomingStudentCount) {
        let matchCount = 0;
        for (const r of session.rawRows) {
          const u = String((r as any).studentId || (r as any).usn || '').trim().toUpperCase();
          if (incomingUSNs.has(u)) matchCount++;
        }
        if (matchCount >= incomingStudentCount * 0.9) {
          if (areInputsMatching(params.semesterDetails, session.config?.semesterDetails)) {
            return session;
          }
        }
      }
    }
  }

  // 3. Check by semester input details
  if (params.semesterDetails && (params.semesterDetails.semester || params.semesterDetails.examination)) {
    let semQuery = `
      SELECT u.id, u.analysis_result_id, u.semester, u.academic_year, u.exam_cycle, u.scheme, u.original_filename
      FROM uploads u
      WHERE 1=1
    `;
    const semParams: any[] = [];
    if (collegeId) {
      semQuery += ' AND u.college_id = ?';
      semParams.push(collegeId);
    }
    if (departmentId) {
      semQuery += ' AND u.department_id = ?';
      semParams.push(departmentId);
    }
    semQuery += ' ORDER BY u.created_at DESC LIMIT 25';

    const semQueryStmt = db.prepare(semQuery);
    if (semParams.length > 0) semQueryStmt.bind(semParams);

    const uploadCandidates: any[] = [];
    while (semQueryStmt.step()) {
      uploadCandidates.push(semQueryStmt.getAsObject());
    }
    semQueryStmt.free();

    for (const uRow of uploadCandidates) {
      const uDetails: SemesterDetails = {
        semester: uRow.semester,
        academicYear: uRow.academic_year,
        examination: uRow.exam_cycle,
        scheme: uRow.scheme,
      };

      if (areInputsMatching(params.semesterDetails, uDetails)) {
        const targetId = uRow.analysis_result_id || uRow.id;
        const session = await getAnalysisSession(targetId, collegeId, departmentId);
        if (session) {
          return session;
        }
      }
    }
  }

  return null;
}

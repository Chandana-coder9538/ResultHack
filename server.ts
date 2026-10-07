import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { parseExcelBuffer, RawParsedRow } from './server/parser.js';
import {
  aggregateSemesterData,
  DEFAULT_GRADING_BANDS,
  DEFAULT_SUBJECT_CONFIG,
} from './server/engine.js';
import {
  generateNormalFixture,
  generateEdgeCaseTiesFixture,
  generateStrictSplitFixture,
  generateGoogleFormsWideFixture,
  generateInvalidFixture,
} from './server/fixtures.js';
import { runBackendUnitTests } from './server/tests.js';
import {
  getDatabase,
  saveAnalysisSession,
  getAnalysisSession,
  listAllAnalyses,
  listUploadHistory,
  saveUploadArchive,
  getUploadById,
  deleteAnalysisSession,
  findExistingAnalysis,
  StoredSessionRecord,
  StoredUploadRecord,
  listColleges,
  getCollegeById,
  getCollegeByEmail,
  getCollegeByName,
  cacheCollegeToLocal,
  createCollege,
  deleteCollege,
  updateCollegePassword,
  updateCollegeLockout,
  resetCollegeFailedAttempts,
  listDepartments,
  getDepartmentById,
  getDepartmentByEmail,
  getDepartmentByName,
  getDepartmentByCode,
  cacheDepartmentToLocal,
  createDepartment,
  deleteDepartment,
  updateDepartmentPassword,
  updateDepartmentLockout,
  resetDepartmentFailedAttempts,
  saveOtpRecord,
  getValidOtpRecord,
  markOtpUsed,
  canResendOtp,
  incrementOtpAttempts,
  savePendingRegistration,
  getPendingRegistration,
  deletePendingRegistration,
  logAuditAction,
  removeAllDepartmentsForFreshStart,
} from './server/db.js';
import * as XLSX from 'xlsx';
import { generateConsolidatedReportPDF, PdfBrandingInfo } from './server/pdf.js';
import {
  AnalysisPayload,
  GradingBandConfig,
  SubjectConfig,
} from './src/types/analyzer.js';
import {
  aiBotBlockerMiddleware,
  attackFilterMiddleware,
  createRateLimiter,
  getSecurityStats,
  requireAuthMiddleware,
  requireCollegeAuth,
  generateCollegeToken,
  verifyCollegeToken,
  generateDepartmentToken,
  verifyDepartmentToken,
  generateVerificationToken,
  verifyVerificationToken,
  encryptBuffer,
  decryptBuffer,
} from './server/security.js';
import {
  generateSixDigitOtp,
  hashOtpCode,
  sendOtpEmail,
  sendEmail,
  isSmtpConfigured,
  getActiveSmtpConfig,
  saveSmtpConfig,
  resetSmtpConfig,
  verifySmtpConnection,
  SmtpConfig,
} from './server/email.js';
import cookieParser from 'cookie-parser';
import {
  isSupabaseConfigured,
  isSupabaseReady,
  getSupabaseDiagnostics,
  SUPABASE_SQL_SCHEMA,
  getSupabase,
  supabaseListColleges,
  supabaseGetCollegeById,
  supabaseGetCollegeByEmail,
  supabaseGetCollegeByName,
  supabaseCreateCollege,
  supabaseDeleteCollege,
  supabaseListDepartments,
  supabaseGetDepartmentById,
  supabaseGetDepartmentByEmail,
  supabaseCreateDepartment,
  supabaseDeleteDepartment,
  supabaseSavePendingRegistration,
  supabaseGetPendingRegistration,
  supabaseDeletePendingRegistration,
  supabaseSaveOtp,
  supabaseVerifyOtp,
  supabaseSaveAnalysisRecord,
  supabaseGetAnalysisRecord,
  supabaseListAnalysisRecords,
  supabaseDeleteAnalysisRecord,
  supabaseRecordAuditLog,
  supabaseUploadLogo,
  supabaseUploadAnalysisFile,
  supabaseGetSignedAnalysisUrl,
} from './server/supabase.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Maximum failed login attempts before temporary lockout
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function isPasswordValid(password: string): boolean {
  if (!password || password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

function parseDataUrlToBuffer(dataUrl?: string): { buffer: Buffer; mimeType: string; filename: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const mimeType = matches[1];
    const ext = mimeType.split('/')[1] || 'png';
    return {
      mimeType,
      filename: `logo_${Date.now()}.${ext}`,
      buffer: Buffer.from(matches[2], 'base64'),
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database with multi-tenant tables and seeding
  await getDatabase();

  // Disable server technology fingerprinting header
  app.disable('x-powered-by');

  // Hardened Security Headers & Anti-Scraping / Privacy Directives
  app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex, nocache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
  });

  // Serve strict robots.txt directly
  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    res.type('text/plain').sendFile(robotsPath);
  });

  // Anti-AI scraper and hostile bot blocking firewall
  app.use(aiBotBlockerMiddleware);

  // Attack pattern & injection defense
  app.use(attackFilterMiddleware);

  // Rate Limiting
  const loginLimiter = createRateLimiter({ maxRequests: 50, windowMs: 5 * 60 * 1000, keyPrefix: 'rl_login' });
  const otpLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60 * 1000, keyPrefix: 'rl_otp' });
  const uploadLimiter = createRateLimiter({ maxRequests: 50, windowMs: 60 * 1000, keyPrefix: 'rl_upload' });
  const generalLimiter = createRateLimiter({ maxRequests: 250, windowMs: 60 * 1000, keyPrefix: 'rl_gen' });

  app.use('/api/', generalLimiter);

  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health and Security Status
  app.get('/api/health', async (req, res) => {
    const smtpReady = await isSmtpConfigured();
    const supabaseConfigured = isSupabaseConfigured();
    const supabaseTablesReady = supabaseConfigured ? await isSupabaseReady() : false;
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      smtpConfigured: smtpReady,
      supabaseConfigured,
      supabaseTablesReady,
    });
  });

  // Supabase Database Status & Migration Schema APIs
  app.get('/api/supabase/status', async (req, res) => {
    try {
      const forceCheck = req.query.check === 'true';
      const status = await getSupabaseDiagnostics(forceCheck);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve Supabase status.' });
    }
  });

  app.get('/api/supabase/schema', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(SUPABASE_SQL_SCHEMA);
  });

  // SMTP Settings & Diagnostic APIs
  app.get('/api/smtp/config', async (req, res) => {
    try {
      const config = await getActiveSmtpConfig();
      if (!config) {
        return res.json({
          configured: false,
          host: '',
          port: 587,
          user: '',
          from: '',
          hasPassword: false,
          secure: false,
        });
      }
      res.json({
        configured: true,
        host: config.host,
        port: config.port,
        user: config.user,
        from: config.from,
        hasPassword: Boolean(config.pass),
        secure: config.secure,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve SMTP configuration.' });
    }
  });

  app.post('/api/smtp/config', async (req, res) => {
    try {
      const { host, port, user, pass, from, secure } = req.body || {};
      const cleanHost = String(host || '').trim();
      const cleanUser = String(user || '').trim();
      const cleanPass = String(pass || '').trim();
      const cleanFrom = String(from || '').trim();
      const portNum = parseInt(String(port || '587'), 10);

      if (!cleanHost || !cleanUser) {
        return res.status(400).json({ error: 'SMTP host and username are required.' });
      }

      // If password is not provided on update, keep existing password
      let finalPass = cleanPass;
      if (!finalPass) {
        const existing = await getActiveSmtpConfig();
        if (existing?.pass) {
          finalPass = existing.pass;
        } else {
          return res.status(400).json({ error: 'SMTP password or App Password is required.' });
        }
      }

      const newConfig: SmtpConfig = {
        host: cleanHost,
        port: isNaN(portNum) ? 587 : portNum,
        user: cleanUser,
        pass: finalPass,
        from: cleanFrom || `Academic Result Analysis <${cleanUser}>`,
        secure: Boolean(secure || portNum === 465),
      };

      // Verify connection before saving to ensure credentials work
      const verifyResult = await verifySmtpConnection(newConfig);
      if (!verifyResult.success) {
        return res.status(400).json({
          error: `SMTP authentication failed: ${verifyResult.message}. Please check your host, port, and App Password.`,
        });
      }

      await saveSmtpConfig(newConfig);

      let resentEmail = false;
      let resentMessage = '';

      // If a pending recipient email was provided, automatically dispatch fresh OTP code over the new real SMTP!
      if (req.body.resendToEmail && typeof req.body.resendToEmail === 'string') {
        const targetEmail = req.body.resendToEmail.trim().toLowerCase();
        const targetPurpose = (req.body.resendPurpose || 'college_register') as any;
        const existing = await getValidOtpRecord(targetEmail, targetPurpose);
        
        if (existing) {
          const freshCode = generateSixDigitOtp();
          const freshHash = hashOtpCode(freshCode);
          await saveOtpRecord({
            email: targetEmail,
            codeHash: freshHash,
            purpose: targetPurpose,
            dataJson: existing.dataJson,
            expiresInSeconds: 600,
          });

          const emailRes = await sendOtpEmail(targetEmail, freshCode, targetPurpose);
          if (emailRes.success && !emailRes.simulated) {
            resentEmail = true;
            resentMessage = ` Real verification code was also immediately dispatched to ${targetEmail}!`;
          }
        }
      }

      res.json({
        success: true,
        message: `SMTP email service verified and saved successfully!${resentMessage}`,
        resentEmail,
      });
    } catch (err: any) {
      console.error('Failed to save SMTP config:', err);
      res.status(500).json({ error: `Failed to save SMTP settings: ${err.message}` });
    }
  });

  // Reset / Disconnect live SMTP settings back to simulated dev mode
  app.post('/api/smtp/reset', async (req, res) => {
    try {
      await resetSmtpConfig();
      res.json({
        success: true,
        message: 'Live SMTP settings have been successfully reset. Mail dispatcher returned to default simulated mode.',
        configured: false,
      });
    } catch (err: any) {
      console.error('Failed to reset SMTP config:', err);
      res.status(500).json({ error: `Failed to reset SMTP: ${err.message}` });
    }
  });

  app.delete('/api/smtp/config', async (req, res) => {
    try {
      await resetSmtpConfig();
      res.json({
        success: true,
        message: 'Live SMTP settings deleted. Switched back to simulated mode.',
        configured: false,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to remove SMTP config: ${err.message}` });
    }
  });

  app.post('/api/smtp/test', async (req, res) => {
    try {
      const { toEmail, host, port, user, pass, from, secure } = req.body || {};
      const targetEmail = String(toEmail || '').trim().toLowerCase();

      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(400).json({ error: 'A valid recipient email address is required for testing.' });
      }

      // Check if custom config is provided in request or load active config
      let testConfig: SmtpConfig | null = null;
      if (host && user) {
        const portNum = parseInt(String(port || '587'), 10);
        let finalPass = String(pass || '').trim();
        if (!finalPass) {
          const active = await getActiveSmtpConfig();
          finalPass = active?.pass || '';
        }
        testConfig = {
          host: String(host).trim(),
          port: isNaN(portNum) ? 587 : portNum,
          user: String(user).trim(),
          pass: finalPass,
          from: String(from || '').trim() || `Academic Result Analysis <${String(user).trim()}>`,
          secure: Boolean(secure || portNum === 465),
        };
      } else {
        testConfig = await getActiveSmtpConfig();
      }

      if (!testConfig || !testConfig.host || !testConfig.user || !testConfig.pass) {
        return res.status(400).json({
          error: 'SMTP is not configured. Please enter your SMTP host, username, and password.',
        });
      }

      // 1. Verify connection
      const verifyResult = await verifySmtpConnection(testConfig);
      if (!verifyResult.success) {
        return res.status(400).json({
          error: `SMTP Connection test failed: ${verifyResult.message}`,
        });
      }

      // 2. Send real test email
      const sendResult = await sendEmail({
        to: targetEmail,
        subject: `[Live Test] Result Analysis Platform Email Verification`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #2563eb; margin-top: 0;">SMTP Email Verification Successful!</h2>
            <p style="color: #334155; line-height: 1.5;">This live confirmation email verifies that your SMTP server <strong>${testConfig.host}:${testConfig.port}</strong> is successfully communicating with the Academic Result Analysis Platform.</p>
            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #475569; margin: 16px 0;">
              <div><strong>Host:</strong> ${testConfig.host}</div>
              <div><strong>Port:</strong> ${testConfig.port}</div>
              <div><strong>Sender:</strong> ${testConfig.from}</div>
              <div><strong>Delivered to:</strong> ${targetEmail}</div>
              <div><strong>Timestamp:</strong> ${new Date().toLocaleString()}</div>
            </div>
            <p style="font-size: 12px; color: #64748b;">All registration OTP codes and deletion authorizations will be delivered via this verified SMTP channel.</p>
          </div>
        `,
        text: `SMTP Email Verification Successful!\n\nThis confirms that SMTP server ${testConfig.host}:${testConfig.port} is working and delivered to ${targetEmail}.\nTimestamp: ${new Date().toISOString()}`,
      });

      if (!sendResult.success) {
        return res.status(400).json({
          error: sendResult.message,
        });
      }

      res.json({
        success: true,
        message: `Real test email successfully dispatched to ${targetEmail}! Please check your inbox or spam folder.`,
      });
    } catch (err: any) {
      console.error('SMTP test endpoint error:', err);
      res.status(500).json({ error: `SMTP test failed: ${err.message || 'Unknown network error'}` });
    }
  });

  app.get('/api/security/status', (req, res) => {
    res.json(getSecurityStats());
  });

  app.get('/api/security/events', (req, res) => {
    const stats = getSecurityStats();
    res.json(stats.recentEvents);
  });

  // =========================================================================
  // CANONICAL REAL-TIME OTP & REGISTRATION/DELETION VERIFICATION ENDPOINTS
  // =========================================================================

  // Instant 1-Click SMTP Connection (for Gmail App Password or custom SMTP)
  app.post('/api/smtp/quick-connect', async (req, res) => {
    try {
      const { email, appPassword, host, port } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(appPassword || '').trim().replace(/\s+/g, '');

      if (!cleanEmail || !cleanEmail.includes('@') || !cleanPass) {
        return res.status(400).json({ error: 'Valid email and App Password are required.' });
      }

      const defaultHost = cleanEmail.includes('@gmail.com') ? 'smtp.gmail.com' : (host || 'smtp.gmail.com');
      const portNum = Number(port) || 587;

      const smtpConfig: SmtpConfig = {
        host: defaultHost,
        port: portNum,
        user: cleanEmail,
        pass: cleanPass,
        from: `Academic Result Analysis <${cleanEmail}>`,
        secure: portNum === 465,
      };

      const verifyResult = await verifySmtpConnection(smtpConfig);
      if (!verifyResult.success) {
        return res.status(400).json({
          error: `SMTP connection failed: ${verifyResult.message}. For Gmail, please use a Google App Password (16 letters), generated at myaccount.google.com/apppasswords.`,
        });
      }

      await saveSmtpConfig(smtpConfig);

      // If there was any pending OTP for this email, immediately dispatch fresh code over real SMTP!
      let pendingResent = false;
      const purposes: any[] = ['college_register', 'dept_register', 'reset', 'dept_reset', 'college_delete', 'dept_delete'];
      for (const purp of purposes) {
        const existing = await getValidOtpRecord(cleanEmail, purp);
        if (existing) {
          const freshCode = generateSixDigitOtp();
          const freshHash = hashOtpCode(freshCode);
          await saveOtpRecord({
            email: cleanEmail,
            codeHash: freshHash,
            purpose: purp,
            targetId: existing.targetId,
            dataJson: existing.dataJson,
            expiresInSeconds: 600,
          });
          const sendRes = await sendOtpEmail(cleanEmail, freshCode, purp);
          if (sendRes.success && !sendRes.simulated) {
            pendingResent = true;
          }
          break;
        }
      }

      res.json({
        success: true,
        message: `SMTP Connected and Verified! Real emails will now be sent directly to ${cleanEmail}.${pendingResent ? ' Fresh verification code has been dispatched to your inbox!' : ''}`,
        pendingResent,
      });
    } catch (err: any) {
      console.error('Quick connect error:', err);
      res.status(500).json({ error: `Quick connect failed: ${err.message}` });
    }
  });

  // POST /api/otp/send → { email, purpose, targetId? }
  app.post('/api/otp/send', otpLimiter, async (req, res) => {
    try {
      const { email, purpose, targetId, dataJson } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPurpose = String(purpose || '') as any;

      const validPurposes = ['college_register', 'dept_register', 'college_delete', 'dept_delete', 'reset', 'dept_reset'];
      if (!cleanEmail || !validPurposes.includes(cleanPurpose)) {
        return res.status(400).json({ error: 'Valid email and purpose are required.' });
      }

      const { canResend, waitSeconds } = await canResendOtp(cleanEmail, cleanPurpose);
      if (!canResend) {
        return res.status(429).json({
          error: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
          retryAfterSeconds: waitSeconds,
        });
      }

      let entityName = '';
      let addDetails: any = {};
      let recipients: string[] = [cleanEmail];
      let expiresInSeconds = 600; // 10 minutes

      if (cleanPurpose === 'college_delete') {
        expiresInSeconds = 300; // 5 minutes
        if (!targetId) return res.status(400).json({ error: 'Target college ID required for deletion.' });
        const col = await getCollegeById(targetId);
        if (!col) return res.status(404).json({ error: 'College not found.' });

        // Enforce: all departments must be deleted first before deleting the college
        const activeDepts = await listDepartments(targetId);
        if (activeDepts.length > 0) {
          return res.status(400).json({
            error: `Cannot request college deletion code: All departments must be deleted first. There are still ${activeDepts.length} active department(s) registered under "${col.name}". Please delete all departments first before proceeding with college deletion.`,
            activeDepartmentsCount: activeDepts.length,
          });
        }

        entityName = col.name;
        recipients = [col.email];
      } else if (cleanPurpose === 'dept_delete') {
        expiresInSeconds = 300; // 5 minutes
        if (!targetId) return res.status(400).json({ error: 'Target department ID required for deletion.' });
        const dept = await getDepartmentById(targetId);
        if (!dept) return res.status(404).json({ error: 'Department not found.' });
        const col = await getCollegeById(dept.collegeId);
        entityName = dept.name;
        addDetails = { collegeName: col?.name, deptName: dept.name, deptCode: dept.code };
        recipients = [dept.email];
        if (col && col.email.toLowerCase() !== dept.email.toLowerCase()) {
          recipients.push(col.email);
        }
      } else if (cleanPurpose === 'college_register') {
        entityName = req.body.name || 'College';
      } else if (cleanPurpose === 'dept_register') {
        entityName = req.body.name || 'Department';
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: recipients[0],
        codeHash,
        purpose: cleanPurpose,
        targetId: targetId ? String(targetId) : undefined,
        dataJson: dataJson ? JSON.stringify(dataJson) : undefined,
        expiresInSeconds,
      });

      const emailResult = await sendOtpEmail(recipients, otpCode, cleanPurpose, entityName, addDetails);

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch verification email: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit verification code has been generated. (SMTP is not configured for live email dispatch)`
          : `A real-time 6-digit verification code has been dispatched to ${recipients.join(', ')}. Please check your inbox and spam folder.`,
        email: cleanEmail,
        purpose: cleanPurpose,
        targetId,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('OTP send error:', err);
      res.status(500).json({ error: `Failed to send verification code: ${err.message}` });
    }
  });

  // POST /api/otp/verify → { email, purpose, otp } returns a short-lived one-time verification token
  app.post('/api/otp/verify', loginLimiter, async (req, res) => {
    try {
      const { email, purpose, otp, targetId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPurpose = String(purpose || '') as any;
      const cleanOtp = String(otp || '').trim();

      if (!cleanEmail || !cleanPurpose || !cleanOtp) {
        return res.status(400).json({ error: 'Email, purpose, and 6-digit OTP code are required.' });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, cleanPurpose, targetId ? String(targetId) : undefined);
      if (!otpRecord) {
        return res.status(400).json({ error: 'Verification code has expired or does not exist. Please request a new code.' });
      }

      const incomingHash = hashOtpCode(cleanOtp);
      if (incomingHash !== otpRecord.codeHash) {
        const attemptResult = await incrementOtpAttempts(otpRecord.id);
        if (attemptResult.maxAttemptsReached) {
          return res.status(400).json({
            error: 'Too many incorrect attempts (maximum 5 reached). This code has been invalidated. Please request a new code.',
            maxAttemptsReached: true,
          });
        }
        return res.status(400).json({
          error: `Invalid verification code. (Attempt ${attemptResult.attempts} of 5)`,
          attempts: attemptResult.attempts,
        });
      }

      // Mark OTP as used
      await markOtpUsed(otpRecord.id);

      // Generate single-use, short-lived (15 min) verification token
      const verificationToken = generateVerificationToken({
        email: cleanEmail,
        purpose: cleanPurpose,
        targetId: targetId ? String(targetId) : undefined,
      });

      res.json({
        success: true,
        message: 'Verification code verified successfully.',
        verificationToken,
        email: cleanEmail,
        purpose: cleanPurpose,
      });
    } catch (err: any) {
      console.error('OTP verify error:', err);
      res.status(500).json({ error: `Verification failed: ${err.message}` });
    }
  });

  // POST /api/college/register/complete accepts the verification token
  app.post('/api/college/register/complete', loginLimiter, async (req, res) => {
    try {
      const { verificationToken, name, universityName, collegeLogoUrl, universityLogoUrl, email, password } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanUniv = String(universityName || '').trim();
      const cleanPass = String(password || '');

      if (!verificationToken) {
        return res.status(401).json({ error: 'One-time verification token is required to complete registration.' });
      }

      const vPayload = verifyVerificationToken(verificationToken);
      if (!vPayload || vPayload.purpose !== 'college_register' || vPayload.email !== cleanEmail) {
        return res.status(401).json({ error: 'Invalid or expired registration verification token. Please verify email again.' });
      }

      if (!cleanName || !cleanUniv || !cleanEmail || !cleanPass) {
        return res.status(400).json({ error: 'All registration fields are required.' });
      }

      let finalCollegeLogo = collegeLogoUrl;
      let finalUniversityLogo = universityLogoUrl;

      if (isSupabaseConfigured()) {
        const colLogoParsed = parseDataUrlToBuffer(collegeLogoUrl);
        if (colLogoParsed) {
          const uploadedUrl = await supabaseUploadLogo(colLogoParsed.buffer, colLogoParsed.filename, colLogoParsed.mimeType);
          if (uploadedUrl) finalCollegeLogo = uploadedUrl;
        }

        const uniLogoParsed = parseDataUrlToBuffer(universityLogoUrl);
        if (uniLogoParsed) {
          const uploadedUrl = await supabaseUploadLogo(uniLogoParsed.buffer, uniLogoParsed.filename, uniLogoParsed.mimeType);
          if (uploadedUrl) finalUniversityLogo = uploadedUrl;
        }
      }

      const passwordHash = await bcrypt.hash(cleanPass, 10);
      const college = await createCollege({
        name: cleanName,
        universityName: cleanUniv,
        collegeLogoUrl: finalCollegeLogo,
        universityLogoUrl: finalUniversityLogo,
        email: cleanEmail,
        passwordHash,
        emailVerified: true,
      });

      if (isSupabaseConfigured()) {
        try {
          await supabaseCreateCollege({
            name: cleanName,
            universityName: cleanUniv,
            collegeLogoUrl: finalCollegeLogo,
            universityLogoUrl: finalUniversityLogo,
            email: cleanEmail,
            passwordHash,
            emailVerified: true,
          });
          await supabaseRecordAuditLog('COLLEGE_REGISTERED', college.id, 'college', college.id, req.ip);
        } catch (sbErr) {
          console.warn('[SUPABASE COLLEGE CREATION]', sbErr);
        }
      }

      await deletePendingRegistration(cleanEmail, 'college');

      const token = generateCollegeToken({
        collegeId: college.id,
        email: college.email,
        name: college.name,
      });

      res.cookie('college_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 4 * 3600 * 1000,
      });

      await logAuditAction({
        action: 'COLLEGE_REGISTERED',
        actorId: college.id,
        targetType: 'college',
        targetId: college.id,
        ip: req.ip,
      });

      const { passwordHash: _, ...safeCollege } = college;

      res.json({
        success: true,
        message: `College "${college.name}" registered and verified successfully!`,
        college: safeCollege,
        token,
      });
    } catch (err: any) {
      console.error('Complete college registration error:', err);
      res.status(500).json({ error: `Registration failed: ${err.message}` });
    }
  });

  // POST /api/department/register/complete accepts the verification token
  app.post('/api/department/register/complete', loginLimiter, requireCollegeAuth, async (req, res) => {
    try {
      const { verificationToken, collegeId, name, code, email, password } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanCode = code ? String(code).trim().toUpperCase() : '';
      const cleanPass = String(password || '');
      const callerCollegeId = (req as any).college?.collegeId || collegeId;

      if (!verificationToken) {
        return res.status(401).json({ error: 'One-time verification token is required to complete department registration.' });
      }

      const vPayload = verifyVerificationToken(verificationToken);
      if (!vPayload || vPayload.purpose !== 'dept_register' || vPayload.email !== cleanEmail) {
        return res.status(401).json({ error: 'Invalid or expired department verification token.' });
      }

      if (!cleanName || !cleanEmail || !cleanPass) {
        return res.status(400).json({ error: 'Department name, official email, and password are required.' });
      }

      const passwordHash = await bcrypt.hash(cleanPass, 10);
      const dept = await createDepartment({
        collegeId: callerCollegeId,
        name: cleanName,
        code: cleanCode,
        email: cleanEmail,
        passwordHash,
        emailVerified: true,
      });

      await deletePendingRegistration(cleanEmail, 'department');

      const college = await getCollegeById(callerCollegeId);
      const token = generateDepartmentToken({
        collegeId: callerCollegeId,
        departmentId: dept.id,
        collegeName: college?.name || 'College',
        departmentName: dept.name,
        email: dept.email,
        username: dept.name,
      });

      await logAuditAction({
        action: 'DEPARTMENT_REGISTERED',
        actorId: callerCollegeId,
        targetType: 'department',
        targetId: dept.id,
        ip: req.ip,
      });

      const { passwordHash: _, ...safeDept } = dept;

      res.json({
        success: true,
        message: `Department "${dept.name}" created and verified successfully!`,
        department: safeDept,
        token,
      });
    } catch (err: any) {
      console.error('Complete department registration error:', err);
      res.status(500).json({ error: `Department registration failed: ${err.message}` });
    }
  });

  // DELETE /api/college/:id requires the deletion verification token and authenticated session
  app.delete('/api/college/:id', requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.id;
      const callerCollegeId = (req as any).college?.collegeId;
      if (callerCollegeId !== collegeId) {
        return res.status(403).json({ error: 'Unauthorized to delete this college.' });
      }

      const { verificationToken, confirmationName } = req.body || {};
      if (!verificationToken) {
        return res.status(401).json({ error: 'Verification authorization token is required to delete a college.' });
      }

      const vPayload = verifyVerificationToken(verificationToken);
      if (!vPayload || vPayload.purpose !== 'college_delete' || vPayload.targetId !== collegeId) {
        return res.status(401).json({ error: 'Invalid or expired college deletion authorization token.' });
      }

      const college = await getCollegeById(collegeId);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }

      // Enforce: all departments must be deleted first before deleting the college
      const activeDepts = await listDepartments(collegeId);
      if (activeDepts.length > 0) {
        return res.status(400).json({
          error: `Cannot delete college: All departments must be deleted first. There are still ${activeDepts.length} active department(s) registered under "${college.name}". Please delete all departments first before proceeding with college deletion.`,
          activeDepartmentsCount: activeDepts.length,
        });
      }

      if (String(confirmationName || '').trim().toLowerCase() !== college.name.trim().toLowerCase()) {
        return res.status(400).json({ error: `Confirmation mismatch. You must type "${college.name}" exactly to delete.` });
      }

      const result = await deleteCollege(collegeId);

      await logAuditAction({
        action: 'COLLEGE_DELETED',
        actorId: callerCollegeId,
        targetType: 'college',
        targetId: collegeId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `College "${result.deletedCollege.name}" and all associated departments, analyses, and archives permanently erased.`,
      });
    } catch (err: any) {
      console.error('Delete college error:', err);
      res.status(500).json({ error: `Failed to delete college: ${err.message}` });
    }
  });

  // DELETE /api/department/:id requires the deletion verification token and authenticated session
  app.delete('/api/department/:id', async (req, res) => {
    try {
      const deptId = req.params.id;
      const authHeader = req.headers['authorization'];
      let callerToken: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        callerToken = authHeader.slice(7).trim();
      }
      if (!callerToken) {
        return res.status(401).json({ error: 'Authentication required to delete a department.' });
      }

      const colPayload = verifyCollegeToken(callerToken);
      const deptPayload = verifyDepartmentToken(callerToken);
      if (!colPayload && !deptPayload) {
        return res.status(401).json({ error: 'Invalid authentication session.' });
      }

      const dept = await getDepartmentById(deptId);
      if (!dept) {
        return res.status(404).json({ error: 'Department not found.' });
      }

      if (colPayload && colPayload.collegeId !== dept.collegeId) {
        return res.status(403).json({ error: 'Unauthorized to delete department in this college.' });
      }
      if (deptPayload && deptPayload.departmentId !== deptId) {
        return res.status(403).json({ error: 'Unauthorized to delete this department.' });
      }

      const { verificationToken, confirmationName } = req.body || {};
      if (!verificationToken) {
        return res.status(401).json({ error: 'Verification authorization token is required to delete department.' });
      }

      const vPayload = verifyVerificationToken(verificationToken);
      if (!vPayload || vPayload.purpose !== 'dept_delete' || vPayload.targetId !== deptId) {
        return res.status(401).json({ error: 'Invalid or expired department deletion authorization token.' });
      }

      if (String(confirmationName || '').trim().toLowerCase() !== dept.name.trim().toLowerCase()) {
        return res.status(400).json({ error: `Confirmation mismatch. You must type "${dept.name}" exactly to delete.` });
      }

      const result = await deleteDepartment(deptId);

      await logAuditAction({
        action: 'DEPARTMENT_DELETED',
        actorId: colPayload?.collegeId || deptPayload?.departmentId,
        targetType: 'department',
        targetId: deptId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `Department "${result.deletedDepartment.name}" and all its examination marksheets permanently erased.`,
      });
    } catch (err: any) {
      console.error('Delete department error:', err);
      res.status(500).json({ error: `Failed to delete department: ${err.message}` });
    }
  });

  // =========================================================================
  // MULTI-TENANT COLLEGE PUBLIC & AUTH APIS
  // =========================================================================

  // 1. List all registered colleges for the landing page cards
  app.get('/api/colleges', async (req, res) => {
    try {
      const search = req.query.search as string;
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        const sbColleges = await supabaseListColleges();
        if (sbColleges !== null && sbColleges.length > 0) {
          if (search) {
            const q = search.trim().toLowerCase();
            return res.json(
              sbColleges.filter(
                (c: any) =>
                  c.name.toLowerCase().includes(q) ||
                  c.universityName?.toLowerCase().includes(q) ||
                  c.email.toLowerCase().includes(q)
              )
            );
          }
          return res.json(sbColleges);
        }
      }
      const colleges = await listColleges(search);
      res.json(colleges);
    } catch (err: any) {
      console.error('Error listing colleges:', err);
      res.status(500).json({ error: 'Failed to retrieve registered colleges.' });
    }
  });

  // 2. Get specific college details
  app.get('/api/colleges/:id', async (req, res) => {
    try {
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        const sbCol = await supabaseGetCollegeById(req.params.id);
        if (sbCol) {
          const { passwordHash, ...safe } = sbCol;
          return res.json(safe);
        }
      }
      const college = await getCollegeById(req.params.id);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }
      const { passwordHash, ...safeCollege } = college;
      res.json(safeCollege);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve college details.' });
    }
  });

  // 3. Initiate College Registration (Step 1: validate & send OTP)
  app.post('/api/colleges/register/initiate', otpLimiter, async (req, res) => {
    try {
      const { name, universityName, collegeLogoUrl, universityLogoUrl, email, password, confirmPassword } = req.body || {};

      const cleanName = String(name || '').trim();
      const cleanUniv = String(universityName || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanName || !cleanUniv || !cleanEmail || !cleanPass) {
        return res.status(400).json({ error: 'Please provide all mandatory college registration fields.' });
      }

      if (cleanPass !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      }

      if (!isPasswordValid(cleanPass)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
        });
      }

      // Check unique college name
      const existingName = await getCollegeByName(cleanName);
      if (existingName) {
        return res.status(409).json({
          error: `College "${cleanName}" is already registered. Please proceed to login.`,
          code: 'COLLEGE_EXISTS',
          collegeId: existingName.id,
        });
      }

      // Check unique college email
      const existingEmail = await getCollegeByEmail(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({
          error: `A college account with email ${cleanEmail} already exists. Please proceed to login.`,
          code: 'EMAIL_EXISTS',
          collegeId: existingEmail.id,
        });
      }

      // Check email collision with department accounts
      const existingDeptEmail = await getDepartmentByEmail(cleanEmail);
      if (existingDeptEmail) {
        return res.status(409).json({
          error: `The email "${cleanEmail}" is already registered for a department. College must use a separate official email.`,
          code: 'EMAIL_EXISTS',
        });
      }

      // Check logo image sizes (max 2MB)
      if (collegeLogoUrl && collegeLogoUrl.length > 2.8 * 1024 * 1024) {
        return res.status(400).json({ error: 'College logo image exceeds the 2 MB limit.' });
      }
      if (universityLogoUrl && universityLogoUrl.length > 2.8 * 1024 * 1024) {
        return res.status(400).json({ error: 'University logo image exceeds the 2 MB limit.' });
      }

      // Generate 6-digit OTP
      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      // Hash password before saving pending record
      const passwordHash = await bcrypt.hash(cleanPass, 10);

      const pendingPayload = JSON.stringify({
        name: cleanName,
        universityName: cleanUniv,
        collegeLogoUrl: collegeLogoUrl || '',
        universityLogoUrl: universityLogoUrl || '',
        email: cleanEmail,
        passwordHash,
      });

      // Save OTP record (10 minutes expiry)
      await saveOtpRecord({
        email: cleanEmail,
        codeHash,
        purpose: 'college_register',
        dataJson: pendingPayload,
        expiresInSeconds: 600,
      });

      // Send OTP email (or simulated delivery)
      const emailResult = await sendOtpEmail(cleanEmail, otpCode, 'college_register', cleanName);

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch verification email: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit verification code has been generated. (SMTP is not configured, so real email could not be routed to ${cleanEmail})`
          : `A real-time 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox and spam folder.`,
        email: cleanEmail,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp, // Only defined when simulated
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('Error initiating college registration:', err);
      res.status(500).json({ error: `Failed to initiate registration: ${err.message || 'Unknown error'}` });
    }
  });

  // 4. Verify OTP and complete College Registration
  app.post('/api/colleges/register/verify', loginLimiter, async (req, res) => {
    try {
      const { email, otp } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();

      if (!cleanEmail || !cleanOtp) {
        return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, 'college_register');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Verification code has expired or does not exist. Please request a new code.' });
      }

      const incomingHash = hashOtpCode(cleanOtp);
      if (incomingHash !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code. Please check your email and try again.' });
      }

      if (!otpRecord.dataJson) {
        return res.status(500).json({ error: 'Registration data is missing. Please restart registration.' });
      }

      const pendingData = JSON.parse(otpRecord.dataJson);

      // Create college record in database
      const college = await createCollege({
        name: pendingData.name,
        universityName: pendingData.universityName,
        collegeLogoUrl: pendingData.collegeLogoUrl,
        universityLogoUrl: pendingData.universityLogoUrl,
        email: pendingData.email,
        passwordHash: pendingData.passwordHash,
        emailVerified: true,
      });

      // Mark OTP as used
      await markOtpUsed(otpRecord.id);

      // Generate college session token
      const token = generateCollegeToken({
        collegeId: college.id,
        email: college.email,
        name: college.name,
      });

      const { passwordHash, ...safeCollege } = college;

      res.json({
        success: true,
        message: `College "${college.name}" registered and verified successfully!`,
        college: safeCollege,
        token,
      });
    } catch (err: any) {
      console.error('Error verifying college registration:', err);
      res.status(500).json({ error: `Verification failed: ${err.message || 'Unknown error'}` });
    }
  });

  // 5. Resend OTP for College Registration or Password Reset
  app.post('/api/colleges/resend-otp', otpLimiter, async (req, res) => {
    try {
      const { email, purpose } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPurpose = (purpose || 'college_register') as
        | 'college_register'
        | 'dept_register'
        | 'reset'
        | 'dept_reset'
        | 'college_delete'
        | 'dept_delete';

      if (!cleanEmail) {
        return res.status(400).json({ error: 'Email address is required.' });
      }

      const { canResend, waitSeconds } = await canResendOtp(cleanEmail, cleanPurpose);
      if (!canResend) {
        return res.status(429).json({
          error: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
          retryAfterSeconds: waitSeconds,
        });
      }

      // Check if there is an existing pending record to renew
      const existing = await getValidOtpRecord(cleanEmail, cleanPurpose);
      const dataJson = existing?.dataJson;

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: cleanEmail,
        codeHash,
        purpose: cleanPurpose,
        dataJson,
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(cleanEmail, otpCode, cleanPurpose);

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch verification email: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A fresh 6-digit verification code has been generated. (SMTP not configured for live email delivery)`
          : `A fresh 6-digit verification code has been dispatched to ${cleanEmail}. Please check your inbox.`,
        email: cleanEmail,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to resend code: ${err.message}` });
    }
  });

  // 6. College Login (with 5-attempt lockout & forgot password)
  app.post('/api/colleges/login', loginLimiter, async (req, res) => {
    try {
      const { email, password, collegeId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      let college = collegeId ? await getCollegeById(collegeId) : await getCollegeByEmail(cleanEmail);

      // If looked up by collegeId, verify email matches or college exists
      if (!college) {
        return res.status(401).json({ error: 'Invalid credentials. College not found.' });
      }

      // Check temporary lockout
      if (college.lockoutUntil) {
        const lockoutTime = new Date(college.lockoutUntil).getTime();
        const now = Date.now();
        if (now < lockoutTime) {
          const remainingMinutes = Math.ceil((lockoutTime - now) / 60000);
          return res.status(403).json({
            error: `Account temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minutes or reset your password.`,
            isLocked: true,
            lockoutUntil: college.lockoutUntil,
          });
        } else {
          // Lockout expired, reset attempts
          await resetCollegeFailedAttempts(college.id);
          college.failedLoginAttempts = 0;
          college.lockoutUntil = null;
        }
      }

      // Check email and password
      const isEmailMatch = college.email.toLowerCase() === cleanEmail;
      const isPasswordMatch = await bcrypt.compare(cleanPass, college.passwordHash);

      if (!isEmailMatch || !isPasswordMatch) {
        const attempts = (college.failedLoginAttempts || 0) + 1;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutDate = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
          await updateCollegeLockout(college.id, attempts, lockoutDate);
          return res.status(403).json({
            error: `Maximum login attempts exceeded. Account is locked for ${LOCKOUT_MINUTES} minutes.`,
            isLocked: true,
            lockoutUntil: lockoutDate,
          });
        } else {
          await updateCollegeLockout(college.id, attempts, null);
          const remaining = MAX_LOGIN_ATTEMPTS - attempts;
          return res.status(401).json({
            error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
            attemptsRemaining: remaining,
          });
        }
      }

      // Login successful: reset failed attempts
      await resetCollegeFailedAttempts(college.id);

      const token = generateCollegeToken({
        collegeId: college.id,
        email: college.email,
        name: college.name,
      });

      const { passwordHash, ...safeCollege } = college;

      res.json({
        success: true,
        message: `Welcome to ${college.name}`,
        college: safeCollege,
        token,
      });
    } catch (err: any) {
      console.error('College login error:', err);
      res.status(500).json({ error: `Login failed: ${err.message || 'Unknown error'}` });
    }
  });

  // 7. College Forgot Password - Initiate OTP
  app.post('/api/colleges/forgot-password/initiate', otpLimiter, async (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!cleanEmail) {
        return res.status(400).json({ error: 'College official email address is required.' });
      }

      let college = await getCollegeByEmail(cleanEmail);
      if (!college && isSupabaseConfigured() && (await isSupabaseReady())) {
        const sbCol = await supabaseGetCollegeByEmail(cleanEmail);
        if (sbCol) {
          await cacheCollegeToLocal(sbCol);
          college = await getCollegeByEmail(cleanEmail);
        }
      }

      if (!college) {
        return res.status(404).json({
          error: `No college account was found for "${cleanEmail}". Please verify the official email address or select your college.`,
        });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: cleanEmail,
        codeHash,
        purpose: 'reset',
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(cleanEmail, otpCode, 'reset', college.name);

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch reset code: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit password reset code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit password reset code has been sent to ${cleanEmail}. Please check your inbox.`,
        email: cleanEmail,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to initiate reset: ${err.message}` });
    }
  });

  // 8. College Forgot Password - Verify OTP and Set New Password
  app.post('/api/colleges/forgot-password/verify', loginLimiter, async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();
      const cleanPass = String(newPassword || '');

      if (!cleanEmail || !cleanOtp || !cleanPass) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      if (cleanPass !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      }

      if (!isPasswordValid(cleanPass)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
        });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, 'reset');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Password reset code has expired or is invalid.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      const college = await getCollegeByEmail(cleanEmail);
      if (!college) {
        return res.status(404).json({ error: 'College account not found.' });
      }

      const newPasswordHash = await bcrypt.hash(cleanPass, 10);
      await updateCollegePassword(college.id, newPasswordHash);
      await markOtpUsed(otpRecord.id);

      res.json({
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to reset password: ${err.message}` });
    }
  });

  // 9. College Account Deletion - Step 1: Initiate & Send Verification Code
  app.post('/api/colleges/:collegeId/delete/initiate', otpLimiter, requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      const authedCollege = (req as any).college;

      if (authedCollege.collegeId !== collegeId) {
        return res.status(403).json({ error: 'Unauthorized to delete this college account.' });
      }

      const college = await getCollegeById(collegeId);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: college.email,
        codeHash,
        purpose: 'college_delete',
        dataJson: JSON.stringify({ collegeId }),
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(college.email, otpCode, 'college_delete', college.name, {
        collegeName: college.name,
      });

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to send deletion authorization code: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit deletion authorization code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit deletion authorization code has been dispatched to official college email ${college.email}.`,
        email: college.email,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('Error initiating college deletion:', err);
      res.status(500).json({ error: `Failed to initiate college deletion: ${err.message}` });
    }
  });

  // 10. College Account Deletion - Step 2: Verify Code & Permanently Delete
  app.post('/api/colleges/:collegeId/delete/verify', loginLimiter, requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      const authedCollege = (req as any).college;
      const { otp } = req.body || {};
      const cleanOtp = String(otp || '').trim();

      if (authedCollege.collegeId !== collegeId) {
        return res.status(403).json({ error: 'Unauthorized to delete this college account.' });
      }

      const college = await getCollegeById(collegeId);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }

      if (!cleanOtp) {
        return res.status(400).json({ error: 'Verification code is required.' });
      }

      const otpRecord = await getValidOtpRecord(college.email, 'college_delete');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Deletion code has expired or is invalid. Please request a new code.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code. Please check your official email.' });
      }

      await deleteCollege(collegeId);
      await markOtpUsed(otpRecord.id);

      res.json({
        success: true,
        message: `College "${college.name}" and all associated departments, students, and analyses have been permanently deleted.`,
      });
    } catch (err: any) {
      console.error('Error deleting college:', err);
      res.status(500).json({ error: `Failed to delete college: ${err.message}` });
    }
  });

  // 11. College Self-Service Deletion from Login Screen - Step 1: Request Code
  app.post('/api/colleges/delete-request/initiate', otpLimiter, async (req, res) => {
    try {
      const { email, password, collegeId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanEmail || !cleanPass) {
        return res.status(400).json({ error: 'Official college email and password are required to request deletion.' });
      }

      let college = collegeId ? await getCollegeById(collegeId) : await getCollegeByEmail(cleanEmail);
      if (!college || college.email.toLowerCase() !== cleanEmail) {
        return res.status(404).json({ error: 'College account not found with the provided email.' });
      }

      const isPasswordMatch = await bcrypt.compare(cleanPass, college.passwordHash);
      if (!isPasswordMatch) {
        return res.status(401).json({ error: 'Invalid password. Cannot authorize deletion.' });
      }

      // Enforce: all departments must be deleted first before deleting the college
      const activeDepts = await listDepartments(college.id);
      if (activeDepts.length > 0) {
        return res.status(400).json({
          error: `Cannot delete college: All departments must be deleted first. There are still ${activeDepts.length} active department(s) registered under "${college.name}". Please delete all departments first before proceeding with college deletion.`,
          activeDepartmentsCount: activeDepts.length,
        });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: college.email,
        codeHash,
        purpose: 'college_delete',
        dataJson: JSON.stringify({ collegeId: college.id }),
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(college.email, otpCode, 'college_delete', college.name, {
        collegeName: college.name,
      });

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch deletion authorization code: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit deletion authorization code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit deletion authorization code has been dispatched to official college email ${college.email}.`,
        email: college.email,
        collegeId: college.id,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('Error initiating college deletion request:', err);
      res.status(500).json({ error: `Failed to initiate college deletion: ${err.message}` });
    }
  });

  // 12. College Self-Service Deletion from Login Screen - Step 2: Verify Code & Delete
  app.post('/api/colleges/delete-request/verify', loginLimiter, async (req, res) => {
    try {
      const { email, otp } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();

      if (!cleanEmail || !cleanOtp) {
        return res.status(400).json({ error: 'College email and 6-digit verification code are required.' });
      }

      const college = await getCollegeByEmail(cleanEmail);
      if (!college) {
        return res.status(404).json({ error: 'College account not found.' });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, 'college_delete');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Deletion code has expired or is invalid. Please request a new code.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code. Please check your official college email.' });
      }

      await deleteCollege(college.id);
      await markOtpUsed(otpRecord.id);

      res.json({
        success: true,
        message: `College "${college.name}" and all associated departments, students, and analyses have been permanently deleted.`,
      });
    } catch (err: any) {
      console.error('Error executing college deletion request:', err);
      res.status(500).json({ error: `Failed to delete college: ${err.message}` });
    }
  });

  // =========================================================================
  // DEPARTMENT PUBLIC & AUTH APIS
  // =========================================================================

  // 1. List departments for a college
  app.get('/api/colleges/:collegeId/departments', async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        const sbDepts = await supabaseListDepartments(collegeId);
        if (sbDepts !== null && sbDepts.length > 0) {
          return res.json(sbDepts);
        }
      }
      const departments = await listDepartments(collegeId);
      res.json(departments);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve college departments.' });
    }
  });

  // 2. Add Department - Step 1: Initiate & Send OTP
  app.post('/api/colleges/:collegeId/departments/register/initiate', otpLimiter, requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      const { name, code, email, password, confirmPassword } = req.body || {};

      const cleanName = String(name || '').trim();
      const cleanCode = String(code || '').trim().toUpperCase();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanName || !cleanEmail || !cleanPass) {
        return res.status(400).json({ error: 'Department name, official email, and password are required.' });
      }

      if (cleanPass !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      }

      if (!isPasswordValid(cleanPass)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
        });
      }

      const college = await getCollegeById(collegeId);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }

      // Check uniqueness of department name within this college
      const existingName = await getDepartmentByName(collegeId, cleanName);
      if (existingName) {
        return res.status(409).json({
          error: `A department named "${cleanName}" already exists in this college.`,
          code: 'DEPT_EXISTS',
        });
      }

      // Check uniqueness of department code within this college
      if (cleanCode) {
        const existingCode = await getDepartmentByCode(collegeId, cleanCode);
        if (existingCode) {
          return res.status(409).json({
            error: `A department with code "${cleanCode}" already exists in this college.`,
            code: 'CODE_EXISTS',
          });
        }
      }

      // Check unique department email across the entire system
      const existingEmail = await getDepartmentByEmail(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({
          error: `Department email ${cleanEmail} is already registered by another department.`,
          code: 'EMAIL_EXISTS',
        });
      }

      // Ensure department email does not collide with a registered college email
      const existingCollegeEmail = await getCollegeByEmail(cleanEmail);
      if (existingCollegeEmail) {
        return res.status(409).json({
          error: `The email ${cleanEmail} is registered as a college email. Department must have its own official email.`,
          code: 'EMAIL_EXISTS',
        });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);
      const passwordHash = await bcrypt.hash(cleanPass, 10);

      const pendingPayload = JSON.stringify({
        collegeId,
        name: cleanName,
        code: cleanCode,
        email: cleanEmail,
        passwordHash,
      });

      await saveOtpRecord({
        email: cleanEmail,
        codeHash,
        purpose: 'dept_register',
        dataJson: pendingPayload,
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(cleanEmail, otpCode, 'dept_register', cleanName, {
        collegeName: college.name,
        deptName: cleanName,
        deptCode: cleanCode,
      });

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch department verification email: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit verification code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit verification code has been dispatched to ${cleanEmail}. Please enter it to complete department creation.`,
        email: cleanEmail,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('Error initiating department registration:', err);
      res.status(500).json({ error: `Failed to initiate department registration: ${err.message}` });
    }
  });

  // 3. Add Department - Step 2: Verify OTP & Create
  app.post('/api/colleges/:collegeId/departments/register/verify', loginLimiter, requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      const { email, otp } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();

      if (!cleanEmail || !cleanOtp) {
        return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, 'dept_register');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Verification code has expired or is invalid.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      if (!otpRecord.dataJson) {
        return res.status(500).json({ error: 'Registration data is missing.' });
      }

      const pendingData = JSON.parse(otpRecord.dataJson);

      const dept = await createDepartment({
        collegeId: pendingData.collegeId || collegeId,
        name: pendingData.name,
        code: pendingData.code,
        email: pendingData.email,
        passwordHash: pendingData.passwordHash,
        emailVerified: true,
      });

      await markOtpUsed(otpRecord.id);

      const college = await getCollegeById(collegeId);

      // Generate department token
      const token = generateDepartmentToken({
        collegeId,
        departmentId: dept.id,
        collegeName: college?.name || 'College',
        departmentName: dept.name,
        email: dept.email,
        username: dept.name,
      });

      const { passwordHash, ...safeDept } = dept;

      res.json({
        success: true,
        message: `Department "${dept.name}" created and verified successfully!`,
        department: safeDept,
        token,
      });
    } catch (err: any) {
      console.error('Error creating department:', err);
      res.status(500).json({ error: `Department verification failed: ${err.message}` });
    }
  });

  // 4. Department Deletion - Step 1: Initiate & Send Code to BOTH department email and official college email
  app.post('/api/colleges/:collegeId/departments/:deptId/delete/initiate', otpLimiter, async (req, res) => {
    try {
      const { collegeId, deptId } = req.params;

      const authHeader = req.headers['authorization'];
      let callerToken: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        callerToken = authHeader.slice(7).trim();
      }
      if (!callerToken) {
        return res.status(401).json({ error: 'Authentication required to delete a department.' });
      }

      const colPayload = verifyCollegeToken(callerToken);
      const deptPayload = verifyDepartmentToken(callerToken);

      if (!colPayload && !deptPayload) {
        return res.status(401).json({ error: 'Invalid authentication session.' });
      }

      if (colPayload && colPayload.collegeId !== collegeId) {
        return res.status(403).json({ error: 'Unauthorized to delete departments in this college.' });
      }

      if (deptPayload && (deptPayload.collegeId !== collegeId || deptPayload.departmentId !== deptId)) {
        return res.status(403).json({ error: 'Unauthorized to delete this department.' });
      }

      const college = await getCollegeById(collegeId);
      if (!college) {
        return res.status(404).json({ error: 'College not found.' });
      }

      const dept = await getDepartmentById(deptId);
      if (!dept || dept.collegeId !== collegeId) {
        return res.status(404).json({ error: 'Department not found in this college.' });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      // Save OTP record for dept.email
      await saveOtpRecord({
        email: dept.email,
        codeHash,
        purpose: 'dept_delete',
        dataJson: JSON.stringify({ collegeId, deptId }),
        expiresInSeconds: 600,
      });

      // Send code to BOTH official department email and official college email
      const recipients = [dept.email];
      if (college.email.toLowerCase() !== dept.email.toLowerCase()) {
        recipients.push(college.email);
      }

      const emailResult = await sendOtpEmail(
        recipients,
        otpCode,
        'dept_delete',
        dept.name,
        {
          collegeName: college.name,
          deptName: dept.name,
          deptCode: dept.code,
        }
      );

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch deletion authorization email: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit deletion authorization code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit deletion authorization code has been dispatched to both the official department email (${dept.email}) and college email (${college.email}).`,
        departmentEmail: dept.email,
        collegeEmail: college.email,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      console.error('Error initiating department deletion:', err);
      res.status(500).json({ error: `Failed to initiate department deletion: ${err.message}` });
    }
  });

  // 5. Department Deletion - Step 2: Verify Code and Delete
  app.post('/api/colleges/:collegeId/departments/:deptId/delete/verify', loginLimiter, async (req, res) => {
    try {
      const { collegeId, deptId } = req.params;
      const { otp } = req.body || {};
      const cleanOtp = String(otp || '').trim();

      const authHeader = req.headers['authorization'];
      let callerToken: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        callerToken = authHeader.slice(7).trim();
      }
      if (!callerToken) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const colPayload = verifyCollegeToken(callerToken);
      const deptPayload = verifyDepartmentToken(callerToken);
      if (!colPayload && !deptPayload) {
        return res.status(401).json({ error: 'Invalid authentication session.' });
      }

      const dept = await getDepartmentById(deptId);
      if (!dept || dept.collegeId !== collegeId) {
        return res.status(404).json({ error: 'Department not found in this college.' });
      }

      if (!cleanOtp) {
        return res.status(400).json({ error: 'Verification code is required.' });
      }

      const otpRecord = await getValidOtpRecord(dept.email, 'dept_delete');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Deletion code has expired or is invalid. Please request a new code.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      await deleteDepartment(deptId);
      await markOtpUsed(otpRecord.id);

      res.json({
        success: true,
        message: `Department "${dept.name}" and all its analysis records have been permanently deleted.`,
      });
    } catch (err: any) {
      console.error('Error deleting department:', err);
      res.status(500).json({ error: `Failed to delete department: ${err.message}` });
    }
  });

  // 6. Department Login (Second level authentication)
  app.post('/api/departments/login', loginLimiter, async (req, res) => {
    try {
      const { email, password, departmentId, collegeId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      let dept = departmentId ? await getDepartmentById(departmentId) : await getDepartmentByEmail(cleanEmail);

      if (!dept) {
        return res.status(401).json({ error: 'Invalid department credentials. Department not found.' });
      }

      // Check temporary lockout
      if (dept.lockoutUntil) {
        const lockoutTime = new Date(dept.lockoutUntil).getTime();
        const now = Date.now();
        if (now < lockoutTime) {
          const remainingMinutes = Math.ceil((lockoutTime - now) / 60000);
          return res.status(403).json({
            error: `Department account temporarily locked. Please try again in ${remainingMinutes} minutes or reset your password.`,
            isLocked: true,
            lockoutUntil: dept.lockoutUntil,
          });
        } else {
          await resetDepartmentFailedAttempts(dept.id);
          dept.failedLoginAttempts = 0;
          dept.lockoutUntil = null;
        }
      }

      const isEmailMatch = dept.email.toLowerCase() === cleanEmail;
      const isPasswordMatch = await bcrypt.compare(cleanPass, dept.passwordHash);

      if (!isEmailMatch || !isPasswordMatch) {
        const attempts = (dept.failedLoginAttempts || 0) + 1;
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutDate = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
          await updateDepartmentLockout(dept.id, attempts, lockoutDate);
          return res.status(403).json({
            error: `Maximum login attempts exceeded. Department account locked for ${LOCKOUT_MINUTES} minutes.`,
            isLocked: true,
            lockoutUntil: lockoutDate,
          });
        } else {
          await updateDepartmentLockout(dept.id, attempts, null);
          const remaining = MAX_LOGIN_ATTEMPTS - attempts;
          return res.status(401).json({
            error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
            attemptsRemaining: remaining,
          });
        }
      }

      await resetDepartmentFailedAttempts(dept.id);

      const college = await getCollegeById(dept.collegeId);

      const token = generateDepartmentToken({
        collegeId: dept.collegeId,
        departmentId: dept.id,
        collegeName: college?.name || 'College',
        departmentName: dept.name,
        email: dept.email,
        username: dept.name,
        role: 'Department Faculty / Examination Officer',
      });

      const authUser = {
        username: dept.name,
        email: dept.email,
        department: dept.name,
        departmentId: dept.id,
        collegeId: dept.collegeId,
        institution: college?.name || 'College',
        role: 'Department Faculty / Examination Officer',
        loginAt: new Date().toISOString(),
      };

      const { passwordHash, ...safeDept } = dept;

      res.json({
        success: true,
        message: `Authenticated for ${dept.name}`,
        department: safeDept,
        college: college ? {
          id: college.id,
          name: college.name,
          universityName: college.universityName,
          collegeLogoUrl: college.collegeLogoUrl,
          universityLogoUrl: college.universityLogoUrl,
          email: college.email,
        } : null,
        user: authUser,
        token,
      });
    } catch (err: any) {
      console.error('Department login error:', err);
      res.status(500).json({ error: `Department authentication failed: ${err.message}` });
    }
  });

  // 5. Department Forgot Password - Initiate OTP
  app.post('/api/departments/forgot-password/initiate', otpLimiter, async (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!cleanEmail) {
        return res.status(400).json({ error: 'Department email address is required.' });
      }

      let dept = await getDepartmentByEmail(cleanEmail);
      if (!dept && isSupabaseConfigured() && (await isSupabaseReady())) {
        const { supabaseGetDepartmentByEmail } = await import('./server/supabase.js');
        const sbDept = await supabaseGetDepartmentByEmail(cleanEmail);
        if (sbDept) {
          await cacheDepartmentToLocal(sbDept);
          dept = await getDepartmentByEmail(cleanEmail);
        }
      }

      if (!dept) {
        return res.status(404).json({
          error: `No department account was found for "${cleanEmail}". Please check your email or contact the college administrator.`,
        });
      }

      const otpCode = generateSixDigitOtp();
      const codeHash = hashOtpCode(otpCode);

      await saveOtpRecord({
        email: cleanEmail,
        codeHash,
        purpose: 'dept_reset',
        expiresInSeconds: 600,
      });

      const emailResult = await sendOtpEmail(cleanEmail, otpCode, 'dept_reset', dept.name);

      if (!emailResult.success && !emailResult.simulated) {
        return res.status(500).json({
          error: `Failed to dispatch reset code: ${emailResult.message}`,
        });
      }

      res.json({
        success: true,
        message: emailResult.simulated
          ? `A 6-digit password reset code has been generated. (SMTP is not configured for live email dispatch)`
          : `A 6-digit password reset code has been sent to ${cleanEmail}. Please check your inbox.`,
        email: cleanEmail,
        emailDelivered: !emailResult.simulated,
        smtpConfigured: !emailResult.simulated,
        simulated: emailResult.simulated,
        devOtp: emailResult.devOtp,
        resendWaitSeconds: 60,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to initiate department reset: ${err.message}` });
    }
  });

  // 6. Department Forgot Password - Verify OTP and Set New Password
  app.post('/api/departments/forgot-password/verify', loginLimiter, async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();
      const cleanPass = String(newPassword || '');

      if (!cleanEmail || !cleanOtp || !cleanPass) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      if (cleanPass !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      }

      if (!isPasswordValid(cleanPass)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long and contain at least one letter and one number.',
        });
      }

      const otpRecord = await getValidOtpRecord(cleanEmail, 'dept_reset');
      if (!otpRecord) {
        return res.status(400).json({ error: 'Password reset code has expired or is invalid.' });
      }

      if (hashOtpCode(cleanOtp) !== otpRecord.codeHash) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      const dept = await getDepartmentByEmail(cleanEmail);
      if (!dept) {
        return res.status(404).json({ error: 'Department account not found.' });
      }

      const newPasswordHash = await bcrypt.hash(cleanPass, 10);
      await updateDepartmentPassword(dept.id, newPasswordHash);
      await markOtpUsed(otpRecord.id);

      res.json({
        success: true,
        message: 'Department password has been reset successfully. You can now login.',
      });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to reset department password: ${err.message}` });
    }
  });

  // 7. Session Rehydration Endpoint (`/api/auth/me`)
  app.get('/api/auth/me', async (req, res) => {
    const authHeader = req.headers['authorization'];
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No active session token provided.' });
    }

    // Check department token
    const deptPayload = verifyDepartmentToken(token);
    if (deptPayload) {
      const college = await getCollegeById(deptPayload.collegeId);
      const department = await getDepartmentById(deptPayload.departmentId);
      return res.json({
        type: 'department',
        token,
        department: department ? {
          id: department.id,
          collegeId: department.collegeId,
          name: department.name,
          code: department.code,
          email: department.email,
        } : null,
        college: college ? {
          id: college.id,
          name: college.name,
          universityName: college.universityName,
          collegeLogoUrl: college.collegeLogoUrl,
          universityLogoUrl: college.universityLogoUrl,
          email: college.email,
        } : null,
        user: {
          username: deptPayload.departmentName,
          email: deptPayload.email,
          department: deptPayload.departmentName,
          departmentId: deptPayload.departmentId,
          collegeId: deptPayload.collegeId,
          institution: deptPayload.collegeName,
          role: deptPayload.role || 'Department Faculty / Examination Officer',
          loginAt: new Date().toISOString(),
        },
      });
    }

    // Check college token
    const colPayload = verifyCollegeToken(token);
    if (colPayload) {
      const college = await getCollegeById(colPayload.collegeId);
      return res.json({
        type: 'college',
        token,
        college: college ? {
          id: college.id,
          name: college.name,
          universityName: college.universityName,
          collegeLogoUrl: college.collegeLogoUrl,
          universityLogoUrl: college.universityLogoUrl,
          email: college.email,
        } : null,
      });
    }

    return res.status(401).json({ error: 'Session token has expired or is invalid.' });
  });

  // Direct department email login route for backward compatibility
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Department email address is required.' });
    }

    const dept = await getDepartmentByEmail(cleanEmail);
    if (!dept) {
      return res.status(401).json({
        error: 'Access denied: No department registered with this email address.',
      });
    }

    const college = await getCollegeById(dept.collegeId);
    const token = generateDepartmentToken({
      departmentId: dept.id,
      collegeId: dept.collegeId,
      departmentName: dept.name,
      collegeName: college?.name || 'Academic Institution',
      email: dept.email,
    });

    res.json({
      success: true,
      message: 'Authentication successful.',
      user: {
        username: dept.name,
        email: dept.email,
        department: dept.name,
        departmentId: dept.id,
        collegeId: dept.collegeId,
        institution: college?.name || 'Academic Institution',
        role: 'Department Faculty / Examination Officer',
      },
      token,
    });
  });

  // Run backend unit tests
  app.get(['/api/run-tests', '/api/tests/run'], async (req, res) => {
    try {
      const testResults = await runBackendUnitTests();
      res.json(testResults);
    } catch (err: any) {
      res.status(500).json({ error: `Unit tests failed: ${err.message}` });
    }
  });

  // Download synthetic sample Excel fixtures
  app.get('/api/sample-excel/:type', (req, res) => {
    const type = req.params.type;
    let buffer: Buffer;
    let filename = 'sample_marks.xlsx';

    if (type === 'google_forms' || type === 'wide') {
      buffer = generateGoogleFormsWideFixture();
      filename = 'Semester_Marks_Google_Forms_Responses.xlsx';
    } else if (type === 'normal') {
      buffer = generateNormalFixture();
      filename = 'Semester_Marks_Standard_Cohort.xlsx';
    } else if (type === 'edge_ties') {
      buffer = generateEdgeCaseTiesFixture();
      filename = 'Semester_Marks_Edge_Cases_Ties.xlsx';
    } else if (type === 'strict_split') {
      buffer = generateStrictSplitFixture();
      filename = 'Semester_Marks_Strict_40_60_Split.xlsx';
    } else if (type === 'invalid') {
      buffer = generateInvalidFixture();
      filename = 'Semester_Marks_Invalid_Format.xlsx';
    } else {
      buffer = generateGoogleFormsWideFixture();
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  });

  // =========================================================================
  // PROTECTED DEPARTMENT ANALYSIS APIS (STRICT TENANT ISOLATION)
  // =========================================================================

  // List past uploads for authenticated department
  // List past uploads for authenticated department (strictly college & department specific)
  app.get(['/api/history', '/api/sessions', '/api/analyses'], requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const collegeId = deptUser?.collegeId || (req.query.collegeId as string);
      const departmentId = deptUser?.departmentId || (req.query.departmentId as string);

      if (!departmentId || !collegeId) {
        return res.status(403).json({ error: 'Department and College session context required.' });
      }

      let list: any[] = [];

      // 1. Fetch from Supabase (strictly partitioned by college_id and department_id)
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          const sbRecords = await supabaseListAnalysisRecords({
            collegeId,
            departmentId,
            semester: req.query.semester as string,
            academic_year: (req.query.academic_year || req.query.academicYear) as string,
            exam_cycle: (req.query.exam_cycle || req.query.examCycle) as string,
            search: req.query.search as string,
          });
          if (sbRecords && sbRecords.length > 0) {
            list = sbRecords;
          }
        } catch (sbErr) {
          console.warn('[Supabase History Sync Notice]:', sbErr);
        }
      }

      // 2. Also retrieve local database records for this department of the college
      const localList = await listUploadHistory({
        semester: req.query.semester as string,
        academic_year: (req.query.academic_year || req.query.academicYear) as string,
        exam_cycle: (req.query.exam_cycle || req.query.examCycle) as string,
        scheme: req.query.scheme as string,
        department: req.query.department as string,
        search: req.query.search as string,
        collegeId,
        departmentId,
      });

      // Merge and deduplicate by ID so no records are lost
      const seenIds = new Set<string>(list.map((r: any) => r.id));
      for (const item of localList) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          list.push(item);
        }
      }

      // Final strict filter: Ensure ONLY this college and department's data is returned
      const filteredList = list
        .filter((r: any) => {
          const itemCollegeId = r.collegeId || r.college_id;
          const itemDeptId = r.departmentId || r.department_id;
          return itemCollegeId === collegeId && itemDeptId === departmentId;
        })
        .map((r: any) => ({
          ...r,
          collegeId,
          departmentId,
          collegeName: deptUser?.collegeName || r.collegeName,
          departmentName: deptUser?.departmentName || r.departmentName || r.department,
        }));

      res.json(filteredList);
    } catch (err: any) {
      console.error('Error fetching sessions list:', err);
      res.status(500).json({ error: 'Failed to retrieve saved analyses.' });
    }
  });

  // Retrieve an existing analysis payload (strictly isolated to department of college)
  app.get(['/api/analysis/:id', '/api/analyses/:id', '/api/history/:id'], requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const rawId = decodeURIComponent(req.params.id || '').trim();
      const collegeId = deptUser?.collegeId || (req.query.collegeId as string);
      const departmentId = deptUser?.departmentId || (req.query.departmentId as string);

      if (!departmentId || !collegeId) {
        return res.status(403).json({ error: 'Department and College session context required.' });
      }

      // 1. Fetch from Supabase first
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          const sbSession = await supabaseGetAnalysisRecord(rawId, collegeId, departmentId);
          if (sbSession && sbSession.analysisJson) {
            return res.json(sbSession.analysisJson);
          }
        } catch (sbGetErr) {
          console.warn('[Supabase Analysis Get Notice]:', sbGetErr);
        }
      }

      // 2. Fallback to local store with strict tenant check
      const session = await getAnalysisSession(rawId, collegeId, departmentId);
      if (!session) {
        return res.status(404).json({ error: 'Analysis session not found in database or unauthorized access.' });
      }
      res.json(session.latestPayload);
    } catch (err: any) {
      console.error('Error retrieving analysis by ID:', err);
      res.status(500).json({ error: 'Failed to retrieve analysis from database.' });
    }
  });

  // Download original archived Excel file by upload ID (tenant-isolated to department of college)
  app.get('/api/download/excel/:id', requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const uploadId = req.params.id;
      const collegeId = deptUser?.collegeId || (req.query.collegeId as string);
      const departmentId = deptUser?.departmentId || (req.query.departmentId as string);

      // 1. Check if stored in Supabase storage bucket
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          const sbRecord = await supabaseGetAnalysisRecord(uploadId, collegeId, departmentId);
          if (sbRecord?.excelFileUrl) {
            const signedUrl = await supabaseGetSignedAnalysisUrl(sbRecord.excelFileUrl);
            if (signedUrl) {
              return res.redirect(signedUrl);
            }
          }
        } catch (sbDlErr) {
          console.warn('[Supabase Signed URL Notice]:', sbDlErr);
        }
      }

      const uploadRecord = await getUploadById(uploadId, collegeId, departmentId);

      if (uploadRecord && uploadRecord.excelBlob && uploadRecord.excelBlob !== 'NO_BLOB') {
        try {
          const fileBuffer = decryptBuffer(uploadRecord.excelBlob);
          const rawFilename = uploadRecord.originalFilename || 'archived_marks.xlsx';
          const cleanFilename = rawFilename.replace(/[^\w.-]/g, '_');

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
          res.setHeader('Content-Length', fileBuffer.length.toString());
          return res.send(fileBuffer);
        } catch (decryptErr) {
          console.error('Failed to decrypt stored Excel blob, attempting raw fallback:', decryptErr);
        }
      }

      // Fallback: Reconstruct from session.rawRows
      const session = await getAnalysisSession(uploadId, collegeId, departmentId);
      if (!session || !session.rawRows || session.rawRows.length === 0) {
        return res.status(404).json({ error: 'Archived Excel sheet not found for this record.' });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(session.rawRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Archived_Marks');
      const fallbackBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const rawFilename = session.fileName || 'archived_marks.xlsx';
      const cleanFilename = rawFilename.replace(/[^\w.-]/g, '_');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
      res.setHeader('Content-Length', fallbackBuffer.length.toString());
      return res.send(fallbackBuffer);
    } catch (err: any) {
      console.error('Error downloading archived Excel file:', err);
      res.status(500).json({ error: `Failed to download original Excel file: ${err.message || 'Unknown error'}` });
    }
  });

  // Download / regenerate consolidated official PDF report with dynamic multi-tenant branding
  app.get('/api/download/pdf/:id', requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const uploadId = req.params.id;
      const session = await getAnalysisSession(uploadId, deptUser?.collegeId, deptUser?.departmentId);
      
      let latestPayload = session?.latestPayload;
      let semName = session?.config?.semesterDetails?.semester;
      let fileName = session?.fileName;

      if (!latestPayload) {
        // Fallback: parse raw archived Excel buffer
        const uploadRec = await getUploadById(uploadId, deptUser?.collegeId, deptUser?.departmentId);
        if (uploadRec && uploadRec.excelBuffer) {
          const parsed = parseExcelBuffer(uploadRec.excelBuffer);
          if (parsed.validRows && parsed.validRows.length > 0) {
            const fallbackSubjectsConfig: Record<string, SubjectConfig> = {};
            parsed.detectedSubjects.forEach((subCode) => {
              fallbackSubjectsConfig[subCode] = DEFAULT_SUBJECT_CONFIG(
                subCode,
                parsed.subjectBlocks?.[subCode]?.blockType
              );
            });

            latestPayload = aggregateSemesterData(
              parsed.validRows,
              DEFAULT_GRADING_BANDS,
              fallbackSubjectsConfig,
              parsed.warnings,
              uploadId,
              uploadRec.originalFilename,
              {
                semester: uploadRec.semester || '4th Sem',
                semType: 'Even Semester',
                examination: uploadRec.examCycle || 'June / July 2025',
                academicYear: uploadRec.academicYear || '2025-26',
                department: uploadRec.department || deptUser?.departmentName || 'Academic Department',
              }
            );
            semName = uploadRec.semester;
            fileName = uploadRec.originalFilename;
          }
        }
      }

      if (!latestPayload) {
        return res.status(404).json({ error: 'Analysis record not found for PDF generation.' });
      }

      // Pull dynamic college and university branding
      let branding: PdfBrandingInfo | undefined = undefined;
      if (deptUser?.collegeId) {
        const col = await getCollegeById(deptUser.collegeId);
        if (col) {
          branding = {
            collegeName: col.name,
            universityName: col.universityName,
            departmentName: deptUser.departmentName,
            collegeLogoUrl: col.collegeLogoUrl,
            universityLogoUrl: col.universityLogoUrl,
          };
        }
      }

      const pdfBuffer = generateConsolidatedReportPDF(latestPayload, branding);
      const semPrefix = semName ? `${semName.replace(/[^\w.-]/g, '_')}_` : '';
      const baseName = (fileName || 'Report').replace(/\.[^/.]+$/, '').replace(/[^\w.-]/g, '_');
      const pdfFilename = `${semPrefix}${baseName}_Consolidated_Report.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('Error generating historical PDF report:', err);
      res.status(500).json({ error: `Failed to generate PDF report: ${err.message || 'Unknown error'}` });
    }
  });

  // Delete an analysis session and associated upload (tenant-isolated to department of college)
  app.delete(['/api/analyses/:id', '/api/analysis/:id', '/api/history/:id'], requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const collegeId = deptUser?.collegeId || (req.query.collegeId as string);
      const departmentId = deptUser?.departmentId || (req.query.departmentId as string);

      if (!departmentId || !collegeId) {
        return res.status(403).json({ error: 'Department and College session context required.' });
      }

      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          await supabaseDeleteAnalysisRecord(req.params.id, collegeId, departmentId);
          await supabaseRecordAuditLog('ANALYSIS_DELETED', deptUser?.id || departmentId, 'analysis_records', req.params.id, req.ip);
        } catch (sbDelErr) {
          console.warn('[Supabase Delete Notice]:', sbDelErr);
        }
      }

      const deleted = await deleteAnalysisSession(req.params.id, collegeId, departmentId);
      res.json({ success: true, message: `Analysis ${req.params.id} deleted successfully.` });
    } catch (err: any) {
      console.error('Error deleting analysis session:', err);
      res.status(500).json({ error: 'Failed to delete analysis session.' });
    }
  });

  // Quick subject detection preview for the interactive wizard
  app.post('/api/detect-subjects', uploadLimiter, requireAuthMiddleware, upload.single('file'), (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No Excel file provided in request.' });
      }
      const parseResult = parseExcelBuffer(req.file.buffer);
      if (parseResult.error) {
        return res.status(422).json({ error: parseResult.error, warnings: parseResult.warnings });
      }
      res.json({
        detectedSubjects: parseResult.detectedSubjects,
        subjectBlocks: parseResult.subjectBlocks,
        isWideFormat: parseResult.isWideFormat,
        totalRows: parseResult.totalRows,
        warnings: parseResult.warnings,
      });
    } catch (err: any) {
      console.error('Detection error:', err);
      res.status(500).json({ error: `Failed to detect subjects: ${err.message || 'Unknown error'}` });
    }
  });

  // Check if entered input details match an existing analysis in the authenticated department
  app.all('/api/check-input-details', requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const q = req.method === 'GET' ? req.query : req.body;
      const semester = (q?.semester || req.query?.semester || '') as string;
      const academicYear = (q?.academicYear || q?.academic_year || req.query?.academicYear || req.query?.academic_year || '') as string;
      const examination = (q?.examination || q?.exam_cycle || req.query?.examination || req.query?.exam_cycle || '') as string;
      const scheme = (q?.scheme || req.query?.scheme || '') as string;
      const fileName = (q?.fileName || req.query?.fileName || '') as string;

      if (!semester && !academicYear && !examination) {
        return res.json({ alreadyAnalysed: false });
      }

      const existingSession = await findExistingAnalysis({
        fileName,
        semesterDetails: {
          semester,
          academicYear,
          examination,
          scheme,
        },
        collegeId: deptUser?.collegeId,
        departmentId: deptUser?.departmentId,
      });

      if (!existingSession) {
        return res.json({ alreadyAnalysed: false });
      }

      const formattedDate = new Date(existingSession.uploadedAt || existingSession.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return res.json({
        alreadyAnalysed: true,
        message: `Identical semester input details detected. An official analysis for ${existingSession.config?.semesterDetails?.semester || semester} (${existingSession.config?.semesterDetails?.academicYear || academicYear}) was already completed on ${formattedDate}.`,
        recommendation: `We recommend checking the existing analysis to view complete reports, student ranks, and charts immediately without duplicate calculation. If faculty assignments or subject settings need changes, select "Want to Edit Faculty & Other Things".`,
        uploadId: existingSession.uploadId,
        uploadedAt: existingSession.uploadedAt,
        fileName: existingSession.fileName,
        totalStudents: existingSession.totalStudents,
        totalSubjects: existingSession.totalSubjects,
        overallPassPercentage: existingSession.overallPassPercentage,
        cohortMeanPercentage: existingSession.cohortMeanPercentage,
        semesterDetails: existingSession.config?.semesterDetails || {
          semester,
          academicYear,
          examination,
          scheme,
        },
        subjectsConfig: existingSession.config?.subjectsConfig,
        gradingBands: existingSession.config?.gradingBands,
        existingPayload: existingSession.latestPayload,
      });
    } catch (err: any) {
      console.error('Check input details error:', err);
      res.status(500).json({ error: `Failed to check input details: ${err.message || 'Unknown error'}` });
    }
  });

  // Check if an Excel file and input configuration have already been analyzed in this department
  app.post('/api/check-duplicate', uploadLimiter, requireAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
      const deptUser = (req as any).department;
      let userSemesterDetails = undefined;
      if (req.body.semesterDetails) {
        try {
          userSemesterDetails = typeof req.body.semesterDetails === 'string'
            ? JSON.parse(req.body.semesterDetails)
            : req.body.semesterDetails;
        } catch {}
      }

      const fileHash = req.file?.buffer ? crypto.createHash('sha256').update(req.file.buffer).digest('hex') : undefined;
      const parseResult = req.file?.buffer ? parseExcelBuffer(req.file.buffer) : undefined;

      const existingSession = await findExistingAnalysis({
        fileHash,
        fileName: req.file ? req.file.originalname : req.body.fileName,
        rawRows: parseResult?.validRows,
        semesterDetails: userSemesterDetails,
        collegeId: deptUser?.collegeId,
        departmentId: deptUser?.departmentId,
      });

      if (!existingSession) {
        return res.json({ alreadyAnalysed: false });
      }

      const formattedDate = new Date(existingSession.uploadedAt || existingSession.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return res.json({
        alreadyAnalysed: true,
        message: `This spreadsheet with matching input details was already analyzed on ${formattedDate}.`,
        recommendation: `We recommend checking the existing analysis to view complete reports, student ranks, and charts immediately without duplicate calculation. If faculty assignments or subject settings need changes, select "Want to Edit Faculty & Other Things".`,
        uploadId: existingSession.uploadId,
        uploadedAt: existingSession.uploadedAt,
        fileName: existingSession.fileName,
        totalStudents: existingSession.totalStudents,
        totalSubjects: existingSession.totalSubjects,
        overallPassPercentage: existingSession.overallPassPercentage,
        cohortMeanPercentage: existingSession.cohortMeanPercentage,
        semesterDetails: existingSession.config?.semesterDetails || userSemesterDetails,
        subjectsConfig: existingSession.config?.subjectsConfig,
        gradingBands: existingSession.config?.gradingBands,
        existingPayload: existingSession.latestPayload,
      });
    } catch (err: any) {
      console.error('Check duplicate error:', err);
      res.status(500).json({ error: `Failed to check duplicate: ${err.message || 'Unknown error'}` });
    }
  });

  // Upload Excel file and generate analysis, tagged with college_id and department_id
  app.post('/api/upload', uploadLimiter, requireAuthMiddleware, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No Excel file provided in request.' });
      }

      const deptUser = (req as any).department;
      const collegeId = deptUser?.collegeId || null;
      const departmentId = deptUser?.departmentId || null;

      let userGradingBands: GradingBandConfig = DEFAULT_GRADING_BANDS;
      let userSubjectsConfig: Record<string, SubjectConfig> = {};
      let userSemesterDetails = undefined;

      if (req.body.gradingBands) {
        try {
          userGradingBands = { ...DEFAULT_GRADING_BANDS, ...JSON.parse(req.body.gradingBands) };
        } catch {}
      }

      if (req.body.subjectsConfig) {
        try {
          userSubjectsConfig = JSON.parse(req.body.subjectsConfig);
        } catch {}
      }

      if (req.body.semesterDetails) {
        try {
          userSemesterDetails = typeof req.body.semesterDetails === 'string'
            ? JSON.parse(req.body.semesterDetails)
            : req.body.semesterDetails;
        } catch {}
      }

      if (!collegeId || !departmentId) {
        return res.status(403).json({
          error: 'Analysis data must be stored specifically for an authenticated department of a college.',
        });
      }

      // Ensure semester details strictly carries authenticated college and concerned department name
      if (!userSemesterDetails) {
        userSemesterDetails = {
          semester: '4th Sem',
          semType: 'Even Semester',
          examination: 'June / July 2025',
          academicYear: '2025-26',
          scheme: '2022',
          department: deptUser?.departmentName || 'Academic Department',
          college: deptUser?.collegeName || 'Engineering College',
        };
      } else {
        if (deptUser?.departmentName) {
          userSemesterDetails.department = deptUser.departmentName;
          userSemesterDetails.branch = deptUser.departmentName;
        }
        if (deptUser?.collegeName) {
          userSemesterDetails.college = deptUser.collegeName;
        }
      }

      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

      const parseResult = parseExcelBuffer(req.file.buffer, {
        roundingTolerance: userGradingBands.roundingTolerance,
      });

      if (parseResult.error) {
        return res.status(422).json({
          error: parseResult.error,
          warnings: parseResult.warnings,
          totalRows: parseResult.totalRows,
        });
      }

      // Check if user requested to force overwrite
      const forceOverwrite = req.body.forceOverwrite === 'true' || 
                             req.body.forceOverwrite === true || 
                             req.query.force === 'true' || 
                             req.headers['x-force-overwrite'] === 'true';

      if (!forceOverwrite) {
        const existingSession = await findExistingAnalysis({
          fileHash,
          fileName: req.file.originalname,
          rawRows: parseResult.validRows,
          semesterDetails: userSemesterDetails,
          gradingBands: userGradingBands,
          collegeId,
          departmentId,
        });

        if (existingSession) {
          return res.json({
            alreadyAnalysed: true,
            message: `This Excel file with matching semester inputs was already analyzed on ${new Date(existingSession.uploadedAt || existingSession.createdAt).toLocaleDateString()}.`,
            uploadId: existingSession.uploadId,
            uploadedAt: existingSession.uploadedAt,
            fileName: existingSession.fileName,
            totalStudents: existingSession.totalStudents,
            totalSubjects: existingSession.totalSubjects,
            overallPassPercentage: existingSession.overallPassPercentage,
            cohortMeanPercentage: existingSession.cohortMeanPercentage,
            semesterDetails: existingSession.config?.semesterDetails || userSemesterDetails,
            subjectsConfig: existingSession.config?.subjectsConfig || userSubjectsConfig,
            gradingBands: existingSession.config?.gradingBands || userGradingBands,
            existingPayload: existingSession.latestPayload,
          });
        }
      }

      // Initialize subject configs
      const completeSubjectsConfig: Record<string, SubjectConfig> = {};
      parseResult.detectedSubjects.forEach((subCode) => {
        const blk = parseResult.subjectBlocks[subCode];
        const blockType = blk?.blockType || 'complete';
        const defaultConfig = DEFAULT_SUBJECT_CONFIG(subCode, blockType);
        if (blk) {
          (defaultConfig as any).modulesDetected = blk.detectedModuleCount;
          (defaultConfig as any).expectedMarksPerModule = blk.expectedMarksPerModule;
          (defaultConfig as any).formulaCheck = blk.formulaCheck;
          (defaultConfig as any).hasModuleMismatch = blk.hasModuleMismatch;
          (defaultConfig as any).mismatchWarning = blk.mismatchWarning;
          if (blk.computedTotalMaxMarks && blk.computedTotalMaxMarks > 0) {
            defaultConfig.maxTotal = blk.computedTotalMaxMarks;
          }
        }
        completeSubjectsConfig[subCode] = userSubjectsConfig[subCode]
          ? { ...defaultConfig, ...userSubjectsConfig[subCode] }
          : defaultConfig;
      });

      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const rawSem = userSemesterDetails?.semester || 'Semester';
      const rawYear = userSemesterDetails?.academicYear || 'AcademicYear';
      const rawCycle = userSemesterDetails?.examination || 'ExamCycle';
      const rawScheme = userSemesterDetails?.scheme ? `_Scheme${userSemesterDetails.scheme.replace(/[^a-zA-Z0-9]/g, '')}` : '';

      const cleanSem = rawSem.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
      const cleanYear = rawYear.replace(/[^a-zA-Z0-9-]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
      const cleanCycle = rawCycle.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
      const cleanFormattedFilename = `${cleanSem}_${cleanYear}_${cleanCycle}${rawScheme}.xlsx`;

      const fileName = cleanFormattedFilename;

      const analysisPayload = aggregateSemesterData(
        parseResult.validRows,
        userGradingBands,
        completeSubjectsConfig,
        parseResult.warnings,
        uploadId,
        fileName,
        userSemesterDetails
      );

      (analysisPayload as any).collegeId = collegeId;
      (analysisPayload as any).departmentId = departmentId;
      (analysisPayload as any).collegeName = deptUser?.collegeName || userSemesterDetails?.college;
      (analysisPayload as any).departmentName = deptUser?.departmentName || userSemesterDetails?.department;

      const now = new Date().toISOString();
      const record: StoredSessionRecord = {
        uploadId,
        fileName,
        uploadedAt: now,
        totalStudents: analysisPayload.semesterSummary.totalUniqueStudents,
        totalSubjects: analysisPayload.detectedSubjects.length,
        overallPassPercentage: analysisPayload.semesterSummary.overallPassPercentage,
        cohortMeanPercentage: analysisPayload.semesterSummary.averageSemesterPercentage || 0,
        rawRows: parseResult.validRows,
        parsedWarnings: parseResult.warnings,
        config: {
          gradingBands: userGradingBands,
          subjectsConfig: completeSubjectsConfig,
          semesterDetails: userSemesterDetails,
        },
        latestPayload: analysisPayload,
        createdAt: now,
        updatedAt: now,
        collegeId,
        departmentId,
      };

      const encryptedExcelBlob = encryptBuffer(req.file.buffer);
      const uploadRecordId = `upload_arch_${uploadId}`;
      const semesterVal = userSemesterDetails?.semester || '4th Sem';
      const academicYearVal = userSemesterDetails?.academicYear || '2025-26';
      const examCycleVal = userSemesterDetails?.examination || 'June / July 2025';
      const schemeVal = userSemesterDetails?.scheme || '2022';
      const departmentVal = userSemesterDetails?.department || deptUser?.departmentName || 'Academic Department';

      const uploadArchiveRecord: StoredUploadRecord = {
        id: uploadRecordId,
        semester: semesterVal,
        academicYear: academicYearVal,
        examCycle: examCycleVal,
        scheme: schemeVal,
        department: departmentVal,
        uploadedAt: now,
        originalFilename: fileName,
        excelBlob: encryptedExcelBlob,
        analysisResultId: uploadId,
        createdAt: now,
        collegeId,
        departmentId,
      };

      let excelStoragePath: string | undefined = undefined;
      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          const uploadedStorageKey = await supabaseUploadAnalysisFile(
            req.file.buffer,
            fileName,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            collegeId,
            departmentId
          );
          if (uploadedStorageKey) {
            excelStoragePath = uploadedStorageKey;
          }

          await supabaseSaveAnalysisRecord({
            id: uploadId,
            collegeId,
            departmentId,
            semester: semesterVal,
            academicYear: academicYearVal,
            examCycle: examCycleVal,
            scheme: schemeVal,
            excelFileUrl: excelStoragePath,
            analysisJson: analysisPayload,
            createdBy: deptUser?.email || 'department',
          });

          await supabaseRecordAuditLog('ANALYSIS_CREATED', deptUser?.id || departmentId, 'analysis_records', uploadId, req.ip);
        } catch (sbErr) {
          console.warn('[Supabase Upload Sync Notice]:', sbErr);
        }
      }

      await saveUploadArchive(uploadArchiveRecord, fileHash, collegeId, departmentId);
      await saveAnalysisSession(record, fileHash, collegeId, departmentId);

      res.json(analysisPayload);
    } catch (err: any) {
      console.error('Upload processing error:', err);
      res.status(500).json({ error: `Server error while processing Excel file: ${err.message || 'Unknown error'}` });
    }
  });

  // Re-analyze existing session with updated config
  app.post('/api/reanalyze/:id', uploadLimiter, requireAuthMiddleware, async (req, res) => {
    try {
      const deptUser = (req as any).department;
      const uploadId = req.params.id;
      const session = await getAnalysisSession(uploadId, deptUser?.collegeId, deptUser?.departmentId);
      if (!session) {
        return res.status(404).json({ error: 'Analysis session not found in database or unauthorized.' });
      }

      const { gradingBands, subjectsConfig, semesterDetails } = req.body;

      const newGradingBands: GradingBandConfig = gradingBands || session.config.gradingBands;
      const newSubjectsConfig: Record<string, SubjectConfig> = subjectsConfig || session.config.subjectsConfig;
      const newSemesterDetails = semesterDetails !== undefined ? semesterDetails : (session.config as any)?.semesterDetails;
      if (newSemesterDetails) {
        if (deptUser?.departmentName) {
          newSemesterDetails.department = deptUser.departmentName;
          newSemesterDetails.branch = deptUser.departmentName;
        }
        if (deptUser?.collegeName) {
          newSemesterDetails.college = deptUser.collegeName;
        }
      }

      const updatedPayload = aggregateSemesterData(
        session.rawRows,
        newGradingBands,
        newSubjectsConfig,
        session.parsedWarnings,
        uploadId,
        session.fileName,
        newSemesterDetails
      );

      (updatedPayload as any).collegeId = deptUser?.collegeId;
      (updatedPayload as any).departmentId = deptUser?.departmentId;
      (updatedPayload as any).collegeName = deptUser?.collegeName;
      (updatedPayload as any).departmentName = deptUser?.departmentName;

      const now = new Date().toISOString();
      const updatedRecord: StoredSessionRecord = {
        ...session,
        collegeId: deptUser?.collegeId || session.collegeId,
        departmentId: deptUser?.departmentId || session.departmentId,
        config: {
          gradingBands: newGradingBands,
          subjectsConfig: newSubjectsConfig,
          semesterDetails: newSemesterDetails,
        } as any,
        totalStudents: updatedPayload.semesterSummary.totalUniqueStudents,
        totalSubjects: updatedPayload.detectedSubjects.length,
        overallPassPercentage: updatedPayload.semesterSummary.overallPassPercentage,
        cohortMeanPercentage: updatedPayload.semesterSummary.averageSemesterPercentage || 0,
        latestPayload: updatedPayload,
        updatedAt: now,
      };

      await saveAnalysisSession(updatedRecord, undefined, deptUser?.collegeId, deptUser?.departmentId);

      if (newSemesterDetails) {
        const existingUpload = await getUploadById(uploadId, deptUser?.collegeId, deptUser?.departmentId);
        if (existingUpload) {
          if (newSemesterDetails.semester) existingUpload.semester = newSemesterDetails.semester;
          if (newSemesterDetails.academicYear) existingUpload.academicYear = newSemesterDetails.academicYear;
          if (newSemesterDetails.examination) existingUpload.examCycle = newSemesterDetails.examination;
          if (newSemesterDetails.department || newSemesterDetails.branch) {
            existingUpload.department = newSemesterDetails.department || newSemesterDetails.branch;
          }
          await saveUploadArchive(existingUpload, undefined, deptUser?.collegeId, deptUser?.departmentId);
        }
      }

      if (isSupabaseConfigured() && (await isSupabaseReady())) {
        try {
          await supabaseSaveAnalysisRecord({
            id: uploadId,
            collegeId: deptUser?.collegeId,
            departmentId: deptUser?.departmentId,
            semester: newSemesterDetails?.semester || (session as any).semester || 'Semester',
            academicYear: newSemesterDetails?.academicYear || (session as any).academicYear || 'AcademicYear',
            examCycle: newSemesterDetails?.examination || (session as any).examCycle || 'ExamCycle',
            scheme: newSemesterDetails?.scheme || '2022',
            analysisJson: updatedPayload,
            createdBy: deptUser?.email || 'department',
          });
          await supabaseRecordAuditLog('ANALYSIS_REANALYZED', deptUser?.id || deptUser?.departmentId, 'analysis_records', uploadId, req.ip);
        } catch (sbReErr) {
          console.warn('[Supabase Reanalyze Sync Notice]:', sbReErr);
        }
      }

      res.json(updatedPayload);
    } catch (err: any) {
      console.error('Re-analysis error:', err);
      res.status(500).json({ error: `Re-analysis failed: ${err.message || 'Unknown error'}` });
    }
  });

  // Allow college admin to remove all departments in this college to start fresh
  app.post('/api/colleges/:collegeId/departments/remove-all', requireCollegeAuth, async (req, res) => {
    try {
      const collegeId = req.params.collegeId;
      const callerCollegeId = (req as any).college?.collegeId;
      if (callerCollegeId !== collegeId) {
        return res.status(403).json({ error: 'Unauthorized to modify departments for this college.' });
      }

      const depts = await listDepartments(collegeId);
      for (const d of depts) {
        await deleteDepartment(d.id);
      }

      await logAuditAction({
        action: 'ALL_DEPARTMENTS_PURGED',
        actorId: callerCollegeId,
        targetType: 'college',
        targetId: collegeId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `Successfully removed ${depts.length} department(s). The college now starts fresh with 0 departments.`,
        removedCount: depts.length,
      });
    } catch (err: any) {
      console.error('Error removing all departments:', err);
      res.status(500).json({ error: `Failed to remove departments: ${err.message}` });
    }
  });

  // Run automated backend unit tests on fixtures
  app.get('/api/run-tests', async (req, res) => {
    try {
      const summary = await runBackendUnitTests();
      res.json(summary);
    } catch (err: any) {
      console.error('Test runner execution error:', err);
      res.status(500).json({ error: `Failed to execute tests: ${err.message || 'Unknown error'}` });
    }
  });

  // Start fresh: purge all existing departments right now
  try {
    const purgeRes = await removeAllDepartmentsForFreshStart();
    if (purgeRes.removedCount > 0) {
      console.log(`[Fresh Start] Purged ${purgeRes.removedCount} department(s) to start fresh.`);
    }
  } catch (err: any) {
    console.warn('[Fresh Start] Could not purge departments on startup:', err.message);
  }

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Semester Marks Analyzer server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

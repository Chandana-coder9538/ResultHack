import 'dotenv/config';
import crypto from 'crypto';
import nodemailer, { SendMailOptions } from 'nodemailer';
import { getAppSetting, setAppSetting } from './db.js';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  cc?: string | string[];
}

export type OtpPurpose =
  | 'college_register'
  | 'dept_register'
  | 'reset'
  | 'dept_reset'
  | 'college_delete'
  | 'dept_delete';

export interface OtpRecord {
  id: string;
  email: string;
  code: string;
  codeHash: string;
  purpose: OtpPurpose;
  dataJson?: string;
  expiresAt: string;
  resendAvailableAt: string;
  used: boolean;
  createdAt: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure?: boolean;
}

/**
 * Generates a cryptographically random 6-digit OTP
 */
export function generateSixDigitOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP code for secure database storage
 */
export function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

/**
 * Get active SMTP configuration from SQLite database settings or process.env
 */
export async function getActiveSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    // 1. Check database app_settings first
    const dbHost = await getAppSetting('smtp_host');
    const dbPort = await getAppSetting('smtp_port');
    const dbUser = await getAppSetting('smtp_user');
    const dbPass = await getAppSetting('smtp_pass');
    const dbFrom = await getAppSetting('smtp_from');
    const dbSecure = await getAppSetting('smtp_secure');

    if (dbHost && dbUser && dbPass) {
      const portNum = parseInt(dbPort || '587', 10);
      return {
        host: dbHost.trim(),
        port: isNaN(portNum) ? 587 : portNum,
        user: dbUser.trim(),
        pass: dbPass.trim(),
        from: dbFrom ? dbFrom.trim() : `Academic Result Analysis <${dbUser.trim()}>`,
        secure: dbSecure === 'true' || portNum === 465,
      };
    }
  } catch (err) {
    console.warn('Could not read SMTP settings from database:', err);
  }

  // 2. Fall back to process.env
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const portNum = parseInt(process.env.SMTP_PORT || '587', 10);
    return {
      host: process.env.SMTP_HOST.trim(),
      port: isNaN(portNum) ? 587 : portNum,
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
      from: process.env.SMTP_FROM
        ? process.env.SMTP_FROM.trim()
        : `Academic Result Analysis <${process.env.SMTP_USER.trim()}>`,
      secure: portNum === 465,
    };
  }

  return null;
}

/**
 * Check if SMTP is configured in the environment or database
 */
export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getActiveSmtpConfig();
  return Boolean(config && config.host && config.user && config.pass);
}

/**
 * Save SMTP settings to database
 */
export async function saveSmtpConfig(config: SmtpConfig): Promise<void> {
  await setAppSetting('smtp_host', config.host.trim());
  await setAppSetting('smtp_port', String(config.port || 587));
  await setAppSetting('smtp_user', config.user.trim());
  if (config.pass) {
    await setAppSetting('smtp_pass', config.pass.trim());
  }
  await setAppSetting('smtp_from', config.from.trim());
  await setAppSetting('smtp_secure', config.secure ? 'true' : 'false');
}

/**
 * Create a nodemailer transporter instance with robust provider settings
 */
function createTransporter(config: SmtpConfig) {
  const isGmail = config.host.toLowerCase().includes('gmail') || config.user.toLowerCase().includes('@gmail.com');
  const portNum = Number(config.port) || 587;
  const isPort465 = portNum === 465;
  const useSecure = config.secure !== undefined ? config.secure : isPort465;

  // For Gmail app-specific passwords, users frequently copy the 16 characters with spaces ('abcd efgh ijkl mnop').
  // Stripping spaces ensures authentication succeeds.
  const cleanPass = isGmail ? config.pass.trim().replace(/\s+/g, '') : config.pass.trim();

  const options: any = {
    host: config.host.trim(),
    port: portNum,
    secure: useSecure,
    auth: {
      user: config.user.trim(),
      pass: cleanPass,
    },
    tls: {
      // Prevents self-signed cert rejections in diverse educational server setups
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  };

  // If port 587 on Gmail or standard STARTTLS, require TLS
  if (portNum === 587) {
    options.requireTLS = true;
  }

  return nodemailer.createTransport(options);
}

/**
 * Verify SMTP connection and credentials
 */
export async function verifySmtpConnection(customConfig?: SmtpConfig): Promise<{ success: boolean; message: string }> {
  const config = customConfig || (await getActiveSmtpConfig());
  if (!config || !config.host || !config.user || !config.pass) {
    return {
      success: false,
      message: 'SMTP credentials are incomplete. Host, username, and password are required.',
    };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return {
      success: true,
      message: `Successfully connected to SMTP server ${config.host}:${config.port}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to authenticate with SMTP server.',
    };
  }
}

/**
 * Send email via real SMTP or simulated dev delivery with clear logging
 */
export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; simulated: boolean; message: string; error?: string }> {
  const { to, subject, html, text, cc } = options;
  const config = await getActiveSmtpConfig();

  if (config) {
    try {
      const transporter = createTransporter(config);
      const recipientStr = Array.isArray(to) ? to.join(', ') : to;
      console.log(`[SMTP DISPATCH] Sending real email to: ${recipientStr} via ${config.host}:${config.port}`);

      const mailOptions: SendMailOptions = {
        from: config.from,
        to,
        subject,
        html,
        text,
      };

      if (cc) {
        mailOptions.cc = cc;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[SMTP SUCCESS] Message sent: ${info.messageId} to ${recipientStr}`);

      return {
        success: true,
        simulated: false,
        message: `Real email successfully dispatched to ${recipientStr}`,
      };
    } catch (err: any) {
      console.error('[SMTP ERROR] Failed to send email via SMTP:', err);
      // Return clear error so user can diagnose bad credentials or port
      return {
        success: false,
        simulated: false,
        message: `SMTP delivery failed: ${err.message || 'Unknown network error'}. Please check your SMTP host, port, and app password.`,
        error: err.message,
      };
    }
  }

  // Fallback: Development / Demo Mode when no SMTP credentials are provided
  const recipientStr = Array.isArray(to) ? to.join(', ') : to;
  console.log('====================================================');
  console.log(`[EMAIL SERVICE] Simulated email delivery to: ${recipientStr}`);
  if (cc) {
    console.log(`[EMAIL SERVICE] CC: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  }
  console.log(`[EMAIL SERVICE] Subject: ${subject}`);
  console.log(`[EMAIL SERVICE] Body text:`);
  console.log(text);
  console.log('====================================================');

  return {
    success: true,
    simulated: true,
    message: `SMTP not configured. Real email could not be routed to ${recipientStr} over the network. Configure SMTP to send real emails to your inbox.`,
  };
}

/**
 * Format and send OTP verification email
 */
export async function sendOtpEmail(
  to: string | string[],
  otpCode: string,
  purpose: OtpPurpose,
  entityName?: string,
  additionalDetails?: { collegeName?: string; deptName?: string; deptCode?: string; cc?: string | string[] }
): Promise<{ success: boolean; simulated: boolean; message: string; devOtp?: string; error?: string; smtpConfigured: boolean }> {
  let title = 'Verification Code';
  let contextMsg = 'Please use the following 6-digit One-Time Password (OTP) to complete your verification.';
  let badgeColor = '#2563eb';
  let badgeBg = '#eff6ff';
  let isDestructive = false;

  if (purpose === 'college_register') {
    title = 'College Registration Verification';
    contextMsg = `You are registering ${entityName || 'your college'} on the Result Analysis multi-tenant platform. Enter this 6-digit OTP to verify your official email address.`;
  } else if (purpose === 'dept_register') {
    title = 'Department Registration Verification';
    contextMsg = `You are creating the ${entityName || 'department'} account in ${additionalDetails?.collegeName || 'your college'}. Enter this 6-digit OTP to verify the department official email.`;
  } else if (purpose === 'reset' || purpose === 'dept_reset') {
    title = 'Password Reset Verification Code';
    contextMsg = `A password reset request was initiated for ${Array.isArray(to) ? to.join(', ') : to}. Enter this 6-digit OTP to reset your password. If you did not request this, please ignore this email.`;
  } else if (purpose === 'college_delete') {
    title = 'CRITICAL: College Deletion Authorization';
    contextMsg = `A request has been initiated to permanently delete ${entityName || 'this college'} and ALL its associated departments, student records, and marks analyses. Enter this 6-digit authorization code to confirm deletion.`;
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
    isDestructive = true;
  } else if (purpose === 'dept_delete') {
    title = 'CRITICAL: Department Deletion Authorization';
    const deptInfo = additionalDetails?.deptName ? `${additionalDetails.deptName} (${additionalDetails.deptCode || ''})` : (entityName || 'this department');
    const colInfo = additionalDetails?.collegeName ? ` from ${additionalDetails.collegeName}` : '';
    contextMsg = `A request has been initiated to permanently delete the department "${deptInfo}"${colInfo} along with all its uploaded marks spreadsheets and generated reports. Enter this 6-digit code to authorize deletion.`;
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
    isDestructive = true;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 24px; }
        .badge { display: inline-block; background: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .title { font-size: 20px; font-weight: 700; margin: 12px 0 6px; color: ${isDestructive ? '#991b1b' : '#0f172a'}; }
        .otp-box { background: ${isDestructive ? '#7f1d1d' : '#0f172a'}; color: #ffffff; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; padding: 18px 24px; border-radius: 12px; margin: 24px 0; }
        .warning-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #9f1239; margin: 16px 0; line-height: 1.5; }
        .note { font-size: 13px; color: #64748b; line-height: 1.6; text-align: center; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Result Analysis Platform</span>
          <h2 class="title">${title}</h2>
          <p style="font-size: 14px; color: #475569; margin: 8px 0 0; line-height: 1.5;">${contextMsg}</p>
        </div>
        ${isDestructive ? '<div class="warning-box"><strong>Warning:</strong> This action is irreversible. All data, marks analysis, and historical uploads under this account will be erased permanently upon confirming this code.</div>' : ''}
        <div class="otp-box">${otpCode}</div>
        <p class="note">This verification code is valid for <strong>10 minutes</strong>. If you did not initiate this request, please change your credentials immediately.</p>
        <div class="footer">
          Academic Result Analysis Multi-Tenant Platform • Secure Institutional Vault
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${title}
${contextMsg}

${isDestructive ? 'WARNING: This action is permanent and irreversible.' : ''}

Your 6-Digit OTP Code: ${otpCode}

This code expires in 10 minutes. If you did not make this request, please disregard this email.
  `.trim();

  const recipientStr = Array.isArray(to) ? to.join(', ') : to;

  const result = await sendEmail({
    to,
    cc: additionalDetails?.cc,
    subject: `[${otpCode}] ${title} - Result Analysis Platform`,
    html,
    text,
  });

  return {
    ...result,
    smtpConfigured: !result.simulated,
    // Only return devOtp when delivery was simulated / SMTP unconfigured
    devOtp: result.simulated ? otpCode : undefined,
  };
}


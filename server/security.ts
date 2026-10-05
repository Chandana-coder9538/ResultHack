import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// ==========================================
// 1. DATA ENCRYPTION AT REST (AES-256-GCM)
// ==========================================

// Master encryption key derived from environment or secure local fallback
const MASTER_KEY_SEED = process.env.ENCRYPTION_SECRET || 'ubdt-cse-academic-marks-encryption-vault-2026';
const DERIVED_KEY = crypto.createHash('sha256').update(MASTER_KEY_SEED).digest();
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Encrypt sensitive plain text using AES-256-GCM with a random 12-byte IV
 * and 16-byte authentication tag for tamper resistance.
 */
export function encryptData(plainText: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_KEY, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: enc:v1:<iv_hex>:<authTag_hex>:<cipher_hex>
    return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Data encryption failure:', err);
    throw new Error('Cryptographic vault failed to encrypt sensitive data payload.');
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM, verifying integrity with the auth tag.
 * Gracefully handles legacy unencrypted data.
 */
export function decryptData(cipherOrPlainText: string): string {
  if (!cipherOrPlainText) return cipherOrPlainText;
  
  if (!cipherOrPlainText.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy or unencrypted string, return as-is
    return cipherOrPlainText;
  }

  try {
    const parts = cipherOrPlainText.slice(ENCRYPTED_PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Corrupted or invalid encrypted payload structure.');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err: any) {
    console.error('Decryption / integrity verification failure:', err);
    throw new Error('Integrity check failed: Data was modified or tamper tag mismatch.');
  }
}

/**
 * Encrypt a binary buffer (e.g. uploaded Excel file) using AES-256-GCM via the primary encryption pipeline.
 */
export function encryptBuffer(buffer: Buffer): string {
  return encryptData(buffer.toString('base64'));
}

/**
 * Decrypt a stored AES-256-GCM ciphertext back into its original binary buffer.
 */
export function decryptBuffer(cipherText: string): Buffer {
  const base64Str = decryptData(cipherText);
  return Buffer.from(base64Str, 'base64');
}

// ==========================================
// 2. AI BOT & WEB SCRAPER DEFENSE ENGINE
// ==========================================

// Blacklist of known automated AI scrapers, LLM training bots, and headless extraction tools
export const BLOCKED_AI_SCRAPERS = [
  /gptbot/i,
  /chatgpt-user/i,
  /ccbot/i,
  /anthropic-ai/i,
  /claudebot/i,
  /claude-web/i,
  /bytespider/i,
  /perplexitybot/i,
  /amazonbot/i,
  /diffbot/i,
  /facebookbot/i,
  /meta-externalagent/i,
  /cohere-ai/i,
  /google-extended/i,
  /omgilibot/i,
  /imagesiftbot/i,
  /timpibot/i,
  /scrapy/i,
  /webreaper/i,
  /httrack/i,
  /snoopy/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /dataforseobot/i,
  /petalbot/i,
  /seekport/i,
  /exabot/i,
];

// Suspicious command-line tools and scripting engines targeting private endpoints
export const BLOCKED_SCRIPTING_TOOLS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /wpscan/i,
  /acunetix/i,
  /nessus/i,
  /python-requests/i,
  /aiohttp/i,
  /libwww-perl/i,
  /go-http-client/i,
  /httpx/i,
];

// In-memory security audit log (last 50 security events)
export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  reason: 'AI_BOT_BLOCKED' | 'SUSPICIOUS_TOOL_BLOCKED' | 'ATTACK_SIGNATURE_BLOCKED' | 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS';
  details: string;
}

const securityAuditLog: SecurityAuditEntry[] = [];
let totalBlockedScrapers = 0;
let totalBlockedAttacks = 0;

export function recordSecurityEvent(
  ip: string,
  userAgent: string,
  path: string,
  method: string,
  reason: SecurityAuditEntry['reason'],
  details: string
) {
  if (reason === 'AI_BOT_BLOCKED' || reason === 'SUSPICIOUS_TOOL_BLOCKED') {
    totalBlockedScrapers++;
  } else if (reason === 'ATTACK_SIGNATURE_BLOCKED' || reason === 'RATE_LIMIT_EXCEEDED') {
    totalBlockedAttacks++;
  }

  const entry: SecurityAuditEntry = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ip,
    userAgent: userAgent || 'Unknown / Missing',
    path,
    method,
    reason,
    details,
  };

  securityAuditLog.unshift(entry);
  if (securityAuditLog.length > 50) {
    securityAuditLog.pop();
  }
}

export function getSecurityStats() {
  return {
    encryption: {
      algorithm: 'AES-256-GCM',
      status: 'active',
      authenticatedEncryption: true,
      restProtection: 'Enabled on all student marks records in SQLite',
    },
    defense: {
      antiScrapingShield: 'ACTIVE',
      aiBotsBlockedCount: totalBlockedScrapers,
      attackAttemptsBlockedCount: totalBlockedAttacks,
      totalEventsLogged: securityAuditLog.length,
      strictCsp: 'ACTIVE',
      antiClickjacking: 'ACTIVE',
      antiSniffing: 'ACTIVE',
      noIndexDirectives: 'ACTIVE',
    },
    recentEvents: securityAuditLog.slice(0, 20),
  };
}

/**
 * Middleware: Block automated AI scrapers and suspicious headless extraction tools
 */
export function aiBotBlockerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow health checks
  if (req.path === '/api/health') {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // 1. Check known AI crawlers & scrapers
  for (const botPattern of BLOCKED_AI_SCRAPERS) {
    if (botPattern.test(userAgent)) {
      recordSecurityEvent(
        clientIp,
        userAgent,
        req.path,
        req.method,
        'AI_BOT_BLOCKED',
        `Blocked AI crawler matching rule ${botPattern.source}`
      );
      return res.status(403).json({
        error: 'Access Denied: Automated AI scraping, data extraction, or unauthorized bot crawling is strictly prohibited without explicit institutional consent.',
        code: 'AI_BOT_BLOCKED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 2. Check vulnerability scanners & hostile automated tools
  for (const toolPattern of BLOCKED_SCRIPTING_TOOLS) {
    if (toolPattern.test(userAgent)) {
      recordSecurityEvent(
        clientIp,
        userAgent,
        req.path,
        req.method,
        'SUSPICIOUS_TOOL_BLOCKED',
        `Blocked automated scripting / hacking tool matching rule ${toolPattern.source}`
      );
      return res.status(403).json({
        error: 'Access Denied: Unauthorized automated scripting or security probe detected.',
        code: 'SUSPICIOUS_TOOL_BLOCKED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  next();
}

// ==========================================
// 3. ATTACK PATTERN & INJECTION DEFENSE
// ==========================================

const ATTACK_PATTERNS = [
  /((\%27)|(\'))\s*(union|select|insert|update|delete|drop|truncate|alter)/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript\s*:/i,
  /(\.\.\/|\.\.\\)/i, // Path traversal
  /(etc\/passwd|windows\/system32|win\.ini)/i,
];

/**
 * Middleware: Sanitize URL parameters and block injection or traversal attempts
 */
export function attackFilterMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const fullUrl = req.originalUrl || req.url;

  // Check URL against attack patterns
  for (const pattern of ATTACK_PATTERNS) {
    if (pattern.test(fullUrl)) {
      recordSecurityEvent(
        clientIp,
        userAgent,
        req.path,
        req.method,
        'ATTACK_SIGNATURE_BLOCKED',
        `Blocked potential injection or path traversal pattern in URL: ${pattern.source}`
      );
      return res.status(400).json({
        error: 'Security Alert: Suspicious request parameters detected and rejected by application firewall.',
        code: 'ATTACK_SIGNATURE_BLOCKED',
      });
    }
  }

  next();
}

// ==========================================
// 4. RATE LIMITING ENGINE (ANTI-BRUTE-FORCE)
// ==========================================

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Clean up expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now > bucket.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createRateLimiter(options: { maxRequests: number; windowMs: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${clientIp}`;
    const now = Date.now();

    let bucket = rateLimitStore.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + options.windowMs,
      };
      rateLimitStore.set(key, bucket);
    } else {
      bucket.count++;
    }

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.maxRequests) {
      const userAgent = req.headers['user-agent'] || '';
      recordSecurityEvent(
        clientIp,
        userAgent,
        req.path,
        req.method,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded: ${bucket.count}/${options.maxRequests} requests in ${options.windowMs / 1000}s`
      );

      return res.status(429).json({
        error: 'Too many requests. Temporary security rate limit engaged to prevent automated abuse and brute force.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      });
    }

    next();
  };
}

// ==========================================
// ==========================================
// 5. TOKEN AUTHORIZATION VERIFIER (MULTI-TENANT)
// ==========================================

export interface CollegeTokenPayload {
  collegeId: string;
  email: string;
  name: string;
  exp: number;
}

export interface DepartmentTokenPayload {
  collegeId: string;
  departmentId: string;
  collegeName: string;
  departmentName: string;
  email: string;
  username?: string;
  role?: string;
  exp: number;
}

function signPayload(payloadJson: string): string {
  const hmac = crypto.createHmac('sha256', DERIVED_KEY);
  hmac.update(payloadJson);
  return hmac.digest('hex');
}

export function generateCollegeToken(data: { collegeId: string; email: string; name: string }): string {
  const payload: CollegeTokenPayload = {
    collegeId: data.collegeId,
    email: data.email,
    name: data.name,
    exp: Date.now() + 4 * 60 * 60 * 1000, // 4 hours valid session
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = signPayload(b64);
  return `col_token_${b64}.${sig}`;
}

export function verifyCollegeToken(token: string | null | undefined): CollegeTokenPayload | null {
  if (!token || !token.startsWith('col_token_')) return null;
  try {
    const raw = token.slice('col_token_'.length);
    const [b64, sig] = raw.split('.');
    if (!b64 || !sig) return null;
    const expectedSig = signPayload(b64);
    if (sig !== expectedSig) return null;

    const payload: CollegeTokenPayload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateDepartmentToken(data: {
  collegeId: string;
  departmentId: string;
  collegeName: string;
  departmentName: string;
  email: string;
  username?: string;
  role?: string;
}): string {
  const payload: DepartmentTokenPayload = {
    collegeId: data.collegeId,
    departmentId: data.departmentId,
    collegeName: data.collegeName,
    departmentName: data.departmentName,
    email: data.email,
    username: data.username || data.departmentName,
    role: data.role || 'Department Faculty / Examination Officer',
    exp: Date.now() + 4 * 60 * 60 * 1000, // 4 hours valid session
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = signPayload(b64);
  return `dept_token_${b64}.${sig}`;
}

export function verifyDepartmentToken(token: string | null | undefined): DepartmentTokenPayload | null {
  if (!token) return null;

  // 1. Scoped multi-tenant department token
  if (token.startsWith('dept_token_')) {
    try {
      const raw = token.slice('dept_token_'.length);
      const [b64, sig] = raw.split('.');
      if (!b64 || !sig) return null;
      const expectedSig = signPayload(b64);
      if (sig !== expectedSig) return null;

      const payload: DepartmentTokenPayload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Middleware: Verify authorized college token
 */
export function requireCollegeAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  const college = verifyCollegeToken(token);
  if (college) {
    (req as any).college = college;
    return next();
  }

  // Also check if request carries department token from which college can be derived
  const dept = verifyDepartmentToken(token);
  if (dept) {
    (req as any).college = {
      collegeId: dept.collegeId,
      name: dept.collegeName,
      email: dept.email,
      exp: dept.exp,
    };
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  recordSecurityEvent(
    clientIp,
    userAgent,
    req.path,
    req.method,
    'UNAUTHORIZED_ACCESS',
    `Unauthenticated request to college endpoint ${req.path}`
  );

  return res.status(401).json({
    error: 'Access Denied: College authentication required.',
    code: 'COLLEGE_AUTH_REQUIRED',
  });
}

/**
 * Middleware: Verify authorized department token for sensitive academic records
 */
export function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  const dept = verifyDepartmentToken(token);
  if (dept) {
    (req as any).department = dept;
    (req as any).college = {
      collegeId: dept.collegeId,
      name: dept.collegeName,
      email: dept.email,
    };
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  recordSecurityEvent(
    clientIp,
    userAgent,
    req.path,
    req.method,
    'UNAUTHORIZED_ACCESS',
    `Unauthenticated request to protected data endpoint ${req.path}`
  );

  return res.status(401).json({
    error: 'Access Denied: Valid department authentication credentials required to access examination marks.',
    code: 'AUTH_REQUIRED',
  });
}

// ==========================================
// 6. SHORT-LIVED ACTION VERIFICATION TOKENS
// ==========================================

export interface VerificationTokenPayload {
  email: string;
  purpose: string;
  targetId?: string;
  exp: number;
}

/**
 * Generate a short-lived (15 min) cryptographic token proving successful OTP verification
 */
export function generateVerificationToken(data: {
  email: string;
  purpose: string;
  targetId?: string;
}): string {
  const payload: VerificationTokenPayload = {
    email: data.email.trim().toLowerCase(),
    purpose: data.purpose,
    targetId: data.targetId,
    exp: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = signPayload(b64);
  return `v_token_${b64}.${sig}`;
}

/**
 * Verify a short-lived verification token
 */
export function verifyVerificationToken(token: string | null | undefined): VerificationTokenPayload | null {
  if (!token || !token.startsWith('v_token_')) return null;
  try {
    const raw = token.slice('v_token_'.length);
    const [b64, sig] = raw.split('.');
    if (!b64 || !sig) return null;
    const expectedSig = signPayload(b64);
    if (sig !== expectedSig) return null;

    const payload: VerificationTokenPayload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}


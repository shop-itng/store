import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import paymentsWebhookHandler from './payments/webhook.js';
import { renderTransactionalEmail, type EmailTemplateKey } from '../src/utils/transactionalEmails.js';
import {
  checkRateLimit as checkOtpRateLimit,
  recordRateLimit as recordOtpRateLimit,
  checkResendCooldown as checkOtpResendCooldown,
  checkAndRecordRateLimit,
  saveHashedOtp,
  verifyAndConsumeOtp,
  issueSignupVerificationToken,
  consumeSignupVerificationToken,
  hashOtp,
  savePaymentRecord,
  saveReportRecord,
  getAllReportRecords,
  updateReportStatus,
  type ReportRecord,
} from './db/otpStore.js';
import {
  query as dbQuery,
  withTransaction,
  hashPassword,
  verifyPassword,
  pingPostgres,
  pingRedis,
  runMigration,
  getDatabaseUrl,
} from './db/postgres.js';
import {
  createSession,
  getSession,
  destroySession,
  revokeUserSessions,
  recordLoginFailure,
  isAccountLocked,
  clearLoginFailures,
  logAuditEvent,
  SESSION_COOKIE_NAME,
} from './auth/sessionStore.js';
import {
  requireAuth,
  requireAdmin,
  requireModerator,
  requireFinance,
  requirePaymentsEnabled,
  requirePayoutsEnabled,
  requireCronOrAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  extractToken,
  type AuthenticatedRequest,
} from './auth/middleware.js';
import {
  nairaToKobo,
  koboToNaira,
  calculateTieredServiceFeeKobo,
  encryptSensitiveData,
  decryptSensitiveData,
  sendBrevoDirect,
  sendAdminAlert as dispatchAdminAlert,
  commitPaidOrderTransaction,
  expireStalePendingOrders,
  processUnshippedOrders,
  restoreOrderStockInTx,
} from './lib/payments.js';
import { getKycProvider } from './lib/kycProvider.js';
import marketplaceRouter, { processEscrowAutoRelease } from './routes/marketplace.js';

export const sendAdminAlert = dispatchAdminAlert;

// Run database migrations on server boot
runMigration().catch(err => {
  console.error('[PostgreSQL Startup Migration Error]:', err.message);
});

const app = express();
app.use(cookieParser());

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const APP_URL = (
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'https://shop-itng-pied.vercel.app'
).replace(/\/$/, '');

function getAllowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const defaults = [
    APP_URL,
    'https://shop-itng-pied.vercel.app',
    ...(IS_PROD ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
  ];
  return Array.from(new Set([...defaults, ...extra]));
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strict security headers middleware (zero 'unsafe-inline'/'unsafe-eval' in script-src)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; frame-src 'self' https://checkout.flutterwave.com https://checkout-v2.flutterwave.com https://*.flutterwave.com; connect-src 'self' https://api.flutterwave.com https://checkout.flutterwave.com https://api.brevo.com https://*.ingest.sentry.io https://*.upstash.io; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:;"
  );
  next();
});

// JSON body parser preserving untouched rawBody Buffer for webhook signature verification
app.use(
  express.json({
    limit: '8mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Strict CORS + CSRF Origin enforcement
app.use((req, res, next) => {
  const originHeader = req.headers.origin ? String(req.headers.origin).replace(/\/$/, '') : '';
  const allowedOrigins = getAllowedOrigins();
  const isWebhookPath =
    req.path === '/payments/webhook' ||
    req.path === '/api/payments/webhook';

  const isOriginAllowed = !originHeader || allowedOrigins.includes(originHeader);

  if (originHeader && isOriginAllowed) {
    res.setHeader('Access-Control-Allow-Origin', originHeader);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-session-token, verif-hash'
  );

  if (req.method === 'OPTIONS') {
    if (originHeader && !isOriginAllowed) {
      return res.status(403).json({ status: false, error: 'CORS_ORIGIN_FORBIDDEN', message: 'Origin not allowed.' });
    }
    return res.status(204).end();
  }

  if (!isWebhookPath && originHeader && !isOriginAllowed && !['GET', 'HEAD'].includes(req.method)) {
    return res.status(403).json({ status: false, error: 'CORS_ORIGIN_FORBIDDEN', message: 'Origin not allowed.' });
  }

  // Cookie-based state changes must originate from allowed origins (exempt webhooks & explicit Bearer token callers)
  if (!isWebhookPath && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const hasCookieSession = Boolean(req.cookies?.[SESSION_COOKIE_NAME]);
    const hasExplicitTokenHeader = Boolean(req.headers.authorization || req.headers['x-session-token']);
    if (hasCookieSession && !hasExplicitTokenHeader) {
      let refererOrigin = '';
      if (!originHeader && req.headers.referer) {
        try {
          refererOrigin = new URL(String(req.headers.referer)).origin.replace(/\/$/, '');
        } catch {}
      }
      const effectiveOrigin = originHeader || refererOrigin;
      if (!effectiveOrigin || !allowedOrigins.includes(effectiveOrigin)) {
        return res.status(403).json({ status: false, error: 'CSRF_ORIGIN_FORBIDDEN', message: 'Invalid request origin.' });
      }
    }
  }

  next();
});

function getFlwSecretKey(): string {
  return (process.env.FLW_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
}

function getFlwWebhookHash(): string {
  return (process.env.FLW_WEBHOOK_SECRET_HASH || '').trim().replace(/^["']|["']$/g, '');
}

function getFlwPublicKey(): string {
  return (process.env.FLW_PUBLIC_KEY || process.env.VITE_FLW_PUBLIC_KEY || '').trim().replace(/^["']|["']$/g, '');
}

const ENV_NIN_HASH_SALT = (process.env.NIN_HASH_SALT || '').trim();
const ENV_DOC_TOKEN_SECRET = (process.env.DOC_TOKEN_SECRET || '').trim();
const DEV_EPHEMERAL_NIN_SALT = crypto.randomBytes(32).toString('hex');
const DEV_EPHEMERAL_DOC_SECRET = crypto.randomBytes(32).toString('hex');

if (IS_PROD && (!ENV_NIN_HASH_SALT || !ENV_DOC_TOKEN_SECRET)) {
  console.error('[SECURITY CRITICAL] NIN_HASH_SALT or DOC_TOKEN_SECRET missing in production.');
}

function getNinSalt(): string {
  if (ENV_NIN_HASH_SALT) return ENV_NIN_HASH_SALT;
  if (IS_PROD) throw new Error('NIN_HASH_SALT must be configured in production.');
  return DEV_EPHEMERAL_NIN_SALT;
}

function getDocSecret(): string {
  if (ENV_DOC_TOKEN_SECRET) return ENV_DOC_TOKEN_SECRET;
  if (IS_PROD) throw new Error('DOC_TOKEN_SECRET must be configured in production.');
  return DEV_EPHEMERAL_DOC_SECRET;
}

function hashNin(nin: string): string {
  return crypto.createHmac('sha256', getNinSalt()).update(nin.trim()).digest('hex');
}

function generateDocToken(docId: string, expiresInMs = 60 * 60 * 1000): { token: string; expires: number; url: string } {
  const expires = Date.now() + expiresInMs;
  const signature = crypto.createHmac('sha256', getDocSecret()).update(`${docId}:${expires}`).digest('hex');
  const token = `${signature}.${expires}`;
  return { token, expires, url: `/api/verification/document/${encodeURIComponent(docId)}?token=${encodeURIComponent(token)}` };
}

function verifyDocToken(docId: string, token: string): boolean {
  try {
    const [sig, expStr] = token.split('.');
    const expires = Number(expStr);
    if (!sig || !expires || Date.now() > expires) return false;
    const expectedSig = crypto.createHmac('sha256', getDocSecret()).update(`${docId}:${expires}`).digest('hex');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

const VALID_EMAIL_TEMPLATES = new Set<EmailTemplateKey>([
  'signup_code',
  'new_device_login',
  'password_reset',
  'withdrawal_code',
  'new_payout_account_code',
  'order_placed_buyer',
  'new_order_seller',
  'order_shipped_buyer',
  'item_received_seller',
  'auto_release_reminder',
  'dispute_opened',
  'dispute_resolved',
  'seller_verified',
  'verification_not_approved',
  'welcome',
]);

const router = express.Router();
router.use(marketplaceRouter);

// Health check
router.get(['/health', '/api/health'], async (_req, res) => {
  const pgPing = await pingPostgres();
  const redisPing = await pingRedis();
  const isPgOk = pgPing.ok;
  const hasRedisConfig = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const isRedisOk = !hasRedisConfig || redisPing.ok;

  if (isPgOk && isRedisOk) {
    return res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  }

  const failingServices: string[] = [];
  if (!isPgOk) failingServices.push('Neon Postgres');
  if (!isRedisOk) failingServices.push('Upstash Redis');
  return res.status(503).json({ status: 'ERROR', failing: failingServices.join(', '), timestamp: new Date().toISOString() });
});

// ============================================================================
// AUTHENTICATION & USER GOVERNANCE
// ============================================================================

router.post(['/auth/register', '/auth/signup'], async (req, res) => {
  try {
    const clientIp = req.ip || 'unknown';
    const rl = await checkAndRecordRateLimit(`register:${clientIp}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many signup requests. Please wait before trying again.' });
    }

    const {
      name,
      email,
      password,
      role = 'buyer',
      age,
      hasGuardianConsent,
      guardianName,
      shopName,
      campus,
      location,
      bio,
      signupVerificationToken,
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ status: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanPassword = String(password).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ status: false, message: 'Please provide a valid email address.' });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({ status: false, message: 'Password must be at least 8 characters long.' });
    }

    if (age === undefined || age === null || String(age).trim() === '') {
      return res.status(400).json({ status: false, message: 'Age is required to register on Shop It.' });
    }

    const parsedAge = parseInt(String(age), 10);
    if (isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120) {
      return res.status(400).json({ status: false, message: 'You must be at least 10 years old to register on Shop It.' });
    }

    if (parsedAge < 18 && (!hasGuardianConsent || !guardianName || !String(guardianName).trim())) {
      return res.status(400).json({
        status: false,
        message: 'Parent or guardian consent and guardian name are required for users under 18.',
      });
    }

    // Consume single-use server-issued signup OTP verification proof token
    const isOtpVerified = await consumeSignupVerificationToken(cleanEmail, String(signupVerificationToken || ''));
    if (!isOtpVerified) {
      return res.status(403).json({
        status: false,
        error: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Please verify your email with the 6-digit OTP code before creating an account.',
      });
    }

    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = hashPassword(cleanPassword);
    const userRole = role === 'seller' ? 'seller' : 'buyer';

    const txResult = await withTransaction(async client => {
      const existing = await client.query('SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
      if (existing.rows.length > 0) {
        return { conflict: true as const };
      }

      const userInsert = await client.query(
        `INSERT INTO shopit_users (
          id, email, name, password_hash, role, is_verified_email, age, has_guardian_consent, guardian_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, name, role, is_verified_email, age, has_guardian_consent, guardian_name, created_at`,
        [
          userId,
          cleanEmail,
          cleanName,
          passwordHash,
          userRole,
          parsedAge,
          parsedAge < 18 ? Boolean(hasGuardianConsent) : true,
          guardianName ? String(guardianName).trim() : null,
        ]
      );

      let sellerProfile: any = null;
      if (userRole === 'seller') {
        const cleanShop = (shopName || `${cleanName}'s Shop`).trim();
        const sellerInsert = await client.query(
          `INSERT INTO shopit_sellers (
            id, user_id, shop_name, owner_name, email, bio, campus, location_state, location_city, location_area,
            is_verified_seller, verification_status, under_18, guardian_consent, guardian_name, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, 'not_started', $11, $12, $13, NOW(), NOW())
          RETURNING *`,
          [
            userId,
            userId,
            cleanShop,
            cleanName,
            cleanEmail,
            bio ? String(bio).trim() : '',
            campus ? String(campus).trim() : 'Lagos Mainland',
            location?.state || 'Lagos',
            location?.city || 'Lagos Mainland',
            location?.area || 'Yaba',
            parsedAge < 18,
            Boolean(hasGuardianConsent),
            guardianName ? String(guardianName).trim() : null,
          ]
        );
        sellerProfile = sellerInsert.rows[0];

        await client.query(
          `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
           VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
           ON CONFLICT (seller_id) DO NOTHING`,
          [userId]
        );
      }

      return { conflict: false as const, savedUser: userInsert.rows[0], sellerProfile };
    });

    if (txResult.conflict) {
      return res.status(409).json({
        status: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    const { token } = await createSession({
      userId,
      email: cleanEmail,
      name: cleanName,
      role: userRole,
      isVerifiedSeller: false,
      mustChangePassword: false,
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(201).json({
      status: true,
      sessionToken: token,
      user: {
        id: txResult.savedUser.id,
        email: txResult.savedUser.email,
        name: txResult.savedUser.name,
        role: txResult.savedUser.role,
        isVerifiedEmail: Boolean(txResult.savedUser.is_verified_email),
        age: txResult.savedUser.age,
        hasGuardianConsent: txResult.savedUser.has_guardian_consent,
        guardianName: txResult.savedUser.guardian_name,
        createdAt: txResult.savedUser.created_at,
        sellerProfile: txResult.sellerProfile,
      },
      message: 'Account successfully registered and saved to database.',
    });
  } catch (err: any) {
    console.error('[User Registration Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error saving user account. Please try again.' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const clientIp = req.ip || 'unknown';
    const ipLimit = await checkAndRecordRateLimit(`login_ip:${clientIp}`, 30, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return res.status(429).json({
        status: false,
        error: 'RATE_LIMITED',
        message: 'Too many login attempts. Please wait a few minutes and try again.',
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ status: false, message: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    const lockout = await isAccountLocked(cleanEmail);
    if (lockout.locked) {
      return res.status(429).json({
        status: false,
        error: 'ACCOUNT_LOCKED',
        message: `Account temporarily locked due to repeated failed logins. Please wait ${lockout.remainingSeconds} seconds.`,
        lockoutRemainingSeconds: lockout.remainingSeconds,
      });
    }

    const userRes = await dbQuery(
      `SELECT u.*, s.id as seller_id, s.shop_name, s.verification_status, s.is_verified_seller, s.bio, s.campus
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON u.id = s.user_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      await recordLoginFailure(cleanEmail);
      return res.status(401).json({
        status: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const userRow = userRes.rows[0];
    const isPasswordValid = verifyPassword(cleanPassword, userRow.password_hash);
    if (!isPasswordValid) {
      const fail = await recordLoginFailure(cleanEmail);
      if (fail.locked) {
        return res.status(429).json({
          status: false,
          error: 'ACCOUNT_LOCKED',
          message: 'Too many failed login attempts. Account temporarily locked for 15 minutes.',
        });
      }
      return res.status(401).json({
        status: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    if (userRow.is_verified_email === false) {
      return res.status(403).json({
        status: false,
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Your email address has not been verified yet. Please verify your email code first.',
      });
    }

    if (userRow.is_banned) {
      return res.status(403).json({
        status: false,
        error: 'ACCOUNT_BANNED',
        message: userRow.ban_reason || 'This account has been suspended by an administrator.',
      });
    }

    await clearLoginFailures(cleanEmail);
    await dbQuery('UPDATE shopit_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [userRow.id]);

    const { token } = await createSession({
      userId: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      subRole: userRow.role === 'admin' && userRow.sub_role ? userRow.sub_role : undefined,
      sellerId: userRow.seller_id || undefined,
      isVerifiedSeller: Boolean(userRow.is_verified_seller),
      mustChangePassword: Boolean(userRow.must_change_password),
      tokenVersion: Number(userRow.token_version || 1),
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await logAuditEvent({
      action: 'USER_LOGIN',
      actor: { id: userRow.id, email: userRow.email, role: userRow.role },
      target: { type: 'session', id: token.slice(-8) },
      details: { role: userRow.role, mustChangePassword: userRow.must_change_password },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const sanitizedUser: any = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      isVerifiedEmail: Boolean(userRow.is_verified_email),
      age: userRow.age,
      hasGuardianConsent: Boolean(userRow.has_guardian_consent),
      guardianName: userRow.guardian_name,
      createdAt: userRow.created_at,
      lastLoginAt: new Date().toISOString(),
    };

    if (userRow.role === 'seller' || userRow.seller_id) {
      sanitizedUser.sellerProfile = {
        id: userRow.seller_id || userRow.id,
        shopName: userRow.shop_name || `${userRow.name}'s Shop`,
        verificationStatus: userRow.verification_status || 'not_started',
        isVerifiedSeller: Boolean(userRow.is_verified_seller),
        bio: userRow.bio || '',
        campus: userRow.campus || 'Lagos Mainland',
      };
    }

    return res.json({
      status: true,
      sessionToken: token,
      user: sanitizedUser,
      mustChangePassword: Boolean(userRow.must_change_password),
      message: 'Login successful.',
    });
  } catch (err: any) {
    console.error('[User Login Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error processing login.' });
  }
});

router.post('/auth/logout', async (req: AuthenticatedRequest, res) => {
  const token = extractToken(req);
  if (token) {
    await destroySession(token);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  return res.json({ status: true, message: 'Logged out successfully.' });
});

router.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 8) {
      return res.status(400).json({ status: false, message: 'New password must be at least 8 characters long.' });
    }

    const cleanNew = String(newPassword).trim();
    const userId = req.user!.userId;

    const userRes = await dbQuery(
      'SELECT u.id, u.email, u.name, u.role, u.sub_role, s.id AS seller_id, s.is_verified_seller, u.password_hash, u.must_change_password FROM shopit_users u LEFT JOIN shopit_sellers s ON u.id = s.user_id WHERE u.id = $1',
      [userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const userRow = userRes.rows[0];
    if (!userRow.must_change_password) {
      if (!currentPassword || !verifyPassword(String(currentPassword).trim(), userRow.password_hash)) {
        return res.status(401).json({ status: false, message: 'Current password is incorrect.' });
      }
    }

    const newHash = hashPassword(cleanNew);
    await dbQuery(
      'UPDATE shopit_users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    // Revoke ALL existing sessions, then create a fresh valid session for this caller
    await revokeUserSessions(userId);
    const { token } = await createSession({
      userId,
      email: req.user!.email,
      name: req.user!.name,
      role: req.user!.role,
      subRole: req.user!.subRole,
      sellerId: req.user!.sellerId,
      isVerifiedSeller: req.user!.isVerifiedSeller,
      mustChangePassword: false,
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await logAuditEvent({
      action: 'PASSWORD_CHANGED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id: userId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, sessionToken: token, message: 'Password changed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ status: false, message: 'Email, 6-digit code, and new password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim().replace(/\D/g, '');
    const cleanPassword = String(newPassword).trim();

    const rl = await checkAndRecordRateLimit(`reset_pw:${cleanEmail}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many reset attempts. Please try again later.' });
    }

    if (cleanCode.length !== 6) {
      return res.status(400).json({ status: false, message: 'Reset code must be a 6-digit number.' });
    }

    if (cleanPassword.length < 8) {
      return res.status(400).json({ status: false, message: 'New password must be at least 8 characters long.' });
    }

    // Atomic OTP verification with SELECT ... FOR UPDATE (prevents brute force / parallel retries)
    const otpResult = await verifyAndConsumeOtp(cleanEmail, 'password_reset', cleanCode);
    if (!otpResult.success) {
      return res.status(400).json({
        status: false,
        message: otpResult.error || 'Invalid or expired reset code.',
        attemptsRemaining: otpResult.attemptsRemaining,
      });
    }

    const userCheck = await dbQuery('SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ status: false, message: 'Unable to reset password for this account.' });
    }

    const userId = userCheck.rows[0].id;
    const newHash = hashPassword(cleanPassword);
    await dbQuery('UPDATE shopit_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
    await revokeUserSessions(userId);

    return res.json({
      status: true,
      message: 'Your password has been reset successfully! All older sessions were signed out.',
    });
  } catch (err: any) {
    console.error('[Password Reset Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error updating password.' });
  }
});

// Strict session-only profile hydration (no ?email or ?userId unauthenticated spoofing)
router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionUser = req.user!;
    const result = await dbQuery(
      `SELECT u.id, u.email, u.name, u.role, u.sub_role, u.is_verified_email, u.is_banned, u.ban_reason,
              u.age, u.has_guardian_consent, u.guardian_name, u.created_at, u.last_login_at,
              s.id as seller_id, s.shop_name, s.bio, s.campus, s.is_verified_seller as seller_is_verified,
              s.verification_status as seller_verification_status,
              s.verified_legal_name, s.verified_nin_last4, s.verified_at
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [sessionUser.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const row = result.rows[0];
    const isVerified = Boolean(
      row.seller_is_verified ||
      row.seller_verification_status === 'verified' ||
      row.seller_verification_status === 'approved'
    );
    const currentStatus = isVerified ? 'verified' : (row.seller_verification_status || 'not_started');

    const sanitizedUser: any = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      subRole: row.role === 'admin' ? row.sub_role || undefined : undefined,
      isVerifiedEmail: Boolean(row.is_verified_email),
      isVerifiedSeller: isVerified,
      verificationStatus: currentStatus,
      isBanned: Boolean(row.is_banned),
      banReason: row.ban_reason,
      age: row.age,
      hasGuardianConsent: Boolean(row.has_guardian_consent),
      guardianName: row.guardian_name,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };

    if (row.role === 'seller' || row.seller_id) {
      sanitizedUser.sellerProfile = {
        id: row.seller_id || row.id,
        shopName: row.shop_name || `${row.name}'s Shop`,
        verificationStatus: currentStatus,
        isVerifiedSeller: isVerified,
        bio: row.bio || '',
        campus: row.campus || 'Lagos Mainland',
        verifiedLegalName: row.verified_legal_name,
        verifiedNinLast4: row.verified_nin_last4,
        verifiedAt: row.verified_at,
        badges: isVerified ? ['verified'] : [],
      };
    }

    return res.json({ status: true, user: sanitizedUser, isVerifiedSeller: isVerified, verificationStatus: currentStatus });
  } catch (err: any) {
    console.error('[Auth Me Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error fetching profile.' });
  }
});

// ============================================================================
// ADMIN GOVERNANCE ROUTES (Strictly Authenticated + Sub-Role Enforced)
// ============================================================================

router.get('/admin/users', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const role = req.query.role ? String(req.query.role).trim() : 'all';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '15'), 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(LOWER(u.name) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (role && role !== 'all') {
      conditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await dbQuery(`SELECT COUNT(*) as total FROM shopit_users u ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT u.id, u.email, u.name, u.role, u.is_verified_email, u.age, u.has_guardian_consent,
             u.guardian_name, u.is_banned, u.ban_reason, u.last_login_at, u.created_at,
             s.id as seller_id, s.shop_name, s.verification_status, s.is_verified_seller
      FROM shopit_users u
      LEFT JOIN shopit_sellers s ON u.id = s.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const usersRes = await dbQuery(dataSql, [...params, limit, offset]);

    const users = usersRes.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isVerifiedEmail: Boolean(row.is_verified_email),
      age: row.age,
      hasGuardianConsent: Boolean(row.has_guardian_consent),
      guardianName: row.guardian_name,
      isBanned: Boolean(row.is_banned),
      banReason: row.ban_reason,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      shopName: row.shop_name,
      verificationStatus: row.verification_status || (row.role === 'seller' ? 'not_started' : 'not_applicable'),
      isVerifiedSeller: Boolean(row.is_verified_seller),
    }));

    return res.json({ status: true, users, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err: any) {
    console.error('[Admin Users Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error reading users.' });
  }
});

router.delete('/admin/users/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (id === req.user!.userId) {
      return res.status(400).json({ status: false, message: 'Administrators cannot delete their own account.' });
    }
    await revokeUserSessions(id);
    await dbQuery('DELETE FROM shopit_users WHERE id = $1', [id]);
    await logAuditEvent({
      action: 'ADMIN_USER_DELETED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: 'User deleted from database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/admin/users/:id/ban', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { isBanned, banReason } = req.body;
    await dbQuery(
      'UPDATE shopit_users SET is_banned = $1, ban_reason = $2, updated_at = NOW() WHERE id = $3',
      [Boolean(isBanned), banReason || null, id]
    );
    if (Boolean(isBanned)) {
      await revokeUserSessions(id);
    }
    await logAuditEvent({
      action: isBanned ? 'ADMIN_USER_BANNED' : 'ADMIN_USER_UNBANNED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id },
      details: { banReason },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: `User ban status updated to ${Boolean(isBanned)}.` });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/admin/users/:id/reset-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 8) {
      return res.status(400).json({ status: false, message: 'New password must be at least 8 characters.' });
    }
    const hash = hashPassword(String(newPassword).trim());
    await dbQuery('UPDATE shopit_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);
    await revokeUserSessions(id);
    await logAuditEvent({
      action: 'ADMIN_PASSWORD_RESET',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: 'User password updated and active sessions revoked.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/admin/sellers/:id/verify', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;
    const status = isVerified ? 'verified' : 'rejected';

    await withTransaction(async client => {
      const updateRes = await client.query(
        `UPDATE shopit_sellers
         SET is_verified_seller = $1,
             verification_status = $2,
             verified_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id = $3 OR user_id = $3 OR LOWER(email) = LOWER($3)`,
        [Boolean(isVerified), status, id]
      );

      if (updateRes.rowCount === 0) {
        await client.query(
          `INSERT INTO shopit_sellers (
             id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, verified_at, created_at, updated_at
           )
           SELECT u.id, u.id, COALESCE(u.name || '''s Shop', 'Artisan Shop'), u.name, u.email, $1, $2, CASE WHEN $1 = true THEN NOW() ELSE NULL END, NOW(), NOW()
           FROM shopit_users u
           WHERE u.id = $3 OR LOWER(u.email) = LOWER($3)
           ON CONFLICT (id) DO UPDATE SET is_verified_seller = $1, verification_status = $2, updated_at = NOW()`,
          [Boolean(isVerified), status, id]
        );
      }

      await client.query(
        `UPDATE shopit_users
         SET role = CASE WHEN $1 = true AND role = 'buyer' THEN 'seller' ELSE role END,
             updated_at = NOW()
         WHERE id = $2 OR LOWER(email) = LOWER($2) OR id IN (SELECT user_id FROM shopit_sellers WHERE id = $2)`,
        [Boolean(isVerified), id]
      );

      await client.query(
        `UPDATE shopit_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             document_url = '[Deleted after review decision]',
             selfie_url = '[Deleted after review decision]',
             updated_at = NOW()
         WHERE seller_id = $3 OR user_id = $3 OR id = $3`,
        [status, req.user!.email, id]
      );

      await client.query(
        `DELETE FROM shopit_verification_documents
         WHERE seller_id = $1
            OR seller_id IN (SELECT id FROM shopit_sellers WHERE id = $1 OR user_id = $1)`,
        [id]
      );
    });

    await logAuditEvent({
      action: isVerified ? 'ADMIN_SELLER_VERIFIED' : 'ADMIN_SELLER_REJECTED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'seller', id },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      isVerifiedSeller: Boolean(isVerified),
      verificationStatus: status,
      message: `Seller verification updated to ${Boolean(isVerified)}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// List under-18 guardian payout accounts awaiting one-time Admin approval
router.get('/admin/payout-accounts/pending', requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const wRes = await dbQuery(
      `SELECT w.seller_id, w.payout_accounts, s.shop_name, s.owner_name, s.guardian_name, s.under_18, u.age
       FROM shopit_wallets w
       LEFT JOIN shopit_sellers s ON (s.id = w.seller_id OR s.user_id = w.seller_id)
       LEFT JOIN shopit_users u ON u.id = s.user_id`
    );

    const pendingApprovals: any[] = [];
    for (const row of wRes.rows) {
      const accounts: any[] = Array.isArray(row.payout_accounts) ? row.payout_accounts : [];
      for (const acc of accounts) {
        if (acc && acc.adminApproved === false) {
          pendingApprovals.push({
            sellerId: row.seller_id,
            shopName: row.shop_name || 'Artisan Shop',
            ownerName: row.owner_name || 'Seller',
            guardianName: row.guardian_name || acc.guardianName || '',
            sellerAge: row.age ?? null,
            accountId: acc.id,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            accountName: acc.accountName,
            createdAt: acc.createdAt,
          });
        }
      }
    }

    return res.json({ status: true, pendingApprovals });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// One-time Admin approval for an under-18 seller's guardian payout account
router.post('/admin/wallets/:sellerId/payout-accounts/:accountId/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { sellerId, accountId } = req.params;
    const wRes = await dbQuery('SELECT seller_id, payout_accounts FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
    if (wRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Seller wallet not found.' });
    }

    const accounts: any[] = Array.isArray(wRes.rows[0].payout_accounts) ? wRes.rows[0].payout_accounts : [];
    const targetAcc = accounts.find(a => a.id === accountId);
    if (!targetAcc) {
      return res.status(404).json({ status: false, message: 'Payout account not found.' });
    }

    const updated = accounts.map(a =>
      a.id === accountId
        ? {
            ...a,
            adminApproved: true,
            adminApprovedBy: req.user!.email,
            adminApprovedAt: new Date().toISOString(),
          }
        : a
    );

    await dbQuery('UPDATE shopit_wallets SET payout_accounts = $1, updated_at = NOW() WHERE seller_id = $2', [
      JSON.stringify(updated),
      sellerId,
    ]);

    await logAuditEvent({
      action: 'MINOR_PAYOUT_ACCOUNT_APPROVED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'wallet', id: sellerId },
      details: { accountId, accountName: targetAcc.accountName, last4: String(targetAcc.accountNumber || '').slice(-4) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      message: 'Guardian payout account approved for withdrawals.',
      account: updated.find(a => a.id === accountId),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// Admin hold toggle (pauses automated Day-5 unshipped auto-refund/cancellation on held orders)
router.patch('/admin/orders/:orderId/hold', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { orderId } = req.params;
    const hold = Boolean(req.body?.hold);
    const upd = await dbQuery(
      'UPDATE shopit_orders SET admin_hold = $1, updated_at = NOW() WHERE id = $2 RETURNING id, admin_hold',
      [hold, orderId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Order not found.' });
    }

    await logAuditEvent({
      action: 'ORDER_ADMIN_HOLD_UPDATED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'order', id: orderId },
      details: { adminHold: hold },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, orderId, adminHold: Boolean(upd.rows[0].admin_hold) });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.all('/admin/users/wipe-non-admins', requireAdmin, (_req: AuthenticatedRequest, res) => {
  return res.status(410).json({
    status: false,
    error: 'ENDPOINT_DISABLED',
    message: 'This destructive endpoint has been permanently disabled for safety and security.',
  });
});

router.get('/admin/metrics', requireModerator, async (_req: AuthenticatedRequest, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [userStats, sellerStats, verifStats] = await Promise.all([
      dbQuery(
        `SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_today,
          COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
          COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers
        FROM shopit_users`,
        [todayStart.toISOString()]
      ),
      dbQuery(`SELECT COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_sellers FROM shopit_sellers`),
      dbQuery(`SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verifications FROM shopit_verifications`),
    ]);

    const pgPing = await pingPostgres();
    const redisPing = await pingRedis();

    return res.json({
      status: true,
      metrics: {
        totalUsers: parseInt(userStats.rows[0].total_users || '0', 10),
        newToday: parseInt(userStats.rows[0].new_today || '0', 10),
        totalSellers: parseInt(userStats.rows[0].total_sellers || '0', 10),
        totalBuyers: parseInt(userStats.rows[0].total_buyers || '0', 10),
        verifiedSellers: parseInt(sellerStats.rows[0].verified_sellers || '0', 10),
        pendingVerifications: parseInt(verifStats.rows[0].pending_verifications || '0', 10),
      },
      database: {
        neon: pgPing.ok && !pgPing.isPgMem,
        isPgMem: Boolean(pgPing.isPgMem),
        redis: redisPing.ok,
        provider: pgPing.provider,
        databaseUrlConfigured: Boolean(getDatabaseUrl()),
        redisConfigured: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
      },
    });
  } catch (err: any) {
    console.error('[Admin Metrics Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error reading metrics.' });
  }
});

router.get('/admin/export-data', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [payRes, repRes, verifRes, ordRes] = await Promise.all([
      dbQuery('SELECT reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, created_at FROM shopit_payments ORDER BY created_at DESC LIMIT 500'),
      dbQuery('SELECT id, target_type, target_id, target_title, reason, status, created_at FROM shopit_reports ORDER BY created_at DESC LIMIT 500'),
      dbQuery('SELECT id, seller_id, shop_name, owner_name, id_type, id_number_masked, under_18, status, submitted_at, reviewed_at FROM shopit_verifications ORDER BY submitted_at DESC LIMIT 500'),
      dbQuery('SELECT id, buyer_id, subtotal_kobo, service_fee_kobo, delivery_fee_kobo, grand_total_kobo, status, payment_reference, created_at FROM shopit_orders ORDER BY created_at DESC LIMIT 500'),
    ]);

    const exportPayload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.email,
      platform: 'Shop It Nigeria (TEEDS)',
      summary: {
        totalPayments: payRes.rows.length,
        totalReports: repRes.rows.length,
        totalVerifications: verifRes.rows.length,
        totalOrders: ordRes.rows.length,
      },
      payments: payRes.rows,
      reports: repRes.rows,
      verifications: verifRes.rows,
      orders: ordRes.rows,
    };

    await logAuditEvent({
      action: 'ADMIN_DATA_EXPORTED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'system', id: 'export' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="shopit-backup-${Date.now()}.json"`);
    return res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// PAYMENTS / ESCROW / PAYOUTS / REFUND ROUTES
// ============================================================================

router.get('/payments/config', (_req, res) => {
  res.json({
    status: true,
    gateway: 'flutterwave',
    publicKey: getFlwPublicKey(),
    isSecretConfigured: Boolean(getFlwSecretKey()),
    isWebhookSecretConfigured: Boolean(getFlwWebhookHash()),
    webhookPath: '/api/payments/webhook',
    webhookUrl: `${APP_URL}/api/payments/webhook`,
    minWithdrawal: 1000,
    coolingPeriodHours: 24,
  });
});

router.get('/payments/webhook-info', (_req, res) => {
  res.json({
    gateway: 'flutterwave',
    webhookPath: '/api/payments/webhook',
    webhookUrl: `${APP_URL}/api/payments/webhook`,
    method: 'POST',
    signatureHeader: 'verif-hash',
    isConfigured: Boolean(getFlwSecretKey() && getFlwWebhookHash()),
  });
});

router.get('/payments/banks', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({
      status: false,
      error: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'Bank directory is unavailable because FLW_SECRET_KEY is not configured.',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let bankRes: Response;
    let bankData: any;
    try {
      bankRes = await fetch('https://api.flutterwave.com/v3/banks/NG', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      bankData = await bankRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!bankRes.ok || bankData?.status !== 'success' || !Array.isArray(bankData?.data)) {
      return res.status(502).json({
        status: false,
        message: bankData?.message || 'Unable to load supported Nigerian banks from Flutterwave.',
      });
    }

    const banks = bankData.data
      .filter((b: any) => b && b.code && b.name)
      .map((b: any) => ({
        code: String(b.code).trim(),
        name: String(b.name).trim(),
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return res.json({ status: true, banks });
  } catch (err: any) {
    return res.status(502).json({ status: false, message: `Bank list lookup failed: ${err.message}` });
  }
});

router.post('/payments/resolve-account', requireAuth, async (req: AuthenticatedRequest, res) => {
  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({
      status: false,
      error: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'Account resolution requires FLW_SECRET_KEY.',
    });
  }

  const accountNumber = String(req.body?.accountNumber || '').trim();
  const bankCode = String(req.body?.bankCode || '').trim();

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return res.status(400).json({ status: false, message: 'Valid 10-digit accountNumber and bankCode are required.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resolveRes: Response;
    let resolveData: any;
    try {
      resolveRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: accountNumber,
          account_bank: bankCode,
        }),
        signal: controller.signal,
      });
      resolveData = await resolveRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!resolveRes.ok || resolveData?.status !== 'success' || !resolveData?.data?.account_name) {
      return res.status(400).json({
        status: false,
        message: resolveData?.message || 'Could not resolve Nigerian bank account with Flutterwave.',
      });
    }

    return res.json({
      status: true,
      accountNumber: String(resolveData.data.account_number || accountNumber),
      accountName: String(resolveData.data.account_name).trim(),
      bankCode,
    });
  } catch (err: any) {
    return res.status(502).json({ status: false, message: `Account verification error: ${err.message}` });
  }
});

router.post('/payments/initialize', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const rl = await checkAndRecordRateLimit(`pay_init:${user.userId}`, 20, 5 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many checkout attempts. Please wait a minute.' });
    }

    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({
        status: false,
        error: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'Payment gateway is not configured on this server.',
      });
    }

    const { items, couponCode, campus, deliveryArea, pickupPoint, paymentMethod } = req.body;
    const buyerEmail = user.email;

    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ status: false, message: 'Valid cart items are required.' });
    }

    const initializedOrder = await withTransaction(async client => {
      const resolvedItems: any[] = [];
      const sellerGroups = new Map<string, { deliveryFeeKobo: number }>();

      let subtotalKobo = 0;
      let serviceFeeKobo = 0;

      for (const reqItem of items) {
        const productId = String(reqItem.productId || '').trim();
        const qty = Math.max(1, Math.min(50, Math.floor(Number(reqItem.quantity) || 1)));
        const deliveryMethod = reqItem.deliveryMethod === 'pickup' ? 'pickup' : 'delivery';

        if (!productId) {
          throw Object.assign(new Error('Each cart item must include productId.'), { statusCode: 400 });
        }

        const pRes = await client.query(
          `SELECT id, seller_id, seller_shop_name, seller_campus, title, images,
                  seller_price, stock, is_sold_out, delivery_pickup_fee, delivery_local_fee
           FROM shopit_products
           WHERE id = $1
           FOR UPDATE`,
          [productId]
        );

        if (pRes.rows.length === 0) {
          throw Object.assign(new Error(`Product "${productId}" was not found.`), { statusCode: 404 });
        }

        const p = pRes.rows[0];
        if (String(p.seller_id) === String(user.userId) || (user.sellerId && String(p.seller_id) === String(user.sellerId))) {
          throw Object.assign(new Error('You cannot buy your own product.'), { statusCode: 400 });
        }

        const currentStock = Math.max(0, parseInt(String(p.stock || '0'), 10));
        if (Boolean(p.is_sold_out) || currentStock < qty) {
          throw Object.assign(new Error(`"${p.title}" does not have enough stock available.`), { statusCode: 400 });
        }

        const nextStock = currentStock - qty;
        await client.query(
          'UPDATE shopit_products SET stock = $1, is_sold_out = $2, updated_at = NOW() WHERE id = $3',
          [nextStock, nextStock <= 0, p.id]
        );

        const sellerPriceKobo = nairaToKobo(p.seller_price);
        if (sellerPriceKobo <= 0) {
          throw Object.assign(new Error(`Invalid server price on "${p.title}".`), { statusCode: 400 });
        }

        const itemServiceFeeKobo = calculateTieredServiceFeeKobo(sellerPriceKobo);
        subtotalKobo += sellerPriceKobo * qty;
        serviceFeeKobo += itemServiceFeeKobo * qty;

        const rawDeliveryNaira =
          deliveryMethod === 'pickup'
            ? Number(p.delivery_pickup_fee || 200)
            : Number(p.delivery_local_fee || 500);
        const itemDeliveryKobo = Math.max(
          0,
          nairaToKobo(rawDeliveryNaira > 0 ? rawDeliveryNaira : deliveryMethod === 'pickup' ? 200 : 500)
        );

        const sKey = String(p.seller_id);
        const prevGroup = sellerGroups.get(sKey);
        if (!prevGroup || itemDeliveryKobo > prevGroup.deliveryFeeKobo) {
          sellerGroups.set(sKey, { deliveryFeeKobo: itemDeliveryKobo });
        }

        resolvedItems.push({
          productId: p.id,
          title: p.title,
          image: Array.isArray(p.images) ? p.images[0] || '' : '',
          sellerId: p.seller_id,
          sellerShopName: p.seller_shop_name || 'Artisan Shop',
          sellerCampus: p.seller_campus || campus || 'Campus',
          quantity: qty,
          sellerPrice: koboToNaira(sellerPriceKobo),
          sellerPriceKobo,
          serviceFee: koboToNaira(itemServiceFeeKobo),
          displayPrice: koboToNaira(sellerPriceKobo + itemServiceFeeKobo),
          deliveryMethod,
          deliveryFee: koboToNaira(itemDeliveryKobo),
        });
      }

      let deliveryTotalKobo = 0;
      for (const group of sellerGroups.values()) {
        deliveryTotalKobo += group.deliveryFeeKobo;
      }

      let discountTotalKobo = 0;
      let appliedCouponCode: string | null = null;
      if (couponCode && String(couponCode).trim()) {
        const cleanCode = String(couponCode).trim().toUpperCase();
        const cRes = await client.query(
          'SELECT code, discount_kobo, min_subtotal_kobo, is_active, max_uses, current_uses, expires_at FROM shopit_coupons WHERE code = $1',
          [cleanCode]
        );
        const c = cRes.rows[0];
        if (
          c &&
          c.is_active &&
          subtotalKobo >= Number(c.min_subtotal_kobo) &&
          (!c.expires_at || new Date(c.expires_at).getTime() > Date.now()) &&
          (!c.max_uses || Number(c.current_uses) < Number(c.max_uses))
        ) {
          discountTotalKobo = Math.min(Number(c.discount_kobo), subtotalKobo);
          appliedCouponCode = cleanCode;
        }
      }

      const grandTotalKobo = Math.max(10000, subtotalKobo + serviceFeeKobo + deliveryTotalKobo - discountTotalKobo);
      const orderId = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const reference = `SHOPIT_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const handshakeOtp = String(crypto.randomInt(1000, 10000));
      const maskedBuyerId = `Buyer #${user.userId.slice(-4).toUpperCase()}`;

      await client.query(
        `INSERT INTO shopit_orders (
          id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
          subtotal, subtotal_kobo, service_fee_total, service_fee_kobo,
          delivery_total, delivery_fee_kobo, discount_total, discount_total_kobo, coupon_code,
          grand_total, grand_total_kobo, payment_method, payment_reference,
          handshake_otp, handshake_verified, status, stock_reserved, expires_at,
          campus, delivery_area, pickup_point, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, false, 'pending_payment', true, NOW() + INTERVAL '30 minutes',
          $21, $22, $23, NOW(), NOW()
        )`,
        [
          orderId,
          user.userId,
          user.name,
          buyerEmail,
          maskedBuyerId,
          JSON.stringify(resolvedItems),
          koboToNaira(subtotalKobo),
          subtotalKobo,
          koboToNaira(serviceFeeKobo),
          serviceFeeKobo,
          koboToNaira(deliveryTotalKobo),
          deliveryTotalKobo,
          koboToNaira(discountTotalKobo),
          discountTotalKobo,
          appliedCouponCode,
          koboToNaira(grandTotalKobo),
          grandTotalKobo,
          paymentMethod || 'flutterwave_card',
          reference,
          handshakeOtp,
          campus || 'Lagos Mainland',
          deliveryArea || campus || 'Campus Hub',
          pickupPoint || 'Main Security Gate Hub',
        ]
      );

      await client.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, updated_at
        ) VALUES ($1, $2, $3, $4, 'NGN', $5, 'pending_payment', false, $6, NOW())`,
        [reference, orderId, grandTotalKobo, koboToNaira(grandTotalKobo), paymentMethod || 'card', buyerEmail]
      );

      return {
        orderId,
        reference,
        resolvedItems,
        pricing: {
          subtotal: koboToNaira(subtotalKobo),
          serviceFeeTotal: koboToNaira(serviceFeeKobo),
          deliveryTotal: koboToNaira(deliveryTotalKobo),
          discountTotal: koboToNaira(discountTotalKobo),
          grandTotalNaira: koboToNaira(grandTotalKobo),
          amountInKobo: grandTotalKobo,
        },
      };
    });

    // Call official Flutterwave v3 Standard Hosted Checkout API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let flwRes: Response | null = null;
    let flwData: any = {};
    try {
      flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: initializedOrder.reference,
          amount: initializedOrder.pricing.grandTotalNaira,
          currency: 'NGN',
          redirect_url: `${APP_URL}/?view=orders&payment_ref=${encodeURIComponent(initializedOrder.reference)}`,
          payment_options: 'card, banktransfer, ussd, opay',
          customer: {
            email: buyerEmail,
            name: user.name || 'Shop It Buyer',
          },
          customizations: {
            title: 'Shop It Escrow Checkout',
            description: `Order #${initializedOrder.orderId} (${campus || 'Nigeria'})`,
          },
          meta: {
            orderId: initializedOrder.orderId,
            buyerId: user.userId,
            campus: campus || 'Nigeria',
          },
        }),
        signal: controller.signal,
      });
      flwData = await flwRes.json().catch(() => ({}));
    } catch (gatewayErr: any) {
      flwData = { message: gatewayErr?.message || 'Flutterwave API timeout or connection error.' };
    } finally {
      clearTimeout(timeout);
    }

    if (!flwRes || !flwRes.ok || flwData?.status !== 'success' || !flwData?.data?.link) {
      await withTransaction(async client => {
        await restoreOrderStockInTx(client, {
          id: initializedOrder.orderId,
          items: initializedOrder.resolvedItems,
          stock_reserved: true,
        });
        await client.query(
          "UPDATE shopit_orders SET status = 'cancelled', stock_reserved = false, notes = 'Gateway init failed', updated_at = NOW() WHERE id = $1",
          [initializedOrder.orderId]
        );
        await client.query("UPDATE shopit_payments SET status = 'failed', updated_at = NOW() WHERE reference = $1", [
          initializedOrder.reference,
        ]);
      }).catch(() => {});

      return res.status(502).json({
        status: false,
        message: flwData?.message || 'Unable to initialize payment with Flutterwave. Please try again.',
      });
    }

    const responseData = {
      gateway: 'flutterwave',
      reference: initializedOrder.reference,
      orderId: initializedOrder.orderId,
      amountInKobo: initializedOrder.pricing.amountInKobo,
      amountNaira: initializedOrder.pricing.grandTotalNaira,
      grandTotalNaira: initializedOrder.pricing.grandTotalNaira,
      authorizationUrl: flwData.data.link,
      authorization_url: flwData.data.link,
      publicKey: getFlwPublicKey(),
      pricing: initializedOrder.pricing,
    };

    return res.json({ status: true, ...responseData, data: responseData });
  } catch (err: any) {
    const code = err?.statusCode || 500;
    if (code >= 500) console.error('[Payment Init Error]:', err.message);
    return res.status(code).json({ status: false, message: err.message || 'Internal server error initializing payment.' });
  }
});

router.all('/payments/webhook', requirePaymentsEnabled, async (req: any, res: any) => {
  return paymentsWebhookHandler(req, res);
});

router.get('/payments/verify/:reference', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { reference } = req.params;
    const transactionId = req.query.transaction_id ? String(req.query.transaction_id).trim() : '';

    if (!reference) {
      return res.status(400).json({ status: false, message: 'Reference is required.' });
    }

    const orderRes = await dbQuery('SELECT * FROM shopit_orders WHERE payment_reference = $1', [reference]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Payment reference not found.' });
    }

    const order = orderRes.rows[0];
    if (order.buyer_id !== user.userId && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden: you cannot verify another buyer’s order.' });
    }

    if (['paid', 'packed', 'shipped', 'delivered', 'completed'].includes(order.status)) {
      return res.json({
        status: true,
        isPaid: true,
        orderStatus: order.status,
        reference,
        orderId: order.id,
        amountInKobo: Number(order.grand_total_kobo || nairaToKobo(order.grand_total)),
        amountNaira: Number(order.grand_total),
        currency: 'NGN',
        message: 'Transaction already verified and paid.',
      });
    }

    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({ status: false, message: 'Payment verification secret not configured.' });
    }

    const verifyUrl = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let verifyRes: Response;
    let verifyData: any;
    try {
      verifyRes = await fetch(verifyUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${flwSecret}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      verifyData = await verifyRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!verifyRes.ok || verifyData?.status !== 'success' || verifyData?.data?.status !== 'successful') {
      if (order.status === 'cancelled') {
        return res.status(409).json({
          status: false,
          isPaid: false,
          expired: true,
          orderStatus: 'cancelled',
          message: 'Checkout order expired or was cancelled before payment.',
        });
      }
      return res.json({
        status: true,
        isPaid: false,
        orderStatus: order.status,
        gatewayStatus: verifyData?.data?.status || 'pending',
        message: verifyData?.message || 'Payment not yet confirmed with Flutterwave.',
      });
    }

    if (String(verifyData.data.tx_ref || '').trim() !== reference) {
      return res.status(400).json({ status: false, isPaid: false, message: 'Verified tx_ref mismatch.' });
    }

    const confirmedAmountKobo = Math.round(Number(verifyData.data.amount || 0) * 100);
    const channel = String(verifyData.data.payment_type || 'card');

    const settlement = await commitPaidOrderTransaction({
      reference,
      confirmedAmountKobo,
      currency: String(verifyData.data.currency || '').toUpperCase(),
      channel,
      webhookReceived: false,
      customerEmail: verifyData.data.customer?.email || user.email,
      gatewayData: {
        flwTransactionId: verifyData.data.id,
        flwRef: verifyData.data.flw_ref,
        processorResponse: verifyData.data.processor_response,
        paymentType: channel,
      },
      source: 'verify_endpoint',
    });

    if (settlement.currencyMismatch || settlement.amountMismatch) {
      return res.status(400).json({ status: false, isPaid: false, message: 'Currency or paid amount mismatch.' });
    }

    if (settlement.expired) {
      return res.status(409).json({
        status: false,
        isPaid: false,
        expired: true,
        orderStatus: 'cancelled',
        message: 'Order expired before payment cleared and has been flagged for admin refund.',
      });
    }

    return res.json({
      status: true,
      isPaid: Boolean(settlement.committed || settlement.alreadyPaid),
      orderStatus: 'paid',
      reference,
      orderId: order.id,
      amountInKobo: confirmedAmountKobo,
      amountNaira: koboToNaira(confirmedAmountKobo),
      currency: 'NGN',
      channel,
      message: 'Payment verified with Flutterwave and committed to escrow.',
    });
  } catch (err: any) {
    console.error('[Payment Verify Error]:', err.message);
    return res.status(502).json({ status: false, message: 'Could not verify payment with Flutterwave.' });
  }
});

router.post('/payments/refund', requirePaymentsEnabled, requireAdmin, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { reference, orderId, amountKobo, reason } = req.body;

  if (!reference && !orderId) {
    return res.status(400).json({ status: false, message: 'Payment reference or orderId is required for refund.' });
  }

  try {
    const flwSecret = getFlwSecretKey();
    if (!flwSecret) {
      return res.status(503).json({ status: false, message: 'Payment gateway secret is not configured.' });
    }

    const orderLookup = await dbQuery('SELECT * FROM shopit_orders WHERE payment_reference = $1 OR id = $2', [
      reference || '',
      orderId || '',
    ]);
    const targetOrder = orderLookup.rows[0] || null;
    const effectiveRef = reference || targetOrder?.payment_reference || '';

    const payLookup = await dbQuery('SELECT * FROM shopit_payments WHERE reference = $1 OR order_id = $2', [
      effectiveRef,
      targetOrder?.id || orderId || '',
    ]);
    const paymentRow = payLookup.rows[0] || null;

    if (paymentRow?.status === 'refunded' && targetOrder && ['refunded', 'cancelled'].includes(targetOrder.status)) {
      return res.json({
        status: true,
        alreadyRefunded: true,
        message: 'Refund already processed for this order.',
      });
    }

    let flwTxId = paymentRow?.data?.flwTransactionId || paymentRow?.data?.gatewayId || '';
    if (!flwTxId && effectiveRef) {
      const lookController = new AbortController();
      const lookTimeout = setTimeout(() => lookController.abort(), 8000);
      try {
        const lookRes = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(effectiveRef)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${flwSecret}`, 'Content-Type': 'application/json' },
            signal: lookController.signal,
          }
        );
        const lookData: any = await lookRes.json().catch(() => ({}));
        if (lookRes.ok && lookData?.status === 'success' && lookData?.data?.id) {
          flwTxId = String(lookData.data.id);
        }
      } catch {
      } finally {
        clearTimeout(lookTimeout);
      }
    }

    if (!flwTxId) {
      return res.status(400).json({
        status: false,
        message: 'Cannot execute Flutterwave refund: missing verified Flutterwave transaction ID for this reference.',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let refundRes: Response;
    let refundData: any;
    try {
      refundRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(flwTxId))}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${flwSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(amountKobo ? { amount: koboToNaira(Number(amountKobo)) } : {}),
          comments: reason || 'Customer refund approved by Shop It Admin',
        }),
        signal: controller.signal,
      });
      refundData = await refundRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!refundRes.ok || refundData?.status !== 'success') {
      return res.status(502).json({ status: false, message: refundData?.message || 'Flutterwave refund call failed.' });
    }

    await withTransaction(async client => {
      const orderRes = await client.query(
        'SELECT * FROM shopit_orders WHERE payment_reference = $1 OR id = $2 FOR UPDATE',
        [effectiveRef, targetOrder?.id || orderId || '']
      );

      if (orderRes.rows.length > 0) {
        const order = orderRes.rows[0];
        if (order.status !== 'refunded') {
          const prevStatus = order.status;
          await restoreOrderStockInTx(client, order);

          await client.query(
            `UPDATE shopit_orders
             SET status = 'refunded', stock_reserved = false, auto_release_at = NULL,
                 notes = COALESCE(notes || ' | ', '') || $1, updated_at = NOW()
             WHERE id = $2`,
            [`Refunded: ${reason || 'Approved by Admin'}`, order.id]
          );

          await client.query(
            `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
             VALUES ($1, $2, $3, 'refunded', $4, $5, NOW())`,
            [
              `osh_ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              order.id,
              prevStatus,
              user.email,
              `Refund processed via Flutterwave: ${reason || 'Admin approval'}`,
            ]
          );

          const items = Array.isArray(order.items) ? order.items : [];
          const sellerTotalsKobo: Record<string, number> = {};
          for (const item of items) {
            if (item.sellerId) {
              const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
              const sellerUnitKobo = Number(item.sellerPriceKobo) || nairaToKobo(item.sellerPrice);
              sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + sellerUnitKobo * qty;
            }
          }

          for (const [sId, sellerRefundKobo] of Object.entries(sellerTotalsKobo)) {
            const wRes = await client.query(
              'SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
              [sId]
            );
            if (wRes.rows.length > 0) {
              const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
              const newPending = Math.max(0, currentPending - sellerRefundKobo);
              const idempotencyKey = `refund:${order.id}:${sId}`;

              const ledgerIns = await client.query(
                `INSERT INTO shopit_ledger_entries (
                  id, wallet_id, order_id, type, amount, fee, balance_after, balance_type, status,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES ($1, $2, $3, 'refund', $4, 0, $5, 'pending', 'completed', $6, 0, $7, $8, $9, $10, NOW())
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id`,
                [
                  `LEDGER-REF-${order.id}-${sId.slice(-6)}`,
                  sId,
                  order.id,
                  koboToNaira(sellerRefundKobo),
                  koboToNaira(newPending),
                  sellerRefundKobo,
                  newPending,
                  `Refund deducted from pending escrow for Order #${order.id}`,
                  effectiveRef || order.id,
                  idempotencyKey,
                ]
              );

              if (ledgerIns.rows.length > 0) {
                await client.query(
                  'UPDATE shopit_wallets SET pending_balance_kobo = $1, pending_balance = $2, updated_at = NOW() WHERE seller_id = $3',
                  [newPending, koboToNaira(newPending), sId]
                );
              }
            }
          }
        }
      }

      if (effectiveRef) {
        let existingPayData: Record<string, any> = {};
        if (paymentRow?.data) {
          existingPayData =
            typeof paymentRow.data === 'string'
              ? (() => {
                  try {
                    return JSON.parse(paymentRow.data);
                  } catch {
                    return {};
                  }
                })()
              : typeof paymentRow.data === 'object'
                ? paymentRow.data
                : {};
        }
        const mergedPayData = {
          ...existingPayData,
          refundId: refundData?.data?.id,
          flwTransactionId: flwTxId,
        };
        await client.query(
          `UPDATE shopit_payments
           SET status = 'refunded',
               data = $1,
               updated_at = NOW()
           WHERE reference = $2`,
          [JSON.stringify(mergedPayData), effectiveRef]
        );
      }
    });

    await logAuditEvent({
      action: 'PAYMENT_REFUND_EXECUTED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'payment', id: effectiveRef || orderId },
      details: { amountKobo, reason, orderId: targetOrder?.id || orderId, flwTxId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'Refund processed atomically and escrow debited.', data: refundData.data });
  } catch (err: any) {
    console.error('[Refund Error]:', err.message);
    return res.status(500).json({ status: false, message: `Refund processing failed: ${err.message}` });
  }
});

router.get('/payments/payments', requirePaymentsEnabled, requireFinance, async (_req: AuthenticatedRequest, res) => {
  try {
    const payRes = await dbQuery('SELECT * FROM shopit_payments ORDER BY created_at DESC LIMIT 200');
    return res.json({ status: true, payments: payRes.rows });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.get('/payments/events', requirePaymentsEnabled, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const payRes = await dbQuery(
      "SELECT reference, order_id, amount_naira, channel, status, webhook_received, updated_at FROM shopit_payments WHERE webhook_received = true OR status = 'paid' ORDER BY updated_at DESC LIMIT 200"
    );
    return res.json({ status: true, events: payRes.rows, processedCount: payRes.rows.length });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// Seller withdrawal via Flutterwave Transfers API with ownership, FOR UPDATE debit, cooled saved account, daily cap, compensating rollback
const withdrawalLocks = new Map<string, Promise<void>>();
async function withSellerWithdrawalLock<T>(sellerKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = withdrawalLocks.get(sellerKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  withdrawalLocks.set(sellerKey, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (withdrawalLocks.get(sellerKey) === current) {
      withdrawalLocks.delete(sellerKey);
    }
  }
}

router.post('/payments/transfer', requirePayoutsEnabled, requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { amount, payoutAccountId, otpCode, sellerId } = req.body;
  const targetSellerId = sellerId ? String(sellerId).trim() : user.sellerId || user.userId;

  const ownsSeller = targetSellerId === user.userId || (user.sellerId && targetSellerId === user.sellerId);
  if (!ownsSeller && user.role !== 'admin') {
    return res.status(403).json({ status: false, message: 'Forbidden: you can only withdraw from your own wallet.' });
  }

  const flwSecret = getFlwSecretKey();
  if (!flwSecret) {
    return res.status(503).json({ status: false, message: 'Payout gateway secret is not configured.' });
  }

  const amountNum = Math.floor(Number(amount) || 0);
  if (amountNum < 1000 || amountNum > 300000) {
    return res.status(400).json({ status: false, message: 'Withdrawal amount must be between ₦1,000 and ₦300,000.' });
  }

  if (!payoutAccountId) {
    return res.status(400).json({ status: false, message: 'A saved payoutAccountId is required.' });
  }

  if (!otpCode) {
    return res.status(400).json({ status: false, message: 'Withdrawal authorization OTP is required.' });
  }

  try {
    // 1. Verify OTP atomically via SELECT ... FOR UPDATE (zero test code backdoors)
    const otpCheck = await verifyAndConsumeOtp(user.email, 'withdrawal', String(otpCode).trim());
    if (!otpCheck.success) {
      return res.status(400).json({ status: false, message: otpCheck.error || 'Invalid or expired withdrawal OTP.' });
    }

    // Option 1: Shop It covers Flutterwave transfer fees (₦0 seller withdrawal fee)
    const fee = 0;
    const amountKobo = amountNum * 100;
    const feeKobo = 0;
    const totalDeductionKobo = amountKobo;
    const transferCode = `TRF_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 2. Atomic check + debit inside Postgres transaction BEFORE external payout API call
    const debitState = await withSellerWithdrawalLock(targetSellerId, () =>
      withTransaction(async client => {
        const sellerRes = await client.query('SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1', [
          targetSellerId,
        ]);
        if (sellerRes.rows.length === 0) {
          throw Object.assign(new Error('Registered artisan profile not found.'), { statusCode: 403 });
        }
        const seller = sellerRes.rows[0];
        if (seller.verification_status !== 'verified' && seller.verification_status !== 'approved') {
          throw Object.assign(new Error('NIN identity verification is required before withdrawing earnings.'), {
            statusCode: 403,
          });
        }

        const userAgeRes = await client.query('SELECT age FROM shopit_users WHERE id = $1 OR id = $2 LIMIT 1', [
          seller.user_id || targetSellerId,
          user.userId,
        ]);
        const parsedAge =
          userAgeRes.rows[0]?.age !== null && userAgeRes.rows[0]?.age !== undefined
            ? Number(userAgeRes.rows[0].age)
            : null;
        const isMinorSeller = Boolean(seller.under_18) || (parsedAge !== null && parsedAge < 18);

        const wRes = await client.query('SELECT * FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE', [seller.id]);
        if (wRes.rows.length === 0) {
          throw Object.assign(new Error('Seller wallet not found.'), { statusCode: 404 });
        }
        const wallet = wRes.rows[0];
        if (wallet.is_frozen) {
          throw Object.assign(new Error(`Wallet is frozen: ${wallet.freeze_reason || 'Security review'}`), {
            statusCode: 403,
          });
        }

        const payoutAccounts: any[] = Array.isArray(wallet.payout_accounts) ? wallet.payout_accounts : [];
        const account = payoutAccounts.find((a: any) => a.id === payoutAccountId);
        if (!account || !account.bankCode || !account.accountNumber) {
          throw Object.assign(new Error('Valid saved payout account with bank code not found.'), { statusCode: 400 });
        }

        if (isMinorSeller && account.adminApproved !== true) {
          throw Object.assign(
            new Error('Under-18 seller guardian payout account requires one-time Admin approval before withdrawing.'),
            { statusCode: 403 }
          );
        }

        if (account.coolingPeriodEndsAt && Date.now() < new Date(account.coolingPeriodEndsAt).getTime()) {
          const hoursRemaining = Math.max(
            1,
            Math.ceil((new Date(account.coolingPeriodEndsAt).getTime() - Date.now()) / (1000 * 60 * 60))
          );
          throw Object.assign(
            new Error(`Payout account is in 24h security cooling period (${hoursRemaining}h remaining).`),
            { statusCode: 403 }
          );
        }

        // Daily withdrawal cap check: ₦25,000 / 24h for under-18 sellers, ₦300,000 / 24h for adults
        const dailyCapKobo = isMinorSeller ? 2500000 : 30000000;
        const dailyCapNaira = isMinorSeller ? '₦25,000' : '₦300,000';
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const dailyRes = await client.query(
          `SELECT COALESCE(SUM(amount_kobo), 0) AS daily_kobo
           FROM shopit_payouts
           WHERE seller_id = $1 AND status IN ('pending', 'processing', 'success') AND created_at >= $2`,
          [seller.id, dayAgo]
        );
        const dailyUsedKobo = parseInt(String(dailyRes.rows[0]?.daily_kobo || '0'), 10);
        if (dailyUsedKobo + amountKobo > dailyCapKobo) {
          throw Object.assign(
            new Error(
              isMinorSeller
                ? `Under-18 daily withdrawal limit of ${dailyCapNaira} exceeded.`
                : `Daily withdrawal limit of ${dailyCapNaira} exceeded.`
            ),
            { statusCode: 400 }
          );
        }

        const availableKobo = parseInt(String(wallet.available_balance_kobo || '0'), 10);
        if (availableKobo < totalDeductionKobo) {
          throw Object.assign(new Error('Insufficient Available balance for withdrawal and fee.'), { statusCode: 400 });
        }

        const newAvailableKobo = availableKobo - totalDeductionKobo;
        const newWithdrawnKobo = parseInt(String(wallet.total_withdrawn_kobo || '0'), 10) + amountKobo;

        const updRes = await client.query(
          `UPDATE shopit_wallets
           SET available_balance_kobo = $1, available_balance = $2,
               total_withdrawn_kobo = $3, total_withdrawn = $4, updated_at = NOW()
           WHERE seller_id = $5 AND available_balance_kobo >= $6`,
          [
            newAvailableKobo,
            koboToNaira(newAvailableKobo),
            newWithdrawnKobo,
            koboToNaira(newWithdrawnKobo),
            seller.id,
            totalDeductionKobo,
          ]
        );
        if (updRes.rowCount === 0) {
          throw Object.assign(new Error('Insufficient Available balance (concurrent withdrawal blocked).'), {
            statusCode: 400,
          });
        }

      const ledgerId = `LEDGER-WTD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO shopit_ledger_entries (
          id, wallet_id, type, amount, fee, balance_after, balance_type, status,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
        ) VALUES ($1, $2, 'withdrawal', $3, $4, $5, 'available', 'pending', $6, $7, $8, $9, $10, $11, NOW())`,
        [
          ledgerId,
          seller.id,
          amountNum,
          fee,
          koboToNaira(newAvailableKobo),
          amountKobo,
          feeKobo,
          newAvailableKobo,
          `Payout · ${account.bankName} (${account.accountNumber})`,
          transferCode,
          `withdrawal:${transferCode}`,
        ]
      );

      await client.query(
        `INSERT INTO shopit_payouts (
          id, seller_id, amount_kobo, fee_kobo, total_deduction_kobo,
          bank_code, bank_name, account_number, account_name, transfer_code, reference, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW(), NOW())`,
        [
          transferCode,
          seller.id,
          amountKobo,
          feeKobo,
          totalDeductionKobo,
          String(account.bankCode),
          account.bankName,
          account.accountNumber,
          account.accountName || seller.shop_name,
          transferCode,
          transferCode,
        ]
      );

      return { seller, account, newAvailableKobo };
      })
    );

    // 3. Call Flutterwave Transfers API v3; compensate atomically if gateway call fails or times out
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let transRes: Response;
      let transData: any;
      try {
        transRes = await fetch('https://api.flutterwave.com/v3/transfers', {
          method: 'POST',
          headers: { Authorization: `Bearer ${flwSecret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_bank: String(debitState.account.bankCode),
            account_number: debitState.account.accountNumber,
            amount: amountNum,
            currency: 'NGN',
            narration: `Shop It Withdrawal - ${debitState.seller.shop_name}`,
            reference: transferCode,
            debit_currency: 'NGN',
          }),
          signal: controller.signal,
        });
        transData = await transRes.json().catch(() => ({}));
      } finally {
        clearTimeout(timeout);
      }

      if (!transRes.ok || transData?.status !== 'success') {
        throw new Error(transData?.message || 'Flutterwave transfer rejected.');
      }

      await dbQuery(
        "UPDATE shopit_payouts SET status = 'processing', transfer_code = $1, flw_transfer_id = $2, provider_response = $3, updated_at = NOW() WHERE id = $4",
        [
          transData.data?.reference || transferCode,
          transData.data?.id ? String(transData.data.id) : null,
          JSON.stringify(transData.data || {}),
          transferCode,
        ]
      );
    } catch (gatewayErr: any) {
      // Compensating atomic rollback in Postgres so user funds are never lost on gateway failure
      await withTransaction(async client => {
        const wRes = await client.query(
          'SELECT available_balance_kobo, total_withdrawn_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
          [debitState.seller.id]
        );
        if (wRes.rows.length > 0) {
          const curAvail = parseInt(String(wRes.rows[0].available_balance_kobo || '0'), 10);
          const curWtd = parseInt(String(wRes.rows[0].total_withdrawn_kobo || '0'), 10);
          const restoredAvail = curAvail + totalDeductionKobo;
          const restoredWtd = Math.max(0, curWtd - amountKobo);
          await client.query(
            `UPDATE shopit_wallets
             SET available_balance_kobo = $1, available_balance = $2,
                 total_withdrawn_kobo = $3, total_withdrawn = $4, updated_at = NOW()
             WHERE seller_id = $5`,
            [restoredAvail, koboToNaira(restoredAvail), restoredWtd, koboToNaira(restoredWtd), debitState.seller.id]
          );
          await client.query(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, type, amount, fee, balance_after, balance_type, status,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
            ) VALUES ($1, $2, 'refund', $3, 0, $4, 'available', 'completed', $5, 0, $6, $7, $8, $9, NOW())
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              `LEDGER-WTD-REV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              debitState.seller.id,
              koboToNaira(totalDeductionKobo),
              koboToNaira(restoredAvail),
              totalDeductionKobo,
              restoredAvail,
              `Failed payout reversal · ${transferCode}`,
              transferCode,
              `withdrawal_reversal:${transferCode}`,
            ]
          );
        }
        await client.query("UPDATE shopit_payouts SET status = 'failed', updated_at = NOW() WHERE id = $1", [transferCode]);
      });

      return res.status(502).json({ status: false, message: `Payout failed and balance restored: ${gatewayErr.message}` });
    }

    if (amountNum >= 50000) {
      await sendAdminAlert(
        `withdrawal_alert_${transferCode}`,
        `High-Value Withdrawal Request (₦${amountNum.toLocaleString()})`,
        `Artisan <strong>"${escapeHtml(debitState.seller.shop_name)}"</strong> withdrew <strong>₦${amountNum.toLocaleString()}</strong> to ${escapeHtml(debitState.account.bankName)} ending ${escapeHtml(String(debitState.account.accountNumber).slice(-4))}.`
      );
    }

    await logAuditEvent({
      action: 'SELLER_WITHDRAWAL_DISPATCHED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'wallet', id: debitState.seller.id },
      details: { amount: amountNum, fee, transferCode, bankName: debitState.account.bankName },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      transferCode,
      amount: amountNum,
      fee,
      bankName: debitState.account.bankName,
      accountNumber: debitState.account.accountNumber,
      message: `Transfer of ₦${amountNum.toLocaleString()} initiated to ${debitState.account.bankName}. Ref: ${transferCode}`,
    });
  } catch (err: any) {
    const code = err?.statusCode || 500;
    if (code >= 500) console.error('[Withdrawal Error]:', err.message);
    return res.status(code).json({ status: false, message: err.message || 'Withdrawal failed.' });
  }
});

// ============================================================================
// EMAIL DISPATCH, SUPPORT CONTACT & OTP AUTHENTICATION
// ============================================================================

// Strictly admin-only templated email trigger (no arbitrary HTML relay)
router.post('/email/send', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { to, template, data, toName } = req.body;
    if (!to || !template) {
      return res.status(400).json({ status: false, message: 'Recipient "to" and allowed "template" key are required.' });
    }
    if (!VALID_EMAIL_TEMPLATES.has(template as EmailTemplateKey)) {
      return res.status(400).json({ status: false, message: 'Unsupported email template.' });
    }

    const cleanEmail = String(to).trim().toLowerCase();
    const rendered = renderTransactionalEmail(template as EmailTemplateKey, data || {});
    const sent = await sendBrevoDirect(cleanEmail, rendered.subject, rendered.text, rendered.html, toName || data?.name);
    return res.json({ status: true, dispatched: sent, subject: rendered.subject });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Internal server error dispatching email.' });
  }
});

// Rate-limited public Contact Us endpoint (delivers ONLY to shopitverified@gmail.com)
router.post('/support/contact', async (req, res) => {
  try {
    const rl = await checkAndRecordRateLimit(`support:${req.ip || 'unknown'}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many support messages. Please try again later.' });
    }

    const { name, email, category, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ status: false, message: 'Name, email, and message are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ status: false, message: 'Please enter a valid email address.' });
    }

    const cleanName = String(name).trim().slice(0, 120);
    const cleanCat = String(category || 'General Question').trim().slice(0, 80);
    const cleanMsg = String(message).trim().slice(0, 3000);

    const htmlBody = `<div style="font-family:sans-serif;padding:20px;">
      <h2>New Support Request</h2>
      <p><strong>From:</strong> ${escapeHtml(cleanName)} (${escapeHtml(cleanEmail)})</p>
      <p><strong>Category:</strong> ${escapeHtml(cleanCat)}</p>
      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin-top:12px;">
        ${escapeHtml(cleanMsg).replace(/\n/g, '<br/>')}
      </div>
    </div>`;

    await sendBrevoDirect(
      'shopitverified@gmail.com',
      `[Shop It Help] ${cleanCat} from ${cleanName}`,
      `Support request from ${cleanName} (${cleanEmail})\nCategory: ${cleanCat}\n\n${cleanMsg}`,
      htmlBody,
      'Shop It Support'
    );

    return res.json({ status: true, message: 'Support inquiry sent.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to submit contact request.' });
  }
});

router.post('/auth/send-otp', async (req, res) => {
  try {
    const { email, purpose, deviceId, metadata } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ status: false, message: 'email and purpose are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPurpose = String(purpose).trim();

    // Sensitive withdrawal / payout account OTPs require active session matching email
    if (cleanPurpose === 'withdrawal' || cleanPurpose === 'payout_account') {
      const token = extractToken(req);
      const session = token ? await getSession(token) : null;
      if (!session) {
        return res.status(401).json({ status: false, message: 'Authentication required to request payout verification code.' });
      }
      if (session.email.toLowerCase() !== cleanEmail && session.role !== 'admin') {
        return res.status(403).json({ status: false, message: 'You can only request payout OTPs for your own email.' });
      }
    }

    const ipRl = await checkAndRecordRateLimit(`otp_ip:${req.ip || 'unknown'}`, 25, 15 * 60 * 1000);
    if (!ipRl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many verification code requests. Please try again later.' });
    }

    const cooldownCheck = await checkOtpResendCooldown(cleanEmail, cleanPurpose);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({
        status: false,
        message: `Please wait ${cooldownCheck.waitSeconds}s before requesting a new code.`,
        waitSeconds: cooldownCheck.waitSeconds,
      });
    }

    const rateCheck = await checkOtpRateLimit(cleanEmail, deviceId);
    if (!rateCheck.allowed) {
      return res.status(429).json({ status: false, message: rateCheck.reason });
    }

    // Never reveal registered vs unregistered email on password_reset (uniform response)
    if (cleanPurpose === 'password_reset') {
      const userCheck = await dbQuery('SELECT id, is_verified_email FROM shopit_users WHERE LOWER(email) = LOWER($1)', [
        cleanEmail,
      ]);
      if (userCheck.rows.length === 0 || userCheck.rows[0].is_verified_email === false) {
        await recordOtpRateLimit(cleanEmail, deviceId);
        return res.json({
          status: true,
          message: 'If an account with this email exists, a 6-digit verification code has been sent.',
        });
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashOtp(code);
    await saveHashedOtp(cleanEmail, cleanPurpose, codeHash, metadata);
    await recordOtpRateLimit(cleanEmail, deviceId);

    const templateMap: Record<string, EmailTemplateKey> = {
      signup: 'signup_code',
      new_device_login: 'new_device_login',
      password_reset: 'password_reset',
      withdrawal: 'withdrawal_code',
      payout_account: 'new_payout_account_code',
    };
    const templateKey: EmailTemplateKey = templateMap[cleanPurpose] || 'signup_code';

    const rendered = renderTransactionalEmail(templateKey, {
      code,
      email: cleanEmail,
      amount: metadata?.amount,
      bank_name: metadata?.bank_name,
      last4: metadata?.last4,
      ...metadata,
    });

    await sendBrevoDirect(cleanEmail, rendered.subject, rendered.text, rendered.html, metadata?.name);

    return res.json({
      status: true,
      message:
        cleanPurpose === 'password_reset'
          ? 'If an account with this email exists, a 6-digit verification code has been sent.'
          : 'A 6-digit verification code has been sent to your email.',
    });
  } catch (err: any) {
    console.error('[Server Error in /api/auth/send-otp]', err.message);
    return res.status(500).json({ status: false, message: 'Internal server error dispatching OTP.' });
  }
});

router.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, purpose, code } = req.body;
    if (!email || !purpose || !code) {
      return res.status(400).json({ status: false, message: 'email, purpose, and code are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPurpose = String(purpose).trim();
    const inputCode = String(code).trim();

    const rl = await checkAndRecordRateLimit(`verify_otp:${req.ip || cleanEmail}`, 30, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many attempts. Please try again later.' });
    }

    const result = await verifyAndConsumeOtp(cleanEmail, cleanPurpose, inputCode);
    if (!result.success) {
      return res.status(400).json({
        status: false,
        message: result.error,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    let signupVerificationToken: string | undefined;
    if (cleanPurpose === 'signup' || cleanPurpose === 'email_verification') {
      signupVerificationToken = await issueSignupVerificationToken(cleanEmail);
      await dbQuery('UPDATE shopit_users SET is_verified_email = true, updated_at = NOW() WHERE LOWER(email) = LOWER($1)', [
        cleanEmail,
      ]).catch(() => {});
    }

    return res.json({
      status: true,
      signupVerificationToken,
      message: 'Verification successful.',
    });
  } catch (err: any) {
    console.error('[Server Error in /api/auth/verify-otp]', err.message);
    return res.status(500).json({ status: false, message: 'Internal server error verifying OTP.' });
  }
});

// ============================================================================
// SAFETY REPORTS (PostgreSQL + Moderator Auth)
// ============================================================================

router.post('/reports', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rl = await checkAndRecordRateLimit(`reports:${req.ip || 'unknown'}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many report submissions. Please wait a bit.' });
    }

    const { targetType, targetId, targetTitle, reporterEmail, reason, details } = req.body;
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ status: false, message: 'targetType, targetId, and reason are required' });
    }

    const reportId = `REP_${Date.now()}_${crypto.randomInt(1000, 10000)}`;
    const resolvedEmail = req.user?.email || reporterEmail || undefined;

    const newReport: ReportRecord = {
      id: reportId,
      targetType: targetType as any,
      targetId: String(targetId).slice(0, 120),
      targetTitle: String(targetTitle || 'Marketplace Item / User').slice(0, 200),
      reporterEmail: resolvedEmail ? String(resolvedEmail).slice(0, 200) : undefined,
      reason: String(reason).slice(0, 200),
      details: String(details || '').slice(0, 2000),
      status: 'open',
      actionLogs: [
        {
          action: 'Report Submitted',
          note: `Flagged for: ${String(reason).slice(0, 150)}`,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    await saveReportRecord(newReport);

    await sendAdminAlert(
      `report_alert_${reportId}`,
      `Safety Report Filed: ${escapeHtml(String(targetType).toUpperCase())}`,
      `Target Type: <strong>${escapeHtml(targetType)}</strong><br/>
       Target: <strong>${escapeHtml(newReport.targetTitle)}</strong><br/>
       Reason: <strong>${escapeHtml(newReport.reason)}</strong><br/>
       Details: ${escapeHtml(newReport.details || 'None provided')}<br/>
       Reporter: ${escapeHtml(newReport.reporterEmail || 'Anonymous')}`
    );

    return res.json({ status: true, reportId, message: 'Report received. Our moderation team will investigate promptly.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Internal server error filing report.' });
  }
});

router.get('/reports', requireModerator, async (_req: AuthenticatedRequest, res) => {
  try {
    const reports = await getAllReportRecords();
    return res.json({ status: true, reports });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.patch('/reports/:id', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, actionNote } = req.body;
    if (!['open', 'reviewing', 'resolved'].includes(status)) {
      return res.status(400).json({ status: false, message: 'Invalid status. Must be open, reviewing, or resolved.' });
    }
    await updateReportStatus(id, status as any, actionNote);
    await logAuditEvent({
      action: 'REPORT_STATUS_UPDATED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'report', id },
      details: { status, actionNote },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: `Report status updated to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// SELLER IDENTITY VERIFICATION ENGINE (NDPA 2023 + AES-256-GCM + POSTGRESQL)
// ============================================================================

async function verifyWithNigerianIdentityApi(nin: string, fullName: string, dob: string) {
  const provider = getKycProvider();
  return provider.verifyNin({
    nin,
    fullName,
    dateOfBirth: dob,
  });
}

router.post(
  '/sellers/verify/submit',
  requireAuth,
  requireOwnershipOrAdmin(req => req.body?.sellerId || req.body?.userId || ''),
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const { sellerId, ownerName, shopName, nin, idType, under18, guardianName, guardianPhone, guardianConsent } = req.body;
      const targetId = sellerId || user.sellerId || user.userId;

      if (!ownerName || !String(ownerName).trim()) {
        return res.status(400).json({ status: false, message: 'Legal full name (ownerName) is required.' });
      }

      const cleanNin = String(nin || '').trim().replace(/\D/g, '');
      if (cleanNin.length !== 11) {
        return res.status(400).json({ status: false, message: 'A valid 11-digit NIN is required.' });
      }

      const rlCheck = await checkAndRecordRateLimit(`verif_legacy:${targetId}`, 5, 24 * 60 * 60 * 1000);
      if (!rlCheck.allowed) {
        return res.status(429).json({ status: false, message: 'Too many verification attempts today. Please try again later.' });
      }

      const ninLast4 = cleanNin.slice(-4);
      const reqId = `VERIF-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

      await dbQuery(
        `INSERT INTO shopit_verifications (
          id, seller_id, user_id, shop_name, owner_name, id_type, id_number_masked, full_nin_last4,
          status, under_18, guardian_name, guardian_phone, notes, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, NOW(), NOW(), NOW())`,
        [
          reqId,
          targetId,
          user.userId,
          shopName || null,
          ownerName || user.name,
          idType || 'nin_slip',
          ninLast4 ? `***-***-${ninLast4}` : '****',
          ninLast4 || '****',
          Boolean(under18),
          guardianName || null,
          guardianPhone || null,
          'Submitted for moderator review',
        ]
      );

      await dbQuery(
        `UPDATE shopit_sellers
         SET verification_status = 'pending', verified_legal_name = COALESCE($1, verified_legal_name),
             verified_nin_last4 = COALESCE($2, verified_nin_last4), under_18 = $3,
             guardian_name = $4, guardian_phone = $5, guardian_consent = $6, updated_at = NOW()
         WHERE id = $7 OR user_id = $7`,
        [ownerName || null, ninLast4 || null, Boolean(under18), guardianName || null, guardianPhone || null, Boolean(guardianConsent), targetId]
      );

      return res.json({ status: true, requestId: reqId, message: 'Verification submitted for review.' });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err.message });
    }
  }
);

router.post(
  '/verification/submit',
  requireAuth,
  requireOwnershipOrAdmin(req => req.body?.sellerId || req.user?.sellerId || req.user?.userId || ''),
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const {
        sellerId,
        shopName,
        fullName,
        dateOfBirth,
        nin,
        idDocumentType,
        idDocumentPhoto,
        selfiePhoto,
        livenessScore,
        under18,
        guardianFullName,
        guardianNin,
        guardianIdDocumentPhoto,
        guardianConsentSigned,
        ndpaConsentSigned,
      } = req.body;

      const resolvedSellerId = sellerId || user.sellerId || user.userId;

      if (!fullName || !nin || !idDocumentPhoto || !selfiePhoto) {
        return res.status(400).json({
          status: false,
          message: 'Full Name, NIN, ID Photo, and Live Selfie are mandatory.',
        });
      }

      if (!ndpaConsentSigned) {
        return res.status(400).json({ status: false, message: 'NDPA 2023 consent is required.' });
      }

      const maxDocChars = 7 * 1024 * 1024;
      if (
        String(idDocumentPhoto).length > maxDocChars ||
        String(selfiePhoto).length > maxDocChars ||
        (guardianIdDocumentPhoto && String(guardianIdDocumentPhoto).length > maxDocChars)
      ) {
        return res.status(413).json({ status: false, message: 'Uploaded verification images exceed maximum 5MB limit.' });
      }

      const cleanNin = String(nin).trim().replace(/\D/g, '');
      if (cleanNin.length !== 11) {
        return res.status(400).json({ status: false, message: 'NIN must contain exactly 11 numeric digits.' });
      }

      // Limit verification failures in Postgres across serverless restarts (3 tries / 24h)
      const rlCheck = await checkAndRecordRateLimit(`verif_submit:${resolvedSellerId}`, 5, 24 * 60 * 60 * 1000);
      if (!rlCheck.allowed) {
        return res.status(429).json({
          status: false,
          code: 'VERIFICATION_LOCKED',
          message: 'Too many verification submissions today. Please wait 24 hours or contact Support.',
        });
      }

      // Check duplicate NIN across distinct sellers directly in Postgres
      const ninDigest = hashNin(cleanNin);
      const dupRes = await dbQuery('SELECT seller_id FROM shopit_verifications WHERE id_hash = $1 LIMIT 1', [ninDigest]);
      if (dupRes.rows.length > 0 && dupRes.rows[0].seller_id !== resolvedSellerId) {
        await logAuditEvent({
          action: 'DUPLICATE_NIN_FLAGGED',
          actor: { id: user.userId, email: user.email, role: user.role },
          target: { type: 'seller', id: resolvedSellerId },
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
        return res.status(409).json({
          status: false,
          code: 'DUPLICATE_NIN',
          message: 'This NIN is already associated with another Shop It account.',
        });
      }

      if (under18) {
        if (!guardianFullName || !guardianNin || !guardianConsentSigned || !guardianIdDocumentPhoto) {
          return res.status(400).json({
            status: false,
            message: 'Sellers under 18 require guardian full name, 11-digit NIN, guardian ID, and consent.',
          });
        }
        if (String(guardianNin).replace(/\D/g, '').length !== 11) {
          return res.status(400).json({ status: false, message: 'Guardian NIN must contain 11 numeric digits.' });
        }
      }

      const idDocId = `doc_id_${resolvedSellerId}_${Date.now()}`;
      const selfieDocId = `doc_selfie_${resolvedSellerId}_${Date.now()}`;
      const guardianDocId = under18 ? `doc_guardian_${resolvedSellerId}_${Date.now()}` : undefined;

      const idDocSigned = generateDocToken(idDocId);
      const selfieDocSigned = generateDocToken(selfieDocId);

      const apiResult = await verifyWithNigerianIdentityApi(cleanNin, fullName, dateOfBirth);
      const finalStatus: 'pending' | 'verified' =
        apiResult.success && apiResult.status === 'match' && (Number(livenessScore) || 0) >= 70 ? 'verified' : 'pending';

      const submissionId = `VERIF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const fullNinLast4 = cleanNin.slice(-4);
      const maskedNin = `***-***-${fullNinLast4}`;

      await withTransaction(async client => {
        if (finalStatus === 'pending') {
          await client.query(
            `INSERT INTO shopit_verification_documents (id, seller_id, doc_type, encrypted_data, created_at)
             VALUES ($1, $2, 'id_document', $3, NOW()), ($4, $2, 'selfie', $5, NOW())`,
            [
              idDocId,
              resolvedSellerId,
              encryptSensitiveData(String(idDocumentPhoto)),
              selfieDocId,
              encryptSensitiveData(String(selfiePhoto)),
            ]
          );

          if (guardianDocId && guardianIdDocumentPhoto) {
            await client.query(
              `INSERT INTO shopit_verification_documents (id, seller_id, doc_type, encrypted_data, created_at)
               VALUES ($1, $2, 'guardian_id', $3, NOW())`,
              [guardianDocId, resolvedSellerId, encryptSensitiveData(String(guardianIdDocumentPhoto))]
            );
          }
        }

        await client.query(
          `INSERT INTO shopit_verifications (
            id, seller_id, user_id, shop_name, owner_name, id_type,
            id_number_masked, full_nin_last4, nin_last4, id_hash,
            document_url, selfie_url, under_18, guardian_name,
            guardian_phone, status, notes, reviewed_by, reviewed_at, submitted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW(), NOW())`,
          [
            submissionId,
            resolvedSellerId,
            user.userId,
            shopName || `${fullName}'s Crafts`,
            fullName.trim(),
            idDocumentType || 'nin_slip',
            maskedNin,
            fullNinLast4,
            fullNinLast4,
            ninDigest,
            finalStatus === 'pending' ? idDocSigned.url : '[Deleted after automated verification]',
            finalStatus === 'pending' ? selfieDocSigned.url : '[Deleted after automated verification]',
            Boolean(under18),
            guardianFullName ? String(guardianFullName).trim() : null,
            guardianNin ? String(guardianNin).slice(-4) : null,
            finalStatus,
            `Submission via portal (${apiResult.provider}). Liveness: ${Math.round(Number(livenessScore) || 90)}%`,
            finalStatus === 'verified' ? apiResult.provider : null,
            finalStatus === 'verified' ? new Date().toISOString() : null,
          ]
        );

        await client.query(
          `UPDATE shopit_sellers
           SET verification_status = $1, is_verified_seller = $2, verified_legal_name = $3,
               verified_nin_last4 = $4,
               under_18 = COALESCE($5, under_18),
               guardian_name = COALESCE($6, guardian_name),
               guardian_consent = COALESCE($7, guardian_consent),
               verified_at = CASE WHEN $2 = true THEN NOW() ELSE verified_at END, updated_at = NOW()
           WHERE id = $8 OR user_id = $8`,
          [
            finalStatus,
            finalStatus === 'verified',
            fullName.trim(),
            fullNinLast4,
            under18 !== undefined ? Boolean(under18) : null,
            guardianFullName ? String(guardianFullName).trim() : null,
            under18 ? Boolean(guardianConsentSigned) : null,
            resolvedSellerId,
          ]
        );
      });

      await logAuditEvent({
        action: finalStatus === 'verified' ? 'NIN_AUTO_VERIFIED' : 'NIN_SUBMITTED_FOR_ADMIN_REVIEW',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'seller', id: resolvedSellerId },
        details: { submissionId, maskedNin, provider: apiResult.provider },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      await sendAdminAlert(
        `verif_submission_${submissionId}`,
        `New Seller Identity Verification: ${escapeHtml(shopName || fullName)}`,
        `Artisan <strong>"${escapeHtml(shopName || fullName)}"</strong> (${escapeHtml(fullName)}) submitted verification.<br/>
         Status: <strong>${finalStatus === 'verified' ? 'Verified' : 'Pending Moderator Review'}</strong><br/>
         Masked NIN: <strong>${escapeHtml(maskedNin)}</strong>`
      );

      return res.status(200).json({
        status: true,
        verificationId: submissionId,
        verificationStatus: finalStatus,
        maskedNin,
        ownerName: fullName,
        verifiedAt: finalStatus === 'verified' ? new Date().toISOString() : undefined,
        message:
          finalStatus === 'verified'
            ? 'Identity verification succeeded. Your Verified Artisan badge is active!'
            : 'Verification submitted successfully. Your documents have been queued for Trust & Safety review.',
      });
    } catch (err: any) {
      console.error('Error in /api/verification/submit:', err.message);
      return res.status(500).json({ status: false, message: 'Internal server error processing verification submission.' });
    }
  }
);

router.get(
  '/verification/status/:sellerId',
  requireAuth,
  requireOwnershipOrAdmin(req => req.params.sellerId),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sellerId } = req.params;
      const sellerRes = await dbQuery(
        `SELECT s.is_verified_seller, s.verification_status, s.verification_rejection_reason,
                s.verified_legal_name, s.verified_nin_last4, s.verified_at
         FROM shopit_sellers s
         WHERE s.id = $1 OR s.user_id = $1`,
        [sellerId]
      );

      const sellerRow = sellerRes.rows[0];
      const verifRes = await dbQuery(
        'SELECT status, rejection_reason, admin_notes FROM shopit_verifications WHERE seller_id = $1 OR user_id = $1 ORDER BY submitted_at DESC LIMIT 1',
        [sellerId]
      );

      const isVerified = Boolean(
        sellerRow?.is_verified_seller ||
        sellerRow?.verification_status === 'verified' ||
        sellerRow?.verification_status === 'approved' ||
        verifRes.rows[0]?.status === 'verified' ||
        verifRes.rows[0]?.status === 'approved'
      );

      const verifStatus = isVerified
        ? 'verified'
        : verifRes.rows[0]?.status || sellerRow?.verification_status || 'not_started';

      return res.json({
        status: true,
        verificationStatus: verifStatus,
        isVerified,
        maskedNin: sellerRow?.verified_nin_last4 ? `******${sellerRow.verified_nin_last4}` : undefined,
        ownerName: sellerRow?.verified_legal_name,
        verifiedAt: sellerRow?.verified_at,
        rejectionReason: sellerRow?.verification_rejection_reason || verifRes.rows[0]?.rejection_reason || verifRes.rows[0]?.admin_notes,
        isLocked: false,
      });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: 'Database error retrieving verification status.' });
    }
  }
);

router.get('/verification/admin/queue', requireModerator, async (_req: AuthenticatedRequest, res) => {
  try {
    const dbRes = await dbQuery(`
      SELECT v.*, s.shop_name as seller_shop_name, s.owner_name as seller_owner_name
      FROM shopit_verifications v
      LEFT JOIN shopit_sellers s ON (s.id = v.seller_id OR s.user_id = v.seller_id)
      ORDER BY v.submitted_at DESC
      LIMIT 100
    `);

    const auditRes = await dbQuery(
      "SELECT id, action, target_id, actor_email, details, created_at FROM shopit_audit_logs WHERE action LIKE 'NIN_%' OR action LIKE '%VERIF%' OR action LIKE '%NIN%' ORDER BY created_at DESC LIMIT 50"
    );

    const queue = dbRes.rows.map((row: any) => ({
      id: row.id,
      sellerId: row.seller_id,
      shopName: row.shop_name || row.seller_shop_name || 'Artisan Shop',
      ownerName: row.owner_name || row.seller_owner_name || 'Seller',
      idType: row.id_type || row.document_type || 'nin_slip',
      fullNinLast4: row.id_number_masked || '****',
      idNumber: row.id_number_masked || '****',
      under18: Boolean(row.under_18),
      guardianName: row.guardian_name,
      guardianPhone: row.guardian_phone,
      status: row.status,
      rejectionReason: row.rejection_reason,
      adminNotes: row.admin_notes || row.notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at || row.created_at,
      idCardPhotoUrl: row.document_url || '',
      selfiePhotoUrl: row.selfie_url || '',
    }));

    return res.json({
      status: true,
      totalCount: queue.length,
      pendingCount: queue.filter((q: any) => q.status === 'pending').length,
      queue,
      auditLogs: auditRes.rows,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/verification/admin/review', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const sellerTarget = req.body.sellerId || req.body.requestId || req.body.targetId;
    const rawAction = req.body.action || req.body.decision;
    const reason = req.body.reason || req.body.rejectionReason;
    const reviewedBy = user.email; // Derived strictly from authenticated moderator session

    if (!sellerTarget) {
      return res.status(400).json({ status: false, message: 'sellerId or requestId is required.' });
    }

    const action = rawAction === 'approved' ? 'verified' : rawAction;
    if (!['verified', 'rejected', 'needs_resubmission'].includes(action)) {
      return res.status(400).json({ status: false, message: 'Invalid action.' });
    }

    const isVerified = action === 'verified';

    await withTransaction(async client => {
      const sellerUpdate = await client.query(
        `UPDATE shopit_sellers
         SET is_verified_seller = $1, verification_status = $2,
             verified_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
             verification_rejection_reason = $3, updated_at = NOW()
         WHERE id = $4 OR user_id = $4 OR LOWER(email) = LOWER($4)`,
        [isVerified, action, isVerified ? null : reason || null, sellerTarget]
      );

      if (sellerUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, verified_at, created_at, updated_at)
           SELECT u.id, u.id, COALESCE(u.name || '''s Shop', 'Artisan Shop'), u.name, u.email, $1, $2, CASE WHEN $1 = true THEN NOW() ELSE NULL END, NOW(), NOW()
           FROM shopit_users u WHERE u.id = $3 OR LOWER(u.email) = LOWER($3)
           ON CONFLICT (id) DO UPDATE SET is_verified_seller = $1, verification_status = $2, updated_at = NOW()`,
          [isVerified, action, sellerTarget]
        );
      }

      await client.query(
        `UPDATE shopit_users
         SET role = CASE WHEN $1 = true AND role = 'buyer' THEN 'seller' ELSE role END, updated_at = NOW()
         WHERE id = $2 OR LOWER(email) = LOWER($2) OR id IN (SELECT user_id FROM shopit_sellers WHERE id = $2)`,
        [isVerified, sellerTarget]
      );

      await client.query(
        `UPDATE shopit_verifications
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             rejection_reason = $3, admin_notes = $3, notes = $3,
             document_url = '[Deleted after review decision]',
             selfie_url = '[Deleted after review decision]',
             updated_at = NOW()
         WHERE seller_id = $4 OR user_id = $4 OR id = $4`,
        [action, reviewedBy, reason || null, sellerTarget]
      );

      // Rule 3: Immediately purge encrypted ID/selfie/guardian images after admin decision; retain only last 4, hash, decision, and date
      await client.query(
        `DELETE FROM shopit_verification_documents
         WHERE seller_id = $1
            OR seller_id IN (SELECT seller_id FROM shopit_verifications WHERE id = $1 OR seller_id = $1 OR user_id = $1)
            OR seller_id IN (SELECT id FROM shopit_sellers WHERE id = $1 OR user_id = $1 OR LOWER(email) = LOWER($1))`,
        [sellerTarget]
      );
    });

    await logAuditEvent({
      action: `VERIFICATION_${action.toUpperCase()}`,
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'seller', id: sellerTarget },
      details: { reason, imagesPurgedImmediately: true },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      sellerId: sellerTarget,
      isVerifiedSeller: isVerified,
      verificationStatus: action,
      imagesDeletedImmediately: true,
      message: `Seller verification status updated to '${action}'. Uploaded ID/selfie images have been deleted immediately.`,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.get('/verification/document/:docId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { docId } = req.params;
    const token = String(req.query.token || '');

    if (!token || !verifyDocToken(docId, token)) {
      return res.status(403).json({ status: false, message: 'Access denied: invalid or expired document token.' });
    }

    const docRes = await dbQuery('SELECT seller_id, encrypted_data FROM shopit_verification_documents WHERE id = $1', [docId]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Requested identity document was not found or was purged.' });
    }

    const doc = docRes.rows[0];
    const isOwner = doc.seller_id === user.userId || (user.sellerId && doc.seller_id === user.sellerId);
    const isModeratorAdmin = user.role === 'admin' && ['superadmin', 'moderator'].includes(user.subRole || '');
    if (!isOwner && !isModeratorAdmin) {
      return res.status(403).json({ status: false, message: 'Forbidden: only the document owner or a Trust & Safety moderator may view identity documents.' });
    }

    const plainData = decryptSensitiveData(doc.encrypted_data);
    if (plainData.startsWith('data:image/')) {
      const matches = plainData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches) {
        res.setHeader('Content-Type', matches[1]);
        res.setHeader('Cache-Control', 'no-store');
        return res.send(Buffer.from(matches[2], 'base64'));
      }
    }

    return res.json({ status: true, docId, data: plainData });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Unable to retrieve document.' });
  }
});

router.post(
  '/verification/delete-data',
  requireAuth,
  requireOwnershipOrAdmin(req => req.body?.sellerId || req.user?.sellerId || req.user?.userId || ''),
  async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const sellerId = req.body?.sellerId || user.sellerId || user.userId;
      const { confirmationText } = req.body;

      if (confirmationText !== 'PURGE_MY_IDENTITY_DATA') {
        return res.status(400).json({ status: false, message: 'Confirmation phrase "PURGE_MY_IDENTITY_DATA" required.' });
      }

      await withTransaction(async client => {
        await client.query('DELETE FROM shopit_verification_documents WHERE seller_id = $1', [sellerId]);
        await client.query(
          `UPDATE shopit_verifications
           SET document_url = '[Purged]', selfie_url = '[Purged]', id_hash = NULL, updated_at = NOW()
           WHERE seller_id = $1 OR user_id = $1`,
          [sellerId]
        );
      });

      await logAuditEvent({
        action: 'NDPA_DATA_PURGED',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'seller', id: sellerId },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ status: true, message: 'Identification documents permanently purged under NDPA 2023.' });
    } catch (err: any) {
      return res.status(500).json({ status: false, message: err.message });
    }
  }
);

// ============================================================================
// CRON JOBS (Guarded by CRON_SECRET Bearer token or Admin Session)
// ============================================================================

// expireStalePendingOrders imported from ./lib/payments.js (30-min pending expiry + atomic stock restore)

router.all('/cron/escrow', requireCronOrAdmin, async (_req, res) => {
  const result = await processEscrowAutoRelease();
  const unshipped = await processUnshippedOrders();
  return res.json({ status: true, ...result, unshipped });
});

router.all('/cron/unshipped', requireCronOrAdmin, async (_req, res) => {
  const result = await processUnshippedOrders();
  return res.json({ status: true, ...result });
});

router.all('/cron/expire-orders', requireCronOrAdmin, async (_req, res) => {
  const result = await expireStalePendingOrders();
  return res.json({ status: true, ...result });
});

router.post('/coupons/validate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const cleanCode = String(req.body?.code || '').trim().toUpperCase();
    const subtotalNaira = Math.max(0, Number(req.body?.subtotal) || 0);
    if (!cleanCode) {
      return res.status(400).json({ status: false, message: 'Promo code is required.' });
    }

    const couponRes = await dbQuery('SELECT * FROM shopit_coupons WHERE UPPER(code) = $1 LIMIT 1', [cleanCode]);
    if (couponRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Invalid promo code.' });
    }

    const coupon = couponRes.rows[0];
    if (!coupon.is_active) {
      return res.status(400).json({ status: false, message: 'This promo code is no longer active.' });
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ status: false, message: 'This promo code has expired.' });
    }
    if (coupon.max_uses !== null && coupon.max_uses !== undefined && Number(coupon.current_uses || 0) >= Number(coupon.max_uses)) {
      return res.status(400).json({ status: false, message: 'This promo code has reached its usage limit.' });
    }

    const minOrderNaira = koboToNaira(parseInt(String(coupon.min_subtotal_kobo || '0'), 10));
    if (subtotalNaira < minOrderNaira) {
      return res.status(400).json({
        status: false,
        message: `This promo code requires a minimum item order of ₦${minOrderNaira.toLocaleString()}.`,
      });
    }

    const discountAmount = koboToNaira(parseInt(String(coupon.discount_kobo || '0'), 10));
    return res.json({
      status: true,
      coupon: {
        code: coupon.code,
        discountAmount,
        minOrder: minOrderNaira,
        description: `₦${discountAmount.toLocaleString()} promo discount (${coupon.code})`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Unable to validate promo code.' });
  }
});

// Mount router under BOTH '/api' and '/' so Vercel rewrites match cleanly
app.use('/api', router);
app.use('/', router);

export default function handler(req: any, res: any) {
  return app(req, res);
}

export { app };

import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import paymentsWebhookHandler from './webhooks/flutterwave.js';
import { renderTransactionalEmail, type EmailTemplateKey } from '../src/utils/transactionalEmails.js';
import {
  checkRateLimit as checkOtpRateLimit,
  recordRateLimit as recordOtpRateLimit,
  checkResendCooldown as checkOtpResendCooldown,
  checkAndRecordRateLimit,
  saveHashedOtp,
  deleteOtpRecord,
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
  getAllPlatformConfig,
  getPlatformSetting,
  setPlatformSetting,
  DEFAULT_BROADCAST_SETTING,
  DEFAULT_EMERGENCY_CONTROLS,
  DEFAULT_FEE_SETTINGS_DB,
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
  requireOwnershipOrAdmin,
  requireCronSecret,
  optionalAuth,
  extractToken,
  type AuthenticatedRequest,
} from './auth/middleware.js';
import {
  nairaToKobo,
  koboToNaira,
  calculateTieredServiceFeeKobo,
  calculateConfiguredServiceFeeKobo,
  encryptSensitiveData,
  decryptSensitiveData,
  sendBrevoDirect,
  sendAdminAlert as dispatchAdminAlert,
  commitPaidOrderTransaction,
  expireStalePendingOrders,
  runLazyPendingOrderExpiry,
  processUnshippedOrders,
  runDailyReconciliationCheck,
  restoreOrderStockInTx,
} from './lib/payments.js';
import { validateAppSecret, deriveSubKey } from './lib/secrets.js';
import { getKycProvider } from './lib/kycProvider.js';
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_SETTINGS,
  UNDER_18_PRIVACY_SETTINGS,
  containsForbiddenContactInfo,
  extractFirstName,
  generateUniqueProfileSlug,
  rejectUnknownFields,
  sanitizeNotificationPrefs,
  sanitizePrivacySettings,
} from './lib/validation.js';
import marketplaceRouter, { processEscrowAutoRelease } from './routes/marketplace.js';
import profilesRouter from './routes/profiles.js';
import filesRouter from './routes/files.js';

// Fail-closed startup guard: refuse to boot unless APP_SECRET is valid (64+ hex chars)
validateAppSecret();

export const sendAdminAlert = dispatchAdminAlert;

// Run database migrations on server boot
runMigration().catch(err => {
  console.error('[PostgreSQL Startup Migration Error]:', err.message);
});

const app = express();
app.use(cookieParser());

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const PRODUCTION_APP_URL = 'https://shopitng.vercel.app';

const APP_URL = (
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  PRODUCTION_APP_URL
).replace(/\/$/, '');

function getAllowedOrigins(req?: express.Request): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const ngAllowedHosts = (process.env.NG_ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  const hostHeader = req ? String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase() : '';
  const protoHeader = req ? String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim().toLowerCase() : 'https';
  const sameHostOrigins: string[] = [];
  if (hostHeader) {
    const cleanHost = hostHeader.replace(/:\d+$/, '');
    const isTrustedDeploymentHost =
      cleanHost.endsWith('.run.app') ||
      cleanHost.endsWith('.vercel.app') ||
      cleanHost === 'shopitng.vercel.app' ||
      cleanHost === 'localhost' ||
      cleanHost === '127.0.0.1' ||
      ngAllowedHosts.includes(cleanHost);
    if (isTrustedDeploymentHost) {
      sameHostOrigins.push(`${protoHeader === 'http' ? 'http' : 'https'}://${hostHeader}`);
    }
  }

  const defaults = [
    APP_URL,
    PRODUCTION_APP_URL,
    ...sameHostOrigins,
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, '')]
      : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`.replace(/\/$/, '')] : []),
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
  const allowedOrigins = getAllowedOrigins(req);
  const isWebhookPath =
    req.path === '/webhooks/flutterwave' ||
    req.path === '/api/webhooks/flutterwave';

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

function hashNin(nin: string): string {
  const ninKey = deriveSubKey('nin-hash', 32);
  return crypto.createHmac('sha256', ninKey).update(nin.trim()).digest('hex');
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
  'email_change',
]);

const router = express.Router();
router.use(marketplaceRouter);
router.use(profilesRouter);
router.use(filesRouter);

const APP_BUILT_AT = new Date().toISOString();

// Deployment version check (VERCEL_GIT_COMMIT_SHA & builtAt)
router.get('/version', (_req, res) => {
  return res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'local',
    builtAt: process.env.VERCEL_BUILD_COMPLETED_AT || APP_BUILT_AT,
  });
});

// Health check (verifies PostgreSQL connection + core schema tables + optional Redis)
router.get(['/health', '/api/health'], async (_req, res) => {
  const pgPing = await pingPostgres();
  const redisPing = await pingRedis();
  const isPgOk = pgPing.ok;
  const hasRedisConfig = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const isRedisOk = !hasRedisConfig || redisPing.ok;

  if (isPgOk && isRedisOk) {
    return res.status(200).json({
      status: 'OK',
      database: pgPing.provider,
      schemaOk: Boolean(pgPing.schemaOk),
      timestamp: new Date().toISOString(),
    });
  }

  const failingServices: string[] = [];
  if (!isPgOk) failingServices.push('PostgreSQL');
  if (!isRedisOk) failingServices.push('Upstash Redis');
  const safeDbError = pgPing.error
    ? String(pgPing.error).replace(/postgres(ql)?:\/\/[^\s]+/gi, '[redacted-url]').slice(0, 180)
    : undefined;
  return res.status(503).json({
    status: 'ERROR',
    failing: failingServices.join(', '),
    schemaOk: Boolean(pgPing.schemaOk),
    ...(pgPing.missingTables && pgPing.missingTables.length > 0 ? { missingTables: pgPing.missingTables } : {}),
    ...(safeDbError ? { error: safeDbError } : {}),
    timestamp: new Date().toISOString(),
  });
});

// Public live platform configuration (PostgreSQL source of truth for broadcast banner, killswitches, and fee policy)
router.get('/platform/config', async (_req, res) => {
  try {
    const config = await getAllPlatformConfig();
    return res.json({ status: true, ...config });
  } catch (err: any) {
    console.error('[Platform Config Read Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to load platform configuration from database.' });
  }
});

// ============================================================================
// AUTHENTICATION & USER GOVERNANCE
// ============================================================================

router.post(['/auth/register', '/auth/signup'], async (req, res) => {
  try {
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

    if (cleanName.length < 2 || cleanName.length > 120) {
      return res.status(400).json({ status: false, message: 'Name must be between 2 and 120 characters.' });
    }
    const nameContactCheck = containsForbiddenContactInfo(cleanName);
    if (nameContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Name: ${nameContactCheck.reason}` });
    }
    if (shopName) {
      const shopContactCheck = containsForbiddenContactInfo(String(shopName));
      if (shopContactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop name: ${shopContactCheck.reason}` });
      }
    }
    if (bio) {
      const bioContactCheck = containsForbiddenContactInfo(String(bio));
      if (bioContactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Bio: ${bioContactCheck.reason}` });
      }
    }

    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ status: false, message: 'Please provide a valid email address.' });
    }

    if (cleanPassword.length < 8 || cleanPassword.length > 128) {
      return res.status(400).json({ status: false, message: 'Password must be between 8 and 128 characters long.' });
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

    // Consume single-use server-issued signup OTP proof token if present; never block registration if unverified or Redis/email failed
    let isVerifiedEmail = false;
    if (signupVerificationToken) {
      try {
        isVerifiedEmail = await consumeSignupVerificationToken(cleanEmail, String(signupVerificationToken));
      } catch {
        isVerifiedEmail = false;
      }
    }

    const userRole = role === 'seller' ? 'seller' : 'buyer';
    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = hashPassword(cleanPassword);
    const defaultDisplayName = extractFirstName(cleanName);
    const resolvedCampus = campus ? String(campus).trim() : (userRole === 'seller' ? 'Lagos Mainland' : '');
    const resolvedArea = location?.area ? String(location.area).trim() : (userRole === 'seller' ? 'Yaba' : '');
    const resolvedBio = bio ? String(bio).trim().slice(0, 200) : '';
    const initialPrivacy = parsedAge < 18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;

    const txResult = await withTransaction(async client => {
      const existing = await client.query('SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
      if (existing.rows.length > 0) {
        return { conflict: true as const };
      }

      const profileSlug = await generateUniqueProfileSlug(
        (sql: string, p?: any[]) => client.query(sql, p),
        defaultDisplayName
      );

      const userInsert = await client.query(
        `INSERT INTO shopit_users (
          id, email, name, display_name, profile_slug, bio, campus, location_area,
          interests, notification_prefs, privacy_settings,
          password_hash, role, is_verified_email, age, has_guardian_consent, guardian_name,
          last_seen_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, NOW(), NOW(), NOW())
        RETURNING id, email, name, display_name, profile_slug, avatar_url, cover_url, bio, campus, location_area, interests, notification_prefs, privacy_settings, role, is_verified_email, age, has_guardian_consent, guardian_name, created_at`,
        [
          userId,
          cleanEmail,
          cleanName,
          defaultDisplayName,
          profileSlug,
          resolvedBio,
          resolvedCampus || null,
          resolvedArea || null,
          JSON.stringify(DEFAULT_NOTIFICATION_PREFS),
          JSON.stringify(initialPrivacy),
          passwordHash,
          userRole,
          isVerifiedEmail,
          parsedAge,
          parsedAge < 18 ? Boolean(hasGuardianConsent) : true,
          guardianName ? String(guardianName).trim() : null,
        ]
      );

      let sellerProfile: any = null;
      if (userRole === 'seller') {
        const cleanShop = (shopName || `${defaultDisplayName}'s Shop`).trim();
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
            defaultDisplayName,
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
          `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, is_frozen, created_at, updated_at)
           VALUES ($1, 0, 0, 0, false, NOW(), NOW())
           ON CONFLICT (seller_id) DO NOTHING`,
          [userId]
        );
      }

      // Atomic Admin Alert & Notification inside the exact same transaction as user creation
      const roleLabel = userRole === 'seller' ? 'Seller' : 'Buyer';
      const txShopName = sellerProfile?.shop_name || (shopName ? String(shopName).trim() : null);
      const txCampus = sellerProfile?.campus || (campus ? String(campus).trim() : null);
      const txArea = sellerProfile?.location_area || location?.area || null;
      const alertTitle = `New ${roleLabel} Registered: ${cleanName}`;
      const alertMsg =
        userRole === 'seller'
          ? `${cleanName} (${cleanEmail}) registered Seller Shop "${txShopName || cleanName}" at ${txCampus || 'Campus'}.`
          : `${cleanName} (${cleanEmail}) joined Shop It as a Buyer (Age ${parsedAge}).`;

      await client.query(
        `INSERT INTO shopit_admin_alerts (
          alert_key, id, alert_type, user_id, user_email, user_name, user_role,
          title, message, is_read, metadata, created_at
        ) VALUES ($1, $2, 'new_user', $3, $4, $5, $6, $7, $8, false, $9::jsonb, NOW())
        ON CONFLICT (alert_key) DO NOTHING`,
        [
          `new_user_${userId}`,
          `alert_user_${userId}`,
          userId,
          cleanEmail,
          cleanName,
          userRole,
          alertTitle,
          alertMsg,
          JSON.stringify({
            shopName: txShopName,
            campus: txCampus,
            locationArea: txArea,
            age: parsedAge,
            isVerifiedEmail,
          }),
        ]
      );

      const adminUsersRes = await client.query("SELECT id FROM shopit_users WHERE role = 'admin'");
      for (const adm of adminUsersRes.rows) {
        await client.query(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, $3, $4, 'info', false, '/admin', NOW())`,
          [
            `notif_new_user_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            adm.id,
            alertTitle,
            alertMsg,
          ]
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

    const signupShopName = txResult.sellerProfile?.shop_name || (shopName ? String(shopName).trim() : undefined);
    const signupCampus = txResult.sellerProfile?.campus || (campus ? String(campus).trim() : undefined);
    const signupArea = txResult.sellerProfile?.location_area || location?.area || undefined;

    await logAuditEvent({
      action: 'USER_REGISTERED',
      actor: { id: userId, email: cleanEmail, role: userRole },
      target: { type: 'user', id: userId },
      details: {
        name: cleanName,
        email: cleanEmail,
        role: userRole,
        age: parsedAge,
        isUnder18: parsedAge < 18,
        hasGuardianConsent: parsedAge < 18 ? Boolean(hasGuardianConsent) : true,
        guardianName: guardianName ? String(guardianName).trim() : null,
        shopName: signupShopName || null,
        campus: signupCampus || null,
        locationArea: signupArea || null,
        isVerifiedEmail,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Non-blocking email alert to admin (already persisted atomically in shopit_admin_alerts)
    dispatchAdminAlert(
      `new_user_${userId}`,
      `New ${userRole === 'seller' ? 'Seller' : 'Buyer'} Signed Up: ${cleanName}`,
      `Name: <strong>${escapeHtml(cleanName)}</strong><br/>
       Email: <strong>${escapeHtml(cleanEmail)}</strong><br/>
       Role: <strong>${escapeHtml(userRole.toUpperCase())}</strong><br/>
       Age: <strong>${parsedAge}</strong>${parsedAge < 18 && guardianName ? ` (Guardian: ${escapeHtml(guardianName)})` : ''}<br/>
       ${signupShopName ? `Shop: <strong>${escapeHtml(signupShopName)}</strong> (${escapeHtml(signupCampus || 'Campus')})<br/>` : ''}
       Registered At: <strong>${new Date().toISOString()}</strong>`
    ).catch(() => {});

    return res.status(201).json({
      status: true,
      sessionToken: token,
      user: {
        id: txResult.savedUser.id,
        email: txResult.savedUser.email,
        name: txResult.savedUser.name,
        displayName: txResult.savedUser.display_name,
        profileSlug: txResult.savedUser.profile_slug,
        avatarUrl: txResult.savedUser.avatar_url || undefined,
        coverUrl: txResult.savedUser.cover_url || undefined,
        bio: txResult.savedUser.bio || '',
        campus: txResult.savedUser.campus || undefined,
        locationArea: txResult.savedUser.location_area || undefined,
        interests: Array.isArray(txResult.savedUser.interests) ? txResult.savedUser.interests : [],
        notificationPrefs: txResult.savedUser.notification_prefs || DEFAULT_NOTIFICATION_PREFS,
        privacySettings: txResult.savedUser.privacy_settings || initialPrivacy,
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
    if (err?.code === '23505') {
      return res.status(409).json({
        status: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }
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
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE LOWER(u.email) = LOWER($1)`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      await recordLoginFailure(cleanEmail);
      await logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        actor: { id: 'unknown', email: cleanEmail, role: 'visitor' },
        target: { type: 'auth', id: cleanEmail },
        details: { reason: 'unknown_email' },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
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
      await logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        actor: { id: userRow.id, email: userRow.email, role: userRow.role },
        target: { type: 'auth', id: userRow.id },
        details: { reason: fail.locked ? 'account_locked' : 'invalid_password' },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
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

    if (userRow.is_banned) {
      await logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        actor: { id: userRow.id, email: userRow.email, role: userRow.role },
        target: { type: 'auth', id: userRow.id },
        details: { reason: 'account_banned' },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.status(403).json({
        status: false,
        error: 'ACCOUNT_BANNED',
        message: userRow.ban_reason || 'This account has been suspended by an administrator.',
      });
    }

    await clearLoginFailures(cleanEmail);
    await dbQuery('UPDATE shopit_users SET last_login_at = NOW(), last_seen_at = NOW(), updated_at = NOW() WHERE id = $1', [userRow.id]);

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

    const isMinor = (userRow.age !== null && userRow.age !== undefined && Number(userRow.age) < 18);
    const sanitizedUser: any = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      displayName: userRow.display_name || extractFirstName(userRow.name || 'Member'),
      profileSlug: userRow.profile_slug || userRow.id,
      avatarUrl: userRow.avatar_url || undefined,
      coverUrl: userRow.cover_url || undefined,
      bio: userRow.bio || '',
      campus: userRow.campus || undefined,
      locationArea: userRow.location_area || undefined,
      interests: Array.isArray(userRow.interests) ? userRow.interests : [],
      notificationPrefs: sanitizeNotificationPrefs(userRow.notification_prefs, DEFAULT_NOTIFICATION_PREFS),
      privacySettings: sanitizePrivacySettings(
        userRow.privacy_settings,
        isMinor ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
        isMinor
      ),
      role: userRow.role,
      ...(userRow.role === 'admin' && userRow.sub_role ? { subRole: userRow.sub_role } : {}),
      isVerifiedEmail: Boolean(userRow.is_verified_email),
      mustChangePassword: Boolean(userRow.must_change_password),
      age: userRow.age,
      hasGuardianConsent: Boolean(userRow.has_guardian_consent),
      guardianName: userRow.guardian_name,
      createdAt: userRow.created_at,
      lastLoginAt: new Date().toISOString(),
    };

    if (userRow.role === 'seller' || userRow.seller_id) {
      sanitizedUser.sellerProfile = {
        id: userRow.seller_id || userRow.id,
        shopName: userRow.shop_name || `${sanitizedUser.displayName}'s Shop`,
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
    const sess = await getSession(token);
    await destroySession(token);
    if (sess) {
      await logAuditEvent({
        action: 'USER_LOGOUT',
        actor: { id: sess.userId, email: sess.email, role: sess.role },
        target: { type: 'session', id: token.slice(-8) },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
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
      'SELECT u.id, u.email, u.name, u.role, u.sub_role, s.id AS seller_id, s.is_verified_seller, u.password_hash, u.must_change_password FROM shopit_users u LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id) WHERE u.id = $1',
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

    await logAuditEvent({
      action: 'PASSWORD_RESET_COMPLETED',
      actor: { id: userId, email: cleanEmail, role: 'user' },
      target: { type: 'user', id: userId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      message: 'Your password has been reset successfully! All older sessions were signed out.',
    });
  } catch (err: any) {
    console.error('[Password Reset Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error updating password.' });
  }
});

// Authenticated Email Change (Step 1: verify password + send OTP to new email; Step 2: consume OTP + revoke sessions)
router.post('/auth/change-email/request-otp', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const check = rejectUnknownFields(req.body, ['newEmail', 'currentPassword']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { newEmail, currentPassword } = check.obj;
    const cleanNewEmail = String(newEmail || '').trim().toLowerCase();
    if (!cleanNewEmail || cleanNewEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      return res.status(400).json({ status: false, message: 'Please provide a valid email address.' });
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ status: false, message: 'Your current password is required to change your email.' });
    }

    const userId = req.user!.userId;
    const uRes = await dbQuery('SELECT id, email, password_hash FROM shopit_users WHERE id = $1', [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User account not found.' });
    }
    const uRow = uRes.rows[0];
    if (String(uRow.email).trim().toLowerCase() === cleanNewEmail) {
      return res.status(400).json({ status: false, message: 'Please enter a different email address from your current one.' });
    }
    if (!verifyPassword(currentPassword.trim(), uRow.password_hash)) {
      return res.status(401).json({ status: false, message: 'Current password is incorrect.' });
    }

    const conflictRes = await dbQuery('SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1', [
      cleanNewEmail,
      userId,
    ]);
    if (conflictRes.rows.length > 0) {
      return res.status(409).json({ status: false, message: 'That email address is already registered to another account.' });
    }

    const rl = await checkAndRecordRateLimit(`email_change_req:${userId}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many email change requests. Please wait a few minutes.' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashOtp(code);
    await saveHashedOtp(cleanNewEmail, 'email_change', codeHash, { userId, oldEmail: uRow.email });

    const rendered = renderTransactionalEmail('email_change', { code, email: cleanNewEmail });
    const emailSent = await sendBrevoDirect(cleanNewEmail, rendered.subject, rendered.text, rendered.html);
    if (IS_PROD && !emailSent) {
      await deleteOtpRecord(cleanNewEmail, 'email_change').catch(() => {});
      return res.status(503).json({ status: false, message: 'Email service temporarily unavailable. Please try again.' });
    }

    await logAuditEvent({
      action: 'EMAIL_CHANGE_OTP_REQUESTED',
      actor: { id: userId, email: uRow.email, role: req.user!.role },
      target: { type: 'user', id: userId },
      details: { requestedNewEmailDomain: cleanNewEmail.split('@')[1] || '' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: `A 6-digit confirmation code was sent to ${cleanNewEmail}.` });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Unable to send email confirmation code.' });
  }
});

router.post('/auth/change-email/confirm', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const check = rejectUnknownFields(req.body, ['newEmail', 'code', 'currentPassword']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { newEmail, code, currentPassword } = check.obj;
    const cleanNewEmail = String(newEmail || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim().replace(/\D/g, '');

    if (!cleanNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail) || cleanCode.length !== 6) {
      return res.status(400).json({ status: false, message: 'Valid new email and 6-digit verification code are required.' });
    }
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ status: false, message: 'Current password is required.' });
    }

    const userId = req.user!.userId;
    const uRes = await dbQuery('SELECT id, email, name, role, sub_role, password_hash FROM shopit_users WHERE id = $1', [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }
    const uRow = uRes.rows[0];
    if (!verifyPassword(currentPassword.trim(), uRow.password_hash)) {
      return res.status(401).json({ status: false, message: 'Current password is incorrect.' });
    }

    const otpRes = await verifyAndConsumeOtp(cleanNewEmail, 'email_change', cleanCode);
    if (!otpRes.success) {
      return res.status(400).json({
        status: false,
        message: otpRes.error || 'Invalid or expired verification code.',
        attemptsRemaining: otpRes.attemptsRemaining,
      });
    }
    if (otpRes.record?.metadata?.userId && otpRes.record.metadata.userId !== userId) {
      return res.status(403).json({ status: false, message: 'Verification code does not belong to your account.' });
    }

    const txRes = await withTransaction(async client => {
      const conflict = await client.query('SELECT id FROM shopit_users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1', [
        cleanNewEmail,
        userId,
      ]);
      if (conflict.rows.length > 0) {
        return { conflict: true as const };
      }
      await client.query('UPDATE shopit_users SET email = $1, is_verified_email = true, updated_at = NOW() WHERE id = $2', [
        cleanNewEmail,
        userId,
      ]);
      await client.query('UPDATE shopit_sellers SET email = $1, updated_at = NOW() WHERE user_id = $2 OR id = $2', [
        cleanNewEmail,
        userId,
      ]);
      return { conflict: false as const };
    });

    if (txRes.conflict) {
      return res.status(409).json({ status: false, message: 'That email address is already in use.' });
    }

    await revokeUserSessions(userId);
    const { token } = await createSession({
      userId,
      email: cleanNewEmail,
      name: uRow.name,
      role: uRow.role,
      subRole: uRow.role === 'admin' ? uRow.sub_role : undefined,
      sellerId: req.user!.sellerId,
      isVerifiedSeller: req.user!.isVerifiedSeller,
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    await logAuditEvent({
      action: 'EMAIL_CHANGED',
      actor: { id: userId, email: cleanNewEmail, role: uRow.role },
      target: { type: 'user', id: userId },
      details: { previousEmailDomain: String(uRow.email).split('@')[1] || '', newEmailDomain: cleanNewEmail.split('@')[1] || '' },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      email: cleanNewEmail,
      sessionToken: token,
      message: 'Your email address has been updated and older sessions signed out.',
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to confirm email change.' });
  }
});

// Strict session-only profile hydration (no ?email or ?userId unauthenticated spoofing)
router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const sessionUser = req.user!;
    await dbQuery('UPDATE shopit_users SET last_seen_at = NOW() WHERE id = $1', [sessionUser.userId]).catch(() => {});
    const result = await dbQuery(
      `SELECT u.id, u.email, u.name, u.display_name, u.profile_slug, u.avatar_url, u.cover_url, u.bio,
              u.campus, u.location_area, u.interests, u.notification_prefs, u.privacy_settings, u.last_seen_at,
              u.role, u.sub_role, u.is_verified_email, u.must_change_password, u.is_banned, u.ban_reason,
              u.age, u.has_guardian_consent, u.guardian_name, u.created_at, u.last_login_at,
              s.id as seller_id, s.shop_name, s.bio as s_bio, s.campus as s_campus, s.location_area as s_area,
              s.logo_url as s_logo_url, s.banner_url as s_banner_url, s.is_verified_seller as seller_is_verified,
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
    const isMinor = row.age !== null && row.age !== undefined && Number(row.age) < 18;
    const displayName = row.display_name || extractFirstName(row.name || 'Member');

    const sanitizedUser: any = {
      id: row.id,
      email: row.email,
      name: row.name,
      displayName,
      profileSlug: row.profile_slug || row.id,
      avatarUrl: row.avatar_url || row.s_logo_url || undefined,
      coverUrl: row.cover_url || row.s_banner_url || undefined,
      bio: row.bio || row.s_bio || '',
      campus: row.campus || row.s_campus || undefined,
      locationArea: row.location_area || row.s_area || undefined,
      interests: Array.isArray(row.interests) ? row.interests : [],
      notificationPrefs: sanitizeNotificationPrefs(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS),
      privacySettings: sanitizePrivacySettings(
        row.privacy_settings,
        isMinor ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
        isMinor
      ),
      lastSeenAt: row.last_seen_at || row.last_login_at || row.created_at,
      role: row.role,
      subRole: row.role === 'admin' ? row.sub_role || undefined : undefined,
      isVerifiedEmail: Boolean(row.is_verified_email),
      mustChangePassword: Boolean(row.must_change_password),
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
        shopName: row.shop_name || `${displayName}'s Shop`,
        ownerName: displayName,
        verificationStatus: currentStatus,
        isVerifiedSeller: isVerified,
        bio: row.s_bio || row.bio || '',
        campus: row.s_campus || row.campus || 'Lagos Mainland',
        locationArea: row.s_area || row.location_area || 'Yaba',
        logoUrl: row.s_logo_url || row.avatar_url || undefined,
        bannerUrl: row.s_banner_url || row.cover_url || undefined,
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
    const rawQ = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const q = rawQ.slice(0, 100);
    const role = req.query.role ? String(req.query.role).trim().toLowerCase() : 'all';
    if (!['all', 'buyer', 'seller', 'admin'].includes(role)) {
      return res.status(400).json({ status: false, message: 'Invalid role filter. Must be all, buyer, seller, or admin.' });
    }

    const onlyNew = String(req.query.onlyNew || '').toLowerCase() === 'true' || req.query.onlyNew === '1';
    const rawPage = req.query.page !== undefined ? String(req.query.page).trim() : '1';
    const rawLimit = req.query.limit !== undefined ? String(req.query.limit).trim() : '15';
    const parsedPage = /^\d+$/.test(rawPage) ? parseInt(rawPage, 10) : NaN;
    const parsedLimit = /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : NaN;
    if (isNaN(parsedPage) || parsedPage < 1 || isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ status: false, message: 'Invalid pagination parameters: page and limit must be positive integers.' });
    }
    const page = parsedPage;
    const limit = Math.min(200, parsedLimit);
    const offset = (page - 1) * limit;

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(LOWER(u.name) LIKE $${paramIndex} OR LOWER(COALESCE(u.display_name, '')) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex} OR LOWER(COALESCE(u.profile_slug, '')) LIKE $${paramIndex})`);
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (role && role !== 'all') {
      conditions.push(`u.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }
    if (onlyNew) {
      conditions.push(`u.created_at >= $${paramIndex}`);
      params.push(cutoff24h);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRes, newCountsRes] = await Promise.all([
      dbQuery(`SELECT COUNT(*) as total FROM shopit_users u ${whereClause}`, params),
      dbQuery(
        `SELECT
           COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_today,
           COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_24h
         FROM shopit_users`,
        [todayStart.toISOString(), cutoff24h]
      ),
    ]);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT u.id, u.email, u.name, u.display_name, u.profile_slug, u.avatar_url, u.bio, u.interests,
             u.campus as u_campus, u.location_area as u_area, u.deleted_at,
             u.role, u.sub_role, u.is_verified_email, u.age, u.has_guardian_consent,
             u.guardian_name, u.is_banned, u.ban_reason, u.last_login_at, u.created_at,
             s.id as seller_id, s.shop_name, s.campus, s.location_area, s.bio as s_bio,
             s.verification_status, s.is_verified_seller
      FROM shopit_users u
      LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const usersRes = await dbQuery(dataSql, [...params, limit, offset]);

    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    const seenUserIds = new Set<string>();
    const users = usersRes.rows
      .filter((row: any) => {
        if (seenUserIds.has(row.id)) return false;
        seenUserIds.add(row.id);
        return true;
      })
      .map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        displayName: row.display_name || extractFirstName(row.name || 'Member'),
        profileSlug: row.profile_slug || row.id,
        avatarUrl: row.avatar_url || undefined,
        role: row.role,
        ...(row.role === 'admin' && row.sub_role ? { subRole: row.sub_role } : {}),
        isVerifiedEmail: Boolean(row.is_verified_email),
        age: row.age,
        hasGuardianConsent: Boolean(row.has_guardian_consent),
        guardianName: row.guardian_name,
        isBanned: Boolean(row.is_banned),
        banReason: row.ban_reason,
        deletedAt: row.deleted_at || undefined,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
        isNew: row.created_at ? new Date(row.created_at).getTime() >= cutoffMs : false,
        shopName: row.shop_name,
        campus: row.campus || row.u_campus,
        locationArea: row.location_area || row.u_area,
        bio: row.bio || row.s_bio,
        interests: Array.isArray(row.interests) ? row.interests : [],
        verificationStatus: row.verification_status || (row.role === 'seller' ? 'not_started' : 'not_applicable'),
        isVerifiedSeller: Boolean(row.is_verified_seller),
      }));

    return res.json({
      status: true,
      users,
      total,
      newTodayCount: parseInt(newCountsRes.rows[0]?.new_today || '0', 10),
      newLast24HoursCount: parseInt(newCountsRes.rows[0]?.new_24h || '0', 10),
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    console.error('[Admin Users Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error reading users.' });
  }
});

// Auto-refreshing "New Users" feed backed by transactional shopit_admin_alerts + shopit_users
router.get('/admin/new-users', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const rawPage = req.query.page !== undefined ? String(req.query.page).trim() : '1';
    const rawLimit = req.query.limit !== undefined ? String(req.query.limit).trim() : '20';
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';

    const whereExtra = unreadOnly ? 'AND COALESCE(a.is_read, false) = false' : '';

    const [countRes, unreadRes, rowsRes] = await Promise.all([
      dbQuery(
        `SELECT COUNT(*) AS total
         FROM shopit_users u
         LEFT JOIN shopit_admin_alerts a ON a.user_id = u.id AND (a.alert_type = 'new_user' OR a.alert_key LIKE 'new_user_%')
         WHERE u.deleted_at IS NULL ${whereExtra}`
      ),
      dbQuery(
        `SELECT COUNT(*) AS unread
         FROM shopit_admin_alerts
         WHERE (alert_type = 'new_user' OR alert_key LIKE 'new_user_%') AND COALESCE(is_read, false) = false`
      ),
      dbQuery(
        `SELECT u.id AS user_id, u.email, u.name, u.display_name, u.profile_slug, u.role,
                u.age, u.has_guardian_consent, u.guardian_name, u.is_verified_email, u.created_at AS user_created_at,
                s.shop_name, s.campus, s.location_area, s.verification_status, s.is_verified_seller,
                a.id AS alert_id, a.alert_key, a.title, a.message, COALESCE(a.is_read, false) AS is_read, a.created_at AS alert_created_at
         FROM shopit_users u
         LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
         LEFT JOIN shopit_admin_alerts a ON a.user_id = u.id AND (a.alert_type = 'new_user' OR a.alert_key LIKE 'new_user_%')
         WHERE u.deleted_at IS NULL ${whereExtra}
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const seen = new Set<string>();
    const items = rowsRes.rows
      .filter((row: any) => {
        if (seen.has(row.user_id)) return false;
        seen.add(row.user_id);
        return true;
      })
      .map((row: any) => ({
        alertId: row.alert_id || row.alert_key || `new_user_${row.user_id}`,
        alertKey: row.alert_key || `new_user_${row.user_id}`,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        displayName: row.display_name || extractFirstName(row.name || 'Member'),
        profileSlug: row.profile_slug || row.user_id,
        role: row.role,
        age: row.age,
        hasGuardianConsent: Boolean(row.has_guardian_consent),
        guardianName: row.guardian_name,
        isVerifiedEmail: Boolean(row.is_verified_email),
        shopName: row.shop_name || undefined,
        campus: row.campus || undefined,
        locationArea: row.location_area || undefined,
        verificationStatus: row.verification_status || (row.role === 'seller' ? 'not_started' : 'not_applicable'),
        isVerifiedSeller: Boolean(row.is_verified_seller),
        title: row.title || `New ${row.role === 'seller' ? 'Seller' : row.role === 'admin' ? 'Admin' : 'Buyer'} Registered: ${row.name}`,
        message: row.message || `${row.name} (${row.email}) registered as ${row.role}.`,
        isRead: Boolean(row.is_read),
        createdAt: row.user_created_at || row.alert_created_at,
      }));

    const total = parseInt(String(countRes.rows[0]?.total || '0'), 10);
    const unreadCount = parseInt(String(unreadRes.rows[0]?.unread || '0'), 10);

    return res.json({
      status: true,
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    console.error('[Admin New Users Feed Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error loading new users feed.' });
  }
});

router.patch('/admin/alerts/:id/read', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await dbQuery(
        `UPDATE shopit_admin_alerts SET is_read = true WHERE (alert_type = 'new_user' OR alert_key LIKE 'new_user_%') AND COALESCE(is_read, false) = false`
      );
      return res.json({ status: true, message: 'All new user alerts marked as read.' });
    }

    await dbQuery(
      `UPDATE shopit_admin_alerts SET is_read = true WHERE id = $1 OR alert_key = $1 OR user_id = $1`,
      [id]
    );
    return res.json({ status: true, message: 'Alert marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to update alert read state.' });
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
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [userStats, sellerStats, verifStats, activityStats, orderStats, productStats, latestUsersRes] = await Promise.all([
      dbQuery(
        `SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_today,
          COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_24h,
          COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
          COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
          COUNT(CASE WHEN is_banned = true THEN 1 END) as suspended_users
        FROM shopit_users`,
        [todayStart.toISOString(), cutoff24h]
      ),
      dbQuery(`SELECT COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_sellers FROM shopit_sellers`),
      dbQuery(`SELECT COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_verifications FROM shopit_verifications`),
      dbQuery(
        `SELECT
          COUNT(*) as total_events,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END) as events_24h
         FROM shopit_audit_logs`,
        [cutoff24h]
      ),
      dbQuery(`SELECT COUNT(*) as total_orders FROM shopit_orders`),
      dbQuery(`SELECT COUNT(*) as total_products FROM shopit_products`),
      dbQuery(
        `SELECT u.id, u.email, u.name, u.role, u.age, u.has_guardian_consent, u.guardian_name, u.is_verified_email, u.is_banned, u.created_at, u.last_login_at,
                s.shop_name, s.campus, s.location_area, s.verification_status, s.is_verified_seller
         FROM shopit_users u
         LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
         ORDER BY u.created_at DESC
         LIMIT 10`
      ),
    ]);

    const pgPing = await pingPostgres();
    const redisPing = await pingRedis();
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;

    return res.json({
      status: true,
      metrics: {
        totalUsers: parseInt(userStats.rows[0].total_users || '0', 10),
        newToday: parseInt(userStats.rows[0].new_today || '0', 10),
        newLast24Hours: parseInt(userStats.rows[0].new_24h || '0', 10),
        totalSellers: parseInt(userStats.rows[0].total_sellers || '0', 10),
        totalBuyers: parseInt(userStats.rows[0].total_buyers || '0', 10),
        suspendedUsers: parseInt(userStats.rows[0].suspended_users || '0', 10),
        verifiedSellers: parseInt(sellerStats.rows[0].verified_sellers || '0', 10),
        pendingVerifications: parseInt(verifStats.rows[0].pending_verifications || '0', 10),
        totalActivityEvents: parseInt(activityStats.rows[0].total_events || '0', 10),
        activityLast24Hours: parseInt(activityStats.rows[0].events_24h || '0', 10),
        totalOrders: parseInt(orderStats.rows[0].total_orders || '0', 10),
        totalProducts: parseInt(productStats.rows[0].total_products || '0', 10),
      },
      latestUsers: latestUsersRes.rows.map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        age: row.age,
        hasGuardianConsent: Boolean(row.has_guardian_consent),
        guardianName: row.guardian_name,
        isVerifiedEmail: Boolean(row.is_verified_email),
        isBanned: Boolean(row.is_banned),
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        isNew: row.created_at ? new Date(row.created_at).getTime() >= cutoffMs : false,
        shopName: row.shop_name,
        campus: row.campus,
        locationArea: row.location_area,
        verificationStatus: row.verification_status || (row.role === 'seller' ? 'not_started' : 'not_applicable'),
        isVerifiedSeller: Boolean(row.is_verified_seller),
      })),
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

// Live Website Activity & Full Audit Log Feed (Moderator+)
router.get('/admin/activity', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const category = req.query.category ? String(req.query.category).trim().toLowerCase() : 'all';
    const actorEmail = req.query.actorEmail ? String(req.query.actorEmail).trim().toLowerCase() : '';
    const actionFilter = req.query.action ? String(req.query.action).trim().toUpperCase() : '';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(
        `(LOWER(action) LIKE $${paramIndex} OR LOWER(COALESCE(actor_email, '')) LIKE $${paramIndex} OR LOWER(COALESCE(target_type, '')) LIKE $${paramIndex} OR LOWER(COALESCE(target_id, '')) LIKE $${paramIndex} OR LOWER(CAST(details AS TEXT)) LIKE $${paramIndex})`
      );
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (actorEmail) {
      conditions.push(`LOWER(COALESCE(actor_email, '')) = $${paramIndex}`);
      params.push(actorEmail);
      paramIndex++;
    }

    if (actionFilter) {
      conditions.push(`action = $${paramIndex}`);
      params.push(actionFilter);
      paramIndex++;
    }

    if (category === 'users') {
      conditions.push(
        `action IN ('USER_REGISTERED','BUYER_UPGRADED_TO_SELLER','USER_LOGIN','USER_LOGIN_FAILED','USER_LOGOUT','OTP_REQUESTED','OTP_VERIFIED','OTP_VERIFY_FAILED','PASSWORD_CHANGED','PASSWORD_RESET_COMPLETED','PASSWORD_RESET_FAILED','ADMIN_USER_DELETED','ADMIN_USER_BANNED','ADMIN_USER_UNBANNED','ADMIN_PASSWORD_RESET')`
      );
    } else if (category === 'orders_payments') {
      conditions.push(
        `action IN ('CHECKOUT_INITIALIZED','ORDER_PAYMENT_VERIFIED','ORDER_PAID_WEBHOOK','ORDER_STATUS_CHANGED','PAYMENT_REFUND_EXECUTED','SELLER_WITHDRAWAL_DISPATCHED','PAYOUT_ACCOUNT_LINKED','MINOR_GUARDIAN_PAYOUT_ACCOUNT_LINKED','MINOR_PAYOUT_ACCOUNT_APPROVED','ORDER_ADMIN_HOLD_UPDATED','PAYOUT_WEBHOOK_PROCESSED','COUPON_VALIDATED','CRON_DAILY_PROCESSED','ADMIN_ESCROW_SCAN_TRIGGERED')`
      );
    } else if (category === 'marketplace') {
      conditions.push(
        `action IN ('PRODUCT_CREATED','PRODUCT_UPDATED','PRODUCT_DELETED','SELLER_PROFILE_UPDATED','CHAT_CONVERSATION_STARTED','CHAT_MESSAGE_SENT','COMMISSION_REQUESTED','COMMISSION_SUBMITTED','REVIEW_SUBMITTED','CART_UPDATED','WISHLIST_UPDATED')`
      );
    } else if (category === 'security') {
      conditions.push(
        `(action LIKE 'ADMIN_%' OR action LIKE 'NIN_%' OR action LIKE 'VERIFICATION_%' OR action LIKE '%BYPASS%' OR action IN ('REPORT_SUBMITTED','REPORT_STATUS_UPDATED','DISPUTE_OPENED','DISPUTE_RESOLVED','FLAG_ACTION_APPLIED','BROADCAST_UPDATED','BROADCAST_ACTIVATED','BROADCAST_DEACTIVATED','KILLSWITCH_TOGGLED','FEE_SETTINGS_UPDATED','WEBHOOK_SIGNATURE_REJECTED','DUPLICATE_NIN_FLAGGED','KYC_DOCUMENT_ACCESSED','NDPA_DATA_PURGED','ORDER_STATUS_IDOR_BLOCKED','WALLET_FREEZE_UPDATED','SUPPORT_CONTACT_SUBMITTED','USER_LOGIN_FAILED'))`
      );
    } else if (category === 'browsing') {
      conditions.push(
        `action IN ('PAGE_VIEWED','PRODUCT_VIEWED','SELLER_SHOP_VIEWED','MARKETPLACE_SEARCHED','CATEGORY_FILTERED','CART_ITEM_ADDED','CART_ITEM_REMOVED','CART_CLEARED','WISHLIST_TOGGLED','CHECKOUT_OPENED','AUTH_MODAL_OPENED','STYLE_POST_SUBMITTED','REFERRAL_CODE_APPLIED')`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [countRes, rowsRes, summaryRes] = await Promise.all([
      dbQuery(`SELECT COUNT(*) as total FROM shopit_audit_logs ${whereClause}`, params),
      dbQuery(
        `SELECT id, action, actor_id, actor_email, actor_role, target_type, target_id, details, ip_address, user_agent, created_at
         FROM shopit_audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      dbQuery(
        `SELECT
           COUNT(*) as total_events,
           COUNT(CASE WHEN created_at >= $1 THEN 1 END) as events_24h,
           COUNT(CASE WHEN action = 'USER_REGISTERED' AND created_at >= $1 THEN 1 END) as new_users_24h,
           COUNT(CASE WHEN action IN ('WEBHOOK_SIGNATURE_REJECTED','CHAT_BYPASS_BLOCKED','DUPLICATE_NIN_FLAGGED','ORDER_STATUS_IDOR_BLOCKED','REPORT_SUBMITTED','DISPUTE_OPENED','USER_LOGIN_FAILED') AND created_at >= $1 THEN 1 END) as security_alerts_24h
         FROM shopit_audit_logs`,
        [cutoff24h]
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const events = rowsRes.rows.map((row: any) => {
      let parsedDetails: Record<string, any> = {};
      if (row.details) {
        if (typeof row.details === 'string') {
          try {
            parsedDetails = JSON.parse(row.details);
          } catch {
            parsedDetails = { message: row.details };
          }
        } else if (typeof row.details === 'object') {
          parsedDetails = row.details;
        }
      }
      return {
        id: row.id,
        action: row.action,
        actorId: row.actor_id,
        actorEmail: row.actor_email || 'guest@visitor',
        actorRole: row.actor_role || 'visitor',
        targetType: row.target_type,
        targetId: row.target_id,
        details: parsedDetails,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at,
      };
    });

    return res.json({
      status: true,
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalEvents: parseInt(summaryRes.rows[0]?.total_events || '0', 10),
        eventsLast24h: parseInt(summaryRes.rows[0]?.events_24h || '0', 10),
        newUsersLast24h: parseInt(summaryRes.rows[0]?.new_users_24h || '0', 10),
        securityAlertsCount: parseInt(summaryRes.rows[0]?.security_alerts_24h || '0', 10),
      },
    });
  } catch (err: any) {
    console.error('[Admin Activity Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error reading website activity.' });
  }
});

// Moderator Audit Recorder for Admin Panel UI actions (broadcast, killswitch, dispute resolution, fee changes, etc.)
router.post('/admin/audit', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const rawAction = String(req.body?.action || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 64);
    if (!rawAction) {
      return res.status(400).json({ status: false, message: 'Valid action code is required.' });
    }
    const targetType = String(req.body?.targetType || 'admin_panel').slice(0, 60);
    const targetId = req.body?.targetId ? String(req.body.targetId).slice(0, 120) : undefined;
    const summaryText = req.body?.summary ? String(req.body.summary).slice(0, 500) : undefined;
    const rawMeta = req.body?.details && typeof req.body.details === 'object' ? req.body.details : {};
    const safeDetails: Record<string, any> = summaryText ? { summary: summaryText } : {};
    for (const [k, v] of Object.entries(rawMeta).slice(0, 12)) {
      if (!/password|secret|token|otp|nin/i.test(k)) {
        safeDetails[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 200) : v;
      }
    }

    await logAuditEvent({
      action: rawAction,
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: targetType, id: targetId },
      details: safeDetails,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ status: true, message: 'Admin audit event recorded.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to record admin audit event.' });
  }
});

// Persistent Platform Controls: Site-Wide Broadcast, Emergency Killswitches, Fee Policy (PostgreSQL-backed)
router.put('/admin/broadcast', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const current = await getPlatformSetting('broadcast', DEFAULT_BROADCAST_SETTING);
    const body = req.body || {};
    const validTones = new Set(['info', 'warning', 'emergency', 'promo']);
    const nextTone = body.tone && validTones.has(String(body.tone)) ? String(body.tone) : current.tone;
    const nextTitle = body.title !== undefined ? String(body.title).trim().slice(0, 140) : current.title;
    const nextMessage = body.message !== undefined ? String(body.message).trim().slice(0, 500) : current.message;
    const nextActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(current.isActive);

    const updated = {
      id: `broad_${Date.now()}`,
      isActive: nextActive,
      title: nextTitle || 'Platform Notice',
      message: nextMessage || '',
      tone: nextTone as 'info' | 'warning' | 'emergency' | 'promo',
      createdAt: new Date().toISOString(),
      author: user.name || user.email || 'Shop It Safety Desk',
    };

    await setPlatformSetting('broadcast', updated, user.email);

    await logAuditEvent({
      action: body.isActive !== undefined ? (nextActive ? 'BROADCAST_ACTIVATED' : 'BROADCAST_DEACTIVATED') : 'BROADCAST_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'platform_setting', id: 'broadcast' },
      details: { isActive: updated.isActive, tone: updated.tone, title: updated.title },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, broadcastAnnouncement: updated, message: 'Broadcast saved in PostgreSQL.' });
  } catch (err: any) {
    console.error('[Broadcast Update Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to save broadcast announcement in database.' });
  }
});

router.put('/admin/emergency-controls', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const current = await getPlatformSetting('emergency_controls', DEFAULT_EMERGENCY_CONTROLS);
    const body = req.body || {};
    const updated = {
      maintenanceMode: body.maintenanceMode !== undefined ? Boolean(body.maintenanceMode) : Boolean(current.maintenanceMode),
      pauseNewOrders: body.pauseNewOrders !== undefined ? Boolean(body.pauseNewOrders) : Boolean(current.pauseNewOrders),
      pauseSellerSignups: body.pauseSellerSignups !== undefined ? Boolean(body.pauseSellerSignups) : Boolean(current.pauseSellerSignups),
    };

    await setPlatformSetting('emergency_controls', updated, user.email);

    await logAuditEvent({
      action: 'KILLSWITCH_TOGGLED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'platform_setting', id: 'emergency_controls' },
      details: updated,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, emergencyControls: updated, message: 'Emergency killswitches saved in PostgreSQL.' });
  } catch (err: any) {
    console.error('[Emergency Controls Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to update emergency killswitches in database.' });
  }
});

router.put('/admin/fee-settings', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const current = await getPlatformSetting('fee_settings', DEFAULT_FEE_SETTINGS_DB);
    const body = req.body || {};
    const parsedLow = body.tierLowFee !== undefined ? Math.max(0, Math.min(50000, Number(body.tierLowFee) || 0)) : current.tierLowFee;
    const parsedMid = body.tierMidFee !== undefined ? Math.max(0, Math.min(100000, Number(body.tierMidFee) || 0)) : current.tierMidFee;
    const parsedHigh = body.tierHighPercentage !== undefined ? Math.max(0, Math.min(0.25, Number(body.tierHighPercentage) || 0)) : current.tierHighPercentage;
    const parsedMinWd = body.minWithdrawal !== undefined ? Math.max(100, Math.min(100000, Number(body.minWithdrawal) || 1000)) : current.minWithdrawal;

    const updated = {
      firstMonthPromoFree: body.firstMonthPromoFree !== undefined ? Boolean(body.firstMonthPromoFree) : Boolean(current.firstMonthPromoFree),
      tierLowFee: parsedLow,
      tierMidFee: parsedMid,
      tierHighPercentage: parsedHigh,
      minWithdrawal: parsedMinWd,
    };

    await setPlatformSetting('fee_settings', updated, user.email);

    await logAuditEvent({
      action: 'FEE_SETTINGS_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'platform_setting', id: 'fee_settings' },
      details: updated,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, feeSettings: updated, message: 'Fee settings saved in PostgreSQL.' });
  } catch (err: any) {
    console.error('[Fee Settings Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to update fee settings in database.' });
  }
});

// Allow-listed Website Activity Tracker (Captures visitor & logged-in user browsing, search, cart/wishlist, reviews)
const ALLOWED_WEBSITE_ACTIVITY_ACTIONS = new Set([
  'PAGE_VIEWED',
  'PRODUCT_VIEWED',
  'SELLER_SHOP_VIEWED',
  'MARKETPLACE_SEARCHED',
  'CATEGORY_FILTERED',
  'CART_ITEM_ADDED',
  'CART_ITEM_REMOVED',
  'CART_CLEARED',
  'WISHLIST_TOGGLED',
  'REVIEW_SUBMITTED',
  'CHECKOUT_OPENED',
  'AUTH_MODAL_OPENED',
  'COMMISSION_SUBMITTED',
  'STYLE_POST_SUBMITTED',
  'REFERRAL_CODE_APPLIED',
]);

router.post('/activity/track', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clientIp = req.ip || 'unknown';
    const rl = await checkAndRecordRateLimit(`activity_track:${clientIp}`, 120, 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ status: false, message: 'Too many activity events.' });
    }

    const action = String(req.body?.action || '').trim().toUpperCase();
    if (!ALLOWED_WEBSITE_ACTIVITY_ACTIONS.has(action)) {
      return res.status(400).json({ status: false, message: 'Unsupported activity event type.' });
    }

    const targetType = req.body?.targetType ? String(req.body.targetType).trim().slice(0, 60) : 'website';
    const targetId = req.body?.targetId ? String(req.body.targetId).trim().slice(0, 120) : undefined;
    const rawDetails = req.body?.details && typeof req.body.details === 'object' ? req.body.details : {};
    const safeDetails: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawDetails).slice(0, 10)) {
      if (/password|secret|token|otp|nin|cvv|pin/i.test(k)) continue;
      if (typeof v === 'string') {
        safeDetails[k.slice(0, 40)] = v.slice(0, 200);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        safeDetails[k.slice(0, 40)] = v;
      }
    }

    const visitorId = req.body?.visitorId ? String(req.body.visitorId).slice(0, 64) : undefined;
    const actor = req.user
      ? { id: req.user.userId, email: req.user.email, role: req.user.role }
      : { id: visitorId || 'guest', email: 'guest@visitor', role: 'visitor' };

    await logAuditEvent({
      action,
      actor,
      target: { type: targetType, id: targetId },
      details: safeDetails,
      ip: clientIp,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ status: true });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to log activity.' });
  }
});

router.get('/admin/export-data', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [
      usersRes,
      sellersRes,
      productsRes,
      ordRes,
      payRes,
      walletsRes,
      ledgerRes,
      disputesRes,
      repRes,
      verifRes,
      alertsRes,
    ] = await Promise.all([
      dbQuery(
        `SELECT id, email, name, display_name, profile_slug, bio, campus, location_area,
                role, sub_role, is_verified_email, age, has_guardian_consent, guardian_name,
                is_banned, ban_reason, deleted_at, last_login_at, created_at, updated_at
         FROM shopit_users ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, user_id, shop_name, owner_name, email, bio, campus,
                location_state, location_city, location_area,
                is_verified_seller, verification_status, verified_nin_last4, verified_at,
                under_18, guardian_consent, guardian_name, rating, sales_count, views_count,
                vacation_mode, created_at, updated_at
         FROM shopit_sellers ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, seller_id, seller_shop_name, seller_campus, title, description, category,
                seller_price_kobo, service_fee_kobo, display_price_kobo, stock, images,
                delivery_pickup_fee_kobo, delivery_local_fee_kobo, delivery_buyer_arranges,
                location_state, location_city, location_area, is_sold_out, is_paused, is_draft,
                created_at, updated_at
         FROM shopit_products ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
                subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo,
                coupon_code, grand_total_kobo, payment_method, payment_reference,
                status, campus, delivery_area, pickup_point, admin_hold,
                paid_at, shipped_at, delivered_at, completed_at, created_at, updated_at
         FROM shopit_orders ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT reference, order_id, amount_kobo, currency, channel, status,
                webhook_received, customer_email, created_at, updated_at
         FROM shopit_payments ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo,
                is_frozen, freeze_reason, created_at, updated_at
         FROM shopit_wallets ORDER BY updated_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, wallet_id, order_id, type, amount_kobo, fee_kobo, balance_after_kobo,
                balance_type, status, description, reference, idempotency_key, created_at
         FROM shopit_ledger_entries ORDER BY created_at DESC LIMIT 5000`
      ),
      dbQuery(
        `SELECT id, order_id, buyer_id, seller_id, reason, description, status, amount_held_in_escrow_kobo,
                resolution_notes, created_at, updated_at
         FROM shopit_disputes ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, target_type, target_id, target_title, reason, details, status, action_logs, created_at
         FROM shopit_reports ORDER BY created_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT id, seller_id, user_id, shop_name, owner_name, id_type, id_number_masked,
                full_nin_last4, under_18, status, submitted_at, reviewed_at
         FROM shopit_verifications ORDER BY submitted_at DESC LIMIT 2000`
      ),
      dbQuery(
        `SELECT alert_key, id, alert_type, user_id, user_email, user_name, user_role,
                title, message, is_read, metadata, created_at
         FROM shopit_admin_alerts ORDER BY created_at DESC LIMIT 2000`
      ),
    ]);

    const exportPayload = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.email,
      platform: 'Shop It Nigeria (TEEDS)',
      summary: {
        totalUsers: usersRes.rows.length,
        totalSellers: sellersRes.rows.length,
        totalProducts: productsRes.rows.length,
        totalOrders: ordRes.rows.length,
        totalPayments: payRes.rows.length,
        totalWallets: walletsRes.rows.length,
        totalLedgerEntries: ledgerRes.rows.length,
        totalDisputes: disputesRes.rows.length,
        totalReports: repRes.rows.length,
        totalVerifications: verifRes.rows.length,
        totalAdminAlerts: alertsRes.rows.length,
      },
      users: usersRes.rows,
      sellers: sellersRes.rows,
      products: productsRes.rows,
      orders: ordRes.rows,
      payments: payRes.rows,
      wallets: walletsRes.rows,
      ledger: ledgerRes.rows,
      disputes: disputesRes.rows,
      reports: repRes.rows,
      verifications: verifRes.rows,
      adminAlerts: alertsRes.rows,
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
    webhookPath: '/api/webhooks/flutterwave',
    webhookUrl: `${APP_URL}/api/webhooks/flutterwave`,
    minWithdrawal: 1000,
    coolingPeriodHours: 24,
  });
});

router.get('/payments/webhook-info', (_req, res) => {
  res.json({
    gateway: 'flutterwave',
    webhookPath: '/api/webhooks/flutterwave',
    webhookUrl: `${APP_URL}/api/webhooks/flutterwave`,
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
    const emergency = await getPlatformSetting('emergency_controls', DEFAULT_EMERGENCY_CONTROLS);
    if ((emergency.pauseNewOrders || emergency.maintenanceMode) && user.role !== 'admin') {
      return res.status(503).json({
        status: false,
        error: 'ORDERS_PAUSED',
        message: 'Checkout and new orders are temporarily paused by platform moderation.',
      });
    }

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

    // Lazily expire stale 60-minute pending orders & restore reserved stock before inventory checks
    await runLazyPendingOrderExpiry();
    const feePolicy = await getPlatformSetting('fee_settings', DEFAULT_FEE_SETTINGS_DB);

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
                  seller_price_kobo, stock, is_sold_out, delivery_pickup_fee_kobo, delivery_local_fee_kobo
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

        const sellerPriceKobo = Math.max(0, Math.round(Number(p.seller_price_kobo || 0)));
        if (sellerPriceKobo <= 0) {
          throw Object.assign(new Error(`Invalid server price on "${p.title}".`), { statusCode: 400 });
        }

        const itemServiceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
        subtotalKobo += sellerPriceKobo * qty;
        serviceFeeKobo += itemServiceFeeKobo * qty;

        const rawDeliveryKobo =
          deliveryMethod === 'pickup'
            ? Number(p.delivery_pickup_fee_kobo || 20000)
            : Number(p.delivery_local_fee_kobo || 50000);
        const itemDeliveryKobo = Math.max(
          0,
          Math.round(rawDeliveryKobo > 0 ? rawDeliveryKobo : deliveryMethod === 'pickup' ? 20000 : 50000)
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
      const buyerDisplayRes = await client.query('SELECT display_name, name FROM shopit_users WHERE id = $1 LIMIT 1', [user.userId]);
      const buyerDisplayLabel =
        buyerDisplayRes.rows[0]?.display_name ||
        extractFirstName(buyerDisplayRes.rows[0]?.name || user.name || 'Buyer');

      await client.query(
        `INSERT INTO shopit_orders (
          id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
          subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, coupon_code,
          grand_total_kobo, payment_method, payment_reference,
          handshake_otp, handshake_verified, status, stock_reserved, expires_at,
          campus, delivery_area, pickup_point, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14,
          $15, false, 'pending_payment', true, NOW() + INTERVAL '60 minutes',
          $16, $17, $18, NOW(), NOW()
        )`,
        [
          orderId,
          user.userId,
          user.name,
          buyerEmail,
          buyerDisplayLabel,
          JSON.stringify(resolvedItems),
          subtotalKobo,
          serviceFeeKobo,
          deliveryTotalKobo,
          discountTotalKobo,
          appliedCouponCode,
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
          reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email, updated_at
        ) VALUES ($1, $2, $3, 'NGN', $4, 'pending_payment', false, $5, NOW())`,
        [reference, orderId, grandTotalKobo, paymentMethod || 'card', buyerEmail]
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

    await logAuditEvent({
      action: 'CHECKOUT_INITIALIZED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'order', id: initializedOrder.orderId },
      details: {
        reference: initializedOrder.reference,
        amountNaira: initializedOrder.pricing.grandTotalNaira,
        itemCount: initializedOrder.resolvedItems.length,
        campus: campus || 'Nigeria',
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

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

router.get('/webhooks/flutterwave', (_req, res) => {
  return res.status(200).json({ status: 'ok', message: 'POST only' });
});

router.all('/webhooks/flutterwave', requirePaymentsEnabled, async (req: any, res: any) => {
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
      const amountInKobo = parseInt(String(order.grand_total_kobo || '0'), 10);
      return res.json({
        status: true,
        isPaid: true,
        orderStatus: order.status,
        reference,
        orderId: order.id,
        amountInKobo,
        amountNaira: koboToNaira(amountInKobo),
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

    if (settlement.committed) {
      await logAuditEvent({
        action: 'ORDER_PAYMENT_VERIFIED',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'order', id: order.id },
        details: { reference, amountNaira: koboToNaira(confirmedAmountKobo), channel },
        ip: req.ip,
        userAgent: req.get('user-agent'),
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
                  id, wallet_id, order_id, type, balance_type, status,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES ($1, $2, $3, 'refund', 'pending', 'completed', $4, 0, $5, $6, $7, $8, NOW())
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id`,
                [
                  `LEDGER-REF-${order.id}-${sId.slice(-6)}`,
                  sId,
                  order.id,
                  sellerRefundKobo,
                  newPending,
                  `Refund deducted from pending escrow for Order #${order.id}`,
                  effectiveRef || order.id,
                  idempotencyKey,
                ]
              );

              if (ledgerIns.rows.length > 0) {
                await client.query(
                  'UPDATE shopit_wallets SET pending_balance_kobo = $1, updated_at = NOW() WHERE seller_id = $2',
                  [newPending, sId]
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
      "SELECT reference, order_id, amount_kobo, channel, status, webhook_received, updated_at FROM shopit_payments WHERE webhook_received = true OR status = 'paid' ORDER BY updated_at DESC LIMIT 200"
    );
    const events = payRes.rows.map((r: any) => ({
      ...r,
      amount_naira: koboToNaira(parseInt(String(r.amount_kobo || '0'), 10)),
    }));
    return res.json({ status: true, events, processedCount: events.length });
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
    await runLazyPendingOrderExpiry();
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
           SET available_balance_kobo = $1,
               total_withdrawn_kobo = $2, updated_at = NOW()
           WHERE seller_id = $3 AND available_balance_kobo >= $4`,
          [
            newAvailableKobo,
            newWithdrawnKobo,
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
          id, wallet_id, type, balance_type, status,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
        ) VALUES ($1, $2, 'withdrawal', 'available', 'pending', $3, $4, $5, $6, $7, $8, NOW())`,
        [
          ledgerId,
          seller.id,
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
             SET available_balance_kobo = $1,
                 total_withdrawn_kobo = $2, updated_at = NOW()
             WHERE seller_id = $3`,
            [restoredAvail, restoredWtd, debitState.seller.id]
          );
          await client.query(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, type, balance_type, status,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
            ) VALUES ($1, $2, 'refund', 'available', 'completed', $3, 0, $4, $5, $6, $7, NOW())
            ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              `LEDGER-WTD-REV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              debitState.seller.id,
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
    await logAuditEvent({
      action: 'ADMIN_EMAIL_SENT',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'email', id: cleanEmail },
      details: { template, dispatched: sent, subject: rendered.subject },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
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

    await logAuditEvent({
      action: 'SUPPORT_CONTACT_SUBMITTED',
      actor: { id: cleanEmail, email: cleanEmail, role: 'visitor' },
      target: { type: 'support', id: cleanCat },
      details: { name: cleanName, category: cleanCat, preview: cleanMsg.slice(0, 150) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

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

    if (cleanPurpose !== 'signup') {
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
    }

    // Never reveal registered vs unregistered email on password_reset (uniform response)
    if (cleanPurpose === 'password_reset') {
      const userCheck = await dbQuery('SELECT id, is_verified_email FROM shopit_users WHERE LOWER(email) = LOWER($1)', [
        cleanEmail,
      ]);
      if (userCheck.rows.length === 0) {
        await recordOtpRateLimit(cleanEmail, deviceId);
        return res.json({
          status: true,
          message: 'If an account with this email exists, a 6-digit verification code has been sent.',
        });
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashOtp(code);
    await saveHashedOtp(cleanEmail, cleanPurpose, codeHash, metadata).catch(() => {});
    if (cleanPurpose !== 'signup') {
      await recordOtpRateLimit(cleanEmail, deviceId).catch(() => {});
    }

    const templateMap: Record<string, EmailTemplateKey> = {
      signup: 'signup_code',
      new_device_login: 'new_device_login',
      password_reset: 'password_reset',
      withdrawal: 'withdrawal_code',
      payout_account: 'new_payout_account_code',
      email_change: 'email_change',
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

    const emailSent = await sendBrevoDirect(
      cleanEmail,
      rendered.subject,
      rendered.text,
      rendered.html,
      metadata?.name
    ).catch(() => false);

    if (IS_PROD && !emailSent && cleanPurpose !== 'password_reset' && cleanPurpose !== 'signup') {
      await deleteOtpRecord(cleanEmail, cleanPurpose).catch(() => {});
      return res.status(503).json({
        status: false,
        error: 'EMAIL_SERVICE_UNAVAILABLE',
        message: 'Verification email service is temporarily unavailable. Please try again shortly.',
      });
    }

    await logAuditEvent({
      action: 'OTP_REQUESTED',
      actor: { id: cleanEmail, email: cleanEmail, role: 'user' },
      target: { type: 'otp', id: cleanPurpose },
      details: { purpose: cleanPurpose, emailDelivered: Boolean(emailSent) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      emailDelivered: Boolean(emailSent),
      message:
        cleanPurpose === 'password_reset'
          ? 'If an account with this email exists, a 6-digit verification code has been sent.'
          : emailSent
            ? 'A 6-digit verification code has been sent to your email.'
            : 'Email delivery is temporarily unavailable; you may finish creating your account directly.',
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
      await logAuditEvent({
        action: 'OTP_VERIFY_FAILED',
        actor: { id: cleanEmail, email: cleanEmail, role: 'user' },
        target: { type: 'otp', id: cleanPurpose },
        details: { purpose: cleanPurpose, reason: result.error || 'Invalid code' },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
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

    await logAuditEvent({
      action: 'OTP_VERIFIED',
      actor: { id: cleanEmail, email: cleanEmail, role: 'user' },
      target: { type: 'otp', id: cleanPurpose },
      details: { purpose: cleanPurpose },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

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

    await logAuditEvent({
      action: 'REPORT_SUBMITTED',
      actor: {
        id: req.user?.userId || 'visitor',
        email: newReport.reporterEmail || 'anonymous@visitor',
        role: req.user?.role || 'visitor',
      },
      target: { type: 'report', id: reportId },
      details: {
        targetType: newReport.targetType,
        targetId: newReport.targetId,
        targetTitle: newReport.targetTitle,
        reason: newReport.reason,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

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
      const { sellerId, ownerName, shopName, nin, idType, under18, guardianName, guardianConsent } = req.body;
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
          status, under_18, guardian_name, notes, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, NOW(), NOW(), NOW())`,
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
          'Submitted for moderator review',
        ]
      );

      await dbQuery(
        `UPDATE shopit_sellers
         SET verification_status = 'pending', verified_legal_name = COALESCE($1, verified_legal_name),
             verified_nin_last4 = COALESCE($2, verified_nin_last4), under_18 = $3,
             guardian_name = $4, guardian_consent = $5, updated_at = NOW()
         WHERE id = $6 OR user_id = $6`,
        [ownerName || null, ninLast4 || null, Boolean(under18), guardianName || null, Boolean(guardianConsent), targetId]
      );

      await logAuditEvent({
        action: 'NIN_SUBMITTED_FOR_ADMIN_REVIEW',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'seller', id: targetId },
        details: { requestId: reqId, shopName: shopName || null, maskedNin: `***-***-${ninLast4}` },
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

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

      const idDocUrl = `/api/verification/document/${encodeURIComponent(idDocId)}`;
      const selfieDocUrl = `/api/verification/document/${encodeURIComponent(selfieDocId)}`;

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
            status, notes, reviewed_by, reviewed_at, submitted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW(), NOW())`,
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
            finalStatus === 'pending' ? idDocUrl : '[Deleted after automated verification]',
            finalStatus === 'pending' ? selfieDocUrl : '[Deleted after automated verification]',
            Boolean(under18),
            guardianFullName ? String(guardianFullName).trim() : null,
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

router.get('/verification/document/:docId', requireModerator, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const { docId } = req.params;

    const docRes = await dbQuery('SELECT seller_id, doc_type, encrypted_data FROM shopit_verification_documents WHERE id = $1', [docId]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Requested identity document was not found or was purged.' });
    }

    const doc = docRes.rows[0];
    const plainData = decryptSensitiveData(doc.encrypted_data);

    await logAuditEvent({
      action: 'KYC_DOCUMENT_ACCESSED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'verification_document', id: docId },
      details: { sellerId: doc.seller_id, docType: doc.doc_type },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    if (plainData.startsWith('data:image/')) {
      const matches = plainData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches) {
        res.setHeader('Content-Type', matches[1]);
        res.setHeader('Cache-Control', 'no-store');
        return res.send(Buffer.from(matches[2], 'base64'));
      }
    }

    res.setHeader('Cache-Control', 'no-store');
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
// DAILY CRON ENDPOINT (Public-safe, Idempotent, Rate-Limited, Batch-Limited)
// ============================================================================

router.all(['/cron/daily', '/cron/escrow'], requireCronSecret, async (req, res) => {
  const rl = await checkAndRecordRateLimit(`cron_daily:${req.ip || 'unknown'}`, 30, 60 * 1000);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds || 60));
    return res.status(429).json({ status: false, error: 'RATE_LIMITED', message: 'Too many cron triggers.' });
  }

  const expired = await expireStalePendingOrders(50);
  const escrow = await processEscrowAutoRelease(50);
  const unshipped = await processUnshippedOrders(50);
  const reconciliation = await runDailyReconciliationCheck();

  const workCount =
    expired.expiredCount +
    escrow.releasedCount +
    unshipped.remindedCount +
    unshipped.refundedCount +
    expired.purgedDocsCount;
  if (workCount > 0 || !reconciliation.ok) {
    await logAuditEvent({
      action: 'CRON_DAILY_PROCESSED',
      actor: { id: 'cron', email: 'system@shopit.ng', role: 'system' },
      target: { type: 'cron', id: 'daily' },
      details: {
        expiredOrdersCount: expired.expiredCount,
        escrowReleasedCount: escrow.releasedCount,
        unshippedRemindedCount: unshipped.remindedCount,
        unshippedRefundedCount: unshipped.refundedCount,
        purgedDocsCount: expired.purgedDocsCount,
        reconciliationOk: reconciliation.ok,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  return res.json({
    status: true,
    ok: true,
    processed: {
      expiredOrdersCount: expired.expiredCount,
      escrowReleasedCount: escrow.releasedCount,
      unshippedRemindedCount: unshipped.remindedCount,
      unshippedRefundedCount: unshipped.refundedCount,
      purgedDocsCount: expired.purgedDocsCount,
      reconciliationOk: reconciliation.ok,
    },
    timestamp: new Date().toISOString(),
  });
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
    await logAuditEvent({
      action: 'COUPON_VALIDATED',
      actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'coupon', id: coupon.code },
      details: { code: coupon.code, discountAmount, subtotalNaira },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

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

// JSON 404 handler for unknown /api paths (never Express HTML "Cannot GET ...")
app.use('/api', (_req, res) => {
  return res.status(404).json({ status: false, message: 'Not found' });
});

export default function handler(req: any, res: any) {
  return app(req, res, () => {
    if (!res.headersSent) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: false, message: 'Not found' }));
    }
  });
}

export { app };

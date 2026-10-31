/**
 * Email OTP Manager for Shop It
 * Compliant with strict security rules:
 * - 100% Email-only verification and OTP dispatch (zero SMS/phone dependence).
 * - Code expires in exactly 10 minutes (600,000 ms).
 * - Allows max 3 wrong attempts before code invalidation.
 * - Resend cooldown of exactly 60 seconds.
 * - Dual rate limiting: by email (max 5 OTPs per 15 mins) and by device (max 10 OTPs per 15 mins).
 * - Device tracking for new-device login challenges.
 */

export type OtpPurpose =
  | 'signup'
  | 'new_device_login'
  | 'password_reset'
  | 'withdrawal'
  | 'payout_account';

export interface EmailOtpSession {
  code: string;
  email: string;
  purpose: OtpPurpose;
  createdAt: number;
  expiresAt: number;
  attemptsRemaining: number;
  resendAvailableAt: number;
  metadata?: Record<string, any>;
}

interface RateLimitTracker {
  timestamps: number[];
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_EMAIL_REQUESTS = 5;
const MAX_DEVICE_REQUESTS = 10;

const STORAGE_KEY_SESSIONS = 'shopit_email_otp_sessions';
const STORAGE_KEY_RATE_LIMITS = 'shopit_email_otp_rate_limits';
const STORAGE_KEY_DEVICE_ID = 'shopit_device_id';

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage.getItem(key);
    }
  } catch {
    // fallback to memory
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // fallback to memory
  }
  memoryStore.set(key, value);
}

/**
 * Returns or generates a persistent device identifier.
 */
export function getDeviceId(): string {
  try {
    let devId = safeGetItem(STORAGE_KEY_DEVICE_ID);
    if (!devId) {
      devId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      safeSetItem(STORAGE_KEY_DEVICE_ID, devId);
    }
    return devId;
  } catch {
    return 'dev_fallback_browser';
  }
}

/**
 * Checks if a device has previously authenticated for the given email.
 */
export function isKnownDevice(email: string, deviceId: string): boolean {
  if (!email || !deviceId) return false;
  try {
    const raw = safeGetItem(`shopit_known_devices_${email.trim().toLowerCase()}`);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(deviceId);
  } catch {
    return false;
  }
}

/**
 * Records a device as trusted/known for the given email.
 */
export function recordKnownDevice(email: string, deviceId: string): void {
  if (!email || !deviceId) return;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const key = `shopit_known_devices_${cleanEmail}`;
    const raw = safeGetItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(deviceId)) {
      list.push(deviceId);
      safeSetItem(key, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Could not save known device:', err);
  }
}

function loadSessions(): Record<string, EmailOtpSession> {
  try {
    const raw = safeGetItem(STORAGE_KEY_SESSIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSessions(sessions: Record<string, EmailOtpSession>): void {
  try {
    safeSetItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    console.warn('Could not save OTP sessions:', err);
  }
}

function getRateLimits(): Record<string, RateLimitTracker> {
  try {
    const raw = safeGetItem(STORAGE_KEY_RATE_LIMITS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordRateLimitAttempt(email: string, deviceId: string): void {
  try {
    const now = Date.now();
    const data = getRateLimits();

    const emailKey = `email_${email.trim().toLowerCase()}`;
    const devKey = `dev_${deviceId}`;

    const cleanList = (arr?: number[]) =>
      (arr || []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

    data[emailKey] = { timestamps: [...cleanList(data[emailKey]?.timestamps), now] };
    data[devKey] = { timestamps: [...cleanList(data[devKey]?.timestamps), now] };

    safeSetItem(STORAGE_KEY_RATE_LIMITS, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not record rate limit:', err);
  }
}

/**
 * Validates whether the email or device has exceeded the rate limit.
 */
export function checkRateLimit(
  email: string,
  deviceId: string
): { allowed: boolean; reason?: string } {
  try {
    const now = Date.now();
    const data = getRateLimits();

    const emailKey = `email_${email.trim().toLowerCase()}`;
    const devKey = `dev_${deviceId}`;

    const emailAttempts = (data[emailKey]?.timestamps || []).filter(
      ts => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (emailAttempts.length >= MAX_EMAIL_REQUESTS) {
      const oldest = Math.min(...emailAttempts);
      const remainingMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 60000);
      return {
        allowed: false,
        reason: `Too many OTP requests for this email. Please wait ${remainingMinutes} minute(s) before trying again.`,
      };
    }

    const devAttempts = (data[devKey]?.timestamps || []).filter(
      ts => now - ts < RATE_LIMIT_WINDOW_MS
    );
    if (devAttempts.length >= MAX_DEVICE_REQUESTS) {
      const oldest = Math.min(...devAttempts);
      const remainingMinutes = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 60000);
      return {
        allowed: false,
        reason: `Too many OTP requests from this device. Please wait ${remainingMinutes} minute(s) before trying again.`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Generates an Email OTP with 10-minute expiry, 3 attempts allowed, and 60s resend timer.
 */
export function generateEmailOtp(
  email: string,
  purpose: OtpPurpose,
  metadata?: Record<string, any>
): {
  success: boolean;
  code?: string;
  error?: string;
  waitSeconds?: number;
} {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const deviceId = getDeviceId();
  const sessionKey = `${cleanEmail}_${purpose}`;
  const sessions = loadSessions();
  const existing = sessions[sessionKey];
  const now = Date.now();

  // Check 60-second resend cooldown
  if (existing && now < existing.resendAvailableAt) {
    const waitSeconds = Math.ceil((existing.resendAvailableAt - now) / 1000);
    return {
      success: false,
      error: `Please wait ${waitSeconds}s before requesting a new code.`,
      waitSeconds,
    };
  }

  // Check Email & Device rate limits (15 min window)
  const rateCheck = checkRateLimit(cleanEmail, deviceId);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  // Generate 4-digit numeric code
  const code = Math.floor(1000 + Math.random() * 9000).toString();

  const newSession: EmailOtpSession = {
    code,
    email: cleanEmail,
    purpose,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS, // 10 minutes
    attemptsRemaining: MAX_ATTEMPTS, // 3 wrong tries
    resendAvailableAt: now + RESEND_COOLDOWN_MS, // 60 seconds
    metadata,
  };

  sessions[sessionKey] = newSession;
  saveSessions(sessions);
  recordRateLimitAttempt(cleanEmail, deviceId);

  return {
    success: true,
    code,
  };
}

/**
 * Verifies an entered Email OTP code.
 * Strictly enforces 10-minute expiry and invalidates after 3 failed attempts.
 */
export function verifyEmailOtp(
  email: string,
  purpose: OtpPurpose,
  inputCode: string
): {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
} {
  const cleanEmail = email.trim().toLowerCase();
  const sessionKey = `${cleanEmail}_${purpose}`;
  const sessions = loadSessions();
  const session = sessions[sessionKey];
  const now = Date.now();

  if (!session) {
    return {
      success: false,
      error: 'No active verification code found. Please request a new code.',
    };
  }

  // 10-minute expiry check
  if (now > session.expiresAt) {
    delete sessions[sessionKey];
    saveSessions(sessions);
    return {
      success: false,
      error: 'Verification code has expired (10 minutes limit). Please request a new code.',
      attemptsRemaining: 0,
    };
  }

  // Attempt limit check
  if (session.attemptsRemaining <= 0) {
    delete sessions[sessionKey];
    saveSessions(sessions);
    return {
      success: false,
      error: 'Maximum attempts exceeded (3 wrong tries). This code has been invalidated. Please request a new code.',
      attemptsRemaining: 0,
    };
  }

  // Code comparison
  const trimmedInput = (inputCode || '').trim();
  if (trimmedInput !== session.code) {
    session.attemptsRemaining -= 1;

    if (session.attemptsRemaining <= 0) {
      delete sessions[sessionKey];
      saveSessions(sessions);
      return {
        success: false,
        error: 'Incorrect code. 0 attempts remaining. This code is now invalid. Please request a new code.',
        attemptsRemaining: 0,
      };
    } else {
      sessions[sessionKey] = session;
      saveSessions(sessions);
      return {
        success: false,
        error: `Incorrect code. ${session.attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining: session.attemptsRemaining,
      };
    }
  }

  // Correct code - invalidate to prevent reuse
  delete sessions[sessionKey];
  saveSessions(sessions);

  // If this was a new device login, mark device as known
  if (purpose === 'new_device_login') {
    recordKnownDevice(cleanEmail, getDeviceId());
  }

  return { success: true };
}

/**
 * Returns remaining seconds before resend is allowed (0 if ready).
 */
export function getResendCooldownSeconds(email: string, purpose: OtpPurpose): number {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const sessionKey = `${cleanEmail}_${purpose}`;
    const sessions = loadSessions();
    const session = sessions[sessionKey];
    if (!session) return 0;
    const now = Date.now();
    if (now >= session.resendAvailableAt) return 0;
    return Math.ceil((session.resendAvailableAt - now) / 1000);
  } catch {
    return 0;
  }
}

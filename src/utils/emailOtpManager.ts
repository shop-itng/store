/**
 * Email OTP Manager for Shop It
 *
 * Fully server-authoritative with Brevo integration and persistent database storage:
 * - 100% Email-only verification and OTP dispatch (zero phone/SMS).
 * - 6-digit numeric codes generated on the server and stored hashed with SHA-256.
 * - Expires in exactly 10 minutes.
 * - Max 3 failed attempts before the code is cancelled.
 * - Resend is blocked for 60 seconds (enforced on server).
 * - Rate limiting: 5 requests per email and 10 per device per 15 minutes (enforced in database).
 * - Device tracking for new-device login security challenges.
 */

export type OtpPurpose =
  | 'signup'
  | 'new_device_login'
  | 'password_reset'
  | 'withdrawal'
  | 'payout_account';

const STORAGE_KEY_DEVICE_ID = 'shopit_device_id';

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {}
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

/**
 * Requests the server to generate a 6-digit code, store it hashed in the database,
 * enforce rate limits (5/email, 10/device per 15m) and resend block (60s),
 * and dispatch the email via the Brevo API.
 */
export async function generateEmailOtp(
  email: string,
  purpose: OtpPurpose,
  metadata?: Record<string, any>
): Promise<{
  success: boolean;
  error?: string;
  waitSeconds?: number;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const deviceId = getDeviceId();

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        purpose,
        deviceId,
        metadata,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      return {
        success: false,
        error: data.message || 'Failed to dispatch verification code.',
        waitSeconds: data.waitSeconds,
      };
    }

    return {
      success: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error communicating with email server.',
    };
  }
}

/**
 * Verifies an entered 6-digit OTP code against the server database hash.
 * Enforces 10-minute expiry and invalidates after 3 wrong tries.
 */
export async function verifyEmailOtp(
  email: string,
  purpose: OtpPurpose,
  inputCode: string
): Promise<{
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = inputCode.trim();

  if (!cleanCode || cleanCode.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit verification code.' };
  }

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        purpose,
        code: cleanCode,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      return {
        success: false,
        error: data.message || 'Invalid verification code.',
        attemptsRemaining: data.attemptsRemaining,
      };
    }

    return {
      success: true,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error verifying code.',
    };
  }
}

import crypto from 'crypto';

const HKDF_SALT = Buffer.from('shopit-hkdf-v1-salt', 'utf8');

let cachedMasterHex: string | null = null;
const derivedKeyCache = new Map<string, Buffer>();

/**
 * Validates that process.env.APP_SECRET is present and at least 64 hexadecimal characters (32 bytes).
 * Refuses to start (throws) if missing or invalid. Never logs APP_SECRET or auto-generates runtime keys.
 */
export function validateAppSecret(): void {
  const envVal = process.env.APP_SECRET;
  const raw = typeof envVal === 'string' ? envVal.trim() : '';
  const isSet = raw.length > 0;
  const hasNonHex = isSet && /[^0-9a-fA-F]/.test(raw);
  const isLengthValid = raw.length >= 64;

  if (!isSet || !isLengthValid || hasNonHex) {
    throw new Error(
      `[SECURITY FATAL] APP_SECRET invalid: length ${raw.length} (need 64), non-hex: ${hasNonHex ? 'yes' : 'no'}, set: ${isSet ? 'yes' : 'no'}. Refusing to boot.`
    );
  }

  if (cachedMasterHex !== raw) {
    cachedMasterHex = raw;
    derivedKeyCache.clear();
  }
}

function getMasterKeyBuffer(): Buffer {
  validateAppSecret();
  return Buffer.from(cachedMasterHex!, 'hex');
}

/**
 * Derives a cryptographic sub-key from APP_SECRET using HKDF-SHA256 with a domain-specific label.
 * Never uses the master secret directly.
 */
export function deriveSubKey(
  label: 'doc-encryption' | 'nin-hash' | 'otp-hash' | 'signup-proof' | string,
  lengthBytes = 32
): Buffer {
  validateAppSecret();
  const cacheKey = `${label}:${lengthBytes}`;
  const existing = derivedKeyCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const masterBuf = getMasterKeyBuffer();
  const info = Buffer.from(`shopit:${label}`, 'utf8');
  const rawDerived = crypto.hkdfSync('sha256', masterBuf, HKDF_SALT, info, lengthBytes);
  const keyBuf = Buffer.from(rawDerived);
  derivedKeyCache.set(cacheKey, keyBuf);
  return keyBuf;
}

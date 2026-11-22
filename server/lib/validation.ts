import crypto from 'crypto';
import { MINOR_SAFETY_RULES } from '../config/minorSafety.js';
import {
  PROFILE_INTERESTS,
  ALLOWED_LANGUAGES,
  PROCESSING_TIME_OPTIONS,
  DEFAULT_AVATAR_PRESETS,
  MAX_TAGLINE_LENGTH,
  MAX_BIO_LENGTH,
  MAX_SHOP_STORY_LENGTH,
  MAX_CRAFT_MATERIALS_LENGTH,
} from '../../shared/profileOptions.js';

export {
  PROFILE_INTERESTS,
  ALLOWED_LANGUAGES,
  PROCESSING_TIME_OPTIONS,
  DEFAULT_AVATAR_PRESETS,
  MAX_TAGLINE_LENGTH,
  MAX_BIO_LENGTH,
  MAX_SHOP_STORY_LENGTH,
  MAX_CRAFT_MATERIALS_LENGTH,
};

export const ALLOWED_AVATAR_PRESETS = DEFAULT_AVATAR_PRESETS.map(p => p.url);

export interface NotificationPrefs {
  emailOrders: boolean;
  emailMessages: boolean;
  emailFollowers: boolean;
  emailRestock: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'followers';
  whoCanFollow: 'everyone' | 'approval';
  whoCanMessage: 'everyone' | 'followers' | 'mutual';
  showFollowersList: boolean;
  showFollowingList: boolean;
  showLastSeen: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailOrders: true,
  emailMessages: true,
  emailFollowers: true,
  emailRestock: true,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'public',
  whoCanFollow: 'everyone',
  whoCanMessage: 'everyone',
  showFollowersList: true,
  showFollowingList: true,
  showLastSeen: true,
};

export const UNDER_18_PRIVACY_SETTINGS: PrivacySettings = {
  ...MINOR_SAFETY_RULES.lockedPrivacySettings,
};

export function rejectUnknownFields(
  body: unknown,
  allowedKeys: readonly string[]
): { ok: true; obj: Record<string, any> } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a valid JSON object.' };
  }
  const obj = body as Record<string, any>;
  const unknown = Object.keys(obj).filter(k => !allowedKeys.includes(k));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unexpected field(s): ${unknown.slice(0, 5).join(', ')}.`,
    };
  }
  return { ok: true, obj };
}

const PHONE_REGEX = /(\+?234|0)[789][01]\d{8}|(?:\d[\s.-]*){7,}/;
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_REGEX = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|ng|net|org|io|me|ly|co|app|dev|xyz|link)(\/|$|\s))/i;
const HANDLE_OR_OFFPLATFORM_REGEX = /(?:^|\s)@[a-z0-9._]{2,}|\b(whatsapp|wa\.me|t\.me|telegram|instagram|insta|ig\s*:|snapchat|tiktok|opay|palmpay|kuda|bank\s*transfer|call\s*me|dm\s*me|text\s*me)\b/i;

export function containsForbiddenContactInfo(text: string): {
  blocked: boolean;
  reason?: string;
} {
  if (!text) return { blocked: false };
  const normalized = text.replace(/\u200B/g, '');
  if (EMAIL_REGEX.test(normalized)) {
    return { blocked: true, reason: 'Email addresses are not allowed in public text fields.' };
  }
  if (PHONE_REGEX.test(normalized)) {
    return { blocked: true, reason: 'Phone numbers or long digit sequences are not allowed for safety.' };
  }
  if (URL_REGEX.test(normalized)) {
    return { blocked: true, reason: 'External website links are not allowed.' };
  }
  if (HANDLE_OR_OFFPLATFORM_REGEX.test(normalized)) {
    return { blocked: true, reason: 'Social handles or off-platform contact details are not allowed.' };
  }
  return { blocked: false };
}

export function extractFirstName(fullName: string): string {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  const first = cleaned.split(' ')[0] || 'Member';
  const stripped = first.replace(/[^a-zA-Z0-9'-]/g, '').slice(0, 40);
  return stripped.length >= 2 ? stripped : 'Member';
}

export function slugifyDisplayName(displayName: string): string {
  const base = String(displayName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45);
  return base || 'shopit-member';
}

export async function generateUniqueProfileSlug(
  queryFn: (sql: string, params?: any[]) => Promise<any>,
  displayName: string,
  excludeUserId?: string
): Promise<string> {
  const baseSlug = slugifyDisplayName(displayName);
  let candidate = baseSlug;
  let counter = 2;

  while (counter <= 200) {
    const res = excludeUserId
      ? await queryFn('SELECT id FROM shopit_users WHERE LOWER(profile_slug) = LOWER($1) AND id != $2 LIMIT 1', [
          candidate,
          excludeUserId,
        ])
      : await queryFn('SELECT id FROM shopit_users WHERE LOWER(profile_slug) = LOWER($1) LIMIT 1', [candidate]);
    let histTaken = false;
    if (res.rows.length === 0) {
      try {
        const histRes = excludeUserId
          ? await queryFn(
              'SELECT slug FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) AND user_id != $2 LIMIT 1',
              [candidate, excludeUserId]
            )
          : await queryFn('SELECT slug FROM shopit_profile_slug_history WHERE LOWER(slug) = LOWER($1) LIMIT 1', [
              candidate,
            ]);
        histTaken = histRes.rows.length > 0;
      } catch {
        histTaken = false;
      }
    }
    if (res.rows.length === 0 && !histTaken) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
}

export interface DeliveryOptionsConfig {
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  pickupSpots: string[];
}

export function sanitizeDeliveryOptions(
  input: unknown
): { valid: true; value: DeliveryOptionsConfig } | { valid: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, message: 'Delivery options must be a valid object.' };
  }
  const src = input as Record<string, any>;
  const allowsPickup = src.allowsPickup !== undefined ? Boolean(src.allowsPickup) : true;
  const allowsLocalDelivery = src.allowsLocalDelivery !== undefined ? Boolean(src.allowsLocalDelivery) : true;

  const rawSpots = Array.isArray(src.pickupSpots) ? src.pickupSpots : [];
  const pickupSpots: string[] = [];
  for (const item of rawSpots.slice(0, 5)) {
    const spot = String(item || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!spot) continue;
    const contact = containsForbiddenContactInfo(spot);
    if (contact.blocked) {
      return { valid: false, message: `Pickup spot "${spot}": ${contact.reason}` };
    }
    if (!pickupSpots.includes(spot)) {
      pickupSpots.push(spot);
    }
  }

  return {
    valid: true,
    value: {
      allowsPickup,
      allowsLocalDelivery,
      pickupSpots,
    },
  };
}

/**
 * Strips EXIF / APP1 / APP13 / COM metadata segments from a JPEG buffer.
 */
export function stripJpegMetadata(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }
  const chunks: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let offset = 2;

  while (offset + 1 < buf.length) {
    if (buf[offset] !== 0xff) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    // Standalone markers (TEM, RST0..7, SOI, EOI)
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      if (marker === 0xd9) break; // EOI
      continue;
    }
    // Start of Scan: copy until end cleanly
    if (marker === 0xda) {
      chunks.push(buf.subarray(offset));
      break;
    }
    if (offset + 3 >= buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2 || offset + 2 + segLen > buf.length) break;

    // Drop APP1 (EXIF/XMP), APP13 (IPTC), COM (comments)
    const shouldDrop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!shouldDrop) {
      chunks.push(buf.subarray(offset, offset + 2 + segLen));
    }
    offset += 2 + segLen;
  }

  return Buffer.concat(chunks);
}

function verifyMagicBytesForImage(
  mime: string,
  buf: Buffer
): { ok: true; buf: Buffer } | { ok: false; message: string } {
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isWebp =
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const isGif =
    buf.length >= 6 &&
    (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a');

  if (mime === 'image/jpeg') {
    if (!isJpeg) return { ok: false, message: 'File content does not match JPEG image signature.' };
    const stripped = stripJpegMetadata(buf);
    if (!stripped) return { ok: false, message: 'Corrupted JPEG image.' };
    return { ok: true, buf: stripped };
  }
  if (mime === 'image/png') {
    if (!isPng) return { ok: false, message: 'File content does not match PNG image signature.' };
    return { ok: true, buf };
  }
  if (mime === 'image/webp') {
    if (!isWebp) return { ok: false, message: 'File content does not match WebP image signature.' };
    return { ok: true, buf };
  }
  if (mime === 'image/gif') {
    if (!isGif) return { ok: false, message: 'File content does not match GIF image signature.' };
    return { ok: true, buf };
  }
  return { ok: false, message: 'Unsupported image type.' };
}

/**
 * Validates avatar/cover image URL, preset path, server-stored /api/files/:id path, or base64 data URI.
 */
export function validateAndSanitizeImageInput(
  rawUrl: unknown,
  allowEmpty = true
): { valid: true; url: string | null } | { valid: false; message: string } {
  if (rawUrl === undefined || rawUrl === null || rawUrl === '') {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: 'Image is required.' };
  }
  if (typeof rawUrl !== 'string') {
    return { valid: false, message: 'Image must be a valid upload path, data URL, or preset path.' };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: 'Image is required.' };
  }

  if ((ALLOWED_AVATAR_PRESETS as readonly string[]).includes(trimmed) || trimmed === '/shopit-logo.png') {
    return { valid: true, url: trimmed };
  }

  // Server-issued unified upload path
  if (/^\/api\/files\/file_[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: true, url: trimmed };
  }

  // Allow existing server-issued Vercel Blob URLs if stored from earlier versions
  if (/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(trimmed)) {
    return { valid: true, url: trimmed };
  }

  const dataMatch = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!dataMatch) {
    return { valid: false, message: 'Only JPG, PNG, or WebP images or curated preset avatars are allowed.' };
  }

  const mime = dataMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataMatch[1].toLowerCase();
  const base64Body = dataMatch[2].replace(/\s+/g, '');
  const buf = Buffer.from(base64Body, 'base64');

  const MAX_BYTES = 5 * 1024 * 1024;
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { valid: false, message: 'Image size must be greater than 0 and under 5 MB.' };
  }

  const verified = verifyMagicBytesForImage(mime, buf);
  if (!verified.ok) {
    return { valid: false, message: verified.message };
  }

  return {
    valid: true,
    url: `data:${mime};base64,${verified.buf.toString('base64')}`,
  };
}

export type UploadFilePurpose =
  | 'avatar'
  | 'cover'
  | 'product'
  | 'chat'
  | 'packed_proof'
  | 'dispute'
  | 'general';

export const ALLOWED_UPLOAD_PURPOSES: readonly UploadFilePurpose[] = [
  'avatar',
  'cover',
  'product',
  'chat',
  'packed_proof',
  'dispute',
  'general',
] as const;

export function validateAndSanitizeUploadFile(params: {
  dataUrl: unknown;
  fileName: unknown;
  purpose: UploadFilePurpose;
}):
  | {
      valid: true;
      mimeType: string;
      sizeBytes: number;
      base64Data: string;
      cleanName: string;
      kind: 'image' | 'document';
      sha256: string;
    }
  | { valid: false; message: string } {
  const { dataUrl, fileName, purpose } = params;
  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    return { valid: false, message: 'File data URL is required.' };
  }

  const rawName = String(fileName || 'upload').trim();
  const cleanName = rawName
    .replace(/[\r\n\0/\\]+/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .slice(0, 120) || 'upload';

  const match = /^data:([a-z0-9+.-]+\/[a-z0-9+.-]+)(?:;[a-z0-9=_-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) {
    return { valid: false, message: 'Invalid file format. Please upload a JPG, PNG, WebP, GIF, PDF, or TXT file.' };
  }

  let mimeType = match[1].toLowerCase();
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

  // Explicitly reject SVG, HTML, JS, XML or executable payloads
  if (
    mimeType.includes('svg') ||
    mimeType.includes('html') ||
    mimeType.includes('javascript') ||
    mimeType.includes('xml')
  ) {
    return { valid: false, message: 'SVG, HTML, and script files are blocked for security.' };
  }

  const base64Body = match[2].replace(/\s+/g, '');
  const buf = Buffer.from(base64Body, 'base64');
  const MAX_BYTES = 4 * 1024 * 1024; // 4 MB strict limit
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { valid: false, message: 'File size must be between 1 byte and 4 MB.' };
  }

  const isImageMime =
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    mimeType === 'image/gif';

  if (isImageMime) {
    const verified = verifyMagicBytesForImage(mimeType, buf);
    if (!verified.ok) {
      return { valid: false, message: verified.message };
    }
    const finalBuf = verified.buf;
    const sha256 = crypto.createHash('sha256').update(finalBuf).digest('hex');
    return {
      valid: true,
      mimeType,
      sizeBytes: finalBuf.length,
      base64Data: finalBuf.toString('base64'),
      cleanName,
      kind: 'image',
      sha256,
    };
  }

  // Document uploads are strictly limited to chat attachments (PDF & plain text)
  if (purpose === 'chat' && (mimeType === 'application/pdf' || mimeType === 'text/plain')) {
    if (mimeType === 'application/pdf') {
      const hasPdfSig = buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
      if (!hasPdfSig) {
        return { valid: false, message: 'File content does not match a valid PDF document.' };
      }
    } else {
      // Plain text: disallow null bytes & active script/HTML markup
      if (buf.includes(0)) {
        return { valid: false, message: 'Binary data is not allowed inside a plain-text file.' };
      }
      const txt = buf.toString('utf8');
      if (/<script|<iframe|javascript:/i.test(txt)) {
        return { valid: false, message: 'Text attachment contains disallowed script/HTML markup.' };
      }
    }
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    return {
      valid: true,
      mimeType,
      sizeBytes: buf.length,
      base64Data: buf.toString('base64'),
      cleanName,
      kind: 'document',
      sha256,
    };
  }

  return {
    valid: false,
    message:
      purpose === 'chat'
        ? 'Only JPG, PNG, WebP, GIF, PDF, or TXT files are allowed in chat.'
        : 'Only JPG, PNG, WebP, or GIF image files are allowed for this upload.',
  };
}

export function sanitizeNotificationPrefs(
  input: unknown,
  current: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS
): NotificationPrefs {
  const src = input && typeof input === 'object' ? (input as Record<string, any>) : {};

  // Seamless migration from legacy keys if present in older DB rows
  const emailOrdersRaw = src.emailOrders !== undefined ? src.emailOrders : src.orderUpdates;
  const emailMessagesRaw = src.emailMessages !== undefined ? src.emailMessages : src.messageReceived;
  const emailFollowersRaw = src.emailFollowers !== undefined ? src.emailFollowers : src.newFollower;
  const emailRestockRaw =
    src.emailRestock !== undefined ? src.emailRestock : src.newProductFromFollowing;

  return {
    emailOrders: emailOrdersRaw !== undefined ? Boolean(emailOrdersRaw) : current.emailOrders,
    emailMessages: emailMessagesRaw !== undefined ? Boolean(emailMessagesRaw) : current.emailMessages,
    emailFollowers: emailFollowersRaw !== undefined ? Boolean(emailFollowersRaw) : current.emailFollowers,
    emailRestock: emailRestockRaw !== undefined ? Boolean(emailRestockRaw) : current.emailRestock,
  };
}

export function sanitizePrivacySettings(
  input: unknown,
  current: PrivacySettings = DEFAULT_PRIVACY_SETTINGS,
  isUnder18 = false
): PrivacySettings {
  const src = input && typeof input === 'object' ? (input as Record<string, any>) : {};

  let visRaw = src.profileVisibility;
  if (visRaw === 'everyone') visRaw = 'public';
  const vis: PrivacySettings['profileVisibility'] =
    visRaw === 'followers' || visRaw === 'public' ? visRaw : current.profileVisibility;

  const follow: PrivacySettings['whoCanFollow'] =
    src.whoCanFollow === 'approval' || src.whoCanFollow === 'everyone'
      ? src.whoCanFollow
      : current.whoCanFollow;

  let msgRaw = src.whoCanMessage;
  if (msgRaw === 'order_or_product') msgRaw = 'mutual';
  const msg: PrivacySettings['whoCanMessage'] =
    msgRaw === 'everyone' || msgRaw === 'followers' || msgRaw === 'mutual'
      ? msgRaw
      : current.whoCanMessage;

  return {
    profileVisibility: vis,
    whoCanFollow: isUnder18 ? 'approval' : follow,
    whoCanMessage: isUnder18 ? 'mutual' : msg,
    showFollowersList:
      src.showFollowersList !== undefined ? Boolean(src.showFollowersList) : current.showFollowersList,
    showFollowingList:
      src.showFollowingList !== undefined ? Boolean(src.showFollowingList) : current.showFollowingList,
    showLastSeen: src.showLastSeen !== undefined ? Boolean(src.showLastSeen) : current.showLastSeen,
  };
}

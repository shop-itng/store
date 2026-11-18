import crypto from 'crypto';

export const PROFILE_INTERESTS = [
  'Crochet & Knitwear',
  'Beads & Jewelry',
  'Skincare & Hair',
  'Apparel & Tote Bags',
  'Resin & Decor',
  'Art & Stationery',
  'Tech Accessories',
  'Thrift & Vintage',
  'Custom Gifts',
  'Campus Essentials',
] as const;

export const ALLOWED_AVATAR_PRESETS = [
  '/avatars/avatar-1.svg',
  '/avatars/avatar-2.svg',
  '/avatars/avatar-3.svg',
  '/avatars/avatar-4.svg',
  '/avatars/avatar-5.svg',
  '/avatars/avatar-6.svg',
] as const;

export interface NotificationPrefs {
  newFollower: boolean;
  followBack: boolean;
  newProductFromFollowing: boolean;
  messageReceived: boolean;
  orderUpdates: boolean;
  emailNotifications: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'everyone' | 'followers';
  whoCanFollow: 'everyone' | 'approval';
  whoCanMessage: 'everyone' | 'followers' | 'order_or_product';
  showFollowersList: boolean;
  showFollowingList: boolean;
  showLastSeen: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newFollower: true,
  followBack: true,
  newProductFromFollowing: true,
  messageReceived: true,
  orderUpdates: true,
  emailNotifications: true,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'everyone',
  whoCanFollow: 'everyone',
  whoCanMessage: 'everyone',
  showFollowersList: true,
  showFollowingList: true,
  showLastSeen: true,
};

export const UNDER_18_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'followers',
  whoCanFollow: 'approval',
  whoCanMessage: 'order_or_product',
  showFollowersList: false,
  showFollowingList: false,
  showLastSeen: false,
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
      ? await queryFn('SELECT id FROM shopit_users WHERE profile_slug = $1 AND id != $2 LIMIT 1', [candidate, excludeUserId])
      : await queryFn('SELECT id FROM shopit_users WHERE profile_slug = $1 LIMIT 1', [candidate]);
    if (res.rows.length === 0) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
}

/**
 * Strips EXIF / APP1 / APP13 / COM metadata segments from a JPEG buffer.
 */
function stripJpegMetadata(buf: Buffer): Buffer | null {
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

    // Drop APP1 (EXIF/XMP), APP2 (ICC/FlashPix optional), APP13 (IPTC), COM (comments)
    const shouldDrop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!shouldDrop) {
      chunks.push(buf.subarray(offset, offset + 2 + segLen));
    }
    offset += 2 + segLen;
  }

  return Buffer.concat(chunks);
}

/**
 * Validates avatar/cover image URL or base64 data URI by magic bytes, 5MB limit, and EXIF stripping.
 */
export function validateAndSanitizeImageInput(
  rawUrl: unknown,
  allowEmpty = true
): { valid: true; url: string | null } | { valid: false; message: string } {
  if (rawUrl === undefined || rawUrl === null || rawUrl === '') {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: 'Image is required.' };
  }
  if (typeof rawUrl !== 'string') {
    return { valid: false, message: 'Image must be a valid data URL or preset path.' };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return allowEmpty ? { valid: true, url: null } : { valid: false, message: 'Image is required.' };
  }

  if ((ALLOWED_AVATAR_PRESETS as readonly string[]).includes(trimmed) || trimmed === '/shopit-logo.png') {
    return { valid: true, url: trimmed };
  }

  // Allow existing server-issued private/public blob URLs if already stored
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

  if (mime === 'image/jpeg' && !isJpeg) {
    return { valid: false, message: 'File content does not match JPEG image signature.' };
  }
  if (mime === 'image/png' && !isPng) {
    return { valid: false, message: 'File content does not match PNG image signature.' };
  }
  if (mime === 'image/webp' && !isWebp) {
    return { valid: false, message: 'File content does not match WebP image signature.' };
  }

  let cleanBuf: Buffer = buf;
  if (isJpeg) {
    const stripped = stripJpegMetadata(buf);
    if (!stripped) {
      return { valid: false, message: 'Corrupted JPEG image.' };
    }
    cleanBuf = stripped;
  }

  return {
    valid: true,
    url: `data:${mime};base64,${cleanBuf.toString('base64')}`,
  };
}

export function sanitizeNotificationPrefs(input: unknown, current: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS): NotificationPrefs {
  const src = input && typeof input === 'object' ? (input as Record<string, any>) : {};
  return {
    newFollower: src.newFollower !== undefined ? Boolean(src.newFollower) : current.newFollower,
    followBack: src.followBack !== undefined ? Boolean(src.followBack) : current.followBack,
    newProductFromFollowing:
      src.newProductFromFollowing !== undefined ? Boolean(src.newProductFromFollowing) : current.newProductFromFollowing,
    messageReceived: src.messageReceived !== undefined ? Boolean(src.messageReceived) : current.messageReceived,
    orderUpdates: src.orderUpdates !== undefined ? Boolean(src.orderUpdates) : current.orderUpdates,
    emailNotifications:
      src.emailNotifications !== undefined ? Boolean(src.emailNotifications) : current.emailNotifications,
  };
}

export function sanitizePrivacySettings(
  input: unknown,
  current: PrivacySettings = DEFAULT_PRIVACY_SETTINGS,
  isUnder18 = false
): PrivacySettings {
  const src = input && typeof input === 'object' ? (input as Record<string, any>) : {};
  const vis = src.profileVisibility === 'followers' || src.profileVisibility === 'everyone'
    ? src.profileVisibility
    : current.profileVisibility;
  const follow = src.whoCanFollow === 'approval' || src.whoCanFollow === 'everyone'
    ? src.whoCanFollow
    : current.whoCanFollow;
  const msg =
    src.whoCanMessage === 'everyone' || src.whoCanMessage === 'followers' || src.whoCanMessage === 'order_or_product'
      ? src.whoCanMessage
      : current.whoCanMessage;

  return {
    profileVisibility: vis,
    whoCanFollow: isUnder18 ? 'approval' : follow, // Under-18 always requires approval
    whoCanMessage: isUnder18 ? 'order_or_product' : msg, // Under-18 restricted to order/product connections
    showFollowersList: src.showFollowersList !== undefined ? Boolean(src.showFollowersList) : current.showFollowersList,
    showFollowingList: src.showFollowingList !== undefined ? Boolean(src.showFollowingList) : current.showFollowingList,
    showLastSeen: src.showLastSeen !== undefined ? Boolean(src.showLastSeen) : current.showLastSeen,
  };
}

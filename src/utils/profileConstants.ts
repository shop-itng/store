import {
  PROFILE_INTERESTS,
  ALLOWED_LANGUAGES,
  PROCESSING_TIME_OPTIONS,
  DEFAULT_AVATAR_PRESETS,
  MAX_TAGLINE_LENGTH,
  MAX_BIO_LENGTH,
  MAX_SHOP_STORY_LENGTH,
  MAX_CRAFT_MATERIALS_LENGTH,
} from '../../shared/profileOptions';

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

export const DEFAULT_NOTIFICATION_PREFS = {
  emailOrders: true,
  emailMessages: true,
  emailFollowers: true,
  emailRestock: true,
};

export const DEFAULT_PRIVACY_SETTINGS = {
  profileVisibility: 'public' as 'public' | 'followers',
  showLastSeen: true,
  showFollowersList: true,
  showFollowingList: true,
  whoCanFollow: 'everyone' as 'everyone' | 'approval',
  whoCanMessage: 'everyone' as 'everyone' | 'followers' | 'mutual',
};

export const UNDER_18_PRIVACY_SETTINGS = {
  profileVisibility: 'public' as 'public' | 'followers',
  showLastSeen: false,
  showFollowersList: false,
  showFollowingList: false,
  whoCanFollow: 'approval' as 'everyone' | 'approval',
  whoCanMessage: 'mutual' as 'everyone' | 'followers' | 'mutual',
};

export function clientContainsForbiddenContactInfo(input: string): { blocked: boolean; reason?: string } {
  const text = String(input || '');
  if (!text.trim()) return { blocked: false };

  const digitRuns = text.match(/(?:\+?\d[\s\-().]*){7,}/g);
  if (digitRuns && digitRuns.length > 0) {
    return { blocked: true, reason: 'Phone numbers or long digit sequences are not allowed for safety.' };
  }

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
    return { blocked: true, reason: 'Email addresses are not allowed in public profile or listing text.' };
  }

  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|ng|org|net|io|co|me|ly|app|vercel\.app)\b)/i.test(text)) {
    return { blocked: true, reason: 'External website links are not allowed for safety.' };
  }

  if (/(^|[\s(])@[a-z0-9_.-]{2,}/i.test(text)) {
    return { blocked: true, reason: 'Social handles (@username) are not allowed.' };
  }

  if (/\b(whatsapp|wa\.me|telegram|t\.me|instagram|ig:|tiktok|snapchat|facebook|fb\.me|call\s+me|dm\s+me|text\s+me)\b/i.test(text)) {
    return { blocked: true, reason: 'Off-platform contact references (WhatsApp, Instagram, Telegram, etc.) are not allowed.' };
  }

  return { blocked: false };
}

export function getCanonicalOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://shopitng.vercel.app';
}

export function getProfileUrl(slugOrId: string): string {
  return `${getCanonicalOrigin()}/?profile=${encodeURIComponent(slugOrId)}`;
}

export function formatMemberSince(isoOrDate?: string): string {
  if (!isoOrDate) return 'Recently joined';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
}

export function formatLastSeen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 5 * 60 * 1000) return 'Active recently';
  if (diffMs < 60 * 60 * 1000) return `Last seen ${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 24 * 60 * 60 * 1000) return `Last seen ${Math.floor(diffMs / 3600000)}h ago`;
  return `Last seen ${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`;
}

/**
 * Under-18 Youth Safety & Privacy Policy Configuration
 * ====================================================
 * Centralized configuration for accounts aged 10–17 on Shop It (Nigeria).
 * Every enforcement rule in `api/routes/profiles.ts`, `api/routes/marketplace.ts`,
 * and `api/lib/validation.ts` reads directly from this module so a Nigerian lawyer
 * or developer can audit and adjust any minor protection rule in one place.
 */

import type { PrivacySettings } from '../lib/validation.js';

export const MINIMUM_PLATFORM_AGE = 10;
export const ADULT_AGE_THRESHOLD = 18;

export const MINOR_SAFETY_RULES = {
  /** Adults (18+) are blocked from following or sending follow requests to under-18 accounts. */
  blockAdultFollowingMinors: true,
  /** Under-18 accounts are also blocked from following adult (18+) accounts. */
  blockMinorFollowingAdults: true,
  /** Under-18 accounts must manually approve incoming follow requests (from peers under 18). */
  forceMinorFollowApproval: true,
  /** Exclude under-18 accounts from user search (/profiles/search) and suggested makers (/profiles/discover/suggested). */
  hideMinorsFromSearchAndDiscovery: true,
  /** Keep minor makers' public shop storefronts & craft listings accessible so customers can browse and buy. */
  keepMinorShopsAndProductsPublic: true,
  /** Keep privacy settings locked so minors cannot weaken protections. */
  lockedPrivacySettings: {
    profileVisibility: 'public',
    whoCanFollow: 'approval',
    whoCanMessage: 'mutual',
    showFollowersList: false,
    showFollowingList: false,
    showLastSeen: false,
  } satisfies PrivacySettings,
  /**
   * Minors cannot have open free private messaging (`whoCanMessage` locked to `'mutual'`).
   * However, buyers CAN message a minor maker about a real DB-verified product listing or order.
   * No real product or order => no message allowed.
   */
  allowProductOrOrderLinkedChat: true,
  requireProductOrOrderForMinorChat: true,
} as const;

export function isMinorAccount(input: {
  age?: number | string | null;
  sellerUnder18?: boolean | null;
}): boolean {
  if (input.sellerUnder18) return true;
  if (input.age !== null && input.age !== undefined && String(input.age).trim() !== '') {
    const parsed = Number(input.age);
    if (Number.isFinite(parsed) && parsed < ADULT_AGE_THRESHOLD) {
      return true;
    }
  }
  return false;
}

export function isAdultAccount(age?: number | string | null): boolean {
  if (age === null || age === undefined || String(age).trim() === '') {
    return true; // Fail closed as adult if age is missing
  }
  const parsed = Number(age);
  if (!Number.isFinite(parsed)) return true;
  return parsed >= ADULT_AGE_THRESHOLD;
}

export function evaluateMinorFollowRule(params: {
  viewerAge?: number | string | null;
  viewerIsUnder18?: boolean;
  targetIsUnder18: boolean;
}): { allowed: boolean; forcedStatus?: 'pending'; reason?: string } {
  const viewerUnder18 =
    params.viewerIsUnder18 ?? isMinorAccount({ age: params.viewerAge });

  if (!params.targetIsUnder18) {
    if (MINOR_SAFETY_RULES.blockMinorFollowingAdults && viewerUnder18) {
      return {
        allowed: false,
        reason: 'For youth safety, under-18 accounts cannot follow adult accounts.',
      };
    }
    return { allowed: true };
  }

  if (MINOR_SAFETY_RULES.blockAdultFollowingMinors && !viewerUnder18 && isAdultAccount(params.viewerAge)) {
    return {
      allowed: false,
      reason: 'For youth safety, adults cannot follow or send follow requests to under-18 accounts.',
    };
  }
  return {
    allowed: true,
    forcedStatus: MINOR_SAFETY_RULES.forceMinorFollowApproval ? 'pending' : undefined,
  };
}

export function evaluateMinorChatStart(params: {
  sellerIsUnder18: boolean;
  buyerIsUnder18: boolean;
  hasVerifiedProduct: boolean;
  hasVerifiedOrder: boolean;
  isAdmin?: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.isAdmin) return { allowed: true };
  const involvesMinor = params.sellerIsUnder18 || params.buyerIsUnder18;
  if (!involvesMinor) return { allowed: true };

  if (
    MINOR_SAFETY_RULES.requireProductOrOrderForMinorChat &&
    !params.hasVerifiedProduct &&
    !params.hasVerifiedOrder
  ) {
    return {
      allowed: false,
      reason:
        'For under-18 safety, chats involving under-18 accounts must be linked to a real product listing or order.',
    };
  }
  return { allowed: true };
}

export function evaluateMinorMessageSend(params: {
  sellerIsUnder18: boolean;
  buyerIsUnder18: boolean;
  conversationProductId?: string | null;
  conversationOrderId?: string | null;
  isAdmin?: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.isAdmin) return { allowed: true };
  const involvesMinor = params.sellerIsUnder18 || params.buyerIsUnder18;
  if (!involvesMinor) return { allowed: true };

  if (
    MINOR_SAFETY_RULES.requireProductOrOrderForMinorChat &&
    !params.conversationProductId &&
    !params.conversationOrderId
  ) {
    return {
      allowed: false,
      reason:
        'For under-18 safety, private chat without a real product or order is not allowed.',
    };
  }
  return { allowed: true };
}

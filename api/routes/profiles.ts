import express, { Response } from 'express';
import crypto from 'crypto';
import {
  query as dbQuery,
  withTransaction,
  verifyPassword,
} from '../db/postgres.js';
import {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
} from '../auth/middleware.js';
import {
  revokeUserSessions,
  logAuditEvent,
  SESSION_COOKIE_NAME,
} from '../auth/sessionStore.js';
import {
  PROFILE_INTERESTS,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_SETTINGS,
  UNDER_18_PRIVACY_SETTINGS,
  rejectUnknownFields,
  containsForbiddenContactInfo,
  extractFirstName,
  generateUniqueProfileSlug,
  validateAndSanitizeImageInput,
  sanitizeNotificationPrefs,
  sanitizePrivacySettings,
} from '../lib/validation.js';
import { checkAndRecordRateLimit } from '../db/otpStore.js';
import { sendBrevoDirect } from '../lib/payments.js';

const router = express.Router();

function parseJsonSafe<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function buildInClause(values: string[], startIndex = 1): { placeholders: string; params: string[] } {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return { placeholders: '$1', params: ['__none__'] };
  return {
    placeholders: unique.map((_, i) => `$${startIndex + i}`).join(', '),
    params: unique,
  };
}

function mapProductRow(row: any, sellerDisplayName?: string, sellerAvatarUrl?: string, sellerProfileSlug?: string) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerShopName: row.seller_shop_name || sellerDisplayName || 'Artisan Shop',
    sellerDisplayName: sellerDisplayName || row.seller_shop_name || 'Artisan',
    sellerAvatarUrl: sellerAvatarUrl || undefined,
    sellerProfileSlug: sellerProfileSlug || undefined,
    sellerCampus: row.seller_campus || 'Lagos Mainland',
    location: {
      state: row.location_state || 'Lagos',
      city: row.location_city || 'Lagos Mainland',
      area: row.location_area || 'Yaba',
    },
    locationArea: row.location_area || 'Yaba',
    sellerBadges: Array.isArray(row.seller_badges) ? row.seller_badges : parseJsonSafe(row.seller_badges, []),
    title: row.title,
    description: row.description || '',
    category: row.category || 'crafts',
    sellerPrice: Math.round(Number(row.seller_price_kobo || 0)) / 100,
    serviceFee: Math.round(Number(row.service_fee_kobo || 0)) / 100,
    displayPrice: Math.round(Number(row.display_price_kobo || 0)) / 100,
    images: Array.isArray(row.images) ? row.images : parseJsonSafe(row.images, []),
    stock: parseInt(String(row.stock ?? 0), 10) || 0,
    rating: parseFloat(row.rating || 5.0),
    reviewCount: parseInt(String(row.review_count ?? 0), 10) || 0,
    reviews: Array.isArray(row.reviews) ? row.reviews : parseJsonSafe(row.reviews, []),
    delivery: {
      allowsPickup: true,
      pickupLocation: `${row.location_area || 'Hub'} Safe Handoff Spot`,
      pickupFee: Math.round(Number(row.delivery_pickup_fee_kobo || 0)) / 100,
      allowsLocalDelivery: true,
      localDeliveryFee: row.delivery_local_fee_kobo !== undefined && row.delivery_local_fee_kobo !== null
        ? Math.round(Number(row.delivery_local_fee_kobo)) / 100
        : 500,
      minOrderForDelivery: 1000,
    },
    isSoldOut: Boolean(row.is_sold_out || Number(row.stock || 0) <= 0),
    isNewArrival: Boolean(row.is_new_arrival),
    isPaused: Boolean(row.is_paused),
    isDraft: Boolean(row.is_draft),
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at || undefined,
    createdAt: row.created_at,
  };
}

function computeProfileCompleteness(params: {
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  campus?: string | null;
  locationArea?: string | null;
  interests: string[];
  isVerifiedEmail: boolean;
  isSeller: boolean;
  shopName?: string | null;
  activeProductsCount: number;
}) {
  const items = [
    { key: 'avatar', label: 'Add a profile photo', done: Boolean(params.avatarUrl) },
    { key: 'bio', label: 'Write a short bio', done: Boolean(params.bio && params.bio.trim().length >= 10) },
    { key: 'location', label: 'Set your campus & area', done: Boolean(params.campus || params.locationArea) },
    { key: 'interests', label: 'Pick at least 1 craft interest', done: params.interests.length > 0 },
    { key: 'email', label: 'Verify your email address', done: Boolean(params.isVerifiedEmail) },
  ];
  if (params.isSeller) {
    items.push({
      key: 'shop_name',
      label: 'Name your shop',
      done: Boolean(params.shopName && params.shopName.trim().length >= 2),
    });
    items.push({
      key: 'listing',
      label: 'Publish at least 1 craft listing',
      done: params.activeProductsCount > 0,
    });
  }
  const doneCount = items.filter(i => i.done).length;
  const score = Math.round((doneCount / items.length) * 100);
  return { score, items };
}

async function computeComputedSellerStats(userRow: any, sellerRow: any, activeProducts: any[], allProducts: any[]) {
  const [followersRes, followingRes, ordersRes] = await Promise.all([
    dbQuery("SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'", [userRow.id]),
    dbQuery("SELECT COUNT(*) as total FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'", [userRow.id]),
    sellerRow
      ? dbQuery(
          `SELECT status, created_at, paid_at, shipped_at, items
           FROM shopit_orders
           WHERE items::text LIKE $1 OR items::text LIKE $2`,
          [`%"sellerId":"${userRow.id}"%`, `%"sellerId":"${sellerRow.id}"%`]
        )
      : dbQuery(
          `SELECT status, created_at, paid_at, shipped_at, items
           FROM shopit_orders
           WHERE buyer_id = $1`,
          [userRow.id]
        ),
  ]);

  const followersCount = parseInt(String(followersRes.rows[0]?.total || '0'), 10);
  const followingCount = parseInt(String(followingRes.rows[0]?.total || '0'), 10);

  const completedStatuses = new Set(['delivered', 'completed']);
  const completedOrdersCount = ordersRes.rows.filter((o: any) => completedStatuses.has(String(o.status))).length;

  // Fast Shipper badge: >=1 shipped order with avg fulfillment <= 24h (calculated safely in JS without PG-specific EXTRACT syntax)
  const shippedOrders = ordersRes.rows.filter((o: any) => Boolean(o.shipped_at));
  let isFastShipper = false;
  if (shippedOrders.length >= 1) {
    const diffs = shippedOrders
      .map((o: any) => {
        const startMs = new Date(o.paid_at || o.created_at).getTime();
        const shipMs = new Date(o.shipped_at).getTime();
        return shipMs - startMs;
      })
      .filter((ms: number) => Number.isFinite(ms) && ms >= 0);
    if (diffs.length > 0) {
      const avgMs = diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length;
      if (avgMs <= 24 * 60 * 60 * 1000) {
        isFastShipper = true;
      }
    }
  }

  // Aggregate authentic reviews from DB products
  const rawReviews: any[] = [];
  for (const p of activeProducts) {
    const pRevs = Array.isArray(p.reviews) ? p.reviews : parseJsonSafe(p.reviews, []);
    for (const r of pRevs) {
      rawReviews.push({
        ...r,
        productId: p.id,
        productTitle: p.title,
      });
    }
  }

  // Resolve reviewer display names, avatars, and slugs dynamically from shopit_users when reviewerId exists
  const reviewerIds = Array.from(new Set(rawReviews.map(r => r.reviewerId).filter(Boolean)));
  const reviewerMap = new Map<string, { displayName: string; avatarUrl?: string; profileSlug?: string }>();
  if (reviewerIds.length > 0) {
    const { placeholders, params } = buildInClause(reviewerIds);
    const uRes = await dbQuery(
      `SELECT id, name, display_name, avatar_url, profile_slug, deleted_at
       FROM shopit_users
       WHERE id IN (${placeholders})`,
      params
    ).catch(() => ({ rows: [] }));
    for (const ur of uRes.rows) {
      if (ur.deleted_at) {
        reviewerMap.set(ur.id, { displayName: 'Deleted User' });
      } else {
        reviewerMap.set(ur.id, {
          displayName: ur.display_name || extractFirstName(ur.name || 'Member'),
          avatarUrl: ur.avatar_url || undefined,
          profileSlug: ur.profile_slug || undefined,
        });
      }
    }
  }

  const enrichedReviews = rawReviews.map(r => {
    const revInfo = r.reviewerId ? reviewerMap.get(r.reviewerId) : undefined;
    const displayName = revInfo?.displayName || r.reviewerName || 'Verified Shopper';
    return {
      id: r.id,
      productId: r.productId,
      productTitle: r.productTitle,
      reviewerId: r.reviewerId || undefined,
      reviewerName: displayName,
      reviewerAvatarUrl: revInfo?.avatarUrl || r.reviewerAvatarUrl || undefined,
      reviewerProfileSlug: revInfo?.profileSlug || r.reviewerProfileSlug || undefined,
      rating: Number(r.rating || 5),
      comment: String(r.comment || ''),
      date: r.date || '',
      verifiedPurchase: Boolean(r.verifiedPurchase ?? true),
    };
  });

  const reviewCount = enrichedReviews.length;
  const averageRating =
    reviewCount > 0
      ? Number((enrichedReviews.reduce((s, r) => s + Number(r.rating || 5), 0) / reviewCount).toFixed(2))
      : sellerRow
      ? parseFloat(String(sellerRow.rating || 5.0))
      : 0;

  const isVerifiedSeller = Boolean(
    sellerRow && (sellerRow.is_verified_seller || sellerRow.verification_status === 'verified' || sellerRow.verification_status === 'approved')
  );

  // Real DB-computed badges
  const computedBadges: Array<{ id: string; label: string }> = [];
  if (sellerRow) {
    if (isVerifiedSeller) {
      computedBadges.push({ id: 'verified', label: 'Verified Seller' });
    }
    if (isFastShipper) {
      computedBadges.push({ id: 'fast_shipper', label: 'Fast Shipper' });
    }
    if (reviewCount >= 3 && averageRating >= 4.5) {
      computedBadges.push({ id: 'top_rated', label: 'Top Rated' });
    }
    const joinedMs = new Date(sellerRow.created_at || userRow.created_at || Date.now()).getTime();
    if (completedOrdersCount < 3 && Date.now() - joinedMs <= 30 * 24 * 60 * 60 * 1000) {
      computedBadges.push({ id: 'new_seller', label: 'New Seller' });
    }
  }

  return {
    followersCount,
    followingCount,
    completedOrdersCount,
    productsCount: activeProducts.length,
    totalProductsCount: allProducts.length,
    reviewCount,
    averageRating,
    reviews: enrichedReviews,
    isVerifiedSeller,
    badges: computedBadges,
  };
}

// ============================================================================
// GET /api/profiles/me - Current authenticated user's profile & settings
// ============================================================================
router.get('/profiles/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const uRes = await dbQuery(
      `SELECT u.*, s.id as s_id, s.shop_name, s.bio as s_bio, s.campus as s_campus, s.location_area as s_area,
              s.location_state as s_state, s.location_city as s_city,
              s.logo_url as s_logo_url, s.banner_url as s_banner_url,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18,
              s.vacation_mode, s.created_at as s_created_at, s.rating as s_rating
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [userId]
    );

    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Profile not found.' });
    }

    const row = uRes.rows[0];
    const displayName = row.display_name || extractFirstName(row.name || 'Member');
    const isUnder18 = (row.age !== null && row.age !== undefined && Number(row.age) < 18) || Boolean(row.s_under_18);
    const interests = parseJsonSafe<string[]>(row.interests, []);
    const notificationPrefs = sanitizeNotificationPrefs(parseJsonSafe(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS));
    const privacySettings = sanitizePrivacySettings(
      parseJsonSafe(row.privacy_settings, isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS),
      isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS,
      isUnder18
    );

    const sellerRow = row.s_id
      ? {
          id: row.s_id,
          shop_name: row.shop_name,
          bio: row.s_bio,
          campus: row.s_campus,
          location_area: row.s_area,
          location_state: row.s_state,
          location_city: row.s_city,
          logo_url: row.s_logo_url,
          banner_url: row.s_banner_url,
          is_verified_seller: row.is_verified_seller,
          verification_status: row.verification_status,
          vacation_mode: row.vacation_mode,
          created_at: row.s_created_at,
          rating: row.s_rating,
        }
      : null;

    const prodIds = sellerRow ? [row.id, sellerRow.id] : [row.id];
    const prodIn = buildInClause(prodIds);
    const pRes = await dbQuery(
      `SELECT * FROM shopit_products WHERE seller_id IN (${prodIn.placeholders}) ORDER BY is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC`,
      prodIn.params
    );
    const activeProds = pRes.rows.filter((p: any) => !p.is_paused && !p.is_draft);

    const stats = await computeComputedSellerStats(row, sellerRow, activeProds, pRes.rows);
    const pendingReqRes = await dbQuery(
      `SELECT COUNT(*) as total
       FROM shopit_follows f
       JOIN shopit_users fu ON fu.id = f.follower_id
       WHERE f.following_id = $1 AND f.status = 'pending' AND fu.deleted_at IS NULL AND fu.is_banned IS NOT TRUE`,
      [row.id]
    ).catch(() => ({ rows: [{ total: 0 }] }));
    const pendingFollowRequestsCount = parseInt(String(pendingReqRes.rows[0]?.total || '0'), 10);
    const completeness = computeProfileCompleteness({
      avatarUrl: row.avatar_url || sellerRow?.logo_url,
      coverUrl: row.cover_url || sellerRow?.banner_url,
      bio: row.bio || sellerRow?.bio,
      campus: row.campus || sellerRow?.campus,
      locationArea: row.location_area || sellerRow?.location_area,
      interests,
      isVerifiedEmail: Boolean(row.is_verified_email),
      isSeller: Boolean(sellerRow),
      shopName: sellerRow?.shop_name,
      activeProductsCount: activeProds.length,
    });

    return res.json({
      status: true,
      profile: {
        id: row.id,
        email: row.email,
        fullName: row.name,
        displayName,
        profileSlug: row.profile_slug,
        role: row.role,
        avatarUrl: row.avatar_url || sellerRow?.logo_url || null,
        coverUrl: row.cover_url || sellerRow?.banner_url || null,
        bio: row.bio || '',
        campus: row.campus || sellerRow?.campus || '',
        locationArea: row.location_area || sellerRow?.location_area || '',
        interests,
        isVerifiedEmail: Boolean(row.is_verified_email),
        isUnder18,
        memberSince: row.created_at,
        lastSeenAt: row.last_seen_at || row.last_login_at || row.created_at,
        notificationPrefs,
        privacySettings,
        completeness,
        pendingFollowRequestsCount,
        ...stats,
        products: pRes.rows.map((p: any) =>
          mapProductRow(p, displayName, row.avatar_url || sellerRow?.logo_url, row.profile_slug)
        ),
        seller: sellerRow
          ? {
              id: sellerRow.id,
              shopName: sellerRow.shop_name,
              bio: sellerRow.bio || '',
              campus: sellerRow.campus || 'Lagos Mainland',
              locationArea: sellerRow.location_area || 'Yaba',
              logoUrl: sellerRow.logo_url || row.avatar_url || null,
              bannerUrl: sellerRow.banner_url || row.cover_url || null,
              isVerifiedSeller: stats.isVerifiedSeller,
              verificationStatus: sellerRow.verification_status || 'not_started',
              vacationMode: Boolean(sellerRow.vacation_mode),
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error('[GET /profiles/me Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to load your profile.' });
  }
});

// ============================================================================
// PATCH /api/profiles/me - Update public profile & seller shop identity
// ============================================================================
router.patch('/profiles/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, [
      'displayName',
      'avatarUrl',
      'coverUrl',
      'bio',
      'campus',
      'locationArea',
      'interests',
      'shopName',
      'shopBio',
      'logoUrl',
      'bannerUrl',
    ]);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const body = check.obj;
    const userId = req.user!.userId;

    let nextDisplayName: string | undefined;
    if ('displayName' in body) {
      const cleaned = String(body.displayName || '').trim().replace(/\s+/g, ' ');
      if (cleaned.length < 2 || cleaned.length > 40) {
        return res.status(400).json({ status: false, message: 'Display name must be between 2 and 40 characters.' });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Display name: ${contactCheck.reason}` });
      }
      nextDisplayName = cleaned;
    }

    let nextBio: string | undefined;
    if ('bio' in body) {
      const cleaned = String(body.bio || '').trim();
      if (cleaned.length > 200) {
        return res.status(400).json({ status: false, message: 'Bio must be 200 characters or fewer.' });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Bio: ${contactCheck.reason}` });
      }
      nextBio = cleaned;
    }

    let nextShopName: string | undefined;
    if ('shopName' in body && body.shopName !== undefined && body.shopName !== null) {
      const cleaned = String(body.shopName).trim();
      if (cleaned.length < 2 || cleaned.length > 120) {
        return res.status(400).json({ status: false, message: 'Shop name must be between 2 and 120 characters.' });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop name: ${contactCheck.reason}` });
      }
      nextShopName = cleaned;
    }

    let nextShopBio: string | undefined;
    if ('shopBio' in body && body.shopBio !== undefined && body.shopBio !== null) {
      const cleaned = String(body.shopBio).trim();
      if (cleaned.length > 1000) {
        return res.status(400).json({ status: false, message: 'Shop bio must be 1000 characters or fewer.' });
      }
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Shop bio: ${contactCheck.reason}` });
      }
      nextShopBio = cleaned;
    }

    let nextCampus: string | undefined;
    if ('campus' in body) {
      nextCampus = String(body.campus || '').trim().slice(0, 120);
    }

    let nextArea: string | undefined;
    if ('locationArea' in body) {
      const cleaned = String(body.locationArea || '').trim().slice(0, 100);
      const contactCheck = containsForbiddenContactInfo(cleaned);
      if (contactCheck.blocked) {
        return res.status(400).json({ status: false, message: `Location area: ${contactCheck.reason}` });
      }
      nextArea = cleaned;
    }

    let nextInterests: string[] | undefined;
    if ('interests' in body) {
      if (!Array.isArray(body.interests)) {
        return res.status(400).json({ status: false, message: 'Interests must be a list of allowed tags.' });
      }
      const allowedSet = new Set<string>(PROFILE_INTERESTS);
      const deduped: string[] = [];
      for (const item of body.interests) {
        const s = String(item || '').trim();
        if (!allowedSet.has(s)) {
          return res.status(400).json({ status: false, message: `Invalid interest tag: "${s}".` });
        }
        if (!deduped.includes(s)) deduped.push(s);
      }
      nextInterests = deduped.slice(0, 10);
    }

    let nextAvatarUrl: string | null | undefined;
    if ('avatarUrl' in body) {
      const img = validateAndSanitizeImageInput(body.avatarUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextAvatarUrl = img.url;
    }

    let nextCoverUrl: string | null | undefined;
    if ('coverUrl' in body) {
      const img = validateAndSanitizeImageInput(body.coverUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextCoverUrl = img.url;
    }

    let nextLogoUrl: string | null | undefined;
    if ('logoUrl' in body) {
      const img = validateAndSanitizeImageInput(body.logoUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextLogoUrl = img.url;
    }

    let nextBannerUrl: string | null | undefined;
    if ('bannerUrl' in body) {
      const img = validateAndSanitizeImageInput(body.bannerUrl, true);
      if (!img.valid) return res.status(400).json({ status: false, message: img.message });
      nextBannerUrl = img.url;
    }

    const updated = await withTransaction(async client => {
      const uRes = await client.query('SELECT * FROM shopit_users WHERE id = $1 FOR UPDATE', [userId]);
      if (uRes.rows.length === 0) return null;
      const current = uRes.rows[0];

      let nextSlug = current.profile_slug;
      if (nextDisplayName && nextDisplayName !== current.display_name) {
        nextSlug = await generateUniqueProfileSlug(
          (sql: string, p?: any[]) => client.query(sql, p),
          nextDisplayName,
          userId
        );
      }

      const finalDisplayName = nextDisplayName ?? current.display_name ?? extractFirstName(current.name || 'Member');
      const finalAvatar = 'avatarUrl' in body ? nextAvatarUrl : current.avatar_url;
      const finalCover = 'coverUrl' in body ? nextCoverUrl : current.cover_url;
      const finalBio = nextBio ?? current.bio ?? '';
      const finalCampus = nextCampus ?? current.campus ?? '';
      const finalArea = nextArea ?? current.location_area ?? '';
      const finalInterests = nextInterests ?? parseJsonSafe<string[]>(current.interests, []);

      await client.query(
        `UPDATE shopit_users
         SET display_name = $1, profile_slug = $2, avatar_url = $3, cover_url = $4,
             bio = $5, campus = $6, location_area = $7, interests = $8::jsonb, updated_at = NOW()
         WHERE id = $9`,
        [
          finalDisplayName,
          nextSlug,
          finalAvatar ?? null,
          finalCover ?? null,
          finalBio,
          finalCampus,
          finalArea,
          JSON.stringify(finalInterests),
          userId,
        ]
      );

      const sRes = await client.query('SELECT * FROM shopit_sellers WHERE user_id = $1 OR id = $1 LIMIT 1', [userId]);
      if (sRes.rows.length > 0) {
        const sRow = sRes.rows[0];
        const finalShopName = nextShopName ?? sRow.shop_name;
        const finalShopBio = nextShopBio ?? (nextBio !== undefined && !sRow.bio ? nextBio : sRow.bio) ?? '';
        const finalSellerCampus = nextCampus || sRow.campus;
        const finalSellerArea = nextArea || sRow.location_area;
        const finalLogo = 'logoUrl' in body ? nextLogoUrl : ('avatarUrl' in body ? finalAvatar : sRow.logo_url);
        const finalBanner = 'bannerUrl' in body ? nextBannerUrl : ('coverUrl' in body ? finalCover : sRow.banner_url);

        await client.query(
          `UPDATE shopit_sellers
           SET shop_name = $1, bio = $2, campus = $3, location_area = $4,
               logo_url = $5, banner_url = $6, updated_at = NOW()
           WHERE id = $7`,
          [
            finalShopName,
            finalShopBio,
            finalSellerCampus,
            finalSellerArea,
            finalLogo ?? null,
            finalBanner ?? null,
            sRow.id,
          ]
        );

        if (nextShopName || nextCampus || nextArea) {
          await client.query(
            `UPDATE shopit_products
             SET seller_shop_name = COALESCE($1, seller_shop_name),
                 seller_campus = COALESCE($2, seller_campus),
                 location_area = COALESCE($3, location_area),
                 updated_at = NOW()
             WHERE seller_id = $4 OR seller_id = $5`,
            [nextShopName || null, nextCampus || null, nextArea || null, userId, sRow.id]
          );
        }
      }

      return {
        displayName: finalDisplayName,
        profileSlug: nextSlug,
        avatarUrl: finalAvatar || null,
        coverUrl: finalCover || null,
        bio: finalBio,
        campus: finalCampus,
        locationArea: finalArea,
        interests: finalInterests,
      };
    });

    if (!updated) {
      return res.status(404).json({ status: false, message: 'User account not found.' });
    }

    await logAuditEvent({
      action: 'PROFILE_UPDATED',
      actor: { id: userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id: userId },
      details: { displayName: updated.displayName, profileSlug: updated.profileSlug },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, profile: updated, message: 'Profile saved.' });
  } catch (err: any) {
    console.error('[PATCH /profiles/me Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to save profile changes.' });
  }
});

// ============================================================================
// PATCH /api/profiles/me/settings - Persist notification & privacy preferences
// ============================================================================
router.patch('/profiles/me/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['notificationPrefs', 'privacySettings']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { notificationPrefs, privacySettings } = check.obj;
    const userId = req.user!.userId;

    const uRes = await dbQuery(
      `SELECT u.age, u.notification_prefs, u.privacy_settings, s.under_18 as s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.id = $1`,
      [userId]
    );
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const row = uRes.rows[0];
    const isUnder18 = (row.age !== null && row.age !== undefined && Number(row.age) < 18) || Boolean(row.s_under_18);

    const currentNotif = sanitizeNotificationPrefs(parseJsonSafe(row.notification_prefs, DEFAULT_NOTIFICATION_PREFS));
    const nextNotif = notificationPrefs
      ? sanitizeNotificationPrefs(notificationPrefs, currentNotif)
      : currentNotif;

    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const currentPrivacy = sanitizePrivacySettings(parseJsonSafe(row.privacy_settings, basePrivacy), basePrivacy, isUnder18);
    const nextPrivacy = privacySettings
      ? sanitizePrivacySettings(privacySettings, currentPrivacy, isUnder18)
      : currentPrivacy;

    await dbQuery(
      `UPDATE shopit_users
       SET notification_prefs = $1::jsonb, privacy_settings = $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(nextNotif), JSON.stringify(nextPrivacy), userId]
    );

    await logAuditEvent({
      action: 'ACCOUNT_SETTINGS_UPDATED',
      actor: { id: userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id: userId },
      details: { isUnder18, profileVisibility: nextPrivacy.profileVisibility },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      notificationPrefs: nextNotif,
      privacySettings: nextPrivacy,
      isUnder18,
      message: isUnder18
        ? 'Settings saved. Minor safety defaults for follow requests and messages remain active.'
        : 'Account settings saved.',
    });
  } catch (err: any) {
    console.error('[PATCH /profiles/me/settings Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to update settings.' });
  }
});

// ============================================================================
// GET /api/profiles/me/export - Download personal account data as sanitized JSON
// ============================================================================
router.get('/profiles/me/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [uRes, sRes, ordRes, wishRes, cartRes, notifRes, convRes, folRes, blkRes] = await Promise.all([
      dbQuery(
        `SELECT id, email, name, display_name, profile_slug, role, age, bio, campus, location_area, interests,
                notification_prefs, privacy_settings, is_verified_email, created_at, last_login_at
         FROM shopit_users WHERE id = $1`,
        [userId]
      ),
      dbQuery(
        `SELECT id, shop_name, owner_name, bio, campus, location_state, location_city, location_area,
                is_verified_seller, verification_status, under_18, vacation_mode, rating, sales_count, created_at
         FROM shopit_sellers WHERE user_id = $1 OR id = $1`,
        [userId]
      ),
      dbQuery(
        `SELECT id, items, subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
                status, delivery_area, pickup_point, created_at, delivered_at, completed_at
         FROM shopit_orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [userId]
      ),
      dbQuery('SELECT product_ids, updated_at FROM shopit_wishlists WHERE user_id = $1', [userId]),
      dbQuery('SELECT items, updated_at FROM shopit_carts WHERE user_id = $1', [userId]),
      dbQuery('SELECT id, title, message, type, is_read, created_at FROM shopit_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [userId]),
      dbQuery('SELECT id, product_title, seller_shop_name, last_message, last_message_at, created_at FROM shopit_chat_conversations WHERE buyer_id = $1 OR seller_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]),
      dbQuery('SELECT follower_id, following_id, status, created_at FROM shopit_follows WHERE follower_id = $1 OR following_id = $1', [userId]),
      dbQuery('SELECT blocked_id, reason, created_at FROM shopit_blocks WHERE blocker_id = $1', [userId]),
    ]);

    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Account not found.' });
    }

    await logAuditEvent({
      action: 'USER_DATA_EXPORTED',
      actor: { id: userId, email: req.user!.email, role: req.user!.role },
      target: { type: 'user', id: userId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'Shop It Nigeria (https://shopitng.vercel.app)',
      account: uRes.rows[0],
      sellerProfile: sRes.rows[0] || null,
      orders: ordRes.rows,
      wishlist: wishRes.rows[0] || { product_ids: [] },
      cart: cartRes.rows[0] || { items: [] },
      notifications: notifRes.rows,
      conversations: convRes.rows,
      follows: folRes.rows,
      blockedAccounts: blkRes.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="shopit-my-data-${new Date().toISOString().split('T')[0]}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err: any) {
    console.error('[GET /profiles/me/export Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to prepare your data export.' });
  }
});

// ============================================================================
// DELETE /api/profiles/me - Password-confirmed account deletion & anonymization
// ============================================================================
router.delete('/profiles/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['password', 'confirmation']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { password, confirmation } = check.obj;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ status: false, message: 'Please type DELETE to confirm account deletion.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ status: false, message: 'Your current password is required to delete your account.' });
    }

    const userId = req.user!.userId;
    const uRes = await dbQuery('SELECT id, email, role, password_hash FROM shopit_users WHERE id = $1', [userId]);
    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Account not found.' });
    }

    const userRow = uRes.rows[0];
    if (!verifyPassword(password.trim(), userRow.password_hash)) {
      return res.status(401).json({ status: false, message: 'Incorrect password.' });
    }

    await revokeUserSessions(userId);

    const anonEmail = `deleted_${userId}@deleted.shopit.local`;
    const anonSlug = `deleted-${userId}`;

    await withTransaction(async client => {
      const sellerRows = await client.query('SELECT id FROM shopit_sellers WHERE user_id = $1 OR id = $1', [userId]);
      const sellerTargetIds = Array.from(new Set([userId, ...sellerRows.rows.map((r: any) => r.id)]));
      const sellerIn = buildInClause(sellerTargetIds);

      await client.query('DELETE FROM shopit_follows WHERE follower_id = $1 OR following_id = $1', [userId]);
      await client.query('DELETE FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1', [userId]);
      await client.query('DELETE FROM shopit_mutes WHERE muter_id = $1 OR muted_id = $1', [userId]);
      await client.query('DELETE FROM shopit_wishlists WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM shopit_carts WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM shopit_notifications WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM shopit_restock_alerts WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM shopit_files WHERE owner_id = $1', [userId]);
      await client.query('DELETE FROM shopit_verifications WHERE user_id = $1 OR seller_id = $1', [userId]);
      await client.query(`DELETE FROM shopit_verification_documents WHERE seller_id IN (${sellerIn.placeholders})`, sellerIn.params);

      await client.query(
        `UPDATE shopit_products
         SET is_paused = true, is_draft = true, is_pinned = false, updated_at = NOW()
         WHERE seller_id IN (${sellerIn.placeholders})`,
        sellerIn.params
      );

      await client.query(
        `UPDATE shopit_sellers
         SET shop_name = 'Deleted Shop', owner_name = 'Deleted User', email = $1,
             bio = '', logo_url = NULL, banner_url = NULL, guardian_name = NULL, guardian_phone = NULL,
             vacation_mode = true, updated_at = NOW()
         WHERE user_id = $2 OR id = $2`,
        [anonEmail, userId]
      );

      await client.query(
        `UPDATE shopit_orders
         SET buyer_name = 'Deleted User', buyer_email = NULL, buyer_masked_id = 'Deleted User', updated_at = NOW()
         WHERE buyer_id = $1`,
        [userId]
      );

      await client.query(
        `UPDATE shopit_disputes
         SET buyer_name = 'Deleted User', buyer_masked_id = 'Deleted User', updated_at = NOW()
         WHERE buyer_id = $1`,
        [userId]
      );

      await client.query(
        `UPDATE shopit_users
         SET email = $1, name = 'Deleted User', display_name = 'Deleted User', profile_slug = $2,
             avatar_url = NULL, cover_url = NULL, bio = NULL, campus = NULL, location_area = NULL,
             interests = '[]'::jsonb, guardian_name = NULL, is_banned = true, ban_reason = 'Account deleted by user',
             deleted_at = NOW(), token_version = COALESCE(token_version, 1) + 1, updated_at = NOW()
         WHERE id = $3`,
        [anonEmail, anonSlug, userId]
      );

      await client.query('DELETE FROM shopit_sessions WHERE user_id = $1', [userId]);
    });

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    await logAuditEvent({
      action: 'ACCOUNT_DELETED_BY_USER',
      actor: { id: userId, email: userRow.email, role: userRow.role },
      target: { type: 'user', id: userId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'Your account has been permanently deleted and personal info anonymized.' });
  } catch (err: any) {
    console.error('[DELETE /profiles/me Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to delete your account.' });
  }
});

// ============================================================================
// SOCIAL: FOLLOWS, FOLLOW REQUESTS, FOLLOWING FEED & BLOCKS
// ============================================================================

async function resolveTargetUserRecord(rawTarget: string) {
  const clean = String(rawTarget || '').trim();
  if (!clean) return null;
  const res = await dbQuery(
    `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.age, u.privacy_settings,
            u.notification_prefs, u.is_banned, u.deleted_at, s.id as s_id, s.under_18 as s_under_18
     FROM shopit_users u
     LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
     WHERE u.id = $1 OR s.id = $1 OR LOWER(u.profile_slug) = LOWER($1)
     LIMIT 1`,
    [clean]
  );
  return res.rows[0] || null;
}

async function getAcceptedFollowersCount(targetUserId: string): Promise<number> {
  const res = await dbQuery(
    `SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'`,
    [targetUserId]
  );
  return parseInt(String(res.rows[0]?.total || '0'), 10);
}

// POST /api/follows - Follow a member/seller (enforces DB rate limit, youth safety, mutual alerts & concurrency safety)
router.post('/follows', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['targetUserId']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || '').trim();
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: 'targetUserId is required.' });
    }

    const viewer = req.user!;
    const rl = await checkAndRecordRateLimit(`follows:${viewer.userId}`, 60, 60 * 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({
        status: false,
        message: 'Too many follow requests right now. Please wait before following more accounts.',
      });
    }

    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at || target.is_banned) {
      return res.status(404).json({ status: false, message: 'Account not found or unavailable.' });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: 'You cannot follow your own account.' });
    }

    const blkRes = await dbQuery(
      `SELECT id FROM shopit_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [viewer.userId, target.id]
    );
    if (blkRes.rows.length > 0) {
      return res.status(403).json({ status: false, message: 'Cannot follow this user due to a block.' });
    }

    const viewerRes = await dbQuery(
      'SELECT age, display_name, name, profile_slug FROM shopit_users WHERE id = $1 LIMIT 1',
      [viewer.userId]
    );
    const vRow = viewerRes.rows[0];

    const isTargetUnder18 =
      (target.age !== null && target.age !== undefined && Number(target.age) < 18) || Boolean(target.s_under_18);
    const viewerAge = vRow?.age !== null && vRow?.age !== undefined ? Number(vRow.age) : null;
    const isViewerAdult = viewerAge === null || !Number.isFinite(viewerAge) || viewerAge >= 18;

    if (isTargetUnder18 && isViewerAdult) {
      return res.status(403).json({
        status: false,
        message: 'For youth safety, adults cannot follow or send follow requests to under-18 accounts.',
      });
    }

    const existing = await dbQuery(
      'SELECT id, status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
      [viewer.userId, target.id]
    );
    if (existing.rows.length > 0) {
      const existingStatus = existing.rows[0].status === 'accepted' ? 'accepted' : 'pending';
      const followersCount = await getAcceptedFollowersCount(target.id);
      return res.json({ status: true, followStatus: existingStatus, followersCount });
    }

    const basePrivacy = isTargetUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacy = sanitizePrivacySettings(parseJsonSafe(target.privacy_settings, basePrivacy), basePrivacy, isTargetUnder18);

    const followStatus: 'pending' | 'accepted' =
      isTargetUnder18 || privacy.whoCanFollow === 'approval' ? 'pending' : 'accepted';
    const followId = `fol_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const insRes = await dbQuery(
      `INSERT INTO shopit_follows (id, follower_id, following_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (follower_id, following_id) DO NOTHING
       RETURNING id`,
      [followId, viewer.userId, target.id, followStatus]
    );

    if (insRes.rows.length === 0) {
      const raceRes = await dbQuery(
        'SELECT status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
        [viewer.userId, target.id]
      );
      const settledStatus = raceRes.rows[0]?.status === 'accepted' ? 'accepted' : 'pending';
      const followersCount = await getAcceptedFollowersCount(target.id);
      return res.json({ status: true, followStatus: settledStatus, followersCount });
    }

    try {
      const muteRes = await dbQuery(
        'SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1',
        [target.id, viewer.userId]
      );
      const isMuted = muteRes.rows.length > 0;

      if (!isMuted) {
        const vName = vRow?.display_name || extractFirstName(vRow?.name || viewer.name || 'Someone');
        const vSlug = vRow?.profile_slug || viewer.userId;

        const reverseRes = await dbQuery(
          `SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`,
          [target.id, viewer.userId]
        );
        const isMutualFollowBack = followStatus === 'accepted' && reverseRes.rows.length > 0;

        const notifTitle =
          followStatus === 'pending'
            ? 'New Follow Request'
            : isMutualFollowBack
            ? 'Follow Back — Friends!'
            : 'New Follower';
        const notifMsg =
          followStatus === 'pending'
            ? `${vName} requested to follow your Shop It profile.`
            : isMutualFollowBack
            ? `${vName} followed you back — you're now friends on Shop It!`
            : `${vName} started following you on Shop It.`;

        await dbQuery(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, $3, $4, 'info', false, $5, NOW())`,
          [
            `notif_fol_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            target.id,
            notifTitle,
            notifMsg,
            `/?profile=${encodeURIComponent(vSlug)}`,
          ]
        );

        const targetEmailRes = await dbQuery(
          'SELECT email, display_name, name, notification_prefs FROM shopit_users WHERE id = $1 LIMIT 1',
          [target.id]
        );
        const tEmailRow = targetEmailRes.rows[0];
        const tPrefs = sanitizeNotificationPrefs(
          parseJsonSafe(tEmailRow?.notification_prefs, DEFAULT_NOTIFICATION_PREFS)
        );
        if (
          tPrefs.emailFollowers &&
          tEmailRow?.email &&
          !String(tEmailRow.email).endsWith('.local')
        ) {
          const tName = tEmailRow.display_name || extractFirstName(tEmailRow.name || 'Friend');
          sendBrevoDirect(
            tEmailRow.email,
            `Shop It: ${notifTitle}`,
            `Hi ${tName},\n\n${notifMsg}\n\nVisit Shop It to view their profile.`,
            `<p>Hi ${tName},</p><p>${notifMsg}</p>`,
            tName
          ).catch(() => {});
        }
      }
    } catch {}

    const followersCount = await getAcceptedFollowersCount(target.id);
    return res.status(201).json({ status: true, followStatus, followersCount });
  } catch (err: any) {
    console.error('[POST /follows Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to follow user.' });
  }
});

// DELETE /api/follows/:targetUserId - Unfollow or cancel pending follow request
router.delete('/follows/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const rawTarget = String(req.params.targetUserId || '').trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedTargetId = target?.id || rawTarget;

    await dbQuery(
      'DELETE FROM shopit_follows WHERE follower_id = $1 AND following_id = $2',
      [viewer.userId, resolvedTargetId]
    );

    const followersCount = await getAcceptedFollowersCount(resolvedTargetId);
    return res.json({ status: true, followStatus: 'none', followersCount });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to unfollow user.' });
  }
});

// GET /api/follows/requests - List pending incoming follow requests
router.get('/follows/requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const resRows = await dbQuery(
      `SELECT f.id, f.follower_id, f.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = f.follower_id
       WHERE f.following_id = $1 AND f.status = 'pending' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE
       ORDER BY f.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );

    return res.json({
      status: true,
      requests: resRows.rows.map((r: any) => ({
        id: r.id,
        followerId: r.follower_id,
        displayName: r.display_name || extractFirstName(r.name || 'Member'),
        profileSlug: r.profile_slug || r.follower_id,
        avatarUrl: r.avatar_url || null,
        campus: r.campus || '',
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to load follow requests.' });
  }
});

// PATCH /api/follows/requests/:followerId - Accept or decline a follow request
router.patch('/follows/requests/:followerId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['action']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const action = String(check.obj.action || '').trim();
    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ status: false, message: 'action must be accept or decline.' });
    }

    const viewer = req.user!;
    const followerId = String(req.params.followerId || '').trim();

    const existing = await dbQuery(
      `SELECT id FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'pending' LIMIT 1`,
      [followerId, viewer.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Pending follow request not found.' });
    }

    if (action === 'accept') {
      await dbQuery(
        `UPDATE shopit_follows SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      try {
        const myRes = await dbQuery('SELECT display_name, name, profile_slug FROM shopit_users WHERE id = $1', [viewer.userId]);
        const myRow = myRes.rows[0];
        const myName = myRow?.display_name || extractFirstName(myRow?.name || viewer.name || 'Someone');
        const mySlug = myRow?.profile_slug || viewer.userId;
        await dbQuery(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, 'Follow Request Accepted', $3, 'success', false, $4, NOW())`,
          [
            `notif_fol_acc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            followerId,
            `${myName} accepted your follow request.`,
            `/?profile=${encodeURIComponent(mySlug)}`,
          ]
        );
      } catch {}
    } else {
      await dbQuery('DELETE FROM shopit_follows WHERE id = $1', [existing.rows[0].id]);
    }

    const followersCount = await getAcceptedFollowersCount(viewer.userId);
    return res.json({ status: true, action, followersCount });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to process follow request.' });
  }
});

// GET /api/feed/following - Live product feed from shops the caller follows
router.get('/feed/following', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    const offset = (page - 1) * limit;

    const [folRes, blkRes] = await Promise.all([
      dbQuery(`SELECT following_id FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'`, [viewer.userId]),
      dbQuery(
        `SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1`,
        [viewer.userId]
      ),
    ]);

    const blockedSet = new Set<string>();
    for (const b of blkRes.rows) {
      if (b.blocker_id !== viewer.userId) blockedSet.add(b.blocker_id);
      if (b.blocked_id !== viewer.userId) blockedSet.add(b.blocked_id);
    }

    const followedUserIds: string[] = Array.from(
      new Set<string>(folRes.rows.map((r: any) => String(r.following_id)).filter((id: string) => id && !blockedSet.has(id)))
    );

    if (followedUserIds.length === 0) {
      return res.json({ status: true, products: [], total: 0, followingCount: 0, page, totalPages: 1 });
    }

    const uIn = buildInClause(followedUserIds);
    const sRes = await dbQuery(
      `SELECT id, user_id FROM shopit_sellers WHERE user_id IN (${uIn.placeholders}) OR id IN (${uIn.placeholders})`,
      uIn.params
    );
    const sellerTargetIds = Array.from(
      new Set([...followedUserIds, ...sRes.rows.map((s: any) => String(s.id))])
    );
    const pIn = buildInClause(sellerTargetIds);

    const countRes = await dbQuery(
      `SELECT COUNT(*) as total
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${pIn.placeholders})
         AND (p.is_paused IS NOT TRUE)
         AND (p.is_draft IS NOT TRUE)
         AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))`,
      pIn.params
    );
    const total = parseInt(String(countRes.rows[0]?.total || '0'), 10);

    const rowsRes = await dbQuery(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${pIn.placeholders})
         AND (p.is_paused IS NOT TRUE)
         AND (p.is_draft IS NOT TRUE)
         AND (u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))
       ORDER BY p.created_at DESC
       LIMIT $${pIn.params.length + 1} OFFSET $${pIn.params.length + 2}`,
      [...pIn.params, limit, offset]
    );

    const products = rowsRes.rows.map((r: any) =>
      mapProductRow(
        r,
        r.u_display_name || extractFirstName(r.u_name || r.seller_shop_name || 'Artisan'),
        r.s_logo_url || r.u_avatar_url || undefined,
        r.u_profile_slug || undefined
      )
    );

    return res.json({
      status: true,
      products,
      total,
      followingCount: followedUserIds.length,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    console.error('[GET /feed/following Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to load Following feed.' });
  }
});

// GET /api/blocks - List accounts blocked by current user
router.get('/blocks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const rows = await dbQuery(
      `SELECT b.id, b.blocked_id, b.reason, b.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url
       FROM shopit_blocks b
       LEFT JOIN shopit_users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );

    return res.json({
      status: true,
      blocks: rows.rows.map((r: any) => ({
        id: r.id,
        blockedUserId: r.blocked_id,
        displayName: r.display_name || extractFirstName(r.name || 'Member'),
        profileSlug: r.profile_slug || r.blocked_id,
        avatarUrl: r.avatar_url || null,
        reason: r.reason || '',
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to fetch blocked accounts.' });
  }
});

// POST /api/blocks - Block a user & automatically remove follows in both directions
router.post('/blocks', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['targetUserId', 'reason']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || '').trim();
    const reason = check.obj.reason ? String(check.obj.reason).trim().slice(0, 200) : null;
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: 'targetUserId is required.' });
    }

    const viewer = req.user!;
    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: 'User account not found.' });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: 'You cannot block yourself.' });
    }

    await withTransaction(async client => {
      const blkId = `blk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await client.query(
        `INSERT INTO shopit_blocks (id, blocker_id, blocked_id, reason, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = COALESCE($4, shopit_blocks.reason)`,
        [blkId, viewer.userId, target.id, reason]
      );
      await client.query(
        `DELETE FROM shopit_follows
         WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
        [viewer.userId, target.id]
      );
    });

    await logAuditEvent({
      action: 'USER_BLOCKED',
      actor: { id: viewer.userId, email: viewer.email, role: viewer.role },
      target: { type: 'user', id: target.id },
      details: { reason },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      status: true,
      blockedUserId: target.id,
      message: `${target.display_name || extractFirstName(target.name || 'User')} has been blocked.`,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to block user.' });
  }
});

// DELETE /api/blocks/:targetUserId - Unblock a user
router.delete('/blocks/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const rawTarget = String(req.params.targetUserId || '').trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedId = target?.id || rawTarget;

    await dbQuery('DELETE FROM shopit_blocks WHERE blocker_id = $1 AND blocked_id = $2', [
      viewer.userId,
      resolvedId,
    ]);

    await logAuditEvent({
      action: 'USER_UNBLOCKED',
      actor: { id: viewer.userId, email: viewer.email, role: viewer.role },
      target: { type: 'user', id: resolvedId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'User unblocked.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to unblock user.' });
  }
});

// Helper for followers/following list privacy enforcement
async function handleFollowListRoute(
  req: AuthenticatedRequest,
  res: Response,
  mode: 'followers' | 'following'
) {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    const target = await resolveTargetUserRecord(rawSlug);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: 'Profile not found.' });
    }
    const viewer = req.user;
    const isOwner = Boolean(viewer && viewer.userId === target.id);
    const isAdmin = Boolean(viewer && viewer.role === 'admin');
    if (target.is_banned && !isAdmin) {
      return res.status(404).json({ status: false, message: 'Profile not found.' });
    }

    if (viewer && !isOwner && !isAdmin) {
      const blkRes = await dbQuery(
        `SELECT id FROM shopit_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
        [viewer.userId, target.id]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: 'This profile is unavailable.' });
      }
    }

    const isUnder18 =
      (target.age !== null && target.age !== undefined && Number(target.age) < 18) || Boolean(target.s_under_18);
    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacy = sanitizePrivacySettings(parseJsonSafe(target.privacy_settings, basePrivacy), basePrivacy, isUnder18);

    if (privacy.profileVisibility === 'followers' && !isOwner && !isAdmin) {
      let acceptedFollow = false;
      if (viewer) {
        const fCheck = await dbQuery(
          `SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`,
          [viewer.userId, target.id]
        );
        acceptedFollow = fCheck.rows.length > 0;
      }
      if (!acceptedFollow) {
        return res.status(403).json({ status: false, message: 'Only accepted followers can view this profile.' });
      }
    }

    if (mode === 'followers' && !privacy.showFollowersList && !isOwner && !isAdmin) {
      return res.status(403).json({ status: false, message: 'This member has hidden their followers list.' });
    }
    if (mode === 'following' && !privacy.showFollowingList && !isOwner && !isAdmin) {
      return res.status(403).json({ status: false, message: 'This member has hidden who they follow.' });
    }

    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
    const searchQ = String(req.query.q || '').trim().toLowerCase();

    const joinCol = mode === 'followers' ? 'f.follower_id' : 'f.following_id';
    const filterCol = mode === 'followers' ? 'f.following_id' : 'f.follower_id';

    const params: any[] = [target.id];
    let searchClause = '';
    if (searchQ) {
      params.push(`%${searchQ}%`);
      const pIdx = params.length;
      searchClause = ` AND (
        LOWER(COALESCE(u.display_name, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(u.name, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(u.profile_slug, '')) LIKE $${pIdx}
        OR LOWER(COALESCE(s.shop_name, '')) LIKE $${pIdx}
      )`;
    }

    const countRes = await dbQuery(
      `SELECT COUNT(*) as total
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = ${joinCol}
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE ${filterCol} = $1 AND f.status = 'accepted' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE${searchClause}`,
      params
    );
    const total = parseInt(String(countRes.rows[0]?.total || '0'), 10);

    const rowsRes = await dbQuery(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.role, s.shop_name, f.created_at
       FROM shopit_follows f
       JOIN shopit_users u ON u.id = ${joinCol}
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE ${filterCol} = $1 AND f.status = 'accepted' AND u.deleted_at IS NULL AND u.is_banned IS NOT TRUE${searchClause}
       ORDER BY f.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const listedIds: string[] = rowsRes.rows.map((r: any) => String(r.id)).filter(Boolean);
    const viewerFollowingMap = new Map<string, 'pending' | 'accepted'>();
    const viewerFollowedBySet = new Set<string>();
    if (viewer && listedIds.length > 0) {
      const lIn = buildInClause(listedIds, 2);
      const [vfRes, vfbRes] = await Promise.all([
        dbQuery(
          `SELECT following_id, status FROM shopit_follows WHERE follower_id = $1 AND following_id IN (${lIn.placeholders})`,
          [viewer.userId, ...lIn.params]
        ),
        dbQuery(
          `SELECT follower_id FROM shopit_follows WHERE following_id = $1 AND follower_id IN (${lIn.placeholders}) AND status = 'accepted'`,
          [viewer.userId, ...lIn.params]
        ),
      ]);
      for (const r of vfRes.rows) {
        viewerFollowingMap.set(String(r.following_id), r.status === 'accepted' ? 'accepted' : 'pending');
      }
      for (const r of vfbRes.rows) {
        viewerFollowedBySet.add(String(r.follower_id));
      }
    }

    return res.json({
      status: true,
      total,
      users: rowsRes.rows.map((r: any) => {
        const vfStatus = viewer ? viewerFollowingMap.get(String(r.id)) || 'none' : undefined;
        const isMutual = viewer ? vfStatus === 'accepted' && viewerFollowedBySet.has(String(r.id)) : false;
        return {
          id: r.id,
          displayName: r.display_name || extractFirstName(r.name || 'Member'),
          profileSlug: r.profile_slug || r.id,
          avatarUrl: r.avatar_url || null,
          campus: r.campus || '',
          role: r.role,
          shopName: r.shop_name || undefined,
          followedAt: r.created_at,
          viewerFollowStatus: vfStatus,
          isMutual,
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: `Failed to fetch ${mode} list.` });
  }
}

router.get('/profiles/:slug/followers', optionalAuth, (req: AuthenticatedRequest, res: Response) =>
  handleFollowListRoute(req, res, 'followers')
);

router.get('/profiles/:slug/following', optionalAuth, (req: AuthenticatedRequest, res: Response) =>
  handleFollowListRoute(req, res, 'following')
);

// ============================================================================
// DISCOVERY, SAFE PEOPLE/SHOP SEARCH & MUTES
// ============================================================================

// GET /api/profiles/discover/suggested - Suggested makers & shops (real DB sellers only, no under-18)
router.get('/profiles/discover/suggested', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user;
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit || '8'), 10) || 8));

    let viewerCampus = '';
    const excludeUserIds = new Set<string>();

    if (viewer) {
      excludeUserIds.add(viewer.userId);
      const [vRes, folRes, blkRes] = await Promise.all([
        dbQuery('SELECT campus FROM shopit_users WHERE id = $1 LIMIT 1', [viewer.userId]),
        dbQuery('SELECT following_id FROM shopit_follows WHERE follower_id = $1', [viewer.userId]),
        dbQuery('SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1', [viewer.userId]),
      ]);
      viewerCampus = String(vRes.rows[0]?.campus || '').trim().toLowerCase();
      for (const f of folRes.rows) excludeUserIds.add(String(f.following_id));
      for (const b of blkRes.rows) {
        if (b.blocker_id !== viewer.userId) excludeUserIds.add(String(b.blocker_id));
        if (b.blocked_id !== viewer.userId) excludeUserIds.add(String(b.blocked_id));
      }
    }

    const rowsRes = await dbQuery(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.age,
              s.id as s_id, s.shop_name, s.campus as s_campus, s.bio as s_bio, u.bio as u_bio,
              s.logo_url as s_logo_url, s.is_verified_seller, s.verification_status,
              s.under_18 as s_under_18, s.rating as s_rating
       FROM shopit_users u
       JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.deleted_at IS NULL
         AND u.is_banned IS NOT TRUE
         AND COALESCE(s.vacation_mode, false) = false
         AND COALESCE(s.under_18, false) = false
         AND (u.age IS NULL OR u.age >= 18)
       ORDER BY COALESCE(s.is_verified_seller, false) DESC, COALESCE(s.rating, 5.0) DESC, u.created_at DESC
       LIMIT 60`
    );

    const seen = new Set<string>();
    const baseCandidates = rowsRes.rows.filter((r: any) => {
      if (excludeUserIds.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const followerCountMap = new Map<string, number>();
    const productCountMap = new Map<string, number>();

    if (baseCandidates.length > 0) {
      const userIds = baseCandidates.map((r: any) => String(r.id));
      const sellerRefs = baseCandidates.flatMap((r: any) => [String(r.id), String(r.s_id || '')]).filter(Boolean);
      const folIn = buildInClause(userIds, 1);
      const prodIn = buildInClause(sellerRefs, 1);

      const [folCountsRes, prodCountsRes] = await Promise.all([
        dbQuery(
          `SELECT following_id, COUNT(*) as cnt
           FROM shopit_follows
           WHERE status = 'accepted' AND following_id IN (${folIn.placeholders})
           GROUP BY following_id`,
          folIn.params
        ),
        dbQuery(
          `SELECT seller_id, COUNT(*) as cnt
           FROM shopit_products
           WHERE is_paused IS NOT TRUE AND is_draft IS NOT TRUE AND seller_id IN (${prodIn.placeholders})
           GROUP BY seller_id`,
          prodIn.params
        ),
      ]);

      for (const fr of folCountsRes.rows) {
        followerCountMap.set(String(fr.following_id), parseInt(String(fr.cnt || '0'), 10) || 0);
      }
      for (const pr of prodCountsRes.rows) {
        productCountMap.set(
          String(pr.seller_id),
          (productCountMap.get(String(pr.seller_id)) || 0) + (parseInt(String(pr.cnt || '0'), 10) || 0)
        );
      }
    }

    const candidates = baseCandidates
      .map((r: any) => {
        const campus = r.campus || r.s_campus || '';
        const isSameCampus = Boolean(viewerCampus && campus.trim().toLowerCase() === viewerCampus);
        const isVerified = Boolean(
          r.is_verified_seller || r.verification_status === 'verified' || r.verification_status === 'approved'
        );
        const prodCountBySeller = r.s_id && r.s_id !== r.id ? productCountMap.get(String(r.s_id)) || 0 : 0;
        const productCount = (productCountMap.get(String(r.id)) || 0) + prodCountBySeller;
        const followersCount = followerCountMap.get(String(r.id)) || 0;
        const rating = parseFloat(String(r.s_rating || '5.0'));
        const score = (isSameCampus ? 50 : 0) + (isVerified ? 25 : 0) + Math.min(20, productCount * 4) + rating * 2;
        return {
          id: r.id,
          displayName: r.display_name || extractFirstName(r.name || 'Seller'),
          profileSlug: r.profile_slug || r.id,
          shopName: r.shop_name || 'Artisan Shop',
          avatarUrl: r.avatar_url || r.s_logo_url || null,
          campus,
          bio: String(r.u_bio || r.s_bio || '').slice(0, 120),
          isVerifiedSeller: isVerified,
          productCount,
          followersCount,
          rating,
          isSameCampus,
          _score: score,
        };
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...rest }: any) => rest);

    return res.json({ status: true, sellers: candidates });
  } catch (err: any) {
    console.error('[GET /profiles/discover/suggested Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to load suggested sellers.' });
  }
});

// GET /api/profiles/search?q=... - Search members & shops by public fields only (never email/phone)
router.get('/profiles/search', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12));
    if (q.length < 2) {
      return res.json({ status: true, profiles: [] });
    }

    const viewer = req.user;
    const blockedSet = new Set<string>();
    const followMap = new Map<string, 'pending' | 'accepted'>();

    if (viewer) {
      const [blkRes, folRes] = await Promise.all([
        dbQuery('SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id = $1 OR blocked_id = $1', [viewer.userId]),
        dbQuery('SELECT following_id, status FROM shopit_follows WHERE follower_id = $1', [viewer.userId]),
      ]);
      for (const b of blkRes.rows) {
        if (b.blocker_id !== viewer.userId) blockedSet.add(String(b.blocker_id));
        if (b.blocked_id !== viewer.userId) blockedSet.add(String(b.blocked_id));
      }
      for (const f of folRes.rows) {
        followMap.set(String(f.following_id), f.status === 'accepted' ? 'accepted' : 'pending');
      }
    }

    const pattern = `%${q.toLowerCase()}%`;
    const rowsRes = await dbQuery(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.avatar_url, u.campus, u.role, u.age,
              s.id as s_id, s.shop_name, s.logo_url as s_logo_url, s.campus as s_campus,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.deleted_at IS NULL
         AND u.is_banned IS NOT TRUE
         AND COALESCE(s.under_18, false) = false
         AND (u.age IS NULL OR u.age >= 18)
         AND (
           LOWER(COALESCE(u.display_name, '')) LIKE $1
           OR LOWER(COALESCE(u.name, '')) LIKE $1
           OR LOWER(COALESCE(u.profile_slug, '')) LIKE $1
           OR LOWER(COALESCE(u.campus, '')) LIKE $1
           OR LOWER(COALESCE(s.shop_name, '')) LIKE $1
         )
       ORDER BY COALESCE(s.is_verified_seller, false) DESC, u.created_at DESC
       LIMIT 50`,
      [pattern]
    );

    const seen = new Set<string>();
    const filteredRows = rowsRes.rows
      .filter((r: any) => {
        if (blockedSet.has(r.id) || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .slice(0, limit);

    const searchFollowerCountMap = new Map<string, number>();
    if (filteredRows.length > 0) {
      const fIn = buildInClause(filteredRows.map((r: any) => String(r.id)), 1);
      const fcRes = await dbQuery(
        `SELECT following_id, COUNT(*) as cnt
         FROM shopit_follows
         WHERE status = 'accepted' AND following_id IN (${fIn.placeholders})
         GROUP BY following_id`,
        fIn.params
      );
      for (const fr of fcRes.rows) {
        searchFollowerCountMap.set(String(fr.following_id), parseInt(String(fr.cnt || '0'), 10) || 0);
      }
    }

    const profiles = filteredRows.map((r: any) => ({
      id: r.id,
      displayName: r.display_name || extractFirstName(r.name || 'Member'),
      profileSlug: r.profile_slug || r.id,
      role: r.role,
      shopName: r.shop_name || undefined,
      avatarUrl: r.avatar_url || r.s_logo_url || null,
      campus: r.campus || r.s_campus || '',
      isVerifiedSeller: Boolean(
        r.is_verified_seller || r.verification_status === 'verified' || r.verification_status === 'approved'
      ),
      followersCount: searchFollowerCountMap.get(String(r.id)) || 0,
      followStatus: viewer ? followMap.get(r.id) || 'none' : 'none',
    }));

    return res.json({ status: true, profiles });
  } catch (err: any) {
    console.error('[GET /profiles/search Error]:', err?.message || err);
    return res.status(500).json({ status: false, message: 'Failed to search profiles.' });
  }
});

// GET /api/mutes - List muted users for the caller
router.get('/mutes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const rows = await dbQuery(
      `SELECT m.id, m.muted_id, m.created_at, u.name, u.display_name, u.profile_slug, u.avatar_url
       FROM shopit_mutes m
       JOIN shopit_users u ON u.id = m.muted_id
       WHERE m.muter_id = $1 AND u.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [viewer.userId]
    );
    return res.json({
      status: true,
      mutes: rows.rows.map((r: any) => ({
        id: r.id,
        mutedUserId: r.muted_id,
        displayName: r.display_name || extractFirstName(r.name || 'Member'),
        profileSlug: r.profile_slug || r.muted_id,
        avatarUrl: r.avatar_url || null,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to load muted accounts.' });
  }
});

// POST /api/mutes - Mute notifications from a specific account
router.post('/mutes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const check = rejectUnknownFields(req.body, ['targetUserId']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const rawTarget = String(check.obj.targetUserId || '').trim();
    if (!rawTarget) {
      return res.status(400).json({ status: false, message: 'targetUserId is required.' });
    }
    const viewer = req.user!;
    const target = await resolveTargetUserRecord(rawTarget);
    if (!target || target.deleted_at) {
      return res.status(404).json({ status: false, message: 'User account not found.' });
    }
    if (target.id === viewer.userId) {
      return res.status(400).json({ status: false, message: 'You cannot mute yourself.' });
    }

    const muteId = `mute_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await dbQuery(
      `INSERT INTO shopit_mutes (id, muter_id, muted_id, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (muter_id, muted_id) DO NOTHING`,
      [muteId, viewer.userId, target.id]
    );

    return res.status(201).json({
      status: true,
      mutedUserId: target.id,
      message: `Muted notifications from ${target.display_name || extractFirstName(target.name || 'User')}.`,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to mute user.' });
  }
});

// DELETE /api/mutes/:targetUserId - Unmute notifications from a user
router.delete('/mutes/:targetUserId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const viewer = req.user!;
    const rawTarget = String(req.params.targetUserId || '').trim();
    const target = await resolveTargetUserRecord(rawTarget);
    const resolvedId = target?.id || rawTarget;

    await dbQuery('DELETE FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2', [
      viewer.userId,
      resolvedId,
    ]);

    return res.json({ status: true, message: 'User unmuted.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to unmute user.' });
  }
});

// ============================================================================
// GET /api/profiles/:slug - Public / Privacy-Aware Profile View
// ============================================================================
router.get('/profiles/:slug', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawSlug = String(req.params.slug || '').trim();
    if (!rawSlug || rawSlug.length > 120) {
      return res.status(400).json({ status: false, message: 'Invalid profile identifier.' });
    }

    const viewer = req.user;

    const uRes = await dbQuery(
      `SELECT u.*, s.id as s_id, s.shop_name, s.bio as s_bio, s.campus as s_campus,
              s.location_area as s_area, s.location_state as s_state, s.location_city as s_city,
              s.logo_url as s_logo_url, s.banner_url as s_banner_url,
              s.is_verified_seller, s.verification_status, s.under_18 as s_under_18,
              s.vacation_mode, s.created_at as s_created_at, s.rating as s_rating
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE LOWER(u.profile_slug) = LOWER($1) OR u.id = $1 OR s.id = $1
       LIMIT 1`,
      [rawSlug]
    );

    if (uRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Profile not found.' });
    }

    const row = uRes.rows[0];
    if (row.deleted_at) {
      return res.status(404).json({ status: false, message: 'This account has been deleted.' });
    }

    const isOwner = Boolean(viewer && viewer.userId === row.id);
    const isAdmin = Boolean(viewer && viewer.role === 'admin');

    if (row.is_banned && !isAdmin) {
      return res.status(404).json({ status: false, message: 'This profile is currently unavailable.' });
    }

    // Check mutual block relationship
    if (viewer && !isOwner && !isAdmin) {
      const blkRes = await dbQuery(
        `SELECT blocker_id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [viewer.userId, row.id]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, blocked: true, message: 'This profile is unavailable.' });
      }
    }

    const displayName = row.display_name || extractFirstName(row.name || 'Member');
    const isUnder18 = (row.age !== null && row.age !== undefined && Number(row.age) < 18) || Boolean(row.s_under_18);
    const basePrivacy = isUnder18 ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS;
    const privacySettings = sanitizePrivacySettings(parseJsonSafe(row.privacy_settings, basePrivacy), basePrivacy, isUnder18);

    // Check viewer follow, mutual follow & mute status
    let followStatus: 'none' | 'pending' | 'accepted' = 'none';
    let isMutualFollow = false;
    let isMuted = false;
    if (viewer && !isOwner) {
      const [fRes, rfRes, mRes] = await Promise.all([
        dbQuery('SELECT status FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1', [
          viewer.userId,
          row.id,
        ]),
        dbQuery(
          "SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1",
          [row.id, viewer.userId]
        ),
        dbQuery('SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1', [
          viewer.userId,
          row.id,
        ]),
      ]);
      if (fRes.rows[0]?.status) {
        followStatus = fRes.rows[0].status === 'accepted' ? 'accepted' : 'pending';
      }
      isMutualFollow = followStatus === 'accepted' && rfRes.rows.length > 0;
      isMuted = mRes.rows.length > 0;
    }

    const sellerRow = row.s_id
      ? {
          id: row.s_id,
          shop_name: row.shop_name,
          bio: row.s_bio,
          campus: row.s_campus,
          location_area: row.s_area,
          location_state: row.s_state,
          location_city: row.s_city,
          logo_url: row.s_logo_url,
          banner_url: row.s_banner_url,
          is_verified_seller: row.is_verified_seller,
          verification_status: row.verification_status,
          vacation_mode: row.vacation_mode,
          created_at: row.s_created_at,
          rating: row.s_rating,
        }
      : null;

    // Enforce profileVisibility === 'followers'
    if (privacySettings.profileVisibility === 'followers' && !isOwner && !isAdmin && followStatus !== 'accepted') {
      const [followersRes, followingRes] = await Promise.all([
        dbQuery("SELECT COUNT(*) as total FROM shopit_follows WHERE following_id = $1 AND status = 'accepted'", [row.id]),
        dbQuery("SELECT COUNT(*) as total FROM shopit_follows WHERE follower_id = $1 AND status = 'accepted'", [row.id]),
      ]);
      return res.json({
        status: true,
        isRestricted: true,
        isOwner: false,
        profile: {
          id: row.id,
          displayName,
          profileSlug: row.profile_slug,
          role: row.role,
          avatarUrl: row.avatar_url || sellerRow?.logo_url || null,
          coverUrl: row.cover_url || sellerRow?.banner_url || null,
          campus: row.campus || sellerRow?.campus || '',
          followersCount: parseInt(String(followersRes.rows[0]?.total || '0'), 10),
          followingCount: parseInt(String(followingRes.rows[0]?.total || '0'), 10),
          followStatus,
          isMutualFollow,
          isMuted,
          whoCanFollow: privacySettings.whoCanFollow,
          memberSince: row.created_at,
          isRestricted: true,
          products: [],
          reviews: [],
          badges: [],
          interests: [],
        },
      });
    }

    const prodIds = sellerRow ? [row.id, sellerRow.id] : [row.id];
    const prodIn = buildInClause(prodIds);
    const pRes = await dbQuery(
      `SELECT * FROM shopit_products WHERE seller_id IN (${prodIn.placeholders}) ORDER BY is_pinned DESC, pinned_at DESC NULLS LAST, created_at DESC`,
      prodIn.params
    );
    const activeProds = pRes.rows.filter((p: any) => !p.is_paused && !p.is_draft);
    const visibleProds = isOwner || isAdmin ? pRes.rows : activeProds;

    const stats = await computeComputedSellerStats(row, sellerRow, activeProds, pRes.rows);
    const interests = parseJsonSafe<string[]>(row.interests, []);

    const avatarUrl = row.avatar_url || sellerRow?.logo_url || null;
    const coverUrl = row.cover_url || sellerRow?.banner_url || null;

    const mappedProducts = visibleProds.map((p: any) =>
      mapProductRow(p, displayName, avatarUrl || undefined, row.profile_slug)
    );

    let ownerWishlist: any[] = [];
    if (isOwner) {
      const wRes = await dbQuery('SELECT product_ids FROM shopit_wishlists WHERE user_id = $1', [row.id]);
      const wishIds = parseJsonSafe<string[]>(wRes.rows[0]?.product_ids, []);
      if (wishIds.length > 0) {
        const wishIn = buildInClause(wishIds);
        const wpRes = await dbQuery(
          `SELECT * FROM shopit_products WHERE id IN (${wishIn.placeholders}) AND is_paused IS NOT TRUE AND is_draft IS NOT TRUE`,
          wishIn.params
        );
        ownerWishlist = wpRes.rows.map((p: any) => mapProductRow(p));
      }
    }

    let pendingFollowRequestsCount = 0;
    if (isOwner) {
      const pendRes = await dbQuery(
        `SELECT COUNT(*) as total
         FROM shopit_follows f
         JOIN shopit_users fu ON fu.id = f.follower_id
         WHERE f.following_id = $1 AND f.status = 'pending' AND fu.deleted_at IS NULL AND fu.is_banned IS NOT TRUE`,
        [row.id]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      pendingFollowRequestsCount = parseInt(String(pendRes.rows[0]?.total || '0'), 10);
    }

    const completeness = isOwner
      ? computeProfileCompleteness({
          avatarUrl,
          coverUrl,
          bio: row.bio || sellerRow?.bio,
          campus: row.campus || sellerRow?.campus,
          locationArea: row.location_area || sellerRow?.location_area,
          interests,
          isVerifiedEmail: Boolean(row.is_verified_email),
          isSeller: Boolean(sellerRow),
          shopName: sellerRow?.shop_name,
          activeProductsCount: activeProds.length,
        })
      : undefined;

    return res.json({
      status: true,
      isRestricted: false,
      isOwner,
      profile: {
        id: row.id,
        displayName,
        profileSlug: row.profile_slug,
        role: row.role,
        avatarUrl,
        coverUrl,
        bio: row.bio || sellerRow?.bio || '',
        campus: row.campus || sellerRow?.campus || '',
        locationArea: row.location_area || sellerRow?.location_area || '',
        interests,
        memberSince: row.created_at,
        lastSeenAt:
          privacySettings.showLastSeen || isOwner || isAdmin
            ? row.last_seen_at || row.last_login_at || row.created_at
            : null,
        followStatus,
        isMutualFollow,
        isMuted,
        pendingFollowRequestsCount: isOwner ? pendingFollowRequestsCount : undefined,
        whoCanFollow: privacySettings.whoCanFollow,
        whoCanMessage: privacySettings.whoCanMessage,
        showFollowersList: privacySettings.showFollowersList,
        showFollowingList: privacySettings.showFollowingList,
        completeness,
        ...stats,
        products: mappedProducts,
        wishlistProducts: ownerWishlist,
        seller: sellerRow
          ? {
              id: sellerRow.id,
              shopName: sellerRow.shop_name,
              bio: sellerRow.bio || '',
              campus: sellerRow.campus || 'Lagos Mainland',
              locationArea: sellerRow.location_area || 'Yaba',
              isVerifiedSeller: stats.isVerifiedSeller,
              verificationStatus: sellerRow.verification_status || 'not_started',
              vacationMode: Boolean(sellerRow.vacation_mode),
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error('[GET /profiles/:slug Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Failed to load profile.' });
  }
});

export default router;

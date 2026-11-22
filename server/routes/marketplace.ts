import express, { Response } from 'express';
import crypto from 'crypto';
import {
  query as dbQuery,
  withTransaction,
  getPlatformSetting,
  DEFAULT_EMERGENCY_CONTROLS,
  DEFAULT_FEE_SETTINGS_DB,
} from '../db/postgres.js';
import { checkAndRecordRateLimit, verifyAndConsumeOtp } from '../db/otpStore.js';
import {
  requireAuth,
  requireAdmin,
  requireModerator,
  AuthenticatedRequest,
} from '../auth/middleware.js';
import { logAuditEvent } from '../auth/sessionStore.js';
import {
  nairaToKobo,
  koboToNaira,
  calculateConfiguredServiceFeeKobo,
  processUnshippedOrders,
  runLazyPendingOrderExpiry,
  restoreOrderStockInTx,
  sendBrevoDirect,
} from '../lib/payments.js';
import {
  containsForbiddenContactInfo,
  extractFirstName,
  sanitizePrivacySettings,
  sanitizeNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_SETTINGS,
  UNDER_18_PRIVACY_SETTINGS,
  rejectUnknownFields,
} from '../lib/validation.js';
import {
  evaluateMinorChatStart,
  evaluateMinorMessageSend,
  isMinorAccount,
} from '../config/minorSafety.js';

const router = express.Router();

function buildInClause(values: string[], startIndex = 1): { placeholders: string; params: string[] } {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return { placeholders: '$1', params: ['__none__'] };
  return {
    placeholders: unique.map((_, i) => `$${startIndex + i}`).join(', '),
    params: unique,
  };
}

interface ResolvedUserMeta {
  id: string;
  displayName: string;
  avatarUrl?: string;
  profileSlug?: string;
  isDeleted?: boolean;
}

async function batchLoadUserMeta(userIds: string[]): Promise<Map<string, ResolvedUserMeta>> {
  const map = new Map<string, ResolvedUserMeta>();
  const cleanIds = Array.from(new Set(userIds.filter(Boolean)));
  if (cleanIds.length === 0) return map;
  const { placeholders, params } = buildInClause(cleanIds);
  const res = await dbQuery(
    `SELECT u.id, u.name, u.display_name, u.avatar_url, u.profile_slug, u.deleted_at,
            s.id as seller_id, s.shop_name, s.logo_url
     FROM shopit_users u
     LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
     WHERE u.id IN (${placeholders}) OR s.id IN (${placeholders})`,
    params
  ).catch(() => ({ rows: [] }));

  for (const row of res.rows) {
    const isDeleted = Boolean(row.deleted_at);
    const meta: ResolvedUserMeta = {
      id: row.id,
      displayName: isDeleted ? 'Deleted User' : (row.display_name || extractFirstName(row.name || 'Member')),
      avatarUrl: isDeleted ? undefined : (row.avatar_url || row.logo_url || undefined),
      profileSlug: isDeleted ? undefined : (row.profile_slug || undefined),
      isDeleted,
    };
    map.set(row.id, meta);
    if (row.seller_id) {
      map.set(row.seller_id, meta);
    }
  }
  return map;
}

function mapReviewWithUsers(rev: any, userMap: Map<string, ResolvedUserMeta>) {
  const info = rev?.reviewerId ? userMap.get(String(rev.reviewerId)) : undefined;
  return {
    id: rev.id,
    productId: rev.productId,
    reviewerId: rev.reviewerId || undefined,
    reviewerName: info?.displayName || rev.reviewerName || 'Verified Shopper',
    reviewerAvatarUrl: info?.avatarUrl || rev.reviewerAvatarUrl || undefined,
    reviewerProfileSlug: info?.profileSlug || rev.reviewerProfileSlug || undefined,
    rating: Number(rev.rating || 5),
    comment: rev.comment || '',
    date: rev.date || '',
    verifiedPurchase: Boolean(rev.verifiedPurchase ?? true),
  };
}

async function notifyFollowersOfNewProduct(params: {
  sellerIds: string[];
  shopName: string;
  productId: string;
  productTitle: string;
}) {
  try {
    const cleanIds = Array.from(new Set(params.sellerIds.filter(Boolean)));
    if (cleanIds.length === 0) return;
    const { placeholders, params: sParams } = buildInClause(cleanIds);
    const [folRes, muteRes] = await Promise.all([
      dbQuery(
        `SELECT DISTINCT f.follower_id, u.email, u.display_name, u.name, u.notification_prefs
         FROM shopit_follows f
         JOIN shopit_users u ON u.id = f.follower_id
         WHERE f.following_id IN (${placeholders})
           AND f.status = 'accepted'
           AND u.deleted_at IS NULL
           AND u.is_banned IS NOT TRUE`,
        sParams
      ),
      dbQuery(
        `SELECT muter_id FROM shopit_mutes WHERE muted_id IN (${placeholders})`,
        sParams
      ),
    ]);
    const mutedFollowerSet = new Set(muteRes.rows.map((m: any) => String(m.muter_id)));
    const sellerIdSet = new Set(cleanIds);
    for (const r of folRes.rows) {
      const followerId = String(r.follower_id);
      if (!followerId || sellerIdSet.has(followerId) || mutedFollowerSet.has(followerId)) continue;
      await dbQuery(
        `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
         VALUES ($1, $2, $3, $4, 'info', false, $5, NOW())`,
        [
          `notif_newprod_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          followerId,
          `New craft from ${params.shopName}`,
          `"${params.productTitle}" was just listed by ${params.shopName}.`,
          `/?product=${encodeURIComponent(params.productId)}`,
        ]
      );
      try {
        const rawPrefs =
          typeof r.notification_prefs === 'string'
            ? JSON.parse(r.notification_prefs)
            : r.notification_prefs;
        const prefs = sanitizeNotificationPrefs(rawPrefs || DEFAULT_NOTIFICATION_PREFS);
        if (prefs.emailFollowers && r.email && !String(r.email).endsWith('.local')) {
          const fname = r.display_name || extractFirstName(r.name || 'Friend');
          sendBrevoDirect(
            r.email,
            `New craft from ${params.shopName}`,
            `Hi ${fname},\n\n"${params.productTitle}" was just listed by ${params.shopName} on Shop It.`,
            `<p>Hi ${fname},</p><p><strong>${params.shopName}</strong> just listed <strong>${params.productTitle}</strong> on Shop It.</p>`,
            fname
          ).catch(() => {});
        }
      } catch {}
    }
  } catch (err: any) {
    console.warn('[Follower New Product Notification Note]:', err?.message || err);
  }
}

// Safety switch middleware: returns 503 when PAYMENTS_ENABLED is not 'true'
const requirePaymentsEnabled = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYMENTS_DISABLED',
      message: 'Online payments are coming soon. Arrange directly with the seller',
    });
  }
  next();
};

// Helper: Match seller identity against userId or sellerId
function isUserSellerOwner(user: NonNullable<AuthenticatedRequest['user']>, sellerId?: string): boolean {
  if (!sellerId) return false;
  return sellerId === user.userId || (Boolean(user.sellerId) && sellerId === user.sellerId);
}

// Helper: Validate image URL / base64 upload against XSS or unsafe schemes (blocks javascript:, blob:, svg+xml, text/html)
function isValidImageSource(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4_200_000) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('data:text/') ||
    lower.includes('image/svg+xml') ||
    lower.includes('<script')
  ) {
    return false;
  }
  if (trimmed.startsWith('/')) return true;
  if (lower.startsWith('https://')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(trimmed)) return true;
  return false;
}

function sanitizeImageUrls(
  input: unknown,
  allowFallback = false
): { valid: boolean; urls: string[]; error?: string } {
  if (input === undefined || input === null) {
    return allowFallback ? { valid: true, urls: ['/shopit-logo.png'] } : { valid: false, urls: [], error: 'Product images are required.' };
  }
  if (!Array.isArray(input)) {
    return { valid: false, urls: [], error: 'Images must be provided as an array.' };
  }
  const cleaned = input.map(v => String(v || '').trim()).filter(Boolean).slice(0, 6);
  if (cleaned.length === 0) {
    return allowFallback ? { valid: true, urls: ['/shopit-logo.png'] } : { valid: false, urls: [], error: 'At least one valid image is required.' };
  }
  for (const url of cleaned) {
    if (!isValidImageSource(url)) {
      return {
        valid: false,
        urls: [],
        error: 'Invalid or unsafe image URL. Use an uploaded photo (PNG/JPG/WEBP), https:// URL, or local asset path.',
      };
    }
  }
  return { valid: true, urls: cleaned };
}

// ============================================================================
// 1. PRODUCTS API (PostgreSQL: shopit_products)
// ============================================================================

// GET /api/products - Public listing with filters & pagination (excludes paused/draft & deleted accounts)
router.get('/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;

    const category = req.query.category ? String(req.query.category).trim() : '';
    const search = req.query.search ? String(req.query.search).trim().slice(0, 100) : '';
    const sellerId = req.query.sellerId ? String(req.query.sellerId).trim() : '';
    const campus = req.query.campus ? String(req.query.campus).trim() : '';
    const state = req.query.state ? String(req.query.state).trim() : '';
    const city = req.query.city ? String(req.query.city).trim() : '';
    const area = req.query.area ? String(req.query.area).trim() : '';
    const sortBy = String(req.query.sortBy || 'newest');

    const conditions: string[] = [
      '(p.is_paused IS NOT TRUE)',
      '(p.is_draft IS NOT TRUE)',
      '(u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE))',
    ];
    const params: any[] = [];
    let pIdx = 1;

    if (category && category !== 'all') {
      conditions.push(`p.category = $${pIdx++}`);
      params.push(category);
    }
    if (sellerId) {
      conditions.push(`p.seller_id = $${pIdx++}`);
      params.push(sellerId);
    }
    if (campus && campus !== 'All Campuses') {
      conditions.push(`p.seller_campus = $${pIdx++}`);
      params.push(campus);
    }
    if (state && state !== 'all') {
      conditions.push(`p.location_state = $${pIdx++}`);
      params.push(state);
    }
    if (city && city !== 'all') {
      conditions.push(`p.location_city = $${pIdx++}`);
      params.push(city);
    }
    if (area && area !== 'all') {
      conditions.push(`p.location_area = $${pIdx++}`);
      params.push(area);
    }
    if (search) {
      conditions.push(`(p.title ILIKE $${pIdx} OR p.description ILIKE $${pIdx} OR p.seller_shop_name ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    let orderClause = sellerId
      ? 'ORDER BY p.is_pinned DESC, p.pinned_at DESC NULLS LAST, p.created_at DESC'
      : 'ORDER BY p.created_at DESC';
    if (sortBy === 'price_asc') orderClause = 'ORDER BY p.display_price_kobo ASC';
    else if (sortBy === 'price_desc') orderClause = 'ORDER BY p.display_price_kobo DESC';
    else if (sortBy === 'top_rated') orderClause = 'ORDER BY p.rating DESC, p.review_count DESC';

    const fromJoin = `
      FROM shopit_products p
      LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
      LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
    `;

    const countRes = await dbQuery(`SELECT COUNT(*) as count ${fromJoin} ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await dbQuery(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       ${fromJoin} ${whereClause} ${orderClause} LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    const reviewerIds: string[] = [];
    for (const r of rowsRes.rows) {
      const revs = Array.isArray(r.reviews) ? r.reviews : [];
      for (const rv of revs) {
        if (rv?.reviewerId) reviewerIds.push(String(rv.reviewerId));
      }
    }
    const reviewerMap = await batchLoadUserMeta(reviewerIds);

    const products = rowsRes.rows.map((row: any) => ({
      id: row.id,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || row.u_display_name || 'Artisan Shop',
      sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || row.seller_shop_name || 'Artisan'),
      sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || undefined,
      sellerProfileSlug: row.u_profile_slug || undefined,
      sellerCampus: row.seller_campus || 'Lagos Mainland',
      location: {
        state: row.location_state || 'Lagos',
        city: row.location_city || 'Lagos Mainland',
        area: row.location_area || 'Yaba',
      },
      locationArea: row.location_area || 'Yaba',
      sellerBadges: row.seller_badges || [],
      title: row.title,
      description: row.description || '',
      category: row.category || 'crafts',
      sellerPrice: koboToNaira(row.seller_price_kobo || 0),
      serviceFee: koboToNaira(row.service_fee_kobo || 0),
      displayPrice: koboToNaira(row.display_price_kobo || 0),
      images: Array.isArray(row.images) ? row.images : [],
      stock: parseInt(row.stock, 10) || 0,
      rating: parseFloat(row.rating || 5.0),
      reviewCount: parseInt(row.review_count, 10) || 0,
      reviews: (Array.isArray(row.reviews) ? row.reviews : []).map((rv: any) => mapReviewWithUsers(rv, reviewerMap)),
      delivery: {
        allowsPickup: true,
        pickupLocation: `${row.location_area || 'Hub'} Campus Pickup Spot`,
        pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
        allowsLocalDelivery: true,
        localDeliveryFee:
          row.delivery_local_fee_kobo !== undefined && row.delivery_local_fee_kobo !== null
            ? koboToNaira(row.delivery_local_fee_kobo)
            : 500,
        minOrderForDelivery: 1000,
      },
      isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
      isNewArrival: Boolean(row.is_new_arrival),
      isPaused: Boolean(row.is_paused),
      isDraft: Boolean(row.is_draft),
      isPinned: Boolean(row.is_pinned),
      pinnedAt: row.pinned_at || undefined,
      createdAt: row.created_at,
    }));

    return res.json({
      status: true,
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    console.error('[Products List Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Error retrieving products.' });
  }
});

// GET /api/products/mine - Authenticated seller's products including paused & drafts
router.get('/products/mine', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const sellerIds = Array.from(new Set([user.userId, user.sellerId || user.userId]));
    const { placeholders, params } = buildInClause(sellerIds);
    const rowsRes = await dbQuery(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.seller_id IN (${placeholders})
       ORDER BY p.is_pinned DESC, p.pinned_at DESC NULLS LAST, p.created_at DESC`,
      params
    );
    const products = rowsRes.rows.map((row: any) => ({
      id: row.id,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || 'Artisan Shop',
      sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || 'Artisan'),
      sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || undefined,
      sellerProfileSlug: row.u_profile_slug || undefined,
      sellerCampus: row.seller_campus || 'Lagos Mainland',
      location: {
        state: row.location_state || 'Lagos',
        city: row.location_city || 'Lagos Mainland',
        area: row.location_area || 'Yaba',
      },
      locationArea: row.location_area || 'Yaba',
      sellerBadges: row.seller_badges || [],
      title: row.title,
      description: row.description || '',
      category: row.category || 'crafts',
      sellerPrice: koboToNaira(row.seller_price_kobo || 0),
      serviceFee: koboToNaira(row.service_fee_kobo || 0),
      displayPrice: koboToNaira(row.display_price_kobo || 0),
      images: Array.isArray(row.images) ? row.images : [],
      stock: parseInt(row.stock, 10) || 0,
      rating: parseFloat(row.rating || 5.0),
      reviewCount: parseInt(row.review_count, 10) || 0,
      reviews: Array.isArray(row.reviews) ? row.reviews : [],
      delivery: {
        allowsPickup: true,
        pickupLocation: `${row.location_area || 'Hub'} Campus Pickup Spot`,
        pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
        allowsLocalDelivery: true,
        localDeliveryFee:
          row.delivery_local_fee_kobo !== undefined && row.delivery_local_fee_kobo !== null
            ? koboToNaira(row.delivery_local_fee_kobo)
            : 500,
        minOrderForDelivery: 1000,
      },
      isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
      isNewArrival: Boolean(row.is_new_arrival),
      isPaused: Boolean(row.is_paused),
      isDraft: Boolean(row.is_draft),
      isPinned: Boolean(row.is_pinned),
      pinnedAt: row.pinned_at || undefined,
      createdAt: row.created_at,
    }));
    return res.json({ status: true, products });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to load your listings.' });
  }
});

// GET /api/products/:id - Single product view
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(
      `SELECT p.*, u.display_name as u_display_name, u.name as u_name, u.avatar_url as u_avatar_url,
              u.profile_slug as u_profile_slug, s.logo_url as s_logo_url
       FROM shopit_products p
       LEFT JOIN shopit_sellers s ON (p.seller_id = s.id OR p.seller_id = s.user_id)
       LEFT JOIN shopit_users u ON (u.id = COALESCE(s.user_id, p.seller_id))
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }

    const row = result.rows[0];
    const rawReviews = Array.isArray(row.reviews) ? row.reviews : [];
    const reviewerMap = await batchLoadUserMeta(rawReviews.map((rv: any) => rv?.reviewerId).filter(Boolean));

    return res.json({
      status: true,
      product: {
        id: row.id,
        sellerId: row.seller_id,
        sellerShopName: row.seller_shop_name,
        sellerDisplayName: row.u_display_name || extractFirstName(row.u_name || row.seller_shop_name || 'Artisan'),
        sellerAvatarUrl: row.s_logo_url || row.u_avatar_url || undefined,
        sellerProfileSlug: row.u_profile_slug || undefined,
        sellerCampus: row.seller_campus,
        location: {
          state: row.location_state,
          city: row.location_city,
          area: row.location_area,
        },
        locationArea: row.location_area,
        sellerBadges: row.seller_badges || [],
        title: row.title,
        description: row.description,
        category: row.category,
        sellerPrice: koboToNaira(row.seller_price_kobo || 0),
        serviceFee: koboToNaira(row.service_fee_kobo || 0),
        displayPrice: koboToNaira(row.display_price_kobo || 0),
        images: Array.isArray(row.images) ? row.images : [],
        stock: parseInt(row.stock, 10),
        rating: parseFloat(row.rating || 5.0),
        reviewCount: parseInt(row.review_count, 10) || 0,
        reviews: rawReviews.map((rv: any) => mapReviewWithUsers(rv, reviewerMap)),
        delivery: {
          allowsPickup: true,
          pickupLocation: `${row.location_area || 'Hub'} Campus Pickup Spot`,
          pickupFee: koboToNaira(row.delivery_pickup_fee_kobo || 0),
          allowsLocalDelivery: true,
          localDeliveryFee:
            row.delivery_local_fee_kobo !== undefined && row.delivery_local_fee_kobo !== null
              ? koboToNaira(row.delivery_local_fee_kobo)
              : 500,
          minOrderForDelivery: 1000,
        },
        isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
        isNewArrival: Boolean(row.is_new_arrival),
        isPaused: Boolean(row.is_paused),
        isDraft: Boolean(row.is_draft),
        isPinned: Boolean(row.is_pinned),
        pinnedAt: row.pinned_at || undefined,
        createdAt: row.created_at,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/products - Create a product (Protected; sellerId derived strictly from session)
router.post('/products', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      description,
      category,
      sellerPrice,
      images,
      stock = 1,
      location,
      delivery,
    } = req.body;

    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (!cleanTitle || sellerPrice === undefined || sellerPrice === null) {
      return res.status(400).json({ status: false, message: 'A non-empty product title and seller price are required.' });
    }
    const titleContactCheck = containsForbiddenContactInfo(cleanTitle);
    if (titleContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Title: ${titleContactCheck.reason}` });
    }
    const cleanDescription = description ? String(description).trim().slice(0, 2000) : `${cleanTitle} crafted with care.`;
    const descContactCheck = containsForbiddenContactInfo(cleanDescription);
    if (descContactCheck.blocked) {
      return res.status(400).json({ status: false, message: `Description: ${descContactCheck.reason}` });
    }

    const rawSellerPriceNaira = parseFloat(sellerPrice);
    if (isNaN(rawSellerPriceNaira) || rawSellerPriceNaira < 100 || rawSellerPriceNaira > 10000000) {
      return res.status(400).json({ status: false, message: 'Seller price must be between ₦100 and ₦10,000,000.' });
    }

    const imgCheck = sanitizeImageUrls(images, true);
    if (!imgCheck.valid) {
      return res.status(400).json({ status: false, message: imgCheck.error });
    }

    const sellerPriceKobo = nairaToKobo(rawSellerPriceNaira);
    const feePolicy = await getPlatformSetting('fee_settings', DEFAULT_FEE_SETTINGS_DB);
    const serviceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
    const displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
    const pricing = {
      sellerPriceKobo,
      serviceFeeKobo,
      displayPriceKobo,
      sellerPriceNaira: koboToNaira(sellerPriceKobo),
      serviceFeeNaira: koboToNaira(serviceFeeKobo),
      displayPriceNaira: koboToNaira(displayPriceKobo),
    };

    // Derive sellerId strictly from session (only admin can override on behalf of another seller)
    const sellerId =
      user.role === 'admin' && req.body.sellerId
        ? String(req.body.sellerId).trim()
        : user.sellerId || user.userId;

    const sellerRes = await dbQuery('SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1', [sellerId]);
    let seller = sellerRes.rows[0];

    if (!seller) {
      await dbQuery(
        `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, campus)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          sellerId,
          user.userId,
          req.body.sellerShopName || `${user.name}'s Shop`,
          user.name,
          user.email,
          false,
          'not_started',
          req.body.sellerCampus || 'Lagos Mainland',
        ]
      );
      seller = {
        id: sellerId,
        user_id: user.userId,
        shop_name: req.body.sellerShopName || `${user.name}'s Shop`,
        is_verified_seller: false,
      };
    }

    if (user.role === 'buyer') {
      await dbQuery("UPDATE shopit_users SET role = 'seller', updated_at = NOW() WHERE id = $1", [user.userId]).catch(() => {});
    }

    const shopName = seller?.shop_name || req.body.sellerShopName || `${user.name}'s Shop`;
    const campus = seller?.campus || req.body.sellerCampus || 'Lagos Mainland';
    const isVerified = Boolean(seller?.is_verified_seller || seller?.verification_status === 'verified');

    const badges: string[] = Array.isArray(req.body.sellerBadges)
      ? req.body.sellerBadges.filter((b: any) => b !== 'verified')
      : [];
    if (isVerified) {
      badges.push('verified');
    }

    const productId = `prod_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const imagesArray = imgCheck.urls;

    const rawParsedStock = parseInt(String(stock), 10);
    const parsedStock = Math.max(0, Math.min(10000, Number.isNaN(rawParsedStock) ? 1 : rawParsedStock));
    const pickupFeeKobo = nairaToKobo(Math.max(0, Math.min(1000000, parseFloat(delivery?.pickupFee ?? '0') || 0)));
    const localDeliveryFeeKobo = nairaToKobo(Math.max(0, Math.min(1000000, parseFloat(delivery?.localDeliveryFee ?? '500') || 500)));

    const isDraft = Boolean(req.body.isDraft);
    const isPaused = Boolean(req.body.isPaused);

    await dbQuery(
      `INSERT INTO shopit_products (
        id, seller_id, seller_shop_name, seller_campus, title, description, category,
        seller_price_kobo, service_fee_kobo, display_price_kobo, stock, images,
        delivery_pickup_fee_kobo, delivery_local_fee_kobo, delivery_buyer_arranges,
        location_state, location_city, location_area, seller_badges,
        rating, review_count, is_sold_out, is_new_arrival, is_paused, is_draft, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, false,
        $15, $16, $17, $18,
        5.0, 0, $19, true, $20, $21, NOW(), NOW()
      )`,
      [
        productId,
        sellerId,
        shopName,
        campus,
        cleanTitle.slice(0, 200),
        cleanDescription,
        category || 'crafts',
        pricing.sellerPriceKobo,
        pricing.serviceFeeKobo,
        pricing.displayPriceKobo,
        parsedStock,
        JSON.stringify(imagesArray),
        pickupFeeKobo,
        localDeliveryFeeKobo,
        location?.state || 'Lagos',
        location?.city || 'Lagos Mainland',
        location?.area || 'Yaba',
        JSON.stringify(badges),
        parsedStock <= 0,
        isPaused,
        isDraft,
      ]
    );

    if (!isDraft && !isPaused) {
      await notifyFollowersOfNewProduct({
        sellerIds: [sellerId, seller?.user_id || user.userId],
        shopName,
        productId,
        productTitle: cleanTitle.slice(0, 120),
      });
    }

    await logAuditEvent({
      action: 'PRODUCT_CREATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'product', id: productId },
      details: { title, sellerPriceNaira: pricing.sellerPriceNaira, displayPriceNaira: pricing.displayPriceNaira },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      status: true,
      productId,
      message: 'Product listed successfully in PostgreSQL database.',
    });
  } catch (err: any) {
    console.error('[Product Create Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error creating product.' });
  }
});

// PUT /api/products/:id - Update product
router.put('/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const existing = await dbQuery('SELECT * FROM shopit_products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }

    const row = existing.rows[0];
    if (!isUserSellerOwner(user, row.seller_id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'You do not have permission to modify this product.' });
    }

    const updates = req.body;
    let sellerPriceKobo = Number(row.seller_price_kobo || 0);
    let serviceFeeKobo = Number(row.service_fee_kobo || 0);
    let displayPriceKobo = Number(row.display_price_kobo || 0);

    if (updates.sellerPrice !== undefined) {
      const parsedPrice = parseFloat(updates.sellerPrice);
      if (isNaN(parsedPrice) || parsedPrice < 100) {
        return res.status(400).json({ status: false, message: 'Minimum seller price is ₦100.' });
      }
      const feePolicy = await getPlatformSetting('fee_settings', DEFAULT_FEE_SETTINGS_DB);
      sellerPriceKobo = nairaToKobo(parsedPrice);
      serviceFeeKobo = calculateConfiguredServiceFeeKobo(sellerPriceKobo, feePolicy);
      displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
    }

    let title = row.title;
    if (updates.title !== undefined) {
      const cleanUpdateTitle = String(updates.title).trim().slice(0, 200);
      if (!cleanUpdateTitle) {
        return res.status(400).json({ status: false, message: 'Product title cannot be empty.' });
      }
      const tc = containsForbiddenContactInfo(cleanUpdateTitle);
      if (tc.blocked) {
        return res.status(400).json({ status: false, message: `Title: ${tc.reason}` });
      }
      title = cleanUpdateTitle;
    }
    const description = updates.description !== undefined ? String(updates.description).trim().slice(0, 2000) : row.description;
    if (updates.description !== undefined) {
      const dc = containsForbiddenContactInfo(description);
      if (dc.blocked) {
        return res.status(400).json({ status: false, message: `Description: ${dc.reason}` });
      }
    }
    const category = updates.category !== undefined ? updates.category : row.category;
    const rawUpdateStock = updates.stock !== undefined ? parseInt(String(updates.stock), 10) : parseInt(String(row.stock ?? 0), 10);
    const stock = Math.max(0, Math.min(10000, Number.isNaN(rawUpdateStock) ? 0 : rawUpdateStock));
    const isSoldOut = stock <= 0;
    const isPaused = updates.isPaused !== undefined ? Boolean(updates.isPaused) : Boolean(row.is_paused);
    const isDraft = updates.isDraft !== undefined ? Boolean(updates.isDraft) : Boolean(row.is_draft);
    const deliveryPickupFeeKobo =
      updates.delivery?.pickupFee !== undefined
        ? nairaToKobo(Math.max(0, Math.min(1000000, parseFloat(String(updates.delivery.pickupFee)) || 0)))
        : Number(row.delivery_pickup_fee_kobo || 0);
    const deliveryLocalFeeKobo =
      updates.delivery?.localDeliveryFee !== undefined
        ? nairaToKobo(Math.max(0, Math.min(1000000, parseFloat(String(updates.delivery.localDeliveryFee)) || 0)))
        : Number(row.delivery_local_fee_kobo || 0);

    let images = JSON.stringify(row.images);
    if (updates.images !== undefined) {
      const imgUpdate = sanitizeImageUrls(updates.images, false);
      if (!imgUpdate.valid) {
        return res.status(400).json({ status: false, message: imgUpdate.error });
      }
      images = JSON.stringify(imgUpdate.urls);
    }

    const wasOutOfStock = Boolean(row.is_sold_out) || parseInt(String(row.stock || '0'), 10) <= 0;

    await dbQuery(
      `UPDATE shopit_products
       SET title = $1, description = $2, category = $3, seller_price_kobo = $4, service_fee_kobo = $5, display_price_kobo = $6,
           stock = $7, is_sold_out = $8, images = $9, is_paused = $10, is_draft = $11,
           delivery_pickup_fee_kobo = $12, delivery_local_fee_kobo = $13, updated_at = NOW()
       WHERE id = $14`,
      [
        title,
        description,
        category,
        sellerPriceKobo,
        serviceFeeKobo,
        displayPriceKobo,
        stock,
        isSoldOut,
        images,
        isPaused,
        isDraft,
        deliveryPickupFeeKobo,
        deliveryLocalFeeKobo,
        id,
      ]
    );

    if (wasOutOfStock && stock > 0) {
      try {
        const subs = await dbQuery(
          'SELECT id, user_id, email FROM shopit_restock_alerts WHERE product_id = $1 AND notified = false',
          [id]
        );
        for (const sub of subs.rows) {
          await dbQuery(
            `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
             VALUES ($1, $2, $3, $4, 'success', false, $5, NOW())`,
            [
              `notif_restock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              sub.user_id,
              'Item Back in Stock!',
              `"${title}" is now restocked (${stock} available) on Shop It.`,
              `/?product=${encodeURIComponent(id)}`,
            ]
          );
          if (sub.email) {
            void sendBrevoDirect(
              sub.email,
              `Back in Stock: ${title} on Shop It`,
              `Good news! "${title}" is back in stock on Shop It (${stock} available). Visit https://shopitng.vercel.app/?product=${encodeURIComponent(id)}`,
              `<p>Good news!</p><p><strong>${title}</strong> is back in stock on Shop It (${stock} available).</p><p><a href="https://shopitng.vercel.app/?product=${encodeURIComponent(id)}">View Item on Shop It</a></p>`
            ).catch(() => {});
          }
        }
        if (subs.rows.length > 0) {
          await dbQuery(
            'UPDATE shopit_restock_alerts SET notified = true WHERE product_id = $1 AND notified = false',
            [id]
          );
        }
      } catch (notifErr: any) {
        console.warn('[Restock Notification Warning]:', notifErr?.message || notifErr);
      }
    }

    if ((Boolean(row.is_draft) || Boolean(row.is_paused)) && !isDraft && !isPaused) {
      const sOwnerRes = await dbQuery('SELECT user_id, shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1 LIMIT 1', [row.seller_id]).catch(() => ({ rows: [] }));
      const sOwnerRow = sOwnerRes.rows[0];
      await notifyFollowersOfNewProduct({
        sellerIds: [row.seller_id, sOwnerRow?.user_id].filter(Boolean),
        shopName: sOwnerRow?.shop_name || row.seller_shop_name || 'Artisan Shop',
        productId: id,
        productTitle: title.slice(0, 120),
      });
    }

    await logAuditEvent({
      action: 'PRODUCT_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'product', id },
      details: { title, displayPriceNaira: koboToNaira(displayPriceKobo), stock, isSoldOut },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'Product updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PATCH /api/products/:id/pin - Pin or unpin up to 3 featured products on seller profile
router.patch('/products/:id/pin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const pinned = Boolean(req.body?.pinned);

    const txResult = await withTransaction(async client => {
      const existing = await client.query('SELECT * FROM shopit_products WHERE id = $1 FOR UPDATE', [id]);
      if (existing.rows.length === 0) {
        return { code: 404, body: { status: false, message: 'Product not found.' } };
      }
      const row = existing.rows[0];
      if (!isUserSellerOwner(user, row.seller_id) && user.role !== 'admin') {
        return { code: 403, body: { status: false, message: 'You do not have permission to pin this product.' } };
      }

      if (pinned) {
        if (row.is_draft) {
          return { code: 400, body: { status: false, message: 'Publish your draft before pinning it to your profile.' } };
        }
        const pinnedCountRes = await client.query(
          `SELECT COUNT(*) as total FROM shopit_products
           WHERE seller_id = $1 AND is_pinned = true AND id != $2 AND is_draft IS NOT TRUE`,
          [row.seller_id, id]
        );
        const count = parseInt(String(pinnedCountRes.rows[0]?.total || '0'), 10);
        if (count >= 3) {
          return {
            code: 400,
            body: {
              status: false,
              message: 'You can pin at most 3 featured items on your profile. Unpin another item first.',
            },
          };
        }
      }

      await client.query(
        'UPDATE shopit_products SET is_pinned = $1, pinned_at = $2, updated_at = NOW() WHERE id = $3',
        [pinned, pinned ? new Date().toISOString() : null, id]
      );
      return {
        code: 200,
        body: {
          status: true,
          isPinned: pinned,
          message: pinned ? 'Product pinned to the top of your profile.' : 'Product unpinned.',
        },
      };
    });

    return res.status(txResult.code).json(txResult.body);
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Failed to update pinned product.' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/products/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const existing = await dbQuery('SELECT * FROM shopit_products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }

    const row = existing.rows[0];
    if (!isUserSellerOwner(user, row.seller_id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'You do not have permission to delete this product.' });
    }

    await dbQuery('DELETE FROM shopit_products WHERE id = $1', [id]);

    await logAuditEvent({
      action: 'PRODUCT_DELETED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'product', id },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'Product deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// GET /api/products/:id/restock-alert - Check if authenticated user has active restock alert
router.get('/products/:id/restock-alert', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const resRow = await dbQuery(
      'SELECT notified FROM shopit_restock_alerts WHERE product_id = $1 AND user_id = $2',
      [id, user.userId]
    );
    const subscribed = resRow.rows.length > 0 && !resRow.rows[0].notified;
    return res.json({ status: true, subscribed });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/products/:id/restock-alert - Subscribe authenticated user to restock alert
router.post('/products/:id/restock-alert', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const prodRes = await dbQuery('SELECT id, title, stock, is_sold_out FROM shopit_products WHERE id = $1', [id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }
    const prod = prodRes.rows[0];
    if (!prod.is_sold_out && parseInt(String(prod.stock || '0'), 10) > 0) {
      return res.json({ status: true, subscribed: false, inStock: true, message: 'This item is currently in stock.' });
    }

    const alertId = `rstk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await dbQuery(
      `INSERT INTO shopit_restock_alerts (id, product_id, user_id, email, notified, created_at)
       VALUES ($1, $2, $3, $4, false, NOW())
       ON CONFLICT (product_id, user_id) DO UPDATE SET notified = false, email = $4, created_at = NOW()`,
      [alertId, id, user.userId, user.email || null]
    );

    await logAuditEvent({
      action: 'RESTOCK_ALERT_SUBSCRIBED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'product', id },
      details: { title: prod.title },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      status: true,
      subscribed: true,
      message: 'Restock alert saved. You will be notified when this item is restocked.',
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 2. SELLERS API (PostgreSQL: shopit_sellers)
// ============================================================================

// GET /api/sellers - Public catalog seller profiles (no sensitive email/phone leaked)
router.get('/sellers', async (_req, res) => {
  try {
    const result = await dbQuery(`
      SELECT s.*, u.display_name as u_display_name, u.profile_slug as u_profile_slug,
             u.avatar_url as u_avatar_url, u.cover_url as u_cover_url, u.deleted_at as u_deleted_at, u.is_banned as u_is_banned
      FROM shopit_sellers s
      LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
      WHERE u.id IS NULL OR (u.deleted_at IS NULL AND u.is_banned IS NOT TRUE)
      ORDER BY s.created_at DESC
    `);

    const sellers = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id || row.id,
      shopName: row.shop_name,
      ownerName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || 'Seller'),
      displayName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || 'Seller'),
      profileSlug: row.u_profile_slug || row.id,
      logoUrl: row.logo_url || row.u_avatar_url || undefined,
      bannerUrl: row.banner_url || row.u_cover_url || undefined,
      avatarUrl: row.logo_url || row.u_avatar_url || undefined,
      bio: row.bio || '',
      campus: row.campus || 'Lagos Mainland',
      location: {
        state: row.location_state || 'Lagos',
        city: row.location_city || 'Lagos Mainland',
        area: row.location_area || 'Yaba',
      },
      locationArea: row.location_area || 'Yaba',
      isVerifiedSeller: Boolean(row.is_verified_seller),
      verificationStatus: row.verification_status || 'not_started',
      verifiedAt: row.verified_at,
      under18: Boolean(row.under_18),
      badges: Array.isArray(row.badges)
        ? (row.is_verified_seller && !row.badges.includes('verified') ? [...row.badges, 'verified'] : row.badges)
        : (row.is_verified_seller ? ['verified'] : []),
      level: 1,
      rating: parseFloat(row.rating || 5.0),
      reviewCount: 0,
      salesCount: parseInt(row.sales_count, 10) || 0,
      viewsCount: parseInt(row.views_count, 10) || 0,
      vacationMode: Boolean(row.vacation_mode),
      joinedDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-01-01',
    }));

    return res.json({ status: true, sellers });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// GET /api/sellers/:id - Single seller profile
router.get('/sellers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(
      `SELECT s.*, u.display_name as u_display_name, u.profile_slug as u_profile_slug,
              u.avatar_url as u_avatar_url, u.cover_url as u_cover_url, u.deleted_at as u_deleted_at
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1 OR LOWER(u.profile_slug) = LOWER($1)`,
      [id]
    );

    if (result.rows.length === 0 || result.rows[0].u_deleted_at) {
      return res.status(404).json({ status: false, message: 'Seller not found.' });
    }

    const row = result.rows[0];
    return res.json({
      status: true,
      seller: {
        id: row.id,
        userId: row.user_id || row.id,
        shopName: row.shop_name,
        ownerName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || 'Seller'),
        displayName: row.u_display_name || extractFirstName(row.owner_name || row.shop_name || 'Seller'),
        profileSlug: row.u_profile_slug || row.id,
        logoUrl: row.logo_url || row.u_avatar_url || undefined,
        bannerUrl: row.banner_url || row.u_cover_url || undefined,
        bio: row.bio || '',
        campus: row.campus || 'Lagos Mainland',
        location: {
          state: row.location_state || 'Lagos',
          city: row.location_city || 'Lagos Mainland',
          area: row.location_area || 'Yaba',
        },
        locationArea: row.location_area || 'Yaba',
        isVerifiedSeller: Boolean(row.is_verified_seller),
        verificationStatus: row.verification_status || 'not_started',
        verifiedAt: row.verified_at,
        under18: Boolean(row.under_18),
        badges: Array.isArray(row.badges)
          ? (row.is_verified_seller && !row.badges.includes('verified') ? [...row.badges, 'verified'] : row.badges)
          : (row.is_verified_seller ? ['verified'] : []),
        rating: parseFloat(row.rating || 5.0),
        salesCount: parseInt(row.sales_count, 10) || 0,
        viewsCount: parseInt(row.views_count, 10) || 0,
        vacationMode: Boolean(row.vacation_mode),
        joinedDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-01-01',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PUT /api/sellers/:id - Update seller profile (Owner or Admin only)
router.put('/sellers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    if (!isUserSellerOwner(user, id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden.' });
    }

    const { shopName, bio, campus, location, vacationMode } = req.body;
    if (shopName) {
      const sc = containsForbiddenContactInfo(String(shopName));
      if (sc.blocked) return res.status(400).json({ status: false, message: `Shop name: ${sc.reason}` });
    }
    if (bio) {
      const bc = containsForbiddenContactInfo(String(bio));
      if (bc.blocked) return res.status(400).json({ status: false, message: `Shop bio: ${bc.reason}` });
    }

    await dbQuery(
      `UPDATE shopit_sellers
       SET shop_name = COALESCE($1, shop_name),
           bio = COALESCE($2, bio),
           campus = COALESCE($3, campus),
           location_state = COALESCE($4, location_state),
           location_city = COALESCE($5, location_city),
           location_area = COALESCE($6, location_area),
           vacation_mode = COALESCE($7, vacation_mode),
           updated_at = NOW()
       WHERE id = $8 OR user_id = $8`,
      [shopName, bio, campus, location?.state, location?.city, location?.area, vacationMode, id]
    );

    await logAuditEvent({
      action: 'SELLER_PROFILE_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'seller', id },
      details: { shopName, campus, vacationMode },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, message: 'Seller profile updated.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/sellers/upgrade - Authenticated buyer creates a shop profile and upgrades to seller
router.post('/sellers/upgrade', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = req.user!;
    const { shopName, bio, campus, location, locationArea, under18, guardianName } = req.body || {};

    const cleanShopName = String(shopName || '').trim().slice(0, 120);
    if (!cleanShopName || cleanShopName.length < 2) {
      return res.status(400).json({ status: false, message: 'Please provide a valid shop name (at least 2 characters).' });
    }
    const sc = containsForbiddenContactInfo(cleanShopName);
    if (sc.blocked) {
      return res.status(400).json({ status: false, message: `Shop name: ${sc.reason}` });
    }
    if (under18 && (!guardianName || !String(guardianName).trim())) {
      return res.status(400).json({ status: false, message: 'Youth sellers under 18 require parent/guardian consent.' });
    }

    const userRes = await dbQuery('SELECT * FROM shopit_users WHERE id = $1', [authUser.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'User account not found.' });
    }
    const uRow = userRes.rows[0];
    const resolvedArea = locationArea || location?.area || 'Yaba';
    const resolvedCampus = campus || 'UNILAG (Akoka)';
    const resolvedBio = String(bio || '').trim().slice(0, 1000);
    const bc = containsForbiddenContactInfo(resolvedBio);
    if (bc.blocked) {
      return res.status(400).json({ status: false, message: `Shop bio: ${bc.reason}` });
    }

    const existingSeller = await dbQuery(
      'SELECT * FROM shopit_sellers WHERE id = $1 OR user_id = $1',
      [authUser.userId]
    );

    let sellerId = authUser.userId;
    let isVerifiedSeller = false;
    let verificationStatus = 'not_started';

    if (existingSeller.rows.length > 0) {
      const sRow = existingSeller.rows[0];
      sellerId = sRow.id;
      isVerifiedSeller = Boolean(sRow.is_verified_seller);
      verificationStatus = sRow.verification_status || 'not_started';
      await dbQuery(
        `UPDATE shopit_sellers
         SET shop_name = $1, bio = $2, campus = $3, location_state = $4, location_city = $5, location_area = $6,
             under_18 = $7, guardian_consent = $8, guardian_name = COALESCE($9, guardian_name),
             updated_at = NOW()
         WHERE id = $10`,
        [
          cleanShopName,
          resolvedBio,
          resolvedCampus,
          location?.state || sRow.location_state || 'Lagos',
          location?.city || sRow.location_city || 'Lagos Mainland',
          resolvedArea,
          Boolean(under18),
          Boolean(under18),
          guardianName ? String(guardianName).trim() : null,
          sellerId,
        ]
      );
    } else {
      await dbQuery(
        `INSERT INTO shopit_sellers (
          id, user_id, shop_name, owner_name, email, bio, campus,
          location_state, location_city, location_area,
          under_18, guardian_consent, guardian_name,
          is_verified_seller, verification_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, 'not_started', NOW(), NOW())`,
        [
          sellerId,
          authUser.userId,
          cleanShopName,
          uRow.name,
          uRow.email,
          resolvedBio,
          resolvedCampus,
          location?.state || 'Lagos',
          location?.city || 'Lagos Mainland',
          resolvedArea,
          Boolean(under18),
          Boolean(under18),
          guardianName ? String(guardianName).trim() : null,
        ]
      );
    }

    if (uRow.role === 'buyer') {
      await dbQuery('UPDATE shopit_users SET role = $1, updated_at = NOW() WHERE id = $2', ['seller', authUser.userId]);
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, 0, 0, 0, NOW(), NOW()) ON CONFLICT (seller_id) DO NOTHING`,
      [sellerId]
    );

    await dbQuery(
      `INSERT INTO shopit_admin_alerts (
        alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
      ) VALUES ($1, $2, 'new_user', $3, $4, $5, 'seller', $6, $7, false, $8, NOW())
      ON CONFLICT (alert_key) DO UPDATE SET
        user_role = 'seller',
        title = $6,
        message = $7,
        is_read = false,
        created_at = NOW()`,
      [
        `new_user_${uRow.id}`,
        `alert_u_${uRow.id}`,
        uRow.id,
        uRow.email,
        uRow.display_name || uRow.name || cleanShopName,
        'User upgraded to seller',
        `${uRow.name} (${uRow.email}) opened shop "${cleanShopName}"`,
        JSON.stringify({ sellerId, shopName: cleanShopName, upgrade: true }),
      ]
    ).catch(() => {});

    await logAuditEvent({
      action: 'BUYER_UPGRADED_TO_SELLER',
      actor: { id: authUser.userId, email: uRow.email, role: uRow.role === 'buyer' ? 'seller' : uRow.role },
      target: { type: 'seller', id: sellerId },
      details: { shopName: cleanShopName, campus: resolvedCampus, area: resolvedArea },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const displayName = uRow.display_name || extractFirstName(uRow.name || 'Seller');

    return res.json({
      status: true,
      user: {
        id: uRow.id,
        email: uRow.email,
        name: uRow.name,
        displayName,
        profileSlug: uRow.profile_slug,
        avatarUrl: uRow.avatar_url || undefined,
        role: uRow.role === 'admin' ? 'admin' : 'seller',
        isVerifiedEmail: Boolean(uRow.is_verified_email),
        sellerProfile: {
          id: sellerId,
          shopName: cleanShopName,
          ownerName: displayName,
          bio: resolvedBio,
          campus: resolvedCampus,
          location: location || { state: 'Lagos', city: 'Lagos Mainland', area: resolvedArea },
          locationArea: resolvedArea,
          isVerifiedSeller,
          verificationStatus,
          under18: Boolean(under18),
          guardianConsent: Boolean(under18),
          guardianName: guardianName || undefined,
          badges: isVerifiedSeller ? ['verified'] : [],
          level: 1,
          rating: 5.0,
          reviewCount: 0,
          salesCount: 0,
          viewsCount: 0,
          vacationMode: false,
          joinedDate: new Date().toISOString().split('T')[0],
        },
      },
      message: 'Seller shop created and saved in database.',
    });
  } catch (err: any) {
    console.error('[Seller Upgrade Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error creating seller profile.' });
  }
});

// ============================================================================
// 3. CARTS & WISHLISTS API (PostgreSQL: shopit_carts, shopit_wishlists)
// ============================================================================

router.get('/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery('SELECT items FROM shopit_carts WHERE user_id = $1', [user.userId]);
    const items = result.rows.length > 0 && Array.isArray(result.rows[0].items) ? result.rows[0].items : [];
    return res.json({ status: true, items });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.put('/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { items = [] } = req.body;
    const sanitizedItems = Array.isArray(items) ? items.slice(0, 50) : [];
    await dbQuery(
      `INSERT INTO shopit_carts (user_id, items, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET items = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(sanitizedItems)]
    );
    await logAuditEvent({
      action: 'CART_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'cart', id: user.userId },
      details: {
        itemCount: sanitizedItems.length,
        productTitles: sanitizedItems.map((i: any) => i?.product?.title || i?.title || i?.productId).filter(Boolean).slice(0, 5),
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: 'Cart saved to database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.get('/wishlist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery('SELECT product_ids FROM shopit_wishlists WHERE user_id = $1', [user.userId]);
    const productIds = result.rows.length > 0 && Array.isArray(result.rows[0].product_ids) ? result.rows[0].product_ids : [];
    return res.json({ status: true, productIds });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.put('/wishlist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { productIds = [] } = req.body;
    const sanitizedIds = Array.isArray(productIds) ? productIds.slice(0, 100) : [];
    await dbQuery(
      `INSERT INTO shopit_wishlists (user_id, product_ids, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET product_ids = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(sanitizedIds)]
    );
    await logAuditEvent({
      action: 'WISHLIST_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'wishlist', id: user.userId },
      details: { count: sanitizedIds.length, productIds: sanitizedIds.slice(0, 10) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, message: 'Wishlist saved to database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 4. ORDERS & ESCROW STATE MACHINE (PostgreSQL Authoritative)
// ============================================================================

// GET /api/orders - List user orders (handshakeOtp hidden from sellers; PII hidden from non-admins)
router.get('/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;

    let querySql = '';
    let countSql = '';
    let params: any[] = [];
    let countParams: any[] = [];

    if (user.role === 'admin') {
      countSql = 'SELECT COUNT(*) as count FROM shopit_orders';
      querySql = 'SELECT * FROM shopit_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      params = [limit, offset];
      countParams = [];
    } else if (user.role === 'seller') {
      const sellerLookupId = user.sellerId || user.userId;
      countSql = `SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2 OR items::text LIKE $3`;
      querySql = `SELECT * FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2 OR items::text LIKE $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`;
      countParams = [user.userId, `%"sellerId":"${user.userId}"%`, `%"sellerId":"${sellerLookupId}"%`];
      params = [...countParams, limit, offset];
    } else {
      countSql = 'SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1';
      querySql = 'SELECT * FROM shopit_orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      countParams = [user.userId];
      params = [user.userId, limit, offset];
    }

    const countRes = await dbQuery(countSql, countParams);
    const total = parseInt(countRes.rows[0].count, 10);
    const rowsRes = await dbQuery(querySql, params);

    const participantIds: string[] = [];
    for (const r of rowsRes.rows) {
      if (r.buyer_id) participantIds.push(r.buyer_id);
      if (Array.isArray(r.items)) {
        for (const it of r.items) {
          if (it?.sellerId) participantIds.push(it.sellerId);
        }
      }
    }
    const userMap = await batchLoadUserMeta(participantIds);

    const orders = rowsRes.rows.map((row: any) => {
      const isBuyerOrAdmin = row.buyer_id === user.userId || user.role === 'admin';
      const buyerMeta = row.buyer_id ? userMap.get(row.buyer_id) : undefined;
      const itemsList = Array.isArray(row.items) ? row.items : [];
      const primarySellerId = itemsList[0]?.sellerId;
      const sellerMeta = primarySellerId ? userMap.get(primarySellerId) : undefined;
      const resolvedBuyerDisplay = buyerMeta?.displayName || extractFirstName(row.buyer_name || 'Shopper');

      return {
        id: row.id,
        buyerId: row.buyer_id,
        buyerDisplayName: resolvedBuyerDisplay,
        buyerAvatarUrl: buyerMeta?.avatarUrl,
        buyerProfileSlug: buyerMeta?.profileSlug,
        buyerName: user.role === 'admin' ? row.buyer_name : undefined,
        buyerEmail: user.role === 'admin' ? row.buyer_email : undefined,
        sellerDisplayName: sellerMeta?.displayName || itemsList[0]?.sellerShopName || 'Artisan',
        sellerAvatarUrl: sellerMeta?.avatarUrl,
        sellerProfileSlug: sellerMeta?.profileSlug,
        deliveryArea: row.delivery_area || 'Yaba',
        pickupPoint: row.pickup_point,
        items: itemsList,
        itemsSubtotal: koboToNaira(row.subtotal_kobo || 0),
        serviceFeeTotal: koboToNaira(row.service_fee_kobo || 0),
        deliveryTotal: koboToNaira(row.delivery_fee_kobo || 0),
        discountTotal: koboToNaira(row.discount_total_kobo || 0),
        grandTotal: koboToNaira(row.grand_total_kobo || 0),
        status: row.status,
        paymentMethod: row.payment_method || 'online',
        paymentReference: row.payment_reference,
        // C8 Security: Never expose handshakeOtp to seller
        handshakeOtp: isBuyerOrAdmin ? row.handshake_otp : undefined,
        handshakeVerified: Boolean(row.handshake_verified),
        packedPhotoUrl: row.packed_photo_url || undefined,
        adminHold: Boolean(row.admin_hold),
        autoReleaseAt: row.auto_release_at,
        createdAt: row.created_at,
        packedAt: row.packed_at,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
        completedAt: row.completed_at,
        hasReview: Boolean(row.has_review),
      };
    });

    return res.json({
      status: true,
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/orders - C3 Security: Direct client-side paid order creation is permanently disabled
router.post('/orders', requirePaymentsEnabled, requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const emergency = await getPlatformSetting('emergency_controls', DEFAULT_EMERGENCY_CONTROLS);
  if (emergency.pauseNewOrders || emergency.maintenanceMode) {
    return res.status(503).json({
      status: false,
      error: 'ORDERS_PAUSED',
      message: 'New orders are temporarily paused by platform moderation.',
    });
  }
  return res.status(403).json({
    status: false,
    error: 'DIRECT_ORDER_CREATION_DISABLED',
    message: 'Orders cannot be created directly by the browser. Use payment checkout initialization instead.',
  });
});

// PATCH /api/orders/:id/status - C8 Strict role-enforced state machine & atomic escrow release
router.patch('/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user!;
    const { id } = req.params;
    const { status: newStatus, notes, handshakeOtp, packedPhotoUrl } = req.body;

    const validTargets = ['packed', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled'];
    if (!newStatus || !validTargets.includes(newStatus)) {
      return res.status(400).json({ status: false, message: 'Invalid order target status.' });
    }
    if (packedPhotoUrl !== undefined && packedPhotoUrl !== null && String(packedPhotoUrl).trim() !== '' && !isValidImageSource(packedPhotoUrl)) {
      return res.status(400).json({ status: false, message: 'Invalid packing verification image format.' });
    }

    const result = await withTransaction(async client => {
      const existing = await client.query('SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE', [id]);
      if (existing.rows.length === 0) {
        return { code: 404, body: { status: false, message: 'Order not found.' } };
      }

      const order = existing.rows[0];
      const prevStatus: string = order.status;
      const items: any[] = Array.isArray(order.items) ? order.items : [];

      const isAdmin = user.role === 'admin';
      const isBuyer = order.buyer_id === user.userId;
      const isOrderSeller = items.some(item => isUserSellerOwner(user, item.sellerId));

      if (!isAdmin && !isBuyer && !isOrderSeller) {
        await logAuditEvent({
          action: 'ORDER_STATUS_IDOR_BLOCKED',
          actor: { id: user.userId, email: user.email, role: user.role },
          target: { type: 'order', id },
          details: { attemptedStatus: newStatus },
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
        return { code: 403, body: { status: false, message: 'You are not authorized to modify this order.' } };
      }

      // Enforce transitions + role permissions
      if (newStatus === 'packed') {
        if (!isOrderSeller && !isAdmin) {
          return { code: 403, body: { status: false, message: 'Only the seller can mark an order as packed.' } };
        }
        if (prevStatus !== 'paid') {
          return { code: 400, body: { status: false, message: `Cannot mark as packed from status '${prevStatus}'.` } };
        }
      } else if (newStatus === 'shipped') {
        if (!isOrderSeller && !isAdmin) {
          return { code: 403, body: { status: false, message: 'Only the seller can mark an order as shipped.' } };
        }
        if (prevStatus !== 'paid' && prevStatus !== 'packed') {
          return { code: 400, body: { status: false, message: `Cannot mark as shipped from status '${prevStatus}'.` } };
        }
      } else if (newStatus === 'delivered' || newStatus === 'completed') {
        const allowedFrom =
          newStatus === 'delivered' ? ['shipped', ...(isAdmin ? ['packed'] : [])] : ['shipped', 'delivered'];
        if (!allowedFrom.includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot transition order from '${prevStatus}' to '${newStatus}'.` } };
        }

        // Only buyer, admin, OR seller WITH matching handshakeOtp may confirm delivery / completion
        let otpMatched = false;
        if (handshakeOtp && order.handshake_otp) {
          const suppliedBuf = Buffer.from(String(handshakeOtp).trim());
          const expectedBuf = Buffer.from(String(order.handshake_otp).trim());
          otpMatched = suppliedBuf.length === expectedBuf.length && crypto.timingSafeEqual(suppliedBuf, expectedBuf);
        }

        if (!isBuyer && !isAdmin && !(isOrderSeller && otpMatched)) {
          return {
            code: 403,
            body: {
              status: false,
              message: 'Only the buyer or a seller presenting the buyer’s valid 4-digit Handshake OTP may confirm delivery.',
            },
          };
        }
      } else if (newStatus === 'disputed') {
        if (!['paid', 'packed', 'shipped', 'delivered'].includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot dispute an order in '${prevStatus}' status.` } };
        }
      } else if (newStatus === 'cancelled') {
        if (!isAdmin && !isBuyer) {
          return { code: 403, body: { status: false, message: 'Only the buyer (before packing) or an administrator can cancel an order.' } };
        }
        if (!isAdmin && prevStatus !== 'paid') {
          return { code: 403, body: { status: false, message: `Orders cannot be cancelled by the buyer once status is '${prevStatus}'. Please open a dispute if you have an issue.` } };
        }
        if (!['pending_payment', 'paid'].includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot cancel order from status '${prevStatus}'.` } };
        }
      }

      // If releasing escrow or buyer cancelling, block when an open dispute exists unless admin override
      const isReleasingEscrow =
        (newStatus === 'delivered' || newStatus === 'completed') &&
        prevStatus !== 'delivered' &&
        prevStatus !== 'completed';

      if ((isReleasingEscrow || newStatus === 'cancelled') && !isAdmin) {
        const disputeCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [id]
        );
        if (disputeCheck.rows.length > 0) {
          return {
            code: 409,
            body: { status: false, message: 'Cannot modify order status while an active dispute exists on this order.' },
          };
        }
      }

      let handshakeVerified = Boolean(order.handshake_verified);
      if ((newStatus === 'delivered' || newStatus === 'completed') && (isBuyer || handshakeOtp)) {
        handshakeVerified = true;
      }

      const cleanPackedPhoto =
        newStatus === 'packed' && packedPhotoUrl && String(packedPhotoUrl).trim()
          ? String(packedPhotoUrl).trim()
          : null;

      await client.query(
        `UPDATE shopit_orders
         SET status = $1,
             handshake_verified = $2,
             packed_photo_url = COALESCE($3, packed_photo_url),
             packed_at = CASE WHEN $1 = 'packed' THEN NOW() ELSE packed_at END,
             shipped_at = CASE WHEN $1 = 'shipped' THEN NOW() ELSE shipped_at END,
             delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $4`,
        [newStatus, handshakeVerified, cleanPackedPhoto, id]
      );

      await client.query(
        `INSERT INTO shopit_order_status_history (
          id, order_id, previous_status, new_status, changed_by, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          `osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          id,
          prevStatus,
          newStatus,
          user.userId,
          notes || `Status updated from ${prevStatus} to ${newStatus}`,
        ]
      );

      if (isReleasingEscrow) {
        const sellerTotals: Record<string, number> = {};
        for (const item of items) {
          if (item.sellerId) {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const itemKobo = Math.round(Number(item.sellerPrice || 0) * 100) * qty;
            sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
          }
        }

        for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
          const wRes = await client.query(
            'SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
            [sId]
          );
          if (wRes.rows.length > 0) {
            const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
            const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || '0', 10);
            const newPending = Math.max(0, currentPending - amountKobo);
            const newAvailable = currentAvailable + amountKobo;

            const idempotencyKey = `escrow_release:${id}:${sId}`;
            const ledgerIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, order_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', 'available', 'completed',
                $4, 0, $5, $6, $7, $8, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-REL-${id}-${sId.slice(-6)}`,
                sId,
                id,
                amountKobo,
                newAvailable,
                `Escrow released for delivered Order #${id}`,
                order.payment_reference || id,
                idempotencyKey,
              ]
            );

            if (ledgerIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1,
                     available_balance_kobo = $2,
                     updated_at = NOW()
                 WHERE seller_id = $3`,
                [newPending, newAvailable, sId]
              );
            }
          }
        }
      }

      if (newStatus === 'cancelled') {
        await restoreOrderStockInTx(client, order);
        await client.query(
          'UPDATE shopit_orders SET auto_release_at = NULL, updated_at = NOW() WHERE id = $1',
          [id]
        );

        if (prevStatus === 'paid') {
          const sellerTotalsKobo: Record<string, number> = {};
          for (const item of items) {
            if (item.sellerId) {
              const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
              const kobo = (Number(item.sellerPriceKobo) || Math.round(Number(item.sellerPrice || 0) * 100)) * qty;
              sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + kobo;
            }
          }
          for (const [sId, amountKobo] of Object.entries(sellerTotalsKobo)) {
            const wRes = await client.query(
              'SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
              [sId]
            );
            if (wRes.rows.length > 0) {
              const currentPending = parseInt(String(wRes.rows[0].pending_balance_kobo || '0'), 10);
              const debitKobo = Math.min(currentPending, amountKobo);
              const nextPending = Math.max(0, currentPending - debitKobo);
              const idempotencyKey = `order_cancel_refund:${id}:${sId}`;
              const ledIns = await client.query(
                `INSERT INTO shopit_ledger_entries (
                  id, wallet_id, order_id, type, balance_type, status,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES (
                  $1, $2, $3, 'refund', 'pending', 'completed',
                  $4, 0, $5, $6, $7, $8, NOW()
                )
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id`,
                [
                  `CANCEL-REF-${id}-${sId.slice(-6)}`,
                  sId,
                  id,
                  debitKobo,
                  nextPending,
                  `Order #${id} cancelled before packing; escrow reversed for buyer refund`,
                  order.payment_reference || id,
                  idempotencyKey,
                ]
              );
              if (ledIns.rows.length > 0) {
                await client.query(
                  `UPDATE shopit_wallets
                   SET pending_balance_kobo = $1, updated_at = NOW()
                   WHERE seller_id = $2`,
                  [nextPending, sId]
                );
              }
            }
          }
        }
      }

      return {
        code: 200,
        body: { status: true, message: `Order status updated to ${newStatus}.` },
        audit: { prevStatus, newStatus, isReleasingEscrow },
        cancelledPaidOrder: newStatus === 'cancelled' && prevStatus === 'paid' ? order : null,
      };
    });

    if (result.code === 200 && (result as any).cancelledPaidOrder) {
      const ord = (result as any).cancelledPaidOrder;
      const items: any[] = Array.isArray(ord.items) ? ord.items : [];
      const flwSecret = (process.env.FLW_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
      if (process.env.PAYMENTS_ENABLED === 'true' && flwSecret && ord.payment_reference) {
        try {
          const payRes = await dbQuery('SELECT data FROM shopit_payments WHERE reference = $1 OR order_id = $2 LIMIT 1', [
            ord.payment_reference,
            id,
          ]);
          const payData = payRes.rows[0]?.data || {};
          const flwTxId = payData?.flwTransactionId || payData?.id;
          const refundNaira = koboToNaira(ord.grand_total_kobo || 0);
          if (flwTxId && refundNaira > 0) {
            const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(flwTxId))}/refund`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${flwSecret}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: refundNaira, comments: `Buyer cancelled unpacked Order #${id}` }),
            });
            if (flwRes.ok) {
              await dbQuery('UPDATE shopit_payments SET status = $1, updated_at = NOW() WHERE reference = $2', [
                'refunded',
                ord.payment_reference,
              ]);
            }
          }
        } catch (refundErr: any) {
          console.warn('[Order Cancel Gateway Refund Warning]:', refundErr?.message || refundErr);
        }
      }
      for (const sId of Array.from(new Set(items.map(i => i.sellerId).filter(Boolean)))) {
        const sRow = await dbQuery('SELECT user_id FROM shopit_sellers WHERE id = $1 OR user_id = $1 LIMIT 1', [sId]).catch(() => ({ rows: [] }));
        const targetUid = sRow.rows[0]?.user_id || sId;
        await dbQuery(
          `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
           VALUES ($1, $2, 'Order Cancelled', $3, 'info', false, '/dashboard', NOW())`,
          [
            `notif_cancel_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
            targetUid,
            `Order #${id} was cancelled by the buyer before packing. Item stock has been restored.`,
          ]
        ).catch(() => {});
      }
    }

    if (result.code === 200 && (result as any).audit) {
      await logAuditEvent({
        action: 'ORDER_STATUS_CHANGED',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'order', id },
        details: (result as any).audit,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    return res.status(result.code).json(result.body);
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/orders/:id/review - Persist verified buyer review in PostgreSQL
router.post('/orders/:id/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { productId, rating, comment } = req.body || {};

    const numRating = Math.round(Number(rating));
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ status: false, message: 'Rating must be between 1 and 5 stars.' });
    }
    const cleanComment = String(comment || '').trim().slice(0, 600);
    if (cleanComment.length < 3) {
      return res.status(400).json({ status: false, message: 'Please write at least a brief review comment.' });
    }

    const txResult = await withTransaction(async client => {
      const ordRes = await client.query('SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE', [id]);
      if (ordRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: 'Order not found.' } };
      }
      const order = ordRes.rows[0];
      if (order.buyer_id !== user.userId && user.role !== 'admin') {
        return { code: 403, body: { status: false, message: 'Only the buyer of this order can leave a review.' } };
      }
      if (!['delivered', 'completed'].includes(order.status)) {
        return { code: 400, body: { status: false, message: 'You can review an order once it has been delivered or completed.' } };
      }
      if (order.has_review) {
        return { code: 409, body: { status: false, message: 'You have already reviewed this order.' } };
      }

      const items: any[] = Array.isArray(order.items) ? order.items : [];
      const targetItem = productId ? items.find(i => i.productId === productId) : items[0];
      const targetProductId = targetItem?.productId || items[0]?.productId;
      if (!targetProductId) {
        return { code: 400, body: { status: false, message: 'No product associated with this order.' } };
      }

      const prodRes = await client.query('SELECT id, seller_id, reviews FROM shopit_products WHERE id = $1 FOR UPDATE', [targetProductId]);
      if (prodRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: 'Product listing no longer exists.' } };
      }

      const prod = prodRes.rows[0];
      const existingReviews: any[] = Array.isArray(prod.reviews) ? prod.reviews : [];
      const uRes = await client.query(
        'SELECT name, display_name, avatar_url, profile_slug FROM shopit_users WHERE id = $1 LIMIT 1',
        [user.userId]
      );
      const uRow = uRes.rows[0];
      const reviewerName = uRow?.display_name || extractFirstName(uRow?.name || user.name || 'Member');
      const reviewEntry = {
        id: `rev_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        productId: targetProductId,
        reviewerId: user.userId,
        reviewerName,
        reviewerAvatarUrl: uRow?.avatar_url || undefined,
        reviewerProfileSlug: uRow?.profile_slug || undefined,
        rating: numRating,
        comment: cleanComment,
        date: new Date().toISOString().split('T')[0],
        verifiedPurchase: true,
      };
      const updatedReviews = [reviewEntry, ...existingReviews];
      const newCount = updatedReviews.length;
      const newAvg = Number(
        (updatedReviews.reduce((sum, r) => sum + Number(r.rating || 5), 0) / newCount).toFixed(2)
      );

      await client.query(
        'UPDATE shopit_products SET reviews = $1, review_count = $2, rating = $3, updated_at = NOW() WHERE id = $4',
        [JSON.stringify(updatedReviews), newCount, newAvg, targetProductId]
      );
      await client.query(
        'UPDATE shopit_orders SET has_review = true, updated_at = NOW() WHERE id = $1',
        [id]
      );

      if (prod.seller_id) {
        const sellerProdsRes = await client.query(
          'SELECT rating, review_count FROM shopit_products WHERE seller_id = $1 AND review_count > 0',
          [prod.seller_id]
        );
        if (sellerProdsRes.rows.length > 0) {
          let totalWeight = 0;
          let weightedSum = 0;
          for (const sp of sellerProdsRes.rows) {
            const c = parseInt(String(sp.review_count || '0'), 10);
            const r = parseFloat(String(sp.rating || '5'));
            totalWeight += c;
            weightedSum += c * r;
          }
          if (totalWeight > 0) {
            const sellerAvg = Number((weightedSum / totalWeight).toFixed(2));
            await client.query(
              'UPDATE shopit_sellers SET rating = $1, updated_at = NOW() WHERE id = $2 OR user_id = $2',
              [sellerAvg, prod.seller_id]
            );
          }
        }
      }

      return {
        code: 201,
        body: {
          status: true,
          review: reviewEntry,
          rating: newAvg,
          reviewCount: newCount,
          productId: targetProductId,
          message: 'Thank you for rating your artisan!',
        },
        audit: { orderId: id, productId: targetProductId, rating: numRating },
      };
    });

    if (txResult.code === 201 && (txResult as any).audit) {
      await logAuditEvent({
        action: 'ORDER_REVIEW_SUBMITTED',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'product', id: (txResult as any).audit.productId },
        details: (txResult as any).audit,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    return res.status(txResult.code).json(txResult.body);
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

/**
 * Escrow Auto-Release Routine (C8):
 * Only releases orders that are 'shipped' or 'delivered' (NEVER never-shipped 'paid' orders!)
 * when auto_release_at <= NOW() and no dispute is open.
 * Every order release executes in a single atomic transaction with an idempotent ledger key.
 */
export async function processEscrowAutoRelease(batchLimit = 50): Promise<{ releasedCount: number; orderIds: string[] }> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(batchLimit)));
  try {
    const candidateRes = await dbQuery(
      `SELECT o.id FROM shopit_orders o
       LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
       WHERE o.status IN ('shipped', 'delivered')
         AND o.auto_release_at IS NOT NULL
         AND o.auto_release_at <= NOW()
         AND d.id IS NULL
       ORDER BY o.auto_release_at ASC
       LIMIT $1`,
      [safeLimit]
    );

    const releasedIds: string[] = [];

    for (const candidate of candidateRes.rows) {
      const released = await withTransaction(async client => {
        const orderRes = await client.query('SELECT * FROM shopit_orders WHERE id = $1 FOR UPDATE', [candidate.id]);
        if (orderRes.rows.length === 0) return false;
        const order = orderRes.rows[0];
        if (order.status !== 'shipped' && order.status !== 'delivered') return false;

        const disputeCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [order.id]
        );
        if (disputeCheck.rows.length > 0) return false;

        const items = Array.isArray(order.items) ? order.items : [];
        const sellerTotals: Record<string, number> = {};
        for (const item of items) {
          if (item.sellerId) {
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const itemKobo = Math.round(Number(item.sellerPrice || 0) * 100) * qty;
            sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
          }
        }

        for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
          const wRes = await client.query(
            'SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
            [sId]
          );
          if (wRes.rows.length > 0) {
            const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
            const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || '0', 10);
            const newPending = Math.max(0, currentPending - amountKobo);
            const newAvailable = currentAvailable + amountKobo;

            const idempotencyKey = `escrow_release:${order.id}:${sId}`;
            const ledgerIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, order_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', 'available', 'completed',
                $4, 0, $5, $6, $7, $8, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-AUTO-${order.id}-${sId.slice(-6)}`,
                sId,
                order.id,
                amountKobo,
                newAvailable,
                `5-Day Escrow auto-released for Order #${order.id}`,
                order.payment_reference || order.id,
                idempotencyKey,
              ]
            );

            if (ledgerIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1,
                     available_balance_kobo = $2,
                     updated_at = NOW()
                 WHERE seller_id = $3`,
                [newPending, newAvailable, sId]
              );
            }
          }
        }

        const prevStatus = order.status;
        await client.query(
          `UPDATE shopit_orders
           SET status = 'completed',
               auto_release_at = NULL,
               completed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        );

        await client.query(
          `INSERT INTO shopit_order_status_history (
            id, order_id, previous_status, new_status, changed_by, notes, created_at
          ) VALUES ($1, $2, $3, 'completed', 'escrow_auto_release_cron', 'Funds auto-released to seller after inspection period without dispute.', NOW())`,
          [`osh_auto_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, order.id, prevStatus]
        );

        return true;
      });

      if (released) releasedIds.push(candidate.id);
    }

    return { releasedCount: releasedIds.length, orderIds: releasedIds };
  } catch (err: any) {
    console.warn('[Escrow Auto-Release Error]:', err.message);
    return { releasedCount: 0, orderIds: [] };
  }
}

// POST /api/escrow/auto-release - Strictly Admin-authenticated manual trigger (cron runs via /api/cron/daily)
router.post('/escrow/auto-release', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const result = await processEscrowAutoRelease(50);
  const unshipped = await processUnshippedOrders(50);
  await logAuditEvent({
    action: 'ADMIN_ESCROW_SCAN_TRIGGERED',
    actor: { id: req.user!.userId, email: req.user!.email, role: req.user!.role },
    target: { type: 'escrow', id: 'batch_scan' },
    details: {
      releasedCount: result.releasedCount,
      remindedCount: unshipped.remindedCount,
      refundedCount: unshipped.refundedCount,
    },
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  return res.json({
    status: true,
    message: `Escrow scan completed. ${result.releasedCount} orders auto-released; ${unshipped.remindedCount} unshipped reminders; ${unshipped.refundedCount} Day-5 auto-refunds.`,
    ...result,
    unshipped,
  });
});

// ============================================================================
// 5. WALLET & DOUBLE-ENTRY LEDGER API
// ============================================================================

router.get('/wallet', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user!;
    const requestedSellerId = req.query.sellerId ? String(req.query.sellerId).trim() : (user.sellerId || user.userId);

    if (!isUserSellerOwner(user, requestedSellerId) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden.' });
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, false, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO NOTHING`,
      [requestedSellerId]
    );

    const walletRes = await dbQuery('SELECT * FROM shopit_wallets WHERE seller_id = $1', [requestedSellerId]);
    const walletRow = walletRes.rows[0];

    const ledgerRes = await dbQuery(
      'SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 100',
      [requestedSellerId]
    );

    const sellerMetaRes = await dbQuery(
      `SELECT s.under_18, s.guardian_name, u.age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON u.id = s.user_id
       WHERE s.id = $1 OR s.user_id = $1 LIMIT 1`,
      [requestedSellerId]
    );
    const metaRow = sellerMetaRes.rows[0];
    const parsedAge = metaRow?.age !== null && metaRow?.age !== undefined ? Number(metaRow.age) : null;
    const isMinorSeller = Boolean(metaRow?.under_18) || (parsedAge !== null && parsedAge < 18);

    const pendingKobo = parseInt(walletRow.pending_balance_kobo || '0', 10);
    const availableKobo = parseInt(walletRow.available_balance_kobo || '0', 10);
    const withdrawnKobo = parseInt(walletRow.total_withdrawn_kobo || '0', 10);

    const ledgerEntries = ledgerRes.rows.map((row: any) => {
      const amountKobo = parseInt(row.amount_kobo || '0', 10);
      const feeKobo = parseInt(row.fee_kobo || '0', 10);
      const balanceAfterKobo = parseInt(row.balance_after_kobo || '0', 10);
      return {
        id: row.id,
        walletId: row.wallet_id,
        type: row.type,
        amount: koboToNaira(amountKobo),
        amountKobo,
        fee: koboToNaira(feeKobo),
        feeKobo,
        balanceAfter: koboToNaira(balanceAfterKobo),
        balanceAfterKobo,
        balanceType: row.balance_type,
        description: row.description,
        reference: row.reference,
        createdAt: row.created_at,
      };
    });

    return res.json({
      status: true,
      wallet: {
        sellerId: walletRow.seller_id,
        pendingBalance: koboToNaira(pendingKobo),
        availableBalance: koboToNaira(availableKobo),
        totalWithdrawn: koboToNaira(withdrawnKobo),
        pendingBalanceKobo: pendingKobo,
        availableBalanceKobo: availableKobo,
        totalWithdrawnKobo: withdrawnKobo,
        isFrozen: Boolean(walletRow.is_frozen),
        freezeReason: walletRow.freeze_reason,
        isMinorSeller,
        dailyWithdrawalCap: isMinorSeller ? 25000 : 300000,
        guardianName: metaRow?.guardian_name || undefined,
        payoutAccounts: Array.isArray(walletRow.payout_accounts) ? walletRow.payout_accounts : [],
        activePayoutAccountId: walletRow.active_payout_account_id,
        ledger: ledgerEntries,
        transactions: ledgerEntries,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/wallet/payout-account - Add payout bank account with OTP verification, Flutterwave name resolve, and 24-hr cooling
router.post('/wallet/payout-account', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await runLazyPendingOrderExpiry();
    const user = req.user!;
    const { bankCode, bankName, accountNumber, accountName, otpCode } = req.body;

    if (!bankCode || !/^[A-Za-z0-9]{3,12}$/.test(String(bankCode).trim())) {
      return res.status(400).json({ status: false, message: 'A valid Nigerian bank code is required.' });
    }
    if (!bankName || !accountNumber || !/^\d{10}$/.test(String(accountNumber).trim())) {
      return res.status(400).json({ status: false, message: 'Valid bank name and 10-digit account number are required.' });
    }
    if (!otpCode) {
      return res.status(400).json({ status: false, message: 'Email OTP authorization code is required to link a payout account.' });
    }

    const flwSecret = (process.env.FLW_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!flwSecret) {
      return res.status(503).json({
        status: false,
        error: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'Bank account resolution is unavailable because FLW_SECRET_KEY is not configured.',
      });
    }

    const otpCheck = await verifyAndConsumeOtp(user.email, 'payout_account', String(otpCode).trim());
    if (!otpCheck.success) {
      return res.status(403).json({ status: false, message: otpCheck.error || 'Invalid or expired authorization code.' });
    }

    const cleanBankCode = String(bankCode).trim();
    const cleanAccountNumber = String(accountNumber).trim();

    // Verify account details directly via Flutterwave /v3/accounts/resolve
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let resolveRes: globalThis.Response;
    let resolveData: any;
    try {
      resolveRes = await fetch('https://api.flutterwave.com/v3/accounts/resolve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_number: cleanAccountNumber,
          account_bank: cleanBankCode,
        }),
        signal: controller.signal,
      });
      resolveData = await resolveRes.json().catch(() => ({}));
    } catch (err: any) {
      return res.status(502).json({ status: false, message: `Bank account verification error: ${err.message}` });
    } finally {
      clearTimeout(timeout);
    }

    if (!resolveRes.ok || resolveData?.status !== 'success' || !resolveData?.data?.account_name) {
      return res.status(400).json({
        status: false,
        message: resolveData?.message || 'Could not resolve this bank account number with Flutterwave.',
      });
    }

    const resolvedAccountName = String(resolveData.data.account_name).trim().toUpperCase();

    const sellerId = user.sellerId || user.userId;
    const sellerRes = await dbQuery(
      `SELECT s.verification_status, s.verified_legal_name, s.guardian_name, s.guardian_consent, s.under_18, u.age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON u.id = s.user_id
       WHERE s.id = $1 OR s.user_id = $2`,
      [sellerId, user.userId]
    );
    const sellerRow = sellerRes.rows[0];
    const parsedAge = sellerRow?.age !== null && sellerRow?.age !== undefined ? Number(sellerRow.age) : null;
    const isMinorSeller = Boolean(sellerRow?.under_18) || (parsedAge !== null && parsedAge < 18);

    const isSellerVerified =
      sellerRow?.verification_status === 'verified' || sellerRow?.verification_status === 'approved';
    if (!isSellerVerified && user.role !== 'admin') {
      return res.status(403).json({
        status: false,
        message: 'Complete NIN identity verification before linking a payout bank account.',
      });
    }

    if (isMinorSeller && (!sellerRow?.guardian_name || !sellerRow?.guardian_consent)) {
      return res.status(403).json({
        status: false,
        message: 'Under-18 sellers must submit verified parent/guardian identity and signed consent before linking a guardian payout account.',
      });
    }

    const expectedLegalName = isMinorSeller
      ? String(sellerRow.guardian_name).trim()
      : String(sellerRow?.verified_legal_name || user.name).trim();

    const resolvedTokens = resolvedAccountName.toLowerCase().split(/\s+/).filter(Boolean);
    const legalTokens = expectedLegalName.toLowerCase().split(/\s+/).filter(Boolean);
    const overlap = resolvedTokens.filter(t => t.length >= 2 && legalTokens.includes(t)).length;
    const requiredMatches = legalTokens.length >= 2 ? 2 : 1;

    if (overlap < requiredMatches && user.role !== 'admin') {
      return res.status(403).json({
        status: false,
        message: isMinorSeller
          ? `Under-18 payout account holder (${resolvedAccountName}) must match your guardian's verified ID name (${expectedLegalName}).`
          : `Resolved bank account name (${resolvedAccountName}) must match verified identity (${expectedLegalName}).`,
      });
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, false, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO NOTHING`,
      [sellerId]
    );

    const wRes = await dbQuery('SELECT payout_accounts FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
    const currentAccounts = wRes.rows.length > 0 && Array.isArray(wRes.rows[0].payout_accounts) ? wRes.rows[0].payout_accounts : [];

    const newAccount = {
      id: `acc_${Date.now()}`,
      bankCode: cleanBankCode,
      bankName: String(bankName).trim(),
      accountNumber: cleanAccountNumber,
      accountName: resolvedAccountName || String(accountName || '').trim().toUpperCase(),
      isVerified: true,
      isMinorGuardianAccount: isMinorSeller,
      guardianName: isMinorSeller ? expectedLegalName : undefined,
      adminApproved: !isMinorSeller,
      coolingPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    const updatedAccounts = [...currentAccounts, newAccount];

    await dbQuery(
      `UPDATE shopit_wallets
       SET payout_accounts = $1,
           active_payout_account_id = COALESCE(active_payout_account_id, $2),
           updated_at = NOW()
       WHERE seller_id = $3`,
      [JSON.stringify(updatedAccounts), newAccount.id, sellerId]
    );

    await logAuditEvent({
      action: isMinorSeller ? 'MINOR_GUARDIAN_PAYOUT_ACCOUNT_LINKED' : 'PAYOUT_ACCOUNT_LINKED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'wallet', id: sellerId },
      details: {
        bankName: newAccount.bankName,
        bankCode: newAccount.bankCode,
        last4: newAccount.accountNumber.slice(-4),
        isMinorGuardianAccount: isMinorSeller,
        adminApproved: newAccount.adminApproved,
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      status: true,
      account: newAccount,
      message: isMinorSeller
        ? 'Guardian payout account verified via Flutterwave. Requires one-time Admin approval and 24-hour cooling period before withdrawals.'
        : 'Payout account verified via Flutterwave and added with 24-hour cooling period.',
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 6. CHAT & CONVERSATIONS API (Participant-Authorized)
// ============================================================================

function mapConversationRow(
  row: any,
  userMap?: Map<string, ResolvedUserMeta>,
  unreadStats?: { unreadBuyer: number; unreadSeller: number },
  isBlocked = false
) {
  const buyerMeta = row.buyer_id ? userMap?.get(row.buyer_id) : undefined;
  const sellerMeta = row.seller_id ? userMap?.get(row.seller_id) : undefined;
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productTitle: row.product_title || (row.order_id ? `Order #${row.order_id}` : 'Marketplace Craft Inquiry'),
    productImage: row.product_image || undefined,
    buyerId: row.buyer_id,
    buyerDisplayName: buyerMeta?.displayName || row.buyer_masked_id || extractFirstName(row.buyer_name || 'Member'),
    buyerAvatarUrl: buyerMeta?.avatarUrl,
    buyerProfileSlug: buyerMeta?.profileSlug,
    sellerId: row.seller_id,
    sellerShopName: row.seller_shop_name || sellerMeta?.displayName || 'Artisan',
    sellerDisplayName: sellerMeta?.displayName || row.seller_shop_name || 'Artisan',
    sellerAvatarUrl: sellerMeta?.avatarUrl,
    sellerProfileSlug: sellerMeta?.profileSlug,
    lastMessage: row.last_message || 'Conversation started',
    lastMessageAt: row.last_message_at || row.created_at,
    unreadBuyer: unreadStats ? unreadStats.unreadBuyer : 0,
    unreadSeller: unreadStats ? unreadStats.unreadSeller : 0,
    isChatLocked: Boolean(row.is_chat_locked),
    isBlocked,
    bypassViolationsCount: parseInt(row.bypass_violations_count, 10) || 0,
    createdAt: row.created_at,
  };
}

async function computeConversationUnreadAndBlocks(
  convRows: any[],
  userMap: Map<string, ResolvedUserMeta>
): Promise<{
  unreadMap: Map<string, { unreadBuyer: number; unreadSeller: number }>;
  blockedConvSet: Set<string>;
}> {
  const unreadMap = new Map<string, { unreadBuyer: number; unreadSeller: number }>();
  const blockedConvSet = new Set<string>();
  if (convRows.length === 0) return { unreadMap, blockedConvSet };

  const convIds = convRows.map(c => c.id).filter(Boolean);
  const { placeholders, params } = buildInClause(convIds);
  const msgRes = await dbQuery(
    `SELECT conversation_id, sender_id, sender_role, created_at
     FROM shopit_chat_messages
     WHERE conversation_id IN (${placeholders})`,
    params
  ).catch(() => ({ rows: [] }));

  const msgsByConv = new Map<string, any[]>();
  for (const m of msgRes.rows) {
    const list = msgsByConv.get(m.conversation_id) || [];
    list.push(m);
    msgsByConv.set(m.conversation_id, list);
  }

  for (const conv of convRows) {
    const msgs = msgsByConv.get(conv.id) || [];
    const buyerReadMs = conv.buyer_last_read_at ? new Date(conv.buyer_last_read_at).getTime() : 0;
    const sellerReadMs = conv.seller_last_read_at ? new Date(conv.seller_last_read_at).getTime() : 0;
    let unreadBuyer = 0;
    let unreadSeller = 0;

    for (const m of msgs) {
      const mMs = new Date(m.created_at).getTime();
      if (m.sender_id !== conv.buyer_id && mMs > buyerReadMs) {
        unreadBuyer++;
      }
      if (m.sender_id === conv.buyer_id && mMs > sellerReadMs) {
        unreadSeller++;
      }
    }
    unreadMap.set(conv.id, { unreadBuyer, unreadSeller });
  }

  const allParticipantUserIds = Array.from(
    new Set(
      convRows
        .flatMap(c => [c.buyer_id, userMap.get(c.seller_id)?.id || c.seller_id])
        .filter(Boolean)
    )
  );
  if (allParticipantUserIds.length > 0) {
    const bIn = buildInClause(allParticipantUserIds);
    const blkRes = await dbQuery(
      `SELECT blocker_id, blocked_id FROM shopit_blocks WHERE blocker_id IN (${bIn.placeholders}) OR blocked_id IN (${bIn.placeholders})`,
      bIn.params
    ).catch(() => ({ rows: [] }));
    const blockPairs = new Set<string>(blkRes.rows.map((r: any) => `${r.blocker_id}:${r.blocked_id}`));

    for (const conv of convRows) {
      const sellerUserId = userMap.get(conv.seller_id)?.id || conv.seller_id;
      if (blockPairs.has(`${conv.buyer_id}:${sellerUserId}`) || blockPairs.has(`${sellerUserId}:${conv.buyer_id}`)) {
        blockedConvSet.add(conv.id);
      }
    }
  }

  return { unreadMap, blockedConvSet };
}

router.get('/chat/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const sellerLookup = user.sellerId || user.userId;
    const result =
      user.role === 'admin'
        ? await dbQuery(`SELECT * FROM shopit_chat_conversations ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT 100`)
        : await dbQuery(
            `SELECT * FROM shopit_chat_conversations
             WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2
             ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
            [user.userId, sellerLookup]
          );

    const ids: string[] = [];
    for (const r of result.rows) {
      if (r.buyer_id) ids.push(r.buyer_id);
      if (r.seller_id) ids.push(r.seller_id);
    }
    const userMap = await batchLoadUserMeta(ids);
    const { unreadMap, blockedConvSet } = await computeConversationUnreadAndBlocks(result.rows, userMap);
    const conversations = result.rows.map((r: any) =>
      mapConversationRow(r, userMap, unreadMap.get(r.id), blockedConvSet.has(r.id))
    );

    return res.json({ status: true, conversations });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

/**
 * GET /api/chat/unread-count
 * Lightweight single-query endpoint used by gentle global badge polling (avoids fetching full threads/messages).
 */
router.get('/chat/unread-count', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const sellerLookup = user.sellerId || user.userId;
    const countRes = await dbQuery(
      `SELECT COUNT(*)::int AS unread_count
       FROM shopit_chat_messages m
       JOIN shopit_chat_conversations c ON c.id = m.conversation_id
       WHERE (c.buyer_id = $1 AND m.sender_id != c.buyer_id AND m.created_at > COALESCE(c.buyer_last_read_at, '1970-01-01T00:00:00Z'::timestamptz))
          OR ((c.seller_id = $1 OR c.seller_id = $2) AND m.sender_id = c.buyer_id AND m.created_at > COALESCE(c.seller_last_read_at, '1970-01-01T00:00:00Z'::timestamptz))`,
      [user.userId, sellerLookup]
    );
    return res.json({
      status: true,
      unreadCount: Number(countRes.rows[0]?.unread_count || 0),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: 'Unable to fetch unread message count.' });
  }
});

router.post('/chat/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId, productId, productTitle, productImage, orderId } = req.body || {};
    if (!sellerId) {
      return res.status(400).json({ status: false, message: 'sellerId is required.' });
    }
    if (isUserSellerOwner(user, String(sellerId))) {
      return res.status(400).json({ status: false, message: 'You cannot open a chat conversation with your own shop.' });
    }

    const sellerRes = await dbQuery(
      `SELECT s.id, s.user_id, s.shop_name, s.under_18 as s_under_18,
              u.id as u_id, u.age, u.privacy_settings, u.is_banned, u.deleted_at
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1
       LIMIT 1`,
      [sellerId]
    );
    let targetUserRow = sellerRes.rows[0];
    if (!targetUserRow) {
      const fallbackUserRes = await dbQuery(
        'SELECT id as u_id, age, privacy_settings, is_banned, deleted_at FROM shopit_users WHERE id = $1 LIMIT 1',
        [sellerId]
      );
      if (fallbackUserRes.rows[0]) {
        targetUserRow = fallbackUserRes.rows[0];
      }
    }
    if (!targetUserRow || targetUserRow.deleted_at || targetUserRow.is_banned) {
      return res.status(404).json({ status: false, message: 'This seller account is unavailable.' });
    }

    const canonicalSellerId = targetUserRow.id || String(sellerId);
    const sellerUserId = targetUserRow.user_id || targetUserRow.u_id || canonicalSellerId;
    if (sellerUserId === user.userId || isUserSellerOwner(user, canonicalSellerId)) {
      return res.status(400).json({ status: false, message: 'You cannot open a chat conversation with your own shop.' });
    }
    const shopName = targetUserRow.shop_name || 'Artisan';

    // Check mutual block
    if (user.role !== 'admin') {
      const blkRes = await dbQuery(
        `SELECT id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [user.userId, sellerUserId]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: 'You cannot message this user because one of you has blocked the other.' });
      }
    }

    // DB-verify productId and orderId (client cannot spoof a fake product/order link)
    const cleanProductId = productId ? String(productId).trim() : null;
    const cleanOrderId = orderId ? String(orderId).trim() : null;

    let verifiedProduct: { id: string; title: string; images: any } | null = null;
    if (cleanProductId) {
      const prodRes = await dbQuery(
        `SELECT id, seller_id, title, images, is_draft
         FROM shopit_products
         WHERE id = $1
         LIMIT 1`,
        [cleanProductId]
      );
      const pRow = prodRes.rows[0];
      if (!pRow || pRow.is_draft) {
        return res.status(404).json({ status: false, message: 'Referenced product listing was not found.' });
      }
      if (pRow.seller_id !== canonicalSellerId && pRow.seller_id !== sellerUserId) {
        return res.status(403).json({ status: false, message: 'That product does not belong to this seller.' });
      }
      verifiedProduct = { id: pRow.id, title: pRow.title, images: pRow.images };
    }

    let verifiedOrderId: string | null = null;
    if (cleanOrderId) {
      const ordRes = await dbQuery(
        `SELECT id, buyer_id, items FROM shopit_orders WHERE id = $1 LIMIT 1`,
        [cleanOrderId]
      );
      const oRow = ordRes.rows[0];
      if (!oRow) {
        return res.status(404).json({ status: false, message: 'Referenced order was not found.' });
      }
      const orderItems = Array.isArray(oRow.items)
        ? oRow.items
        : typeof oRow.items === 'string'
          ? (() => { try { return JSON.parse(oRow.items); } catch { return []; } })()
          : [];
      const involvesSeller = orderItems.some(
        (it: any) => it?.sellerId === canonicalSellerId || it?.sellerId === sellerUserId
      );
      if ((oRow.buyer_id !== user.userId && user.role !== 'admin') || !involvesSeller) {
        return res.status(403).json({ status: false, message: 'You are not authorized to chat on this order.' });
      }
      verifiedOrderId = oRow.id;
    }

    // Also detect any existing DB order between buyer and this seller
    const existingOrderRes = verifiedOrderId
      ? null
      : await dbQuery(
          `SELECT id FROM shopit_orders
           WHERE buyer_id = $1 AND (items::text LIKE $2 OR items::text LIKE $3)
           ORDER BY created_at DESC LIMIT 1`,
          [user.userId, `%"sellerId":"${canonicalSellerId}"%`, `%"sellerId":"${sellerUserId}"%`]
        );
    const hasExistingOrder = Boolean(verifiedOrderId || existingOrderRes?.rows?.length);

    // Fetch buyer age to enforce minor safety rules strictly in both directions
    const buyerAgeRes = await dbQuery('SELECT age FROM shopit_users WHERE id = $1 LIMIT 1', [user.userId]);
    const buyerIsUnder18 = isMinorAccount({ age: buyerAgeRes.rows[0]?.age });
    const sellerIsUnder18 = isMinorAccount({ age: targetUserRow.age, sellerUnder18: targetUserRow.s_under_18 });

    const minorChatGate = evaluateMinorChatStart({
      sellerIsUnder18,
      buyerIsUnder18,
      hasVerifiedProduct: Boolean(verifiedProduct),
      hasVerifiedOrder: hasExistingOrder,
      isAdmin: user.role === 'admin',
    });
    if (!minorChatGate.allowed) {
      return res.status(403).json({
        status: false,
        message: minorChatGate.reason,
      });
    }

    // Check adult/recipient's whoCanMessage privacy setting (product/order or mutual/follower rules)
    if (user.role !== 'admin' && !sellerIsUnder18 && !buyerIsUnder18) {
      const basePrivacy = DEFAULT_PRIVACY_SETTINGS;
      const rawPrivacy = typeof targetUserRow.privacy_settings === 'string'
        ? (() => { try { return JSON.parse(targetUserRow.privacy_settings); } catch { return basePrivacy; } })()
        : targetUserRow.privacy_settings || basePrivacy;
      const privacy = sanitizePrivacySettings(rawPrivacy, basePrivacy, false);

      if (privacy.whoCanMessage !== 'everyone' && !hasExistingOrder) {
        const [fViewerToTarget, fTargetToViewer] = await Promise.all([
          dbQuery(`SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`, [user.userId, sellerUserId]),
          dbQuery(`SELECT 1 FROM shopit_follows WHERE follower_id = $1 AND following_id = $2 AND status = 'accepted' LIMIT 1`, [sellerUserId, user.userId]),
        ]);
        const viewerFollows = fViewerToTarget.rows.length > 0;
        const targetFollows = fTargetToViewer.rows.length > 0;

        if (privacy.whoCanMessage === 'followers' && !viewerFollows) {
          return res.status(403).json({
            status: false,
            message: 'This member only accepts messages from followers or customers with an order.',
          });
        }
        if (privacy.whoCanMessage === 'mutual' && !(viewerFollows && targetFollows)) {
          return res.status(403).json({
            status: false,
            message: 'This member only accepts messages from mutual followers or customers with an order.',
          });
        }
      }
    }

    let resolvedTitle = verifiedProduct?.title || (productTitle ? String(productTitle).trim().slice(0, 200) : null);
    let resolvedImage = productImage ? String(productImage).trim() : null;
    if (verifiedProduct && !resolvedImage && Array.isArray(verifiedProduct.images) && verifiedProduct.images[0]) {
      resolvedImage = verifiedProduct.images[0];
    }

    const userMap = await batchLoadUserMeta([user.userId, canonicalSellerId, sellerUserId]);
    const buyerDisplayName = userMap.get(user.userId)?.displayName || extractFirstName(user.name || 'Member');

    const effectiveOrderId = verifiedOrderId || existingOrderRes?.rows?.[0]?.id || null;

    const existing = await dbQuery(
      `SELECT * FROM shopit_chat_conversations
       WHERE buyer_id = $1 AND (seller_id = $2 OR seller_id = $3)
       ORDER BY last_message_at DESC NULLS LAST LIMIT 1`,
      [user.userId, String(sellerId), canonicalSellerId]
    );
    if (existing.rows.length > 0) {
      let existingRow = existing.rows[0];
      if (verifiedProduct?.id || effectiveOrderId || resolvedTitle) {
        const upd = await dbQuery(
          `UPDATE shopit_chat_conversations
           SET product_id = COALESCE($1, product_id),
               product_title = COALESCE($2, product_title),
               product_image = COALESCE($3, product_image),
               order_id = COALESCE($4, order_id),
               seller_shop_name = COALESCE($5, seller_shop_name),
               buyer_masked_id = COALESCE($6, buyer_masked_id)
           WHERE id = $7
           RETURNING *`,
          [verifiedProduct?.id || null, resolvedTitle, resolvedImage, effectiveOrderId, shopName, buyerDisplayName, existingRow.id]
        );
        if (upd.rows.length > 0) existingRow = upd.rows[0];
      }
      const { unreadMap, blockedConvSet } = await computeConversationUnreadAndBlocks([existingRow], userMap);
      return res.json({
        status: true,
        conversation: mapConversationRow(existingRow, userMap, unreadMap.get(existingRow.id), blockedConvSet.has(existingRow.id)),
      });
    }

    const convId = `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const insertRes = await dbQuery(
      `INSERT INTO shopit_chat_conversations (
        id, order_id, product_id, product_title, product_image,
        buyer_id, buyer_masked_id, seller_id, seller_shop_name,
        last_message, last_message_at, buyer_last_read_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Chat started', NOW(), NOW(), NOW())
      RETURNING *`,
      [convId, effectiveOrderId, verifiedProduct?.id || null, resolvedTitle, resolvedImage, user.userId, buyerDisplayName, canonicalSellerId, shopName]
    );

    await logAuditEvent({
      action: 'CHAT_CONVERSATION_STARTED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'conversation', id: convId },
      details: { sellerId: canonicalSellerId, shopName, productId: verifiedProduct?.id || null, productTitle: resolvedTitle, orderId: effectiveOrderId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      status: true,
      conversation: mapConversationRow(insertRes.rows[0], userMap, { unreadBuyer: 0, unreadSeller: 0 }, false),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/chat/conversations/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const convRes = await dbQuery('SELECT * FROM shopit_chat_conversations WHERE id = $1 LIMIT 1', [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Conversation not found.' });
    }
    const conv = convRes.rows[0];
    const isBuyer = conv.buyer_id === user.userId;
    const isSeller = isUserSellerOwner(user, conv.seller_id);
    if (!isBuyer && !isSeller && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Access denied to this conversation.' });
    }

    let updatedConv = conv;
    if (isBuyer) {
      const upd = await dbQuery(
        'UPDATE shopit_chat_conversations SET buyer_last_read_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (upd.rows[0]) updatedConv = upd.rows[0];
    } else if (isSeller) {
      const upd = await dbQuery(
        'UPDATE shopit_chat_conversations SET seller_last_read_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );
      if (upd.rows[0]) updatedConv = upd.rows[0];
    }

    const userMap = await batchLoadUserMeta([conv.buyer_id, conv.seller_id]);
    const { unreadMap } = await computeConversationUnreadAndBlocks([updatedConv], userMap);
    const counts = unreadMap.get(id) || { unreadBuyer: 0, unreadSeller: 0 };

    return res.json({ status: true, conversationId: id, ...counts });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.get('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const rl = await checkAndRecordRateLimit(`chat_poll:${user.userId}`, 60, 60 * 1000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds || 10));
      return res.status(429).json({ status: false, message: 'Polling too quickly. Slowing down requests.' });
    }

    const { id } = req.params;
    const convRes = await dbQuery('SELECT * FROM shopit_chat_conversations WHERE id = $1', [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Conversation not found.' });
    }
    const conv = convRes.rows[0];
    if (conv.buyer_id !== user.userId && !isUserSellerOwner(user, conv.seller_id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Access denied to this conversation.' });
    }

    const afterId = req.query.afterId ? String(req.query.afterId).trim() : '';
    let afterCreatedAt = req.query.afterCreatedAt ? String(req.query.afterCreatedAt).trim() : '';
    let anchorDbCreatedAt: any = null;

    if (afterId) {
      const anchorRes = await dbQuery(
        'SELECT created_at FROM shopit_chat_messages WHERE conversation_id = $1 AND id = $2 LIMIT 1',
        [id, afterId]
      );
      if (anchorRes.rows[0]?.created_at) {
        anchorDbCreatedAt = anchorRes.rows[0].created_at;
        afterCreatedAt = new Date(anchorRes.rows[0].created_at).toISOString();
      }
    }

    const hasCursor = Boolean(anchorDbCreatedAt || (afterCreatedAt && !Number.isNaN(Date.parse(afterCreatedAt))));
    const cursorTimestamp = anchorDbCreatedAt || afterCreatedAt;
    const result = hasCursor
      ? await dbQuery(
          `SELECT * FROM shopit_chat_messages
           WHERE conversation_id = $1
             AND (created_at > $2::timestamptz OR (created_at = $2::timestamptz AND id > $3))
             AND id != $3
           ORDER BY created_at ASC, id ASC
           LIMIT 200`,
          [id, cursorTimestamp, afterId || '__none__']
        )
      : await dbQuery(
          'SELECT * FROM shopit_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC LIMIT 200',
          [id]
        );

    if (result.rows.length === 0) {
      return res.json({ status: true, messages: [], hasNew: false });
    }

    const senderMap = await batchLoadUserMeta([conv.buyer_id, conv.seller_id, ...result.rows.map((r: any) => r.sender_id)]);
    const buyerReadMs = conv.buyer_last_read_at ? new Date(conv.buyer_last_read_at).getTime() : 0;
    const sellerReadMs = conv.seller_last_read_at ? new Date(conv.seller_last_read_at).getTime() : 0;

    return res.json({
      status: true,
      hasNew: true,
      messages: result.rows.map((row: any) => {
        const sMeta = row.sender_id ? senderMap.get(row.sender_id) : undefined;
        const senderDisplayName =
          row.sender_role === 'admin'
            ? 'Shop It Moderation'
            : sMeta?.displayName || row.sender_masked_name || 'Member';
        const msgMs = new Date(row.created_at).getTime();
        const isSentByBuyer = row.sender_id === conv.buyer_id;
        const readByOther = isSentByBuyer ? sellerReadMs >= msgMs : buyerReadMs >= msgMs;

        const parsedAttachment =
          row.attachment && typeof row.attachment === 'string'
            ? (() => { try { return JSON.parse(row.attachment); } catch { return undefined; } })()
            : row.attachment || undefined;

        return {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          senderRole: row.sender_role,
          senderDisplayName,
          senderAvatarUrl: sMeta?.avatarUrl,
          senderProfileSlug: sMeta?.profileSlug,
          content: row.content,
          attachment: parsedAttachment,
          readByOther,
          isBlockedBypass: Boolean(row.is_blocked_bypass),
          presetOffer: row.preset_offer || undefined,
          createdAt: row.created_at,
          timestamp: row.created_at,
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const check = rejectUnknownFields(req.body || {}, ['content', 'presetOffer', 'attachment']);
    if (!check.ok) {
      return res.status(400).json({ status: false, message: check.message });
    }
    const { content, presetOffer, attachment } = check.obj;

    const convRes = await dbQuery('SELECT * FROM shopit_chat_conversations WHERE id = $1', [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Conversation not found.' });
    }
    const conv = convRes.rows[0];
    if (conv.buyer_id !== user.userId && !isUserSellerOwner(user, conv.seller_id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Access denied to this conversation.' });
    }
    if (conv.is_chat_locked) {
      return res.status(403).json({ status: false, message: 'This conversation has been locked by moderation.' });
    }

    const sellerOwnerRes = await dbQuery(
      `SELECT s.user_id, s.under_18 as s_under_18, u.age as u_age
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON (u.id = s.user_id OR u.id = s.id)
       WHERE s.id = $1 OR s.user_id = $1
       LIMIT 1`,
      [conv.seller_id]
    );
    const sellerUserId = sellerOwnerRes.rows[0]?.user_id || conv.seller_id;
    const [buyerAgeRow, sellerAgeRow] = await Promise.all([
      dbQuery('SELECT age FROM shopit_users WHERE id = $1 LIMIT 1', [conv.buyer_id]),
      sellerOwnerRes.rows[0]
        ? Promise.resolve({ rows: [sellerOwnerRes.rows[0]] })
        : dbQuery('SELECT age as u_age FROM shopit_users WHERE id = $1 LIMIT 1', [sellerUserId]),
    ]);

    const buyerIsUnder18 = isMinorAccount({ age: buyerAgeRow.rows[0]?.age });
    const sellerIsUnder18 = isMinorAccount({
      age: sellerAgeRow.rows[0]?.u_age,
      sellerUnder18: sellerAgeRow.rows[0]?.s_under_18,
    });
    const minorMsgGate = evaluateMinorMessageSend({
      sellerIsUnder18,
      buyerIsUnder18,
      conversationProductId: conv.product_id,
      conversationOrderId: conv.order_id,
      isAdmin: user.role === 'admin',
    });
    if (!minorMsgGate.allowed) {
      return res.status(403).json({ status: false, message: minorMsgGate.reason });
    }

    if (user.role !== 'admin') {
      const blkRes = await dbQuery(
        `SELECT id FROM shopit_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [conv.buyer_id, sellerUserId]
      );
      if (blkRes.rows.length > 0) {
        return res.status(403).json({ status: false, message: 'Messaging is disabled because one participant has blocked the other.' });
      }
    }

    let attachmentMeta:
      | { id: string; url: string; originalName: string; mimeType: string; sizeBytes: number; kind: 'image' | 'document' }
      | undefined;

    if (attachment && typeof attachment === 'object' && attachment.fileId) {
      const fileId = String(attachment.fileId).trim();
      const fRes = await dbQuery(
        'SELECT id, owner_id, original_name, mime_type, size_bytes, conversation_id FROM shopit_files WHERE id = $1 LIMIT 1',
        [fileId]
      );
      if (fRes.rows.length === 0) {
        return res.status(400).json({ status: false, message: 'Attached file was not found.' });
      }
      const fRow = fRes.rows[0];
      if (fRow.owner_id !== user.userId && user.role !== 'admin') {
        return res.status(403).json({ status: false, message: 'You can only attach files that you uploaded.' });
      }
      if (fRow.conversation_id && fRow.conversation_id !== id) {
        return res.status(403).json({ status: false, message: 'This file is attached to a different conversation.' });
      }
      await dbQuery('UPDATE shopit_files SET conversation_id = $1, is_public = false WHERE id = $2', [id, fileId]);
      attachmentMeta = {
        id: fRow.id,
        url: `/api/files/${fRow.id}`,
        originalName: fRow.original_name,
        mimeType: fRow.mime_type,
        sizeBytes: Number(fRow.size_bytes || 0),
        kind: String(fRow.mime_type || '').startsWith('image/') ? 'image' : 'document',
      };
    }

    const sanitizedPresetOffer =
      presetOffer && typeof presetOffer === 'object' && Number.isFinite(Number(presetOffer.price)) && Number.isFinite(Number(presetOffer.quantity))
        ? {
            price: Math.max(100, Math.round(Number(presetOffer.price))),
            quantity: Math.max(1, Math.min(100, Math.round(Number(presetOffer.quantity)))),
            title: presetOffer.title ? String(presetOffer.title).trim().slice(0, 120) : undefined,
          }
        : undefined;

    const cleanContent = content !== undefined && content !== null ? String(content).trim().slice(0, 1000) : '';
    if (!cleanContent && !attachmentMeta && !sanitizedPresetOffer) {
      return res.status(400).json({ status: false, message: 'Message text or an attachment is required.' });
    }

    const phoneRegex = /(\+?234|0)[789][01]\d{8}/;
    const bankRegex = /\b\d{10}\b/;
    const whatsappRegex = /(wa\.me|whatsapp|t\.me|telegram|ig\s*dm|dm\s*me\s*on\s*ig|instagram|snapchat|call\s*me|opay|palmpay|kuda|acct\s*no|account\s*number)/i;
    const freeTextDigitRegex = !sanitizedPresetOffer ? /\d/ : /$^/;

    const isBypass = Boolean(
      cleanContent &&
        (phoneRegex.test(cleanContent) ||
          bankRegex.test(cleanContent) ||
          whatsappRegex.test(cleanContent) ||
          freeTextDigitRegex.test(cleanContent))
    );
    const msgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const role = isUserSellerOwner(user, conv.seller_id) ? 'seller' : (user.role === 'admin' ? 'admin' : 'buyer');

    const senderMap = await batchLoadUserMeta([user.userId]);
    const sMeta = senderMap.get(user.userId);
    const senderDisplayName =
      role === 'seller'
        ? conv.seller_shop_name || sMeta?.displayName || 'Artisan'
        : role === 'admin'
          ? 'Shop It Moderation'
          : sMeta?.displayName || extractFirstName(user.name || 'Member');

    const savedContent = isBypass
      ? '[Security Notice: Numbers, phone numbers, account numbers, and off-platform contact details are prohibited in chat.]'
      : cleanContent;

    const savedAttachment = isBypass ? undefined : attachmentMeta;
    const lastMessagePreview = savedContent
      ? savedContent
      : savedAttachment
        ? `[Attachment: ${savedAttachment.originalName}]`
        : '[Custom Offer]';

    const nowIso = new Date().toISOString();

    const insRes = await dbQuery(
      `INSERT INTO shopit_chat_messages (
        id, conversation_id, sender_id, sender_role, sender_masked_name,
        content, is_blocked_bypass, preset_offer, attachment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
      RETURNING created_at`,
      [
        msgId,
        id,
        user.userId,
        role,
        senderDisplayName,
        savedContent,
        isBypass,
        sanitizedPresetOffer ? JSON.stringify(sanitizedPresetOffer) : null,
        savedAttachment ? JSON.stringify(savedAttachment) : null,
        nowIso,
      ]
    );
    const storedCreatedAt = insRes.rows[0]?.created_at
      ? new Date(insRes.rows[0].created_at).toISOString()
      : nowIso;

    const nextViolations = (parseInt(conv.bypass_violations_count, 10) || 0) + (isBypass ? 1 : 0);
    const readCursorColumn = conv.buyer_id === user.userId ? 'buyer_last_read_at' : 'seller_last_read_at';
    await dbQuery(
      `UPDATE shopit_chat_conversations
       SET last_message = $1, last_message_at = NOW(),
           bypass_violations_count = $2,
           is_chat_locked = CASE WHEN $2 >= 2 THEN true ELSE is_chat_locked END,
           ${readCursorColumn} = NOW()
       WHERE id = $3`,
      [lastMessagePreview.slice(0, 200), nextViolations, id]
    );

    // Notify recipient in shopit_notifications (skip if recipient muted sender)
    try {
      const recipientUserId = role === 'buyer' ? sellerUserId : conv.buyer_id;
      if (recipientUserId && recipientUserId !== user.userId) {
        const muteCheck = await dbQuery(
          'SELECT 1 FROM shopit_mutes WHERE muter_id = $1 AND muted_id = $2 LIMIT 1',
          [recipientUserId, user.userId]
        );
        if (muteCheck.rows.length === 0) {
          const notifTitle = `New Message from ${senderDisplayName}`;
          const notifBody = isBypass
            ? 'A blocked safety notice was logged in your conversation.'
            : lastMessagePreview.slice(0, 140);
          await dbQuery(
            `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read, link, created_at)
             VALUES ($1, $2, $3, $4, 'info', false, '/chat', NOW())`,
            [
              `notif_chat_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              recipientUserId,
              notifTitle,
              notifBody,
            ]
          );
          const recRes = await dbQuery(
            'SELECT email, display_name, name, notification_prefs FROM shopit_users WHERE id = $1 LIMIT 1',
            [recipientUserId]
          );
          const recRow = recRes.rows[0];
          const rawPrefs =
            typeof recRow?.notification_prefs === 'string'
              ? JSON.parse(recRow.notification_prefs)
              : recRow?.notification_prefs;
          const prefs = sanitizeNotificationPrefs(rawPrefs || DEFAULT_NOTIFICATION_PREFS);
          if (prefs.emailMessages && recRow?.email && !String(recRow.email).endsWith('.local')) {
            const recName = recRow.display_name || extractFirstName(recRow.name || 'Friend');
            sendBrevoDirect(
              recRow.email,
              notifTitle,
              `Hi ${recName},\n\n${senderDisplayName} sent you a message on Shop It: "${notifBody}"`,
              `<p>Hi ${recName},</p><p><strong>${senderDisplayName}</strong> sent you a message on Shop It:</p><blockquote>${notifBody}</blockquote>`,
              recName
            ).catch(() => {});
          }
        }
      }
    } catch {}

    await logAuditEvent({
      action: isBypass ? 'CHAT_BYPASS_BLOCKED' : 'CHAT_MESSAGE_SENT',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'conversation', id },
      details: {
        senderRole: role,
        isBlockedBypass: isBypass,
        hasAttachment: Boolean(savedAttachment),
        violationsCount: nextViolations,
        preview: isBypass ? '[Off-platform contact blocked]' : lastMessagePreview.slice(0, 80),
      },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      status: true,
      message: {
        id: msgId,
        conversationId: id,
        senderId: user.userId,
        senderRole: role,
        senderDisplayName,
        senderAvatarUrl: sMeta?.avatarUrl,
        senderProfileSlug: sMeta?.profileSlug,
        content: savedContent,
        attachment: savedAttachment,
        readByOther: false,
        isBlockedBypass: isBypass,
        presetOffer: sanitizedPresetOffer,
        createdAt: storedCreatedAt,
        timestamp: storedCreatedAt,
      },
      isChatLocked: nextViolations >= 2 || Boolean(conv.is_chat_locked),
      bypassViolationsCount: nextViolations,
      warning: isBypass ? 'Anti-bypass trigger: Personal contact info or numbers redacted for marketplace safety.' : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 7. DISPUTES API (PostgreSQL: shopit_disputes)
// ============================================================================

router.get('/disputes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const sellerLookup = user.sellerId || user.userId;
    const result =
      user.role === 'admin'
        ? await dbQuery('SELECT * FROM shopit_disputes ORDER BY created_at DESC')
        : await dbQuery(
            'SELECT * FROM shopit_disputes WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2 ORDER BY created_at DESC',
            [user.userId, sellerLookup]
          );

    const ids: string[] = [];
    for (const r of result.rows) {
      if (r.buyer_id) ids.push(r.buyer_id);
      if (r.seller_id) ids.push(r.seller_id);
    }
    const userMap = await batchLoadUserMeta(ids);

    return res.json({
      status: true,
      disputes: result.rows.map((row: any) => {
        const bMeta = row.buyer_id ? userMap.get(row.buyer_id) : undefined;
        const sMeta = row.seller_id ? userMap.get(row.seller_id) : undefined;
        return {
          id: row.id,
          orderId: row.order_id,
          sellerId: row.seller_id,
          buyerId: row.buyer_id,
          buyerDisplayName: bMeta?.displayName || row.buyer_masked_id || extractFirstName(row.buyer_name || 'Buyer'),
          buyerAvatarUrl: bMeta?.avatarUrl,
          buyerProfileSlug: bMeta?.profileSlug,
          sellerShopName: row.seller_shop_name,
          sellerDisplayName: sMeta?.displayName || row.seller_shop_name,
          sellerAvatarUrl: sMeta?.avatarUrl,
          sellerProfileSlug: sMeta?.profileSlug,
          reason: row.reason,
          description: row.description,
          amountHeldInEscrow: koboToNaira(row.amount_held_in_escrow_kobo || 0),
          amountHeldInEscrowKobo: Number(row.amount_held_in_escrow_kobo || 0),
          evidencePhotoUrl: row.evidence_photo_url,
          sellerPackedPhotoUrl: row.seller_packed_photo_url,
          status: row.status,
          resolutionNotes: row.resolution_notes,
          createdAt: row.created_at,
        };
      }),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/disputes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { orderId, reason, description, evidencePhotoUrl } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ status: false, message: 'orderId and reason are required.' });
    }
    if (evidencePhotoUrl !== undefined && evidencePhotoUrl !== null && String(evidencePhotoUrl).trim() !== '' && !isValidImageSource(evidencePhotoUrl)) {
      return res.status(400).json({ status: false, message: 'Invalid dispute evidence image format.' });
    }

    const oRes = await dbQuery('SELECT * FROM shopit_orders WHERE id = $1', [orderId]);
    if (oRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Order not found.' });
    }

    const order = oRes.rows[0];
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const isParticipant =
      order.buyer_id === user.userId ||
      items.some(i => isUserSellerOwner(user, i.sellerId)) ||
      user.role === 'admin';

    if (!isParticipant) {
      return res.status(403).json({ status: false, message: 'Only participants of this order may open a dispute.' });
    }

    const sellerId = items[0]?.sellerId;
    if (!sellerId) {
      return res.status(400).json({ status: false, message: 'Order has no associated seller for dispute tracking.' });
    }
    const sellerShopName = items[0]?.sellerShopName || 'Artisan';
    const disputeId = `DISP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const buyerMetaMap = await batchLoadUserMeta([order.buyer_id || user.userId]);
    const buyerDisplayName = buyerMetaMap.get(order.buyer_id || user.userId)?.displayName || extractFirstName(order.buyer_name || 'Buyer');
    const escrowHeldKobo = Number(order.grand_total_kobo || 0);

    await withTransaction(async client => {
      await client.query(
        `INSERT INTO shopit_disputes (
          id, order_id, seller_id, buyer_id, buyer_masked_id, seller_shop_name,
          reason, description, amount_held_in_escrow_kobo, evidence_photo_url,
          seller_packed_photo_url, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NOW(), NOW())`,
        [
          disputeId,
          orderId,
          sellerId,
          order.buyer_id || user.userId,
          buyerDisplayName,
          sellerShopName,
          String(reason).trim().slice(0, 200),
          String(description || '').trim().slice(0, 1000),
          escrowHeldKobo,
          evidencePhotoUrl || null,
          order.packed_photo_url || null,
        ]
      );

      await client.query('UPDATE shopit_orders SET status = \'disputed\', updated_at = NOW() WHERE id = $1', [orderId]);

      await client.query(
        `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, $3, 'disputed', $4, $5, NOW())`,
        [`osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, orderId, order.status, user.userId, `Dispute filed: ${String(reason).slice(0, 120)}`]
      );
    });

    await logAuditEvent({
      action: 'DISPUTE_OPENED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'dispute', id: disputeId },
      details: { orderId, sellerId, sellerShopName, reason: String(reason).trim().slice(0, 200), amountHeldInEscrow: koboToNaira(escrowHeldKobo) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ status: true, disputeId, message: 'Dispute opened. Held funds are paused until moderation resolves the case.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PATCH /api/disputes/:id/resolve - Moderator dispute resolution (atomic escrow settlement in PostgreSQL)
router.patch('/disputes/:id/resolve', requireModerator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { resolution, partialRefundAmount, notes } = req.body || {};
    if (!['refund_full', 'release_seller', 'partial'].includes(String(resolution))) {
      return res.status(400).json({ status: false, message: 'resolution must be refund_full, release_seller, or partial.' });
    }

    const txResult = await withTransaction(async client => {
      const dispRes = await client.query('SELECT * FROM shopit_disputes WHERE id = $1 FOR UPDATE', [id]);
      if (dispRes.rows.length === 0) {
        return { code: 404, body: { status: false, message: 'Dispute not found.' } };
      }
      const disp = dispRes.rows[0];
      if (disp.status !== 'open' && disp.status !== 'investigating') {
        return { code: 409, body: { status: false, message: `Dispute is already ${disp.status}.` } };
      }

      const escrowKobo = Math.max(0, Number(disp.amount_held_in_escrow_kobo || 0));
      let refundKobo = 0;
      let sellerKobo = 0;
      let nextDisputeStatus = 'resolved_released';
      let nextOrderStatus = 'completed';

      if (resolution === 'refund_full') {
        refundKobo = escrowKobo;
        sellerKobo = 0;
        nextDisputeStatus = 'resolved_refunded';
        nextOrderStatus = 'cancelled';
      } else if (resolution === 'release_seller') {
        refundKobo = 0;
        sellerKobo = escrowKobo;
        nextDisputeStatus = 'resolved_released';
        nextOrderStatus = 'completed';
      } else {
        const reqRefundKobo = partialRefundAmount !== undefined ? nairaToKobo(partialRefundAmount) : Math.round(escrowKobo / 2);
        refundKobo = Math.max(0, Math.min(escrowKobo, reqRefundKobo));
        sellerKobo = Math.max(0, escrowKobo - refundKobo);
        nextDisputeStatus = 'resolved_partial';
        nextOrderStatus = 'completed';
      }

      const cleanNotes = notes ? String(notes).trim().slice(0, 500) : `Resolved by ${user.email} (${resolution})`;
      await client.query(
        'UPDATE shopit_disputes SET status = $1, resolution_notes = $2, updated_at = NOW() WHERE id = $3',
        [nextDisputeStatus, cleanNotes, id]
      );

      if (disp.order_id) {
        const ordRes = await client.query('SELECT status FROM shopit_orders WHERE id = $1 FOR UPDATE', [disp.order_id]);
        if (ordRes.rows.length > 0) {
          const prevStatus = ordRes.rows[0].status;
          await client.query(
            `UPDATE shopit_orders
             SET status = $1,
                 completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
                 updated_at = NOW()
             WHERE id = $2`,
            [nextOrderStatus, disp.order_id]
          );
          await client.query(
            `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              `osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              disp.order_id,
              prevStatus,
              nextOrderStatus,
              user.userId,
              cleanNotes,
            ]
          );
        }
      }

      if (disp.seller_id) {
        const wRes = await client.query(
          'SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
          [disp.seller_id]
        );
        if (wRes.rows.length > 0) {
          const curPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
          const curAvailable = parseInt(wRes.rows[0].available_balance_kobo || '0', 10);
          const nextPending = Math.max(0, curPending - escrowKobo);
          const nextAvailable = curAvailable + sellerKobo;

          const idempKey = `dispute_resolve:${id}:${disp.seller_id}`;
          const ledgerType = resolution === 'refund_full' ? 'refund' : 'escrow_release';
          const ledgerAmtKobo = resolution === 'refund_full' ? refundKobo : sellerKobo;
          const insRes = await client.query(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, order_id, type, balance_type, status,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
            ) VALUES ($1, $2, $3, $4, $5, 'completed', $6, 0, $7, $8, $9, $10, NOW())
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id`,
            [
              `DISP-LED-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
              disp.seller_id,
              disp.order_id,
              ledgerType,
              resolution === 'refund_full' ? 'pending' : 'available',
              ledgerAmtKobo,
              nextAvailable,
              `Dispute #${id} resolved (${resolution}): ${cleanNotes}`,
              disp.order_id,
              idempKey,
            ]
          );

          if (insRes.rows.length > 0) {
            await client.query(
              `UPDATE shopit_wallets
               SET pending_balance_kobo = $1, available_balance_kobo = $2, updated_at = NOW()
               WHERE seller_id = $3`,
              [nextPending, nextAvailable, disp.seller_id]
            );
          }
        }
      }

      return {
        code: 200,
        body: {
          status: true,
          disputeId: id,
          disputeStatus: nextDisputeStatus,
          orderStatus: nextOrderStatus,
          refundNaira: koboToNaira(refundKobo),
          sellerNaira: koboToNaira(sellerKobo),
          resolutionNotes: cleanNotes,
          message: `Dispute ${id} resolved (${resolution}) and saved to database.`,
        },
        audit: { disputeId: id, orderId: disp.order_id, resolution, refundKobo, sellerKobo },
      };
    });

    if (txResult.code === 200 && (txResult as any).audit) {
      await logAuditEvent({
        action: 'DISPUTE_RESOLVED',
        actor: { id: user.userId, email: user.email, role: user.role },
        target: { type: 'dispute', id },
        details: (txResult as any).audit,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    }

    return res.status(txResult.code).json(txResult.body);
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PATCH /api/admin/wallets/:sellerId/freeze - Persist seller wallet freeze/unfreeze in PostgreSQL
router.patch('/admin/wallets/:sellerId/freeze', requireModerator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId } = req.params;
    const isFrozen = Boolean(req.body?.isFrozen);
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 300) : null;

    const sellerCheck = await dbQuery('SELECT id FROM shopit_sellers WHERE id = $1', [sellerId]);
    if (sellerCheck.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Seller not found.' });
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, is_frozen, freeze_reason, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO UPDATE SET is_frozen = $2, freeze_reason = $3, updated_at = NOW()`,
      [sellerId, isFrozen, isFrozen ? (reason || 'Admin Security Review') : null]
    );

    await logAuditEvent({
      action: 'WALLET_FREEZE_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'wallet', id: sellerId },
      details: { isFrozen, reason },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({ status: true, sellerId, isFrozen, message: isFrozen ? 'Wallet frozen in database.' : 'Wallet unfrozen in database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PATCH /api/admin/chat/conversations/:id/lock - Persist conversation lock state in PostgreSQL
router.patch('/admin/chat/conversations/:id/lock', requireModerator, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const locked = req.body?.isChatLocked !== undefined ? Boolean(req.body.isChatLocked) : true;
    const upd = await dbQuery(
      'UPDATE shopit_chat_conversations SET is_chat_locked = $1 WHERE id = $2 RETURNING id',
      [locked, id]
    );
    await logAuditEvent({
      action: 'CHAT_LOCK_UPDATED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'conversation', id },
      details: { isChatLocked: locked, matchedRows: upd.rows.length },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.json({ status: true, conversationId: id, isChatLocked: locked });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 8. NOTIFICATIONS API (PostgreSQL: shopit_notifications)
// ============================================================================

router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery(
      'SELECT * FROM shopit_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [user.userId]
    );
    const unreadCount = result.rows.filter((r: any) => !r.is_read).length;

    return res.json({
      status: true,
      unreadCount,
      notifications: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        isRead: Boolean(row.is_read),
        link: row.link,
        createdAt: row.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    await dbQuery(
      'UPDATE shopit_notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [user.userId]
    );
    return res.json({ status: true, unreadCount: 0, message: 'All notifications marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const upd = await dbQuery(
      'UPDATE shopit_notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.userId]
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Notification not found.' });
    }
    return res.json({ status: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 9. CUSTOM COMMISSIONS API (PostgreSQL: shopit_commissions)
// ============================================================================

router.get('/commissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const sellerLookup = user.sellerId || user.userId;
    const result =
      user.role === 'admin'
        ? await dbQuery('SELECT * FROM shopit_commissions ORDER BY created_at DESC LIMIT 100')
        : await dbQuery(
            `SELECT * FROM shopit_commissions
             WHERE buyer_id = $1 OR seller_id = $1 OR seller_id = $2
             ORDER BY created_at DESC`,
            [user.userId, sellerLookup]
          );

    return res.json({
      status: true,
      commissions: result.rows.map((row: any) => ({
        id: row.id,
        buyerId: row.buyer_id,
        buyerName: row.buyer_name,
        sellerId: row.seller_id,
        sellerShopName: row.seller_shop_name,
        title: row.title,
        description: row.description,
        budget: koboToNaira(row.budget_kobo || 0),
        budgetKobo: parseInt(row.budget_kobo || '0', 10),
        status: row.status,
        milestones: Array.isArray(row.milestones) ? row.milestones : [],
        reference: row.reference,
        createdAt: row.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/commissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId, title, description, budget } = req.body;
    if (!sellerId || !title || !budget) {
      return res.status(400).json({ status: false, message: 'sellerId, title, and budget are required.' });
    }

    if (isUserSellerOwner(user, String(sellerId))) {
      return res.status(400).json({ status: false, message: 'You cannot submit a custom commission to your own shop.' });
    }

    const budgetKobo = nairaToKobo(budget);
    if (budgetKobo < 10000) {
      return res.status(400).json({ status: false, message: 'Minimum custom commission budget is ₦100.' });
    }

    const sellerRes = await dbQuery('SELECT shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1', [sellerId]);
    if (sellerRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Seller not found.' });
    }

    const shopName = sellerRes.rows[0]?.shop_name || 'Artisan';
    const commId = `COMM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await dbQuery(
      `INSERT INTO shopit_commissions (
        id, buyer_id, buyer_name, seller_id, seller_shop_name,
        title, description, budget_kobo, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())`,
      [commId, user.userId, user.name, sellerId, shopName, String(title).trim().slice(0, 200), String(description || '').slice(0, 1500), budgetKobo]
    );

    await logAuditEvent({
      action: 'COMMISSION_REQUESTED',
      actor: { id: user.userId, email: user.email, role: user.role },
      target: { type: 'commission', id: commId },
      details: { sellerId, shopName, title: String(title).trim().slice(0, 120), budgetNaira: koboToNaira(budgetKobo) },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({ status: true, commissionId: commId, message: 'Commission request submitted.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

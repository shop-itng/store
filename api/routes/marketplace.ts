import express, { Response } from 'express';
import crypto from 'crypto';
import { query as dbQuery, withTransaction } from '../db/postgres.js';
import { verifyAndConsumeOtp } from '../db/otpStore.js';
import {
  requireAuth,
  requireCronOrAdmin,
  AuthenticatedRequest,
} from '../auth/middleware.js';
import { logAuditEvent } from '../auth/sessionStore.js';
import { nairaToKobo, koboToNaira, calculatePricingInKobo, processUnshippedOrders } from '../lib/payments.js';

const router = express.Router();

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

// GET /api/products - Public listing with filters & pagination
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

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (category && category !== 'all') {
      conditions.push(`category = $${pIdx++}`);
      params.push(category);
    }
    if (sellerId) {
      conditions.push(`seller_id = $${pIdx++}`);
      params.push(sellerId);
    }
    if (campus && campus !== 'All Campuses') {
      conditions.push(`seller_campus = $${pIdx++}`);
      params.push(campus);
    }
    if (state && state !== 'all') {
      conditions.push(`location_state = $${pIdx++}`);
      params.push(state);
    }
    if (city && city !== 'all') {
      conditions.push(`location_city = $${pIdx++}`);
      params.push(city);
    }
    if (area && area !== 'all') {
      conditions.push(`location_area = $${pIdx++}`);
      params.push(area);
    }
    if (search) {
      conditions.push(`(title ILIKE $${pIdx} OR description ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY created_at DESC';
    if (sortBy === 'price_asc') orderClause = 'ORDER BY display_price ASC';
    else if (sortBy === 'price_desc') orderClause = 'ORDER BY display_price DESC';
    else if (sortBy === 'top_rated') orderClause = 'ORDER BY rating DESC, review_count DESC';

    const countRes = await dbQuery(`SELECT COUNT(*) as count FROM shopit_products ${whereClause}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await dbQuery(
      `SELECT * FROM shopit_products ${whereClause} ${orderClause} LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    const products = rowsRes.rows.map((row: any) => ({
      id: row.id,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || 'Artisan Shop',
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
      sellerPrice: parseFloat(row.seller_price),
      serviceFee: parseFloat(row.service_fee),
      displayPrice: parseFloat(row.display_price),
      images: Array.isArray(row.images) ? row.images : [],
      stock: parseInt(row.stock, 10) || 0,
      rating: parseFloat(row.rating || 5.0),
      reviewCount: parseInt(row.review_count, 10) || 0,
      reviews: [],
      delivery: {
        allowsPickup: true,
        pickupLocation: `${row.location_area || 'Hub'} Safe Handoff Spot`,
        pickupFee: parseFloat(row.delivery_pickup_fee || 0),
        allowsLocalDelivery: true,
        localDeliveryFee: parseFloat(row.delivery_local_fee || 500),
        minOrderForDelivery: 1000,
      },
      isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
      isNewArrival: Boolean(row.is_new_arrival),
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

// GET /api/products/:id - Single product view
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbQuery('SELECT * FROM shopit_products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }

    const row = result.rows[0];
    return res.json({
      status: true,
      product: {
        id: row.id,
        sellerId: row.seller_id,
        sellerShopName: row.seller_shop_name,
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
        sellerPrice: parseFloat(row.seller_price),
        serviceFee: parseFloat(row.service_fee),
        displayPrice: parseFloat(row.display_price),
        images: Array.isArray(row.images) ? row.images : [],
        stock: parseInt(row.stock, 10),
        rating: parseFloat(row.rating || 5.0),
        reviewCount: parseInt(row.review_count, 10) || 0,
        reviews: [],
        delivery: {
          allowsPickup: true,
          pickupLocation: `${row.location_area || 'Hub'} Safe Handoff Spot`,
          pickupFee: parseFloat(row.delivery_pickup_fee || 0),
          allowsLocalDelivery: true,
          localDeliveryFee: parseFloat(row.delivery_local_fee || 500),
          minOrderForDelivery: 1000,
        },
        isSoldOut: Boolean(row.is_sold_out || row.stock <= 0),
        isNewArrival: Boolean(row.is_new_arrival),
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

    const rawSellerPriceNaira = parseFloat(sellerPrice);
    if (isNaN(rawSellerPriceNaira) || rawSellerPriceNaira < 100 || rawSellerPriceNaira > 10000000) {
      return res.status(400).json({ status: false, message: 'Seller price must be between ₦100 and ₦10,000,000.' });
    }

    const imgCheck = sanitizeImageUrls(images, true);
    if (!imgCheck.valid) {
      return res.status(400).json({ status: false, message: imgCheck.error });
    }

    const sellerPriceKobo = nairaToKobo(rawSellerPriceNaira);
    const pricing = calculatePricingInKobo(sellerPriceKobo);

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

    const parsedStock = Math.max(0, Math.min(10000, parseInt(String(stock), 10) || 1));
    const pickupFee = Math.max(0, Math.min(1000000, parseFloat(delivery?.pickupFee ?? '0') || 0));
    const localDeliveryFee = Math.max(0, Math.min(1000000, parseFloat(delivery?.localDeliveryFee ?? '500') || 500));

    await dbQuery(
      `INSERT INTO shopit_products (
        id, seller_id, seller_shop_name, seller_campus, title, description, category,
        seller_price, service_fee, display_price, stock, images,
        delivery_pickup_fee, delivery_local_fee, delivery_buyer_arranges,
        location_state, location_city, location_area, seller_badges,
        rating, review_count, is_sold_out, is_new_arrival, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, false,
        $15, $16, $17, $18,
        5.0, 0, $19, true, NOW(), NOW()
      )`,
      [
        productId,
        sellerId,
        shopName,
        campus,
        String(title).trim().slice(0, 200),
        description ? String(description).trim().slice(0, 2000) : `${String(title).trim()} crafted with care.`,
        category || 'crafts',
        pricing.sellerPriceNaira,
        pricing.serviceFeeNaira,
        pricing.displayPriceNaira,
        parsedStock,
        JSON.stringify(imagesArray),
        pickupFee,
        localDeliveryFee,
        location?.state || 'Lagos',
        location?.city || 'Lagos Mainland',
        location?.area || 'Yaba',
        JSON.stringify(badges),
        parsedStock <= 0,
      ]
    );

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
    let sellerPrice = row.seller_price;
    let serviceFee = row.service_fee;
    let displayPrice = row.display_price;

    if (updates.sellerPrice !== undefined) {
      const parsedPrice = parseFloat(updates.sellerPrice);
      if (isNaN(parsedPrice) || parsedPrice < 100) {
        return res.status(400).json({ status: false, message: 'Minimum seller price is ₦100.' });
      }
      const p = calculatePricingInKobo(nairaToKobo(parsedPrice));
      sellerPrice = p.sellerPriceNaira;
      serviceFee = p.serviceFeeNaira;
      displayPrice = p.displayPriceNaira;
    }

    let title = row.title;
    if (updates.title !== undefined) {
      const cleanUpdateTitle = String(updates.title).trim().slice(0, 200);
      if (!cleanUpdateTitle) {
        return res.status(400).json({ status: false, message: 'Product title cannot be empty.' });
      }
      title = cleanUpdateTitle;
    }
    const description = updates.description !== undefined ? String(updates.description).trim().slice(0, 2000) : row.description;
    const category = updates.category !== undefined ? updates.category : row.category;
    const stock = updates.stock !== undefined ? Math.max(0, Math.min(10000, parseInt(String(updates.stock), 10) || 0)) : row.stock;
    const isSoldOut = stock <= 0;

    let images = JSON.stringify(row.images);
    if (updates.images !== undefined) {
      const imgUpdate = sanitizeImageUrls(updates.images, false);
      if (!imgUpdate.valid) {
        return res.status(400).json({ status: false, message: imgUpdate.error });
      }
      images = JSON.stringify(imgUpdate.urls);
    }

    await dbQuery(
      `UPDATE shopit_products
       SET title = $1, description = $2, category = $3, seller_price = $4, service_fee = $5, display_price = $6,
           stock = $7, is_sold_out = $8, images = $9, updated_at = NOW()
       WHERE id = $10`,
      [title, description, category, sellerPrice, serviceFee, displayPrice, stock, isSoldOut, images, id]
    );

    return res.json({ status: true, message: 'Product updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
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

// ============================================================================
// 2. SELLERS API (PostgreSQL: shopit_sellers)
// ============================================================================

// GET /api/sellers - Public catalog seller profiles (no sensitive email/phone leaked)
router.get('/sellers', async (_req, res) => {
  try {
    const result = await dbQuery(`
      SELECT s.*
      FROM shopit_sellers s
      ORDER BY s.created_at DESC
    `);

    const sellers = result.rows.map((row: any) => ({
      id: row.id,
      shopName: row.shop_name,
      ownerName: row.owner_name,
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
      `SELECT s.*
       FROM shopit_sellers s
       WHERE s.id = $1 OR s.user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Seller not found.' });
    }

    const row = result.rows[0];
    return res.json({
      status: true,
      seller: {
        id: row.id,
        shopName: row.shop_name,
        ownerName: row.owner_name,
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

    return res.json({ status: true, message: 'Seller profile updated.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
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
    await dbQuery(
      `INSERT INTO shopit_carts (user_id, items, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET items = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(Array.isArray(items) ? items.slice(0, 50) : [])]
    );
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
    await dbQuery(
      `INSERT INTO shopit_wishlists (user_id, product_ids, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET product_ids = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(Array.isArray(productIds) ? productIds.slice(0, 100) : [])]
    );
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

    const orders = rowsRes.rows.map((row: any) => {
      const isBuyerOrAdmin = row.buyer_id === user.userId || user.role === 'admin';
      return {
        id: row.id,
        buyerId: row.buyer_id,
        buyerMaskedId: row.buyer_masked_id || `Buyer #${row.id.slice(-4)}`,
        buyerName: user.role === 'admin' ? row.buyer_name : undefined,
        buyerEmail: user.role === 'admin' ? row.buyer_email : undefined,
        deliveryArea: row.delivery_area || 'Yaba',
        pickupPoint: row.pickup_point,
        items: Array.isArray(row.items) ? row.items : [],
        itemsSubtotal: parseFloat(row.subtotal),
        serviceFeeTotal: parseFloat(row.service_fee_total),
        deliveryTotal: parseFloat(row.delivery_total),
        discountTotal: parseFloat(row.discount_total || 0),
        grandTotal: parseFloat(row.grand_total),
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
        hasReview: false,
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
  return res.status(403).json({
    status: false,
    error: 'DIRECT_ORDER_CREATION_DISABLED',
    message: 'Orders cannot be created directly by the browser. Use payment checkout initialization instead.',
  });
});

// PATCH /api/orders/:id/status - C8 Strict role-enforced state machine & atomic escrow release
router.patch('/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
        if (!isAdmin) {
          return { code: 403, body: { status: false, message: 'Only an administrator can cancel or refund a paid order.' } };
        }
        if (!['pending_payment', 'paid'].includes(prevStatus)) {
          return { code: 400, body: { status: false, message: `Cannot cancel order from status '${prevStatus}'.` } };
        }
      }

      // If releasing escrow, block when an open dispute exists unless admin override
      const isReleasingEscrow =
        (newStatus === 'delivered' || newStatus === 'completed') &&
        prevStatus !== 'delivered' &&
        prevStatus !== 'completed';

      if (isReleasingEscrow && !isAdmin) {
        const disputeCheck = await client.query(
          `SELECT id FROM shopit_disputes WHERE order_id = $1 AND status IN ('open', 'investigating') FOR UPDATE`,
          [id]
        );
        if (disputeCheck.rows.length > 0) {
          return {
            code: 409,
            body: { status: false, message: 'Cannot release escrow while an active dispute exists on this order.' },
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
                id, wallet_id, order_id, type, amount, fee, balance_after, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', $4, 0, $5, 'available', 'completed',
                $6, 0, $7, $8, $9, $10, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-REL-${id}-${sId.slice(-6)}`,
                sId,
                id,
                koboToNaira(amountKobo),
                koboToNaira(newAvailable),
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
                     pending_balance = $3,
                     available_balance = $4,
                     updated_at = NOW()
                 WHERE seller_id = $5`,
                [newPending, newAvailable, koboToNaira(newPending), koboToNaira(newAvailable), sId]
              );
            }
          }
        }
      }

      return { code: 200, body: { status: true, message: `Order status updated to ${newStatus}.` } };
    });

    return res.status(result.code).json(result.body);
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
export async function processEscrowAutoRelease(): Promise<{ releasedCount: number; orderIds: string[] }> {
  try {
    const candidateRes = await dbQuery(`
      SELECT o.id FROM shopit_orders o
      LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
      WHERE o.status IN ('shipped', 'delivered')
        AND o.auto_release_at IS NOT NULL
        AND o.auto_release_at <= NOW()
        AND d.id IS NULL
    `);

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
                id, wallet_id, order_id, type, amount, fee, balance_after, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES (
                $1, $2, $3, 'escrow_release', $4, 0, $5, 'available', 'completed',
                $6, 0, $7, $8, $9, $10, NOW()
              )
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `ESCROW-AUTO-${order.id}-${sId.slice(-6)}`,
                sId,
                order.id,
                koboToNaira(amountKobo),
                koboToNaira(newAvailable),
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
                     pending_balance = $3,
                     available_balance = $4,
                     updated_at = NOW()
                 WHERE seller_id = $5`,
                [newPending, newAvailable, koboToNaira(newPending), koboToNaira(newAvailable), sId]
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

// POST /api/escrow/auto-release - Strictly guarded by Cron Secret or Admin Session (C2 & C8)
router.post('/escrow/auto-release', requireCronOrAdmin, async (_req, res) => {
  const result = await processEscrowAutoRelease();
  const unshipped = await processUnshippedOrders();
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
    const user = req.user!;
    const requestedSellerId = req.query.sellerId ? String(req.query.sellerId).trim() : (user.sellerId || user.userId);

    if (!isUserSellerOwner(user, requestedSellerId) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden.' });
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
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

    const ledgerEntries = ledgerRes.rows.map((row: any) => ({
      id: row.id,
      walletId: row.wallet_id,
      type: row.type,
      amount: parseFloat(row.amount),
      amountKobo: row.amount_kobo ? parseInt(row.amount_kobo, 10) : nairaToKobo(row.amount),
      fee: parseFloat(row.fee || 0),
      balanceAfter: parseFloat(row.balance_after),
      balanceAfterKobo: row.balance_after_kobo ? parseInt(row.balance_after_kobo, 10) : nairaToKobo(row.balance_after),
      balanceType: row.balance_type,
      description: row.description,
      reference: row.reference,
      createdAt: row.created_at,
    }));

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
      `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
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

    const conversations = result.rows.map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      productTitle: row.product_title,
      productImage: row.product_image,
      buyerId: row.buyer_id,
      buyerMaskedId: row.buyer_masked_id || `Buyer #${row.id.slice(-4)}`,
      sellerId: row.seller_id,
      sellerShopName: row.seller_shop_name || 'Artisan',
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      isChatLocked: Boolean(row.is_chat_locked),
      bypassViolationsCount: parseInt(row.bypass_violations_count, 10) || 0,
      createdAt: row.created_at,
    }));

    return res.json({ status: true, conversations });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/chat/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId, productId, productTitle, productImage, orderId } = req.body;
    if (!sellerId) {
      return res.status(400).json({ status: false, message: 'sellerId is required.' });
    }
    if (isUserSellerOwner(user, String(sellerId))) {
      return res.status(400).json({ status: false, message: 'You cannot open a chat conversation with your own shop.' });
    }

    const existing = await dbQuery(
      `SELECT * FROM shopit_chat_conversations WHERE buyer_id = $1 AND seller_id = $2`,
      [user.userId, sellerId]
    );
    if (existing.rows.length > 0) {
      return res.json({ status: true, conversation: existing.rows[0] });
    }

    const sellerRes = await dbQuery('SELECT shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1', [sellerId]);
    const shopName = sellerRes.rows[0]?.shop_name || 'Artisan';

    const convId = `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const buyerMaskedId = `Buyer #${convId.slice(-4)}`;

    const insertRes = await dbQuery(
      `INSERT INTO shopit_chat_conversations (
        id, order_id, product_id, product_title, product_image,
        buyer_id, buyer_masked_id, seller_id, seller_shop_name,
        last_message, last_message_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Chat started', NOW(), NOW())
      RETURNING *`,
      [convId, orderId || null, productId || null, productTitle || null, productImage || null, user.userId, buyerMaskedId, sellerId, shopName]
    );

    return res.status(201).json({ status: true, conversation: insertRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.get('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const convRes = await dbQuery('SELECT * FROM shopit_chat_conversations WHERE id = $1', [id]);
    if (convRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Conversation not found.' });
    }
    const conv = convRes.rows[0];
    if (conv.buyer_id !== user.userId && !isUserSellerOwner(user, conv.seller_id) && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Access denied to this conversation.' });
    }

    const result = await dbQuery(
      'SELECT * FROM shopit_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200',
      [id]
    );

    return res.json({
      status: true,
      messages: result.rows.map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        senderRole: row.sender_role,
        senderMaskedName: row.sender_masked_name,
        content: row.content,
        isBlockedBypass: Boolean(row.is_blocked_bypass),
        presetOffer: row.preset_offer,
        createdAt: row.created_at,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

router.post('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { content, presetOffer } = req.body;

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

    if (!content || !String(content).trim()) {
      return res.status(400).json({ status: false, message: 'Message content is required.' });
    }

    const cleanContent = String(content).trim().slice(0, 1000);
    const phoneRegex = /(\+?234|0)[789][01]\d{8}/;
    const bankRegex = /\b\d{10}\b/;
    const whatsappRegex = /(wa\.me|whatsapp|dm me on ig|call me)/i;

    const isBypass = phoneRegex.test(cleanContent) || bankRegex.test(cleanContent) || whatsappRegex.test(cleanContent);
    const msgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const role = isUserSellerOwner(user, conv.seller_id) ? 'seller' : (user.role === 'admin' ? 'admin' : 'buyer');
    const senderMaskedName = role === 'seller' ? 'Artisan' : (role === 'admin' ? 'Shop It Moderation' : `Buyer #${user.userId.slice(-4)}`);

    const savedContent = isBypass
      ? '[Security Notice: Direct phone numbers, account numbers, and off-platform payments are prohibited to protect your escrow security.]'
      : cleanContent;

    await dbQuery(
      `INSERT INTO shopit_chat_messages (
        id, conversation_id, sender_id, sender_role, sender_masked_name,
        content, is_blocked_bypass, preset_offer, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [msgId, id, user.userId, role, senderMaskedName, savedContent, isBypass, presetOffer ? JSON.stringify(presetOffer) : null]
    );

    const nextViolations = (parseInt(conv.bypass_violations_count, 10) || 0) + (isBypass ? 1 : 0);
    await dbQuery(
      `UPDATE shopit_chat_conversations
       SET last_message = $1, last_message_at = NOW(),
           bypass_violations_count = $2,
           is_chat_locked = CASE WHEN $2 >= 2 THEN true ELSE is_chat_locked END
       WHERE id = $3`,
      [savedContent, nextViolations, id]
    );

    return res.status(201).json({
      status: true,
      message: {
        id: msgId,
        conversationId: id,
        senderId: user.userId,
        senderRole: role,
        senderMaskedName,
        content: savedContent,
        isBlockedBypass: isBypass,
        createdAt: new Date().toISOString(),
      },
      warning: isBypass ? 'Anti-bypass trigger: Personal contact info redacted to ensure buyer/seller escrow safety.' : undefined,
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

    return res.json({
      status: true,
      disputes: result.rows.map((row: any) => ({
        id: row.id,
        orderId: row.order_id,
        sellerId: row.seller_id,
        buyerId: row.buyer_id,
        buyerMaskedId: row.buyer_masked_id,
        sellerShopName: row.seller_shop_name,
        reason: row.reason,
        description: row.description,
        amountHeldInEscrow: parseFloat(row.amount_held_in_escrow),
        evidencePhotoUrl: row.evidence_photo_url,
        sellerPackedPhotoUrl: row.seller_packed_photo_url,
        status: row.status,
        resolutionNotes: row.resolution_notes,
        createdAt: row.created_at,
      })),
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

    const sellerId = items[0]?.sellerId || 'seller_system';
    const sellerShopName = items[0]?.sellerShopName || 'Artisan';
    const disputeId = `DISP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await withTransaction(async client => {
      await client.query(
        `INSERT INTO shopit_disputes (
          id, order_id, seller_id, buyer_id, buyer_masked_id, seller_shop_name,
          reason, description, amount_held_in_escrow, evidence_photo_url,
          seller_packed_photo_url, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NOW(), NOW())`,
        [
          disputeId,
          orderId,
          sellerId,
          order.buyer_id || user.userId,
          order.buyer_masked_id || `Buyer #${orderId.slice(-4)}`,
          sellerShopName,
          String(reason).trim().slice(0, 200),
          String(description || '').trim().slice(0, 1000),
          parseFloat(order.grand_total),
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

    return res.status(201).json({ status: true, disputeId, message: 'Dispute opened. Funds held securely in escrow.' });
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

    return res.json({
      status: true,
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
        budget: parseFloat(row.budget_naira),
        budgetKobo: parseInt(row.budget_kobo, 10),
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
        title, description, budget_kobo, budget_naira, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())`,
      [commId, user.userId, user.name, sellerId, shopName, String(title).trim().slice(0, 200), String(description || '').slice(0, 1500), budgetKobo, koboToNaira(budgetKobo)]
    );

    return res.status(201).json({ status: true, commissionId: commId, message: 'Commission request submitted.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

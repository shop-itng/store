import express, { Response } from 'express';
import { query as dbQuery } from '../db/postgres.js';
import {
  requireAuth,
  optionalAuth,
  AuthenticatedRequest,
} from '../auth/middleware.js';
import { logAuditEvent } from '../auth/sessionStore.js';

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

// Helper: Convert Naira to integer Kobo
function nairaToKobo(naira: number | string): number {
  const num = typeof naira === 'string' ? parseFloat(naira) : naira;
  return Math.round((Number.isFinite(num) ? num : 0) * 100);
}

// Helper: Convert integer Kobo to Naira
function koboToNaira(kobo: number | string): number {
  const num = typeof kobo === 'string' ? parseInt(kobo, 10) : kobo;
  return (Number.isFinite(num) ? num : 0) / 100;
}

// Helper: Calculate standard platform service fee (5%) in integer kobo
function calculatePricingInKobo(sellerPriceKobo: number) {
  const serviceFeeKobo = Math.round(sellerPriceKobo * 0.05);
  const displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
  return {
    sellerPriceKobo,
    serviceFeeKobo,
    displayPriceKobo,
    sellerPriceNaira: koboToNaira(sellerPriceKobo),
    serviceFeeNaira: koboToNaira(serviceFeeKobo),
    displayPriceNaira: koboToNaira(displayPriceKobo),
  };
}

// ============================================================================
// 1. PRODUCTS API (PostgreSQL: shopit_products)
// ============================================================================

// GET /api/products - Public listing with filters & pagination
router.get('/products', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;

    const category = req.query.category ? String(req.query.category).trim() : '';
    const search = req.query.search ? String(req.query.search).trim() : '';
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

    const querySql = `
      SELECT * FROM shopit_products
      ${whereClause}
      ${orderClause}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;
    const rowsRes = await dbQuery(querySql, [...params, limit, offset]);

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
    const product = {
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
    };

    return res.json({ status: true, product });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/products - Create a product (Protected)
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

    if (!title || !sellerPrice) {
      return res.status(400).json({ status: false, message: 'Title and seller price are required.' });
    }

    const rawSellerPriceNaira = parseFloat(sellerPrice);
    if (isNaN(rawSellerPriceNaira) || rawSellerPriceNaira < 100) {
      return res.status(400).json({ status: false, message: 'Minimum seller price is ₦100.' });
    }

    const sellerPriceKobo = nairaToKobo(rawSellerPriceNaira);
    const pricing = calculatePricingInKobo(sellerPriceKobo);

    const sellerId = user.role === 'seller' ? (user.sellerId || user.userId) : (req.body.sellerId || user.userId);

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
          user.isVerifiedSeller || false,
          user.isVerifiedSeller ? 'verified' : 'pending',
          req.body.sellerCampus || 'Lagos Mainland',
        ]
      );
      seller = {
        id: sellerId,
        user_id: user.userId,
        shop_name: req.body.sellerShopName || `${user.name}'s Shop`,
        is_verified_seller: user.isVerifiedSeller || false,
      };
    }

    if (user.role === 'buyer') {
      await dbQuery("UPDATE shopit_users SET role = 'seller', updated_at = NOW() WHERE id = $1", [user.userId]).catch(() => {});
    }

    const shopName = seller?.shop_name || req.body.sellerShopName || `${user.name}'s Shop`;
    const campus = seller?.campus || req.body.sellerCampus || 'Lagos Mainland';
    const isVerified = Boolean(seller?.is_verified_seller || seller?.verification_status === 'verified' || user.isVerifiedSeller);

    const badges: string[] = Array.isArray(req.body.sellerBadges) ? req.body.sellerBadges : [];
    if (isVerified && !badges.includes('verified')) {
      badges.push('verified');
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const imagesArray = Array.isArray(images) && images.length > 0 ? images : ['/shopit-logo.png'];

    const pickupFee = delivery?.pickupFee !== undefined ? parseFloat(delivery.pickupFee) : 0;
    const localDeliveryFee = delivery?.localDeliveryFee !== undefined ? parseFloat(delivery.localDeliveryFee) : 500;

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
        title.trim(),
        description ? description.trim() : `${title} crafted with care.`,
        category || 'crafts',
        pricing.sellerPriceNaira,
        pricing.serviceFeeNaira,
        pricing.displayPriceNaira,
        parseInt(String(stock), 10) || 1,
        JSON.stringify(imagesArray),
        pickupFee,
        localDeliveryFee,
        location?.state || 'Lagos',
        location?.city || 'Lagos Mainland',
        location?.area || 'Yaba',
        JSON.stringify(badges),
        parseInt(String(stock), 10) <= 0,
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
    if (row.seller_id !== user.userId && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'You do not have permission to modify this product.' });
    }

    const updates = req.body;
    let sellerPrice = row.seller_price;
    let serviceFee = row.service_fee;
    let displayPrice = row.display_price;

    if (updates.sellerPrice !== undefined) {
      const p = calculatePricingInKobo(nairaToKobo(updates.sellerPrice));
      sellerPrice = p.sellerPriceNaira;
      serviceFee = p.serviceFeeNaira;
      displayPrice = p.displayPriceNaira;
    }

    const title = updates.title !== undefined ? updates.title : row.title;
    const description = updates.description !== undefined ? updates.description : row.description;
    const category = updates.category !== undefined ? updates.category : row.category;
    const stock = updates.stock !== undefined ? parseInt(String(updates.stock), 10) : row.stock;
    const isSoldOut = stock <= 0;
    const images = updates.images !== undefined ? JSON.stringify(updates.images) : JSON.stringify(row.images);

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
    if (row.seller_id !== user.userId && user.role !== 'admin') {
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

// GET /api/sellers - List all registered sellers
router.get('/sellers', async (_req, res) => {
  try {
    const result = await dbQuery(`
      SELECT s.*, u.email as user_email
      FROM shopit_sellers s
      LEFT JOIN shopit_users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);

    const sellers = result.rows.map((row: any) => ({
      id: row.id,
      shopName: row.shop_name,
      ownerName: row.owner_name,
      email: row.email || row.user_email,
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
      verifiedNinLast4: row.verified_nin_last4,
      verifiedLegalName: row.verified_legal_name,
      under18: Boolean(row.under_18),
      guardianConsent: Boolean(row.guardian_consent),
      guardianName: row.guardian_name,
      guardianPhone: row.guardian_phone,
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
      `SELECT s.*, u.email as user_email
       FROM shopit_sellers s
       LEFT JOIN shopit_users u ON s.user_id = u.id
       WHERE s.id = $1 OR s.user_id = $1 OR LOWER(s.email) = LOWER($1)`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Seller not found.' });
    }

    const row = result.rows[0];
    const seller = {
      id: row.id,
      shopName: row.shop_name,
      ownerName: row.owner_name,
      email: row.email || row.user_email,
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
      verifiedNinLast4: row.verified_nin_last4,
      verifiedLegalName: row.verified_legal_name,
      under18: Boolean(row.under_18),
      guardianConsent: Boolean(row.guardian_consent),
      badges: Array.isArray(row.badges)
        ? (row.is_verified_seller && !row.badges.includes('verified') ? [...row.badges, 'verified'] : row.badges)
        : (row.is_verified_seller ? ['verified'] : []),
      rating: parseFloat(row.rating || 5.0),
      salesCount: parseInt(row.sales_count, 10) || 0,
      viewsCount: parseInt(row.views_count, 10) || 0,
      vacationMode: Boolean(row.vacation_mode),
      joinedDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-01-01',
    };

    return res.json({ status: true, seller });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PUT /api/sellers/:id - Update seller profile
router.put('/sellers/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    if (user.userId !== id && user.role !== 'admin') {
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

// GET /api/cart
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

// PUT /api/cart - Save cart items to PostgreSQL
router.put('/cart', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { items = [] } = req.body;
    await dbQuery(
      `INSERT INTO shopit_carts (user_id, items, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET items = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(items)]
    );
    return res.json({ status: true, message: 'Cart saved to database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// GET /api/wishlist
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

// PUT /api/wishlist - Save wishlist to PostgreSQL
router.put('/wishlist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { productIds = [] } = req.body;
    await dbQuery(
      `INSERT INTO shopit_wishlists (user_id, product_ids, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET product_ids = $2, updated_at = NOW()`,
      [user.userId, JSON.stringify(productIds)]
    );
    return res.json({ status: true, message: 'Wishlist saved to database.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 4. ORDERS & STATUS HISTORY API (PostgreSQL: shopit_orders, shopit_order_status_history)
// ============================================================================

// GET /api/orders - List user orders or all orders for admin
router.get('/orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const offset = (page - 1) * limit;

    let querySql = '';
    let countSql = '';
    let params: any[] = [];

    if (user.role === 'admin') {
      countSql = 'SELECT COUNT(*) as count FROM shopit_orders';
      querySql = 'SELECT * FROM shopit_orders ORDER BY created_at DESC LIMIT $1 OFFSET $2';
      params = [limit, offset];
    } else if (user.role === 'seller') {
      countSql = `SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2`;
      querySql = `SELECT * FROM shopit_orders WHERE buyer_id = $1 OR items::text LIKE $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
      params = [user.userId, `%"sellerId":"${user.userId}"%`, limit, offset];
    } else {
      countSql = 'SELECT COUNT(*) as count FROM shopit_orders WHERE buyer_id = $1';
      querySql = 'SELECT * FROM shopit_orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
      params = [user.userId, limit, offset];
    }

    const countRes = await dbQuery(countSql, params.slice(0, countSql.includes('$2') ? 2 : (countSql.includes('$1') ? 1 : 0)));
    const total = parseInt(countRes.rows[0].count, 10);

    const rowsRes = await dbQuery(querySql, params);

    const orders = rowsRes.rows.map((row: any) => ({
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
      paymentMethod: row.payment_method || 'paystack',
      paymentReference: row.payment_reference,
      handshakeOtp: row.handshake_otp,
      handshakeVerified: Boolean(row.handshake_verified),
      autoReleaseAt: row.auto_release_at || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: row.created_at,
      packedAt: row.packed_at,
      shippedAt: row.shipped_at,
      deliveredAt: row.delivered_at,
      completedAt: row.completed_at,
      hasReview: false,
    }));

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

// POST /api/orders - Create an order with integer kobo & status history
router.post('/orders', requirePaymentsEnabled, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYMENTS_DISABLED',
      message: 'Online payments are coming soon. Arrange directly with the seller',
    });
  }

  try {
    const user = req.user;
    const {
      id: requestedId,
      items = [],
      subtotal,
      serviceFeeTotal,
      deliveryTotal,
      discountTotal = 0,
      grandTotal,
      deliveryArea,
      pickupPoint,
      paymentMethod = 'paystack',
      paymentReference,
    } = req.body;

    const orderId = requestedId || `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const buyerEmail = user?.email || (req.body.buyerEmail ? String(req.body.buyerEmail).trim().toLowerCase() : (req.body.email ? String(req.body.email).trim().toLowerCase() : 'customer@shopit.ng'));
    const buyerName = user?.name || (req.body.buyerName ? String(req.body.buyerName).trim() : (req.body.name ? String(req.body.name).trim() : 'Customer'));
    const buyerId = user?.userId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const subtotalKobo = nairaToKobo(subtotal);
    const serviceFeeKobo = nairaToKobo(serviceFeeTotal);
    const deliveryFeeKobo = nairaToKobo(deliveryTotal);
    const discountKobo = nairaToKobo(discountTotal);
    const grandTotalKobo = nairaToKobo(grandTotal);

    const autoReleaseDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const handshakeOtp = String(Math.floor(1000 + Math.random() * 9000));
    const buyerMaskedId = `Buyer #${orderId.slice(-4)}`;

    await dbQuery(
      `INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
        subtotal, service_fee_total, delivery_total, discount_total, grand_total,
        subtotal_kobo, service_fee_kobo, delivery_fee_kobo, grand_total_kobo,
        payment_method, payment_reference, handshake_otp, handshake_verified,
        status, delivery_area, pickup_point, auto_release_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, false,
        'paid', $19, $20, $21, NOW(), NOW()
      )`,
      [
        orderId,
        buyerId,
        buyerName,
        buyerEmail,
        buyerMaskedId,
        JSON.stringify(items),
        koboToNaira(subtotalKobo),
        koboToNaira(serviceFeeKobo),
        koboToNaira(deliveryFeeKobo),
        koboToNaira(discountKobo),
        koboToNaira(grandTotalKobo),
        subtotalKobo,
        serviceFeeKobo,
        deliveryFeeKobo,
        grandTotalKobo,
        paymentMethod,
        paymentReference || `pay_${Date.now()}`,
        handshakeOtp,
        deliveryArea || 'Yaba',
        pickupPoint || 'Campus Safe Hub',
        autoReleaseDate.toISOString(),
      ]
    );

    const historyId = `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await dbQuery(
      `INSERT INTO shopit_order_status_history (
        id, order_id, previous_status, new_status, changed_by, notes, created_at
      ) VALUES ($1, $2, NULL, 'paid', $3, 'Order created and paid via Paystack escrow.', NOW())`,
      [historyId, orderId, user?.userId || buyerId]
    );

    const sellerTotals: Record<string, number> = {};
    for (const item of items) {
      const sId = item.sellerId;
      if (sId) {
        const itemAmountKobo = nairaToKobo(item.sellerPrice * item.quantity);
        sellerTotals[sId] = (sellerTotals[sId] || 0) + itemAmountKobo;
      }
    }

    for (const [sId, sellerEarningsKobo] of Object.entries(sellerTotals)) {
      await dbQuery(
        `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
         VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
         ON CONFLICT (seller_id) DO NOTHING`,
        [sId]
      );

      const wRes = await dbQuery('SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sId]);
      const currentPendingKobo = parseInt(wRes.rows[0]?.pending_balance_kobo || '0', 10);
      const newPendingKobo = currentPendingKobo + sellerEarningsKobo;

      await dbQuery(
        `UPDATE shopit_wallets
         SET pending_balance_kobo = $1,
             pending_balance = $2,
             updated_at = NOW()
         WHERE seller_id = $3`,
        [newPendingKobo, koboToNaira(newPendingKobo), sId]
      );

      const ledgerId = `LEDGER-${orderId}-${sId.slice(-4)}`;
      await dbQuery(
        `INSERT INTO shopit_ledger_entries (
          id, wallet_id, type, amount, fee, balance_after, balance_type,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, created_at
        ) VALUES (
          $1, $2, 'sale_pending', $3, 0, $4, 'pending',
          $5, 0, $6, $7, $8, NOW()
        )`,
        [
          ledgerId,
          sId,
          koboToNaira(sellerEarningsKobo),
          koboToNaira(newPendingKobo),
          sellerEarningsKobo,
          newPendingKobo,
          `Escrow holding for Order #${orderId}`,
          paymentReference || orderId,
        ]
      );
    }

    if (user?.userId) {
      await dbQuery('DELETE FROM shopit_carts WHERE user_id = $1', [user.userId]);
    }

    return res.status(201).json({
      status: true,
      orderId,
      handshakeOtp,
      message: 'Order created and persisted to PostgreSQL.',
    });
  } catch (err: any) {
    console.error('[Order Create Error]:', err.message);
    return res.status(500).json({ status: false, message: 'Database error saving order.' });
  }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { status: newStatus, notes, handshakeOtp } = req.body;

    const existing = await dbQuery('SELECT * FROM shopit_orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Order not found.' });
    }

    const order = existing.rows[0];
    const prevStatus = order.status;

    let handshakeVerified = order.handshake_verified;
    if (newStatus === 'delivered' && handshakeOtp) {
      if (order.handshake_otp && String(handshakeOtp).trim() === String(order.handshake_otp).trim()) {
        handshakeVerified = true;
      }
    }

    await dbQuery(
      `UPDATE shopit_orders
       SET status = $1,
           handshake_verified = $2,
           packed_at = CASE WHEN $1 = 'packed' THEN NOW() ELSE packed_at END,
           shipped_at = CASE WHEN $1 = 'shipped' THEN NOW() ELSE shipped_at END,
           delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END,
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $3`,
      [newStatus, handshakeVerified, id]
    );

    const historyId = `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await dbQuery(
      `INSERT INTO shopit_order_status_history (
        id, order_id, previous_status, new_status, changed_by, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [historyId, id, prevStatus, newStatus, user.userId, notes || `Status updated from ${prevStatus} to ${newStatus}`]
    );

    if ((newStatus === 'delivered' || newStatus === 'completed') && prevStatus !== 'delivered' && prevStatus !== 'completed') {
      const items = Array.isArray(order.items) ? order.items : [];
      const sellerTotals: Record<string, number> = {};

      for (const item of items) {
        if (item.sellerId) {
          const itemKobo = nairaToKobo(item.sellerPrice * item.quantity);
          sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
        }
      }

      for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
        const wRes = await dbQuery('SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sId]);
        if (wRes.rows.length > 0) {
          const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
          const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || '0', 10);

          const newPending = Math.max(0, currentPending - amountKobo);
          const newAvailable = currentAvailable + amountKobo;

          await dbQuery(
            `UPDATE shopit_wallets
             SET pending_balance_kobo = $1,
                 available_balance_kobo = $2,
                 pending_balance = $3,
                 available_balance = $4,
                 updated_at = NOW()
             WHERE seller_id = $5`,
            [newPending, newAvailable, koboToNaira(newPending), koboToNaira(newAvailable), sId]
          );

          const releaseId = `ESCROW-REL-${id}-${sId.slice(-4)}`;
          await dbQuery(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, type, amount, fee, balance_after, balance_type,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, created_at
            ) VALUES (
              $1, $2, 'escrow_release', $3, 0, $4, 'available',
              $5, 0, $6, $7, $8, NOW()
            )`,
            [
              releaseId,
              sId,
              koboToNaira(amountKobo),
              koboToNaira(newAvailable),
              amountKobo,
              newAvailable,
              `Escrow released for delivered Order #${id}`,
              order.payment_reference || id,
            ]
          );
        }
      }
    }

    return res.json({ status: true, message: `Order status updated to ${newStatus}.` });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

/**
 * Escrow Auto-Release Routine:
 * Inspects all paid orders where the 5-day inspection window has elapsed (auto_release_at <= NOW()).
 * Ensures no unresolved disputes are blocking the funds, then releases the pending funds to the sellers'
 * available balances and marks the order completed in the double-entry ledger.
 */
export async function processEscrowAutoRelease(): Promise<{ releasedCount: number; orderIds: string[] }> {
  try {
    const eligibleOrders = await dbQuery(`
      SELECT o.* FROM shopit_orders o
      LEFT JOIN shopit_disputes d ON d.order_id = o.id AND d.status IN ('open', 'investigating')
      WHERE o.status = 'paid'
        AND o.auto_release_at IS NOT NULL
        AND o.auto_release_at <= NOW()
        AND d.id IS NULL
    `);

    const releasedIds: string[] = [];

    for (const order of eligibleOrders.rows) {
      const items = Array.isArray(order.items) ? order.items : [];
      const sellerTotals: Record<string, number> = {};

      for (const item of items) {
        if (item.sellerId) {
          const itemKobo = nairaToKobo(item.sellerPrice * item.quantity);
          sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
        }
      }

      for (const [sId, amountKobo] of Object.entries(sellerTotals)) {
        const wRes = await dbQuery('SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sId]);
        if (wRes.rows.length > 0) {
          const currentPending = parseInt(wRes.rows[0].pending_balance_kobo || '0', 10);
          const currentAvailable = parseInt(wRes.rows[0].available_balance_kobo || '0', 10);

          const newPending = Math.max(0, currentPending - amountKobo);
          const newAvailable = currentAvailable + amountKobo;

          await dbQuery(
            `UPDATE shopit_wallets
             SET pending_balance_kobo = $1,
                 available_balance_kobo = $2,
                 pending_balance = $3,
                 available_balance = $4,
                 updated_at = NOW()
             WHERE seller_id = $5`,
            [newPending, newAvailable, koboToNaira(newPending), koboToNaira(newAvailable), sId]
          );

          const releaseId = `ESCROW-AUTO-${order.id}-${sId.slice(-4)}`;
          await dbQuery(
            `INSERT INTO shopit_ledger_entries (
              id, wallet_id, type, amount, fee, balance_after, balance_type,
              amount_kobo, fee_kobo, balance_after_kobo, description, reference, created_at
            ) VALUES (
              $1, $2, 'escrow_release', $3, 0, $4, 'available',
              $5, 0, $6, $7, $8, NOW()
            )`,
            [
              releaseId,
              sId,
              koboToNaira(amountKobo),
              koboToNaira(newAvailable),
              amountKobo,
              newAvailable,
              `5-Day Escrow auto-released for Order #${order.id}`,
              order.payment_reference || order.id,
            ]
          );
        }
      }

      // Mark order delivered / completed and clear auto_release_at
      await dbQuery(
        `UPDATE shopit_orders
         SET status = 'completed',
             auto_release_at = NULL,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [order.id]
      );

      const historyId = `osh_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await dbQuery(
        `INSERT INTO shopit_order_status_history (
          id, order_id, previous_status, new_status, changed_by, notes, created_at
        ) VALUES ($1, $2, 'paid', 'completed', 'escrow_auto_release_cron', 'Funds auto-released to seller after 5-day inspection period without dispute.', NOW())`,
        [historyId, order.id]
      );

      releasedIds.push(order.id);
    }

    return { releasedCount: releasedIds.length, orderIds: releasedIds };
  } catch (err: any) {
    console.warn('[Escrow Auto-Release Error]:', err.message);
    return { releasedCount: 0, orderIds: [] };
  }
}

// POST /api/escrow/auto-release - Trigger auto-release scan (Admin or internal cron)
router.post('/escrow/auto-release', async (_req, res) => {
  const result = await processEscrowAutoRelease();
  return res.json({
    status: true,
    message: `Escrow scan completed. ${result.releasedCount} orders auto-released.`,
    ...result,
  });
});

// ============================================================================
// 5. WALLET & DOUBLE-ENTRY LEDGER API
// ============================================================================

// GET /api/wallet - Get seller wallet calculated strictly from append-only ledger
router.get('/wallet', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYMENTS_DISABLED',
      message: 'Online payments are coming soon. Arrange directly with the seller',
    });
  }

  try {
    const user = req.user!;
    const sellerId = req.query.sellerId ? String(req.query.sellerId).trim() : user.userId;

    if (sellerId !== user.userId && user.role !== 'admin') {
      return res.status(403).json({ status: false, message: 'Forbidden.' });
    }

    await dbQuery(
      `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
       VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
       ON CONFLICT (seller_id) DO NOTHING`,
      [sellerId]
    );

    const walletRes = await dbQuery('SELECT * FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
    const walletRow = walletRes.rows[0];

    const ledgerRes = await dbQuery(
      'SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 100',
      [sellerId]
    );

    let computedPendingKobo = 0;
    let computedAvailableKobo = 0;
    let computedWithdrawnKobo = 0;

    for (const entry of ledgerRes.rows) {
      const amtKobo = entry.amount_kobo ? parseInt(entry.amount_kobo, 10) : nairaToKobo(entry.amount);
      if (entry.type === 'sale_pending') {
        computedPendingKobo += amtKobo;
      } else if (entry.type === 'escrow_release') {
        computedPendingKobo -= amtKobo;
        computedAvailableKobo += amtKobo;
      } else if (entry.type === 'withdrawal') {
        computedAvailableKobo -= amtKobo;
        computedWithdrawnKobo += amtKobo;
      } else if (entry.type === 'fee_deduction') {
        computedAvailableKobo -= amtKobo;
      } else if (entry.type === 'refund') {
        computedPendingKobo -= amtKobo;
      }
    }

    computedPendingKobo = Math.max(0, computedPendingKobo);
    computedAvailableKobo = Math.max(0, computedAvailableKobo);

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

    const wallet = {
      sellerId: walletRow.seller_id,
      pendingBalance: koboToNaira(computedPendingKobo),
      availableBalance: koboToNaira(computedAvailableKobo),
      totalWithdrawn: koboToNaira(computedWithdrawnKobo),
      pendingBalanceKobo: computedPendingKobo,
      availableBalanceKobo: computedAvailableKobo,
      totalWithdrawnKobo: computedWithdrawnKobo,
      isFrozen: Boolean(walletRow.is_frozen),
      freezeReason: walletRow.freeze_reason,
      payoutAccounts: Array.isArray(walletRow.payout_accounts) ? walletRow.payout_accounts : [],
      activePayoutAccountId: walletRow.active_payout_account_id,
      ledger: ledgerEntries,
      transactions: ledgerEntries,
    };

    return res.json({ status: true, wallet });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/wallet/payout-account - Add payout bank account
router.post('/wallet/payout-account', requirePaymentsEnabled, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYMENTS_DISABLED',
      message: 'Online payments are coming soon. Arrange directly with the seller',
    });
  }

  try {
    const user = req.user!;
    const { bankCode, bankName, accountNumber, accountName } = req.body;

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ status: false, message: 'Bank name, account number, and account name are required.' });
    }

    const sellerId = user.userId;
    const wRes = await dbQuery('SELECT payout_accounts FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
    const currentAccounts = wRes.rows.length > 0 && Array.isArray(wRes.rows[0].payout_accounts) ? wRes.rows[0].payout_accounts : [];

    const newAccount = {
      id: `acc_${Date.now()}`,
      bankCode: bankCode || '044',
      bankName: String(bankName).trim(),
      accountNumber: String(accountNumber).trim(),
      accountName: String(accountName).trim(),
      isVerified: true,
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

    return res.json({ status: true, account: newAccount, message: 'Payout account added with 24-hour security cooling period.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 6. CHAT & CONVERSATIONS API
// ============================================================================

// GET /api/chat/conversations
router.get('/chat/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery(
      `SELECT * FROM shopit_chat_conversations
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY last_message_at DESC NULLS LAST, created_at DESC`,
      [user.userId]
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

// POST /api/chat/conversations - Create or find conversation
router.post('/chat/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId, productId, productTitle, productImage, orderId } = req.body;
    if (!sellerId) {
      return res.status(400).json({ status: false, message: 'sellerId is required.' });
    }

    const existing = await dbQuery(
      `SELECT * FROM shopit_chat_conversations
       WHERE (buyer_id = $1 AND seller_id = $2)
          OR (buyer_id = $2 AND seller_id = $1)`,
      [user.userId, sellerId]
    );

    if (existing.rows.length > 0) {
      return res.json({ status: true, conversation: existing.rows[0] });
    }

    const sellerRes = await dbQuery('SELECT shop_name FROM shopit_sellers WHERE id = $1', [sellerId]);
    const shopName = sellerRes.rows[0]?.shop_name || 'Artisan';

    const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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

// GET /api/chat/conversations/:id/messages
router.get('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await dbQuery(
      'SELECT * FROM shopit_chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );

    const messages = result.rows.map((row: any) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderRole: row.sender_role,
      senderMaskedName: row.sender_masked_name,
      content: row.content,
      isBlockedBypass: Boolean(row.is_blocked_bypass),
      presetOffer: row.preset_offer,
      createdAt: row.created_at,
    }));

    return res.json({ status: true, messages });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/chat/conversations/:id/messages - Send message with Anti-Bypass Guard
router.post('/chat/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { content, presetOffer } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ status: false, message: 'Message content is required.' });
    }

    const cleanContent = content.trim();

    const phoneRegex = /(\+?234|0)[789][01]\d{8}/;
    const bankRegex = /\b\d{10}\b/;
    const whatsappRegex = /(wa\.me|whatsapp|dm me on ig|call me)/i;

    const isBypass = phoneRegex.test(cleanContent) || bankRegex.test(cleanContent) || whatsappRegex.test(cleanContent);

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const role = user.role === 'seller' ? 'seller' : 'buyer';
    const senderMaskedName = role === 'seller' ? 'Artisan' : `Buyer #${user.userId.slice(-4)}`;

    const savedContent = isBypass
      ? '[Security Notice: Direct phone numbers, account numbers, and off-platform payments are prohibited to protect your Paystack escrow security.]'
      : cleanContent;

    await dbQuery(
      `INSERT INTO shopit_chat_messages (
        id, conversation_id, sender_id, sender_role, sender_masked_name,
        content, is_blocked_bypass, preset_offer, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [msgId, id, user.userId, role, senderMaskedName, savedContent, isBypass, presetOffer ? JSON.stringify(presetOffer) : null]
    );

    await dbQuery(
      `UPDATE shopit_chat_conversations
       SET last_message = $1, last_message_at = NOW()
       WHERE id = $2`,
      [savedContent, id]
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

// GET /api/disputes
router.get('/disputes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    let result;
    if (user.role === 'admin') {
      result = await dbQuery('SELECT * FROM shopit_disputes ORDER BY created_at DESC');
    } else {
      result = await dbQuery(
        'SELECT * FROM shopit_disputes WHERE buyer_id = $1 OR seller_id = $1 ORDER BY created_at DESC',
        [user.userId]
      );
    }

    const disputes = result.rows.map((row: any) => ({
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
    }));

    return res.json({ status: true, disputes });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/disputes - Open a dispute ticket
router.post('/disputes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { orderId, reason, description, evidencePhotoUrl } = req.body;
    if (!orderId || !reason) {
      return res.status(400).json({ status: false, message: 'orderId and reason are required.' });
    }

    const oRes = await dbQuery('SELECT * FROM shopit_orders WHERE id = $1', [orderId]);
    if (oRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Order not found.' });
    }

    const order = oRes.rows[0];
    const items = Array.isArray(order.items) ? order.items : [];
    const sellerId = items[0]?.sellerId || 'seller_system';
    const sellerShopName = items[0]?.sellerShopName || 'Artisan';

    const disputeId = `DISP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await dbQuery(
      `INSERT INTO shopit_disputes (
        id, order_id, seller_id, buyer_id, buyer_masked_id, seller_shop_name,
        reason, description, amount_held_in_escrow, evidence_photo_url,
        seller_packed_photo_url, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NOW(), NOW())`,
      [
        disputeId,
        orderId,
        sellerId,
        user.userId,
        `Buyer #${orderId.slice(-4)}`,
        sellerShopName,
        reason,
        description || '',
        parseFloat(order.grand_total),
        evidencePhotoUrl || null,
        order.packed_photo_url || null,
      ]
    );

    await dbQuery('UPDATE shopit_orders SET status = \'disputed\', updated_at = NOW() WHERE id = $1', [orderId]);

    await dbQuery(
      `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
       VALUES ($1, $2, $3, 'disputed', $4, $5, NOW())`,
      [`osh_${Date.now()}`, orderId, order.status, user.userId, `Dispute filed: ${reason}`]
    );

    return res.status(201).json({ status: true, disputeId, message: 'Dispute opened. Funds held securely in escrow.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 8. NOTIFICATIONS API (PostgreSQL: shopit_notifications)
// ============================================================================

// GET /api/notifications
router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery(
      'SELECT * FROM shopit_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [user.userId]
    );

    const notifications = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: Boolean(row.is_read),
      link: row.link,
      createdAt: row.created_at,
    }));

    return res.json({ status: true, notifications });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    await dbQuery('UPDATE shopit_notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, user.userId]);
    return res.json({ status: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// ============================================================================
// 9. CUSTOM COMMISSIONS API (PostgreSQL: shopit_commissions)
// ============================================================================

// GET /api/commissions
router.get('/commissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const result = await dbQuery(
      `SELECT * FROM shopit_commissions
       WHERE buyer_id = $1 OR seller_id = $1
       ORDER BY created_at DESC`,
      [user.userId]
    );

    const commissions = result.rows.map((row: any) => ({
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
    }));

    return res.json({ status: true, commissions });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

// POST /api/commissions
router.post('/commissions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { sellerId, title, description, budget } = req.body;
    if (!sellerId || !title || !budget) {
      return res.status(400).json({ status: false, message: 'sellerId, title, and budget are required.' });
    }

    const budgetKobo = nairaToKobo(budget);
    const commId = `COMM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sellerRes = await dbQuery('SELECT shop_name FROM shopit_sellers WHERE id = $1', [sellerId]);
    const shopName = sellerRes.rows[0]?.shop_name || 'Artisan';

    await dbQuery(
      `INSERT INTO shopit_commissions (
        id, buyer_id, buyer_name, seller_id, seller_shop_name,
        title, description, budget_kobo, budget_naira, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW())`,
      [commId, user.userId, user.name, sellerId, shopName, title.trim(), description || '', budgetKobo, koboToNaira(budgetKobo)]
    );

    return res.status(201).json({ status: true, commissionId: commId, message: 'Commission request submitted.' });
  } catch (err: any) {
    return res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

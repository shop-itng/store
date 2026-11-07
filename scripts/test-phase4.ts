import { query } from '../api/db/postgres';

async function testPhase4() {
  console.log('--- Starting Phase 4 Verification & Product Listing Test ---');

  try {
    const testUserId = `usr_test_seller_${Date.now()}`;
    const testSellerId = `seller_test_${Date.now()}`;
    const testEmail = `seller_${Date.now()}@testcampus.ng`;

    console.log('1. Creating test user and seller in Neon PostgreSQL...');
    await query(`
      INSERT INTO shopit_users (id, email, name, role, is_verified_email, is_verified_seller, verification_status)
      VALUES ($1, $2, $3, 'seller', true, false, 'pending')
    `, [testUserId, testEmail, 'Test Artisan']);

    await query(`
      INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status, campus)
      VALUES ($1, $2, $3, $4, $5, false, 'pending', 'UNILAG (Akoka)')
    `, [testSellerId, testUserId, 'Artisan Beads NG', 'Test Artisan', testEmail]);

    const testVerifId = `VERIF-${Math.floor(10000 + Math.random() * 90000)}`;
    await query(`
      INSERT INTO shopit_verifications (id, seller_id, user_id, status, full_nin_last4, id_type, notes)
      VALUES ($1, $2, $3, 'pending', '4321', 'nin_slip', 'Manual test submission')
    `, [testVerifId, testSellerId, testUserId]);

    console.log('   User, Seller, and Verification created with pending status.');

    // Step 2: Test GET /api/verification/status/:sellerId prior to approval
    const preStatusRes = await fetch(`http://localhost:3000/api/verification/status/${testSellerId}`);
    const preStatus = await preStatusRes.json();
    console.log('2. Pre-approval verification status check:', preStatus);
    if (preStatus.isVerified !== false || preStatus.verificationStatus !== 'pending') {
      throw new Error(`Expected pending verification but got: ${JSON.stringify(preStatus)}`);
    }

    // Step 3: Admin Review Approval via POST /api/verification/admin/review
    console.log('3. Moderator approving verification via /api/verification/admin/review...');
    const reviewRes = await fetch('http://localhost:3000/api/verification/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: testVerifId,
        sellerId: testSellerId,
        decision: 'verified',
        adminName: 'Chief Moderator',
        adminRole: 'moderator'
      })
    });
    const reviewJson = await reviewRes.json();
    console.log('   Review response:', reviewJson);
    if (!reviewJson.status) {
      throw new Error(`Review failed: ${JSON.stringify(reviewJson)}`);
    }

    // Step 4: Verify Neon PostgreSQL state
    console.log('4. Verifying database state across tables...');
    const sellerDb = await query('SELECT is_verified_seller, verification_status FROM shopit_sellers WHERE id = $1', [testSellerId]);
    const userDb = await query('SELECT is_verified_seller, verification_status FROM shopit_users WHERE id = $1', [testUserId]);
    const verifDb = await query('SELECT status FROM shopit_verifications WHERE id = $1', [testVerifId]);

    console.log('   shopit_sellers:', sellerDb.rows[0]);
    console.log('   shopit_users:', userDb.rows[0]);
    console.log('   shopit_verifications:', verifDb.rows[0]);

    if (!sellerDb.rows[0]?.is_verified_seller || sellerDb.rows[0]?.verification_status !== 'verified') {
      throw new Error('Seller is not marked verified in shopit_sellers');
    }
    if (!userDb.rows[0]?.is_verified_seller || userDb.rows[0]?.verification_status !== 'verified') {
      throw new Error('User is not marked verified in shopit_users');
    }
    if (verifDb.rows[0]?.status !== 'verified') {
      throw new Error('Verification is not marked verified in shopit_verifications');
    }

    // Step 5: Test GET /api/verification/status/:sellerId post approval
    console.log('5. Calling GET /api/verification/status/:sellerId post approval...');
    const postStatusRes = await fetch(`http://localhost:3000/api/verification/status/${testSellerId}`);
    const postStatus = await postStatusRes.json();
    console.log('   Post-approval verification status:', postStatus);
    if (!postStatus.isVerified || postStatus.verificationStatus !== 'verified') {
      throw new Error(`Expected verified status but got: ${JSON.stringify(postStatus)}`);
    }

    // Step 6: Test GET /api/auth/me?userId=... to ensure sellerProfile and user have isVerifiedSeller = true
    console.log('6. Calling GET /api/auth/me?userId=... to check session representation...');
    const meRes = await fetch(`http://localhost:3000/api/auth/me?userId=${testUserId}`);
    const meJson = await meRes.json();
    console.log('   Auth /me response: isVerifiedSeller =', meJson.user?.isVerifiedSeller, 'sellerProfile.isVerifiedSeller =', meJson.user?.sellerProfile?.isVerifiedSeller);
    if (!meJson.user?.isVerifiedSeller || !meJson.user?.sellerProfile?.isVerifiedSeller) {
      throw new Error(`Auth me did not return verified seller status: ${JSON.stringify(meJson)}`);
    }

    // Step 7: Create a product listing in Neon Postgres
    console.log('7. Listing a new product in Neon PostgreSQL via POST /api/products...');
    const prodRes = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          id: `PROD-${Date.now()}`,
          sellerId: testSellerId,
          sellerShopName: 'Artisan Beads NG',
          sellerCampus: 'UNILAG (Akoka)',
          sellerBadges: ['verified'],
          title: 'Handmade Campus Crystal Waist Beads',
          description: 'Authentic handmade beaded jewelry crafted on campus.',
          category: 'beads',
          sellerPrice: 3500,
          serviceFee: 300,
          displayPrice: 3800,
          images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908'],
          stock: 12,
          rating: 5,
          reviewCount: 0,
          delivery: {
            allowsPickup: true,
            pickupLocation: 'UNILAG Main Gate',
            pickupFee: 0,
            allowsLocalDelivery: true,
            localDeliveryFee: 500,
            minOrderForDelivery: 1000
          },
          isSoldOut: false,
          isNewArrival: true
        }
      })
    });
    const prodJson = await prodRes.json();
    console.log('   Product creation response:', prodJson);
    if (!prodJson.success && !prodJson.product) {
      throw new Error(`Product creation failed: ${JSON.stringify(prodJson)}`);
    }

    // Step 8: Clean up test artifacts
    console.log('8. Cleaning up test data from Neon database...');
    await query('DELETE FROM shopit_products WHERE seller_id = $1', [testSellerId]);
    await query('DELETE FROM shopit_verifications WHERE id = $1', [testVerifId]);
    await query('DELETE FROM shopit_sellers WHERE id = $1', [testSellerId]);
    await query('DELETE FROM shopit_users WHERE id = $1', [testUserId]);

    console.log('ALL PHASE 4 TESTS PASSED SUCCESSFULLY! Seller verification unblocks listing flawlessly.');
  } catch (err: any) {
    console.error('Phase 4 Test Failure:', err.message);
    process.exit(1);
  }
}

testPhase4();

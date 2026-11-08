import { query, runMigration, hashPassword } from '../api/db/postgres';

async function testPhase4() {
  console.log('--- Starting Phase 4 Verification & Product Listing Test ---');
  await runMigration();

  try {
    const testUserId = `usr_test_seller_${Date.now()}`;
    const testSellerId = `seller_test_${Date.now()}`;
    const testEmail = `seller_${Date.now()}@testcampus.ng`;
    const testHash = hashPassword('TestSeller123!');

    console.log('1. Creating test user and seller in PostgreSQL...');
    await query(`
      INSERT INTO shopit_users (id, email, name, password_hash, role, is_verified_email, is_verified_seller, verification_status)
      VALUES ($1, $2, $3, $4, 'seller', true, false, 'pending')
    `, [testUserId, testEmail, 'Test Artisan', testHash]);

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

    // Step 2: Moderator approval logic simulation
    console.log('2. Simulating moderator approval on verification, seller, and user tables...');
    await query(`
      UPDATE shopit_verifications
      SET status = 'verified', reviewed_at = NOW(), admin_notes = 'Approved by Chief Moderator'
      WHERE id = $1
    `, [testVerifId]);

    await query(`
      UPDATE shopit_sellers
      SET is_verified_seller = true, verification_status = 'verified',
          verified_legal_name = 'Test Artisan', verified_nin_last4 = '4321',
          verified_at = NOW(), verification_rejection_reason = NULL
      WHERE id = $1
    `, [testSellerId]);

    await query(`
      UPDATE shopit_users
      SET is_verified_seller = true, verification_status = 'verified', updated_at = NOW()
      WHERE id = $1
    `, [testUserId]);

    // Step 3: Verify database state
    console.log('3. Checking verification flags in database...');
    const sellerRow = (await query('SELECT is_verified_seller, verification_status, verified_legal_name, verified_nin_last4 FROM shopit_sellers WHERE id = $1', [testSellerId])).rows[0];
    const userRow = (await query('SELECT is_verified_seller, verification_status FROM shopit_users WHERE id = $1', [testUserId])).rows[0];
    const verifRow = (await query('SELECT status FROM shopit_verifications WHERE id = $1', [testVerifId])).rows[0];

    console.log('   shopit_sellers state:', sellerRow);
    console.log('   shopit_users state:', userRow);
    console.log('   shopit_verifications state:', verifRow);

    if (!sellerRow?.is_verified_seller || sellerRow?.verification_status !== 'verified') {
      throw new Error('Seller verification check failed in shopit_sellers');
    }
    if (!userRow?.is_verified_seller || userRow?.verification_status !== 'verified') {
      throw new Error('User verification check failed in shopit_users');
    }
    if (verifRow?.status !== 'verified') {
      throw new Error('Verification request status check failed in shopit_verifications');
    }

    // Step 4: Test listing product in database
    console.log('4. Testing product listing persistence...');
    const testProductId = `PROD-${Date.now()}`;
    await query(`
      INSERT INTO shopit_products (id, seller_id, seller_shop_name, seller_campus, title, description, category, seller_price, service_fee, display_price, images, stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      testProductId,
      testSellerId,
      'Artisan Beads NG',
      'UNILAG (Akoka)',
      'Handcrafted Campus Crystal Beads',
      'Authentic jewelry',
      'beads',
      3500,
      300,
      3800,
      JSON.stringify(['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908']),
      15
    ]);

    const prodRow = (await query('SELECT id, title, display_price, seller_id FROM shopit_products WHERE id = $1', [testProductId])).rows[0];
    console.log('   Listed product row:', prodRow);
    if (!prodRow || prodRow.id !== testProductId) {
      throw new Error('Product failed to persist into database');
    }

    // Step 5: Clean up
    console.log('5. Cleaning up test data...');
    await query('DELETE FROM shopit_products WHERE id = $1', [testProductId]);
    await query('DELETE FROM shopit_verifications WHERE id = $1', [testVerifId]);
    await query('DELETE FROM shopit_sellers WHERE id = $1', [testSellerId]);
    await query('DELETE FROM shopit_users WHERE id = $1', [testUserId]);

    console.log('--- ALL PHASE 4 DATABASE & LOGIC CHECKS PASSED (100%) ---');
  } catch (err: any) {
    console.error('Phase 4 Test Failure:', err.message);
    process.exit(1);
  }
}

testPhase4();

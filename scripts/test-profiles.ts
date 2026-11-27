import './testEnv.js';
import { runMigration, query as dbQuery } from '../server/db/postgres.js';
import { generateUniqueProfileSlug } from '../server/lib/validation.js';

async function runProfileTests() {
  console.log('====================================================');
  console.log('🧪 SHOP IT - PROFILE & SLUG VERIFICATION SUITE');
  console.log('====================================================\n');

  await runMigration();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${name}`);
    } else {
      console.error(`❌ [FAIL] ${name}`);
    }
  }

  // TEST 1: Unique Profile Slug Generation
  {
    const slug1 = await generateUniqueProfileSlug(async (sql, params) => {
      const res = await dbQuery(sql, params);
      return { rows: res.rows };
    }, 'Chinedu Okafor');
    assert(Boolean(slug1 && slug1.length > 0), 'Unique profile slug generated successfully');
  }

  // TEST 2: User profile table columns and backfill
  {
    const testUserId = `user_prof_${Date.now()}`;
    const testEmail = `prof_${Date.now()}@unilag.edu.ng`;
    await dbQuery(
      `INSERT INTO shopit_users (id, email, name, display_name, profile_slug, password_hash, role, is_verified_email, age)
       VALUES ($1, $2, 'Chinedu Okafor', 'Chinedu', 'chinedu_artisan', 'hash_placeholder', 'seller', true, 20)`,
      [testUserId, testEmail]
    );

    await dbQuery(
      `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status)
       VALUES ($1, $1, 'Chinedu Leather Craft', 'Chinedu', $2, true, 'verified')`,
      [testUserId, testEmail]
    );

    const userRes = await dbQuery('SELECT display_name, profile_slug, avatar_url, privacy_settings FROM shopit_users WHERE id = $1', [testUserId]);
    assert(userRes.rows.length === 1, 'Created user retrieved successfully from PostgreSQL');
    assert(userRes.rows[0].profile_slug === 'chinedu_artisan', 'Profile slug correctly stored in database');
    assert(userRes.rows[0].display_name === 'Chinedu', 'Display name correctly stored in database');
  }

  console.log(`\n====================================================`);
  console.log(`📊 PROFILE TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`====================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runProfileTests().catch(err => {
  console.error('Profile test execution failed:', err);
  process.exit(1);
});

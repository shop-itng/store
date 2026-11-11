import 'dotenv/config';
import { app } from '../api/index.js';
import http from 'http';

async function runTests() {
  console.log('=== Testing User Registration, DB Persistence & Accounts Query ===');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const timestamp = Date.now();
    const testEmail = `newuser_${timestamp}@test.edu.ng`;
    const testPassword = 'Password123!';
    const testName = 'Ada Lovelace';

    // 1. Register new user
    console.log(`1. Testing POST /api/auth/register for ${testEmail}...`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
        role: 'buyer',
        age: 22,
        hasGuardianConsent: true,
      }),
    });

    const regData = await regRes.json();
    console.log('   Registration response status:', regRes.status, regData.status, regData.message);
    if (!regRes.ok || !regData.status) {
      throw new Error(`Registration failed: ${regData.message}`);
    }
    const createdUserId = regData.user.id;
    console.log(`   ✓ Created user ID: ${createdUserId}`);

    // 2. Query admin users list to verify the new user appears
    console.log('2. Testing GET /api/admin/users to verify new account appears...');
    const usersRes = await fetch(`${baseUrl}/api/admin/users?q=${encodeURIComponent(testEmail)}`);
    const usersData = await usersRes.json();
    console.log(`   Found ${usersData.total} user(s) matching ${testEmail}`);
    if (!usersData.status || usersData.total === 0 || !usersData.users.some((u: any) => u.email === testEmail)) {
      throw new Error(`New user ${testEmail} was not found in GET /api/admin/users!`);
    }
    console.log('   ✓ User successfully retrieved from database via GET /api/admin/users');

    // 3. Test Login with newly created credentials
    console.log('3. Testing POST /api/auth/login with new account...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    console.log('   Login response status:', loginRes.status, loginData.status);
    if (!loginRes.ok || !loginData.status) {
      throw new Error(`Login failed with created user: ${loginData.message}`);
    }
    console.log('   ✓ Successfully authenticated with newly registered user account');

    // 4. Test Seller Registration
    const sellerEmail = `artisan_${timestamp}@test.edu.ng`;
    console.log(`4. Testing POST /api/auth/register for seller ${sellerEmail}...`);
    const sellerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password: testPassword,
        name: 'Chidi Crafts',
        role: 'seller',
        age: 25,
        shopName: 'Chidi Heritage Beads',
        bio: 'Authentic handmade Nigerian beads',
        campus: 'UNILAG (Akoka)',
      }),
    });
    const sellerRegData = await sellerRegRes.json();
    if (!sellerRegRes.ok || !sellerRegData.status) {
      throw new Error(`Seller registration failed: ${sellerRegData.message}`);
    }
    console.log(`   ✓ Created seller user ID: ${sellerRegData.user.id}`);

    // 5. Query sellers endpoint
    console.log('5. Testing GET /api/sellers to verify new seller appears...');
    const sellersRes = await fetch(`${baseUrl}/api/sellers`);
    const sellersData = await sellersRes.json();
    if (!sellersData.status || !sellersData.sellers.some((s: any) => s.email === sellerEmail)) {
      throw new Error(`Seller ${sellerEmail} was not found in GET /api/sellers!`);
    }
    console.log('   ✓ Seller successfully retrieved from database via GET /api/sellers');

    // 6. Test GET /api/verification/admin/queue
    console.log('6. Testing GET /api/verification/admin/queue (verifying column compatibility)...');
    const queueRes = await fetch(`${baseUrl}/api/verification/admin/queue`);
    const queueData = await queueRes.json();
    if (!queueRes.ok) {
      throw new Error(`Queue query failed with HTTP ${queueRes.status}`);
    }
    console.log(`   ✓ Queue returned successfully with HTTP 200 (Items: ${queueData.queue?.length ?? 0})`);

    console.log('\n=== ALL USER REGISTRATION & DATABASE PERSISTENCE TESTS PASSED (100%) ===');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

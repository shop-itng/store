import 'dotenv/config';
import { app } from '../api/index.js';
import http from 'http';

async function runTests() {
  console.log('=== Testing Email Validation, Password Reset & NIN Verification ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Login with unregistered email
    console.log('1. Testing Login with unregistered email...');
    const unregRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_account_xyz@test.com', password: 'Password123!' }),
    });
    const unregData = await unregRes.json();
    console.log(`   Response status: ${unregRes.status}, Error code: ${unregData.error}`);
    if (unregRes.status !== 404 || unregData.error !== 'EMAIL_NOT_REGISTERED') {
      throw new Error(`Expected 404 EMAIL_NOT_REGISTERED, got ${unregRes.status}: ${JSON.stringify(unregData)}`);
    }
    console.log('   ✓ Unregistered email successfully caught and rejected with EMAIL_NOT_REGISTERED');

    // 2. Password reset OTP with unregistered email
    console.log('\n2. Testing send-otp password_reset with unregistered email...');
    const resetUnregRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_account_xyz@test.com', purpose: 'password_reset' }),
    });
    const resetUnregData = await resetUnregRes.json();
    console.log(`   Response status: ${resetUnregRes.status}, Error code: ${resetUnregData.error}`);
    if (resetUnregRes.status !== 404 || resetUnregData.error !== 'EMAIL_NOT_REGISTERED') {
      throw new Error(`Expected 404 EMAIL_NOT_REGISTERED, got ${resetUnregRes.status}: ${JSON.stringify(resetUnregData)}`);
    }
    console.log('   ✓ Password reset rejected for unregistered email with EMAIL_NOT_REGISTERED');

    // 3. Register a test seller and verify NIN
    const timestamp = Date.now();
    const testEmail = `artisan_nin_${timestamp}@unilag.edu.ng`;
    console.log(`\n3. Registering seller ${testEmail}...`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        name: 'Babatunde Adeleke',
        password: 'StrongPassword123!',
        role: 'seller',
        shopName: "Babatunde's Bronze Crafts",
        age: 22,
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201) {
      throw new Error(`Failed to register test seller: ${JSON.stringify(regData)}`);
    }
    const sellerId = regData.user.id;
    console.log(`   ✓ Created seller ID: ${sellerId}`);

    // 4. Submit 11-digit NIN verification
    console.log('\n4. Submitting NIN verification with 11-digit NIN and live camera selfie...');
    const verifRes = await fetch(`${baseUrl}/api/verification/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerId,
        shopName: "Babatunde's Bronze Crafts",
        fullName: 'Babatunde Adeleke',
        dateOfBirth: '2002-05-14',
        nin: '12345678901',
        idDocumentType: 'nin_slip',
        idDocumentPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        selfiePhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        livenessScore: 95,
        ndpaConsentSigned: true,
      }),
    });
    const verifData = await verifRes.json();
    console.log(`   Verification Status: ${verifData.verificationStatus}, Message: ${verifData.message}`);
    if (verifRes.status !== 200 || verifData.verificationStatus !== 'verified') {
      throw new Error(`Expected verified status, got: ${JSON.stringify(verifData)}`);
    }
    console.log('   ✓ NIN verification completed successfully with verified status!');

    // 5. Test Password Reset for registered user with 6-digit code
    console.log('\n5. Requesting OTP code for password reset on registered user...');
    const otpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, purpose: 'password_reset' }),
    });
    const otpData = await otpRes.json();
    console.log(`   OTP Dispatch: ${otpRes.status}, Message: ${otpData.message}`);
    const devCode = otpData.devCode;
    if (!devCode) {
      throw new Error(`devCode not returned for test verification: ${JSON.stringify(otpData)}`);
    }

    console.log(`   ✓ Received 6-digit code: ${devCode}. Now submitting password reset...`);
    const passResetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: devCode,
        newPassword: 'BrandNewSecurePassword456!',
      }),
    });
    const passResetData = await passResetRes.json();
    if (passResetRes.status !== 200 || !passResetData.status) {
      throw new Error(`Failed to reset password: ${JSON.stringify(passResetData)}`);
    }
    console.log('   ✓ Password successfully reset in database!');

    // 6. Test Login with new password
    console.log('\n6. Testing Login with updated password...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'BrandNewSecurePassword456!',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.status) {
      throw new Error(`Login failed with new password: ${JSON.stringify(loginData)}`);
    }
    console.log(`   ✓ Login successful! Verified seller status: ${loginData.user?.sellerProfile?.isVerifiedSeller}`);

    console.log('\n=== ALL EMAIL VALIDATION, PASSWORD RESET & NIN TESTS PASSED (100%) ===\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});

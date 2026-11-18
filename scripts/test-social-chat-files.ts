import './testEnv.js';
import http from 'http';
import assert from 'assert';
import { app } from '../api/index.js';
import { query, runMigration } from '../api/db/postgres.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.stack || err.message}`);
  }
}

// Valid minimal 1x1 PNG binary
const TINY_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BYTES.toString('base64')}`;

// Synthetic JPEG with SOI (FF D8) + APP1 EXIF segment (FF E1, len 00 08, 'Exif\0\0') + SOF0/EOI trailer (FF D9)
const JPEG_WITH_EXIF_BYTES = Buffer.from([
  0xff, 0xd8, // SOI
  0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x11, 0x22, // APP1 EXIF block
  0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, // APP0
  0xff, 0xda, 0x00, 0x04, 0x00, 0x00, // SOS stub
  0xff, 0xd9, // EOI
]);
const JPEG_WITH_EXIF_DATA_URL = `data:image/jpeg;base64,${JPEG_WITH_EXIF_BYTES.toString('base64')}`;

const TINY_PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64')}`;
const TINY_TXT_DATA_URL = `data:text/plain;base64,${Buffer.from('Handmade order measurement notes: 24cm wrist, navy beads').toString('base64')}`;

async function main() {
  console.log('==================================================================');
  console.log('SHOP IT - PROFILES, FOLLOWING, BLOCKS, BETTER CHAT & FILES SUITE');
  console.log('==================================================================\n');

  await runMigration();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const ts = Date.now();

    let sellerToken = '';
    let sellerUserId = '';
    let sellerProfileSlug = '';
    let sellerShopId = '';

    let buyerToken = '';
    let buyerUserId = '';
    let buyerProfileSlug = '';

    let minorToken = '';
    let minorUserId = '';
    let minorProfileSlug = '';

    let outsiderToken = '';
    let outsiderUserId = '';

    // -----------------------------------------------------------------------
    // TEST 1: Signups, Display Names, Interests & Settings Validation
    // -----------------------------------------------------------------------
    await test('1. Signups (seller, buyer, minor, outsider), profiles/me & canonical settings + minor safety', async () => {
      // 1a. Adult Seller
      const sRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `social_seller_${ts}@shopit.ng`,
          password: 'SocialPass123!',
          name: 'Adaeze Okafor',
          role: 'seller',
          age: 22,
          shopName: 'Ada Crafts Studio',
          campus: 'UNILAG (Akoka)',
        }),
      });
      assert.strictEqual(sRes.status, 201);
      const sJson: any = await sRes.json();
      sellerToken = sJson.sessionToken;
      sellerUserId = sJson.user.id;
      sellerShopId = sJson.user.sellerProfile?.id || sellerUserId;
      assert.ok(sellerToken);

      // 1b. Adult Buyer
      const bRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `social_buyer_${ts}@shopit.ng`,
          password: 'SocialPass123!',
          name: 'Chidi Nwosu',
          role: 'buyer',
          age: 21,
        }),
      });
      assert.strictEqual(bRes.status, 201);
      const bJson: any = await bRes.json();
      buyerToken = bJson.sessionToken;
      buyerUserId = bJson.user.id;

      // 1c. Minor Buyer (age 16)
      const mRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `social_minor_${ts}@shopit.ng`,
          password: 'SocialPass123!',
          name: 'Tunde Adeyemi',
          role: 'buyer',
          age: 16,
          hasGuardianConsent: true,
          guardianName: 'Mrs Adeyemi',
        }),
      });
      assert.strictEqual(mRes.status, 201);
      const mJson: any = await mRes.json();
      minorToken = mJson.sessionToken;
      minorUserId = mJson.user.id;

      // 1d. Outsider user
      const oRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `social_outsider_${ts}@shopit.ng`,
          password: 'SocialPass123!',
          name: 'Bisi Balogun',
          role: 'buyer',
          age: 23,
        }),
      });
      assert.strictEqual(oRes.status, 201);
      const oJson: any = await oRes.json();
      outsiderToken = oJson.sessionToken;
      outsiderUserId = oJson.user.id;

      // Fetch /profiles/me for seller & buyer & minor
      const sMe: any = await (await fetch(`${baseUrl}/api/profiles/me`, { headers: { Authorization: `Bearer ${sellerToken}` } })).json();
      assert.strictEqual(sMe.status, true);
      assert.strictEqual(sMe.profile.displayName, 'Adaeze');
      sellerProfileSlug = sMe.profile.profileSlug;

      const bMe: any = await (await fetch(`${baseUrl}/api/profiles/me`, { headers: { Authorization: `Bearer ${buyerToken}` } })).json();
      assert.strictEqual(bMe.profile.displayName, 'Chidi');
      buyerProfileSlug = bMe.profile.profileSlug;

      const mMe: any = await (await fetch(`${baseUrl}/api/profiles/me`, { headers: { Authorization: `Bearer ${minorToken}` } })).json();
      assert.strictEqual(mMe.profile.isUnder18, true);
      assert.strictEqual(mMe.profile.privacySettings.whoCanFollow, 'approval');
      assert.strictEqual(mMe.profile.privacySettings.whoCanMessage, 'mutual');
      minorProfileSlug = mMe.profile.profileSlug;

      // Unknown field rejected on PATCH /profiles/me
      const unkRes = await fetch(`${baseUrl}/api/profiles/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ displayName: 'Chidi Crafts', hackerField: true }),
      });
      assert.strictEqual(unkRes.status, 400);

      // Update interests & bio on seller
      const patchRes = await fetch(`${baseUrl}/api/profiles/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          displayName: 'Adaeze Studio',
          bio: 'Handcrafted beads and crochet items from Lagos.',
          interests: ['Waist Beads & Jewelry', 'Crochet & Yarn'],
        }),
      });
      assert.strictEqual(patchRes.status, 200);
      const patchJson: any = await patchRes.json();
      assert.strictEqual(patchJson.profile.displayName, 'Adaeze Studio');
      assert.deepStrictEqual(patchJson.profile.interests, ['Waist Beads & Jewelry', 'Crochet & Yarn']);
      sellerProfileSlug = patchJson.profile.profileSlug;

      // Update minor settings — must retain whoCanFollow: 'approval' and whoCanMessage: 'mutual' even if client attempts 'everyone'
      const mSetRes = await fetch(`${baseUrl}/api/profiles/me/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({
          notificationPrefs: { emailFollowers: false, emailOrders: true },
          privacySettings: { whoCanFollow: 'everyone', whoCanMessage: 'everyone', showLastSeen: false },
        }),
      });
      assert.strictEqual(mSetRes.status, 200);
      const mSetJson: any = await mSetRes.json();
      assert.strictEqual(mSetJson.privacySettings.whoCanFollow, 'approval');
      assert.strictEqual(mSetJson.privacySettings.whoCanMessage, 'mutual');
      assert.strictEqual(mSetJson.notificationPrefs.emailFollowers, false);
    });

    // -----------------------------------------------------------------------
    // TEST 2: Unified File Storage (/api/files/upload, /api/files/:id, DELETE)
    // -----------------------------------------------------------------------
    let productFileUrl = '';
    let chatFileId = '';
    let chatFileUrl = '';

    await test('2. Unified PostgreSQL File Storage: magic-bytes, EXIF strip, public vs private auth & headers', async () => {
      // 2a. Reject SVG XSS payload
      const svgRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg onload=alert(1)></svg>').toString('base64')}`,
          fileName: 'evil.svg',
          purpose: 'product',
        }),
      });
      assert.strictEqual(svgRes.status, 400);

      // 2b. Reject disguised PNG with invalid magic bytes
      const badMagicRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          dataUrl: `data:image/png;base64,${Buffer.from('<html>not a png</html>').toString('base64')}`,
          fileName: 'fake.png',
          purpose: 'product',
        }),
      });
      assert.strictEqual(badMagicRes.status, 400);

      // 2c. Upload JPEG with EXIF APP1 block & verify EXIF bytes stripped in DB/served output
      const exifRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          dataUrl: JPEG_WITH_EXIF_DATA_URL,
          fileName: 'avatar-exif.jpg',
          purpose: 'avatar',
        }),
      });
      assert.strictEqual(exifRes.status, 201);
      const exifJson: any = await exifRes.json();
      assert.ok(exifJson.file.url.startsWith('/api/files/file_'));
      const servedExif = await fetch(`${baseUrl}${exifJson.file.url}`);
      assert.strictEqual(servedExif.status, 200);
      const servedBuf = Buffer.from(await servedExif.arrayBuffer());
      assert.strictEqual(servedBuf.includes(Buffer.from('Exif')), false, 'EXIF metadata must be stripped');

      // 2d. Public PNG upload for product listing -> accessible unauthenticated
      const prodUpRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          dataUrl: TINY_PNG_DATA_URL,
          fileName: 'beads.png',
          purpose: 'product',
        }),
      });
      assert.strictEqual(prodUpRes.status, 201);
      const prodUpJson: any = await prodUpRes.json();
      productFileUrl = prodUpJson.file.url;
      assert.strictEqual(prodUpJson.file.isPublic, true);

      const pubGet = await fetch(`${baseUrl}${productFileUrl}`);
      assert.strictEqual(pubGet.status, 200);
      assert.strictEqual(pubGet.headers.get('x-content-type-options'), 'nosniff');

      // 2e. PDF rejected on image-only 'dispute' purpose (400), accepted as private on 'chat' purpose (201) -> 401 unauth, 403 non-owner, 200 owner with attachment header
      const disputePdfReject = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          dataUrl: TINY_PDF_DATA_URL,
          fileName: 'receipt.pdf',
          purpose: 'dispute',
        }),
      });
      assert.strictEqual(disputePdfReject.status, 400);

      const pdfUpRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          dataUrl: TINY_PDF_DATA_URL,
          fileName: 'receipt.pdf',
          purpose: 'chat',
        }),
      });
      assert.strictEqual(pdfUpRes.status, 201);
      const pdfUpJson: any = await pdfUpRes.json();
      assert.strictEqual(pdfUpJson.file.isPublic, false);
      assert.strictEqual(pdfUpJson.file.kind, 'document');

      const unauthPdf = await fetch(`${baseUrl}${pdfUpJson.file.url}`);
      assert.strictEqual(unauthPdf.status, 401);

      const outsiderPdf = await fetch(`${baseUrl}${pdfUpJson.file.url}`, {
        headers: { Authorization: `Bearer ${outsiderToken}` },
      });
      assert.strictEqual(outsiderPdf.status, 403);

      const ownerPdf = await fetch(`${baseUrl}${pdfUpJson.file.url}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(ownerPdf.status, 200);
      assert.ok((ownerPdf.headers.get('content-disposition') || '').startsWith('attachment;'));

      // 2f. Upload TXT chat file (for chat test later) + verify DELETE permissions
      const txtUpRes = await fetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          dataUrl: TINY_TXT_DATA_URL,
          fileName: 'sizes.txt',
          purpose: 'chat',
        }),
      });
      assert.strictEqual(txtUpRes.status, 201);
      const txtUpJson: any = await txtUpRes.json();
      chatFileId = txtUpJson.file.id;
      chatFileUrl = txtUpJson.file.url;

      // Outsider cannot delete buyer's file
      const delForbidden = await fetch(`${baseUrl}/api/files/${pdfUpJson.file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${outsiderToken}` },
      });
      assert.strictEqual(delForbidden.status, 403);

      // Owner can delete their unused file
      const delOk = await fetch(`${baseUrl}/api/files/${pdfUpJson.file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(delOk.status, 200);

      // Clean up exif test file from seller's avatar later; also verify GET /api/files/mine works
      const mineRes = await fetch(`${baseUrl}/api/files/mine`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(mineRes.status, 200);
      const mineJson: any = await mineRes.json();
      assert.ok(mineJson.files.some((f: any) => f.id === chatFileId));
    });

    // -----------------------------------------------------------------------
    // TEST 3: Follows, Requests, Following Feed, Privacy & Notifications
    // -----------------------------------------------------------------------
    let activeProductId = '';

    await test('3. Follows, approval requests, notifications, follower-list privacy & Following feed', async () => {
      // 3a. Buyer follows Seller (adult, open whoCanFollow='everyone' -> accepted immediately)
      const f1 = await fetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ targetUserId: sellerUserId }),
      });
      assert.strictEqual(f1.status, 201);
      const f1Json: any = await f1.json();
      assert.strictEqual(f1Json.followStatus, 'accepted');
      assert.strictEqual(f1Json.followersCount, 1);

      // Seller received a New Follower notification
      const sNotif: any = await (
        await fetch(`${baseUrl}/api/notifications`, { headers: { Authorization: `Bearer ${sellerToken}` } })
      ).json();
      assert.ok(sNotif.unreadCount >= 1);
      assert.ok(sNotif.notifications.some((n: any) => n.title === 'New Follower'));

      // Mark seller notifications read-all
      const markReadAll = await fetch(`${baseUrl}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(markReadAll.status, 200);
      const sNotifAfter: any = await (
        await fetch(`${baseUrl}/api/notifications`, { headers: { Authorization: `Bearer ${sellerToken}` } })
      ).json();
      assert.strictEqual(sNotifAfter.unreadCount, 0);

      // 3b. Buyer requests to follow Minor -> pending
      const fMinor = await fetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ targetUserId: minorUserId }),
      });
      assert.strictEqual(fMinor.status, 201);
      const fMinorJson: any = await fMinor.json();
      assert.strictEqual(fMinorJson.followStatus, 'pending');
      assert.strictEqual(fMinorJson.followersCount, 0);

      // Minor sees pending request and accepts it
      const reqList: any = await (
        await fetch(`${baseUrl}/api/follows/requests`, { headers: { Authorization: `Bearer ${minorToken}` } })
      ).json();
      assert.strictEqual(reqList.requests.length, 1);
      assert.strictEqual(reqList.requests[0].followerId, buyerUserId);

      const acceptRes = await fetch(`${baseUrl}/api/follows/requests/${buyerUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({ action: 'accept' }),
      });
      assert.strictEqual(acceptRes.status, 200);
      const acceptJson: any = await acceptRes.json();
      assert.strictEqual(acceptJson.followersCount, 1);

      // Check privacy: Buyer sets showFollowersList: false & profileVisibility: 'followers'
      await fetch(`${baseUrl}/api/profiles/me/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ privacySettings: { profileVisibility: 'followers', showFollowersList: false } }),
      });

      // Outsider views buyer profile -> isRestricted: true, products hidden
      const restrictedView: any = await (
        await fetch(`${baseUrl}/api/profiles/${buyerProfileSlug}`, {
          headers: { Authorization: `Bearer ${outsiderToken}` },
        })
      ).json();
      assert.strictEqual(restrictedView.isRestricted, true);

      // Outsider requests buyer's followers list -> 403
      const privListRes = await fetch(`${baseUrl}/api/profiles/${buyerProfileSlug}/followers`, {
        headers: { Authorization: `Bearer ${outsiderToken}` },
      });
      assert.strictEqual(privListRes.status, 403);

      // Reset buyer profileVisibility to everyone
      await fetch(`${baseUrl}/api/profiles/me/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ privacySettings: { profileVisibility: 'everyone', showFollowersList: true } }),
      });

      // 3c. Seller lists active product, paused product & draft product -> follower gets notified & Following feed filters properly
      const pActiveRes = await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          title: 'Sunset Seed Bead Bracelet',
          description: 'Handmade colorful sunset bracelet with durable clasp.',
          category: 'Jewelry & Beads',
          sellerPrice: 2500,
          stock: 5,
          images: [productFileUrl],
          isPaused: false,
          isDraft: false,
        }),
      });
      assert.strictEqual(pActiveRes.status, 201);
      const pActiveJson: any = await pActiveRes.json();
      activeProductId = pActiveJson.productId;
      assert.ok(activeProductId);

      // Paused product (must be excluded from Following feed)
      await fetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          title: 'Paused Hidden Craft',
          description: 'Should not appear in following feed.',
          category: 'Jewelry & Beads',
          sellerPrice: 1500,
          stock: 3,
          images: [productFileUrl],
          isPaused: true,
          isDraft: false,
        }),
      });

      // Buyer Following feed sees active product only
      const feedRes = await fetch(`${baseUrl}/api/feed/following`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(feedRes.status, 200);
      const feedJson: any = await feedRes.json();
      assert.strictEqual(feedJson.products.length, 1);
      assert.strictEqual(feedJson.products[0].id, activeProductId);

      // Buyer received New Product notification from followed shop
      const bNotifs: any = await (
        await fetch(`${baseUrl}/api/notifications`, { headers: { Authorization: `Bearer ${buyerToken}` } })
      ).json();
      assert.ok(bNotifs.notifications.some((n: any) => String(n.title).includes('New item from') || String(n.message).includes('Sunset Seed Bead Bracelet')));

      // Seller followers list returns Buyer
      const folListRes: any = await (
        await fetch(`${baseUrl}/api/profiles/${sellerProfileSlug}/followers`, {
          headers: { Authorization: `Bearer ${buyerToken}` },
        })
      ).json();
      assert.strictEqual(folListRes.total, 1);
      assert.strictEqual(folListRes.users[0].id, buyerUserId);
    });

    // -----------------------------------------------------------------------
    // TEST 4: Better Chat Privacy (whoCanMessage), Attachments & Read Receipts
    // -----------------------------------------------------------------------
    let conversationId = '';

    await test('4. Chat privacy (whoCanMessage=mutual), attachments, anti-bypass & unread/read receipts', async () => {
      // Seller restricts messages to mutual followers only
      const setRes = await fetch(`${baseUrl}/api/profiles/me/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ privacySettings: { whoCanMessage: 'mutual' } }),
      });
      assert.strictEqual(setRes.status, 200);

      // Buyer follows Seller, but Seller does NOT follow Buyer yet -> 403
      const blockedStart = await fetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ sellerId: sellerShopId, productId: activeProductId }),
      });
      assert.strictEqual(blockedStart.status, 403);

      // Seller follows Buyer back -> mutual! Now POST /chat/conversations -> 201
      const followBack = await fetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ targetUserId: buyerUserId }),
      });
      assert.strictEqual(followBack.status, 201);

      const startOk = await fetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ sellerId: sellerShopId, productId: activeProductId }),
      });
      assert.strictEqual(startOk.status, 201);
      const startJson: any = await startOk.json();
      conversationId = startJson.conversation.id;
      assert.ok(conversationId);

      // Non-participant outsider cannot access chat file even though it's linked to buyer
      // Send message with attachment & clean text
      const sendMsgRes = await fetch(`${baseUrl}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          content: 'Hi! Here are my wrist measurement notes in the text file.',
          attachment: { fileId: chatFileId },
        }),
      });
      assert.strictEqual(sendMsgRes.status, 201);
      const sendMsgJson: any = await sendMsgRes.json();
      assert.ok(sendMsgJson.message.attachment);
      assert.strictEqual(sendMsgJson.message.attachment.id, chatFileId);
      assert.strictEqual(sendMsgJson.message.readByOther, false);

      // Seller CAN now download chatFileUrl as conversation participant; outsider CANNOT
      const sellerGetFile = await fetch(`${baseUrl}${chatFileUrl}`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(sellerGetFile.status, 200);
      assert.ok((sellerGetFile.headers.get('content-disposition') || '').startsWith('attachment;'));

      const outsiderGetFile = await fetch(`${baseUrl}${chatFileUrl}`, {
        headers: { Authorization: `Bearer ${outsiderToken}` },
      });
      assert.strictEqual(outsiderGetFile.status, 403);

      // Seller checks conversations -> unreadSeller === 1
      const sConvs: any = await (
        await fetch(`${baseUrl}/api/chat/conversations`, { headers: { Authorization: `Bearer ${sellerToken}` } })
      ).json();
      const sConv = sConvs.conversations.find((c: any) => c.id === conversationId);
      assert.ok(sConv);
      assert.strictEqual(sConv.unreadSeller, 1);

      // Seller marks conversation read -> unreadSeller resets to 0 & Buyer sees readByOther: true
      const readRes = await fetch(`${baseUrl}/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(readRes.status, 200);
      const readJson: any = await readRes.json();
      assert.strictEqual(readJson.unreadSeller, 0);

      const bMsgs: any = await (
        await fetch(`${baseUrl}/api/chat/conversations/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${buyerToken}` },
        })
      ).json();
      assert.strictEqual(bMsgs.messages[0].readByOther, true);

      // Anti-bypass check: phone/account number gets redacted cleanly
      const bypassRes = await fetch(`${baseUrl}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ content: 'Call me on 08012345678' }),
      });
      assert.strictEqual(bypassRes.status, 201);
      const bypassJson: any = await bypassRes.json();
      assert.strictEqual(bypassJson.message.isBlockedBypass, true);
    });

    // -----------------------------------------------------------------------
    // TEST 5: Blocking Removes Follows Both Ways & Blocks Profiles, Feed, Chat
    // -----------------------------------------------------------------------
    await test('5. Blocking removes follows both ways, blocks profile/chat/follow & Unblock restores', async () => {
      // Seller blocks Buyer
      const blkRes = await fetch(`${baseUrl}/api/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ targetUserId: buyerUserId, reason: 'Testing block enforcement' }),
      });
      assert.strictEqual(blkRes.status, 201);

      // Both follow directions deleted
      const fRows = await query(
        `SELECT COUNT(*)::int AS c FROM shopit_follows
         WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
        [sellerUserId, buyerUserId]
      );
      assert.strictEqual(Number(fRows.rows[0].c), 0);

      // Buyer sees 403 viewing seller profile
      const profBlocked = await fetch(`${baseUrl}/api/profiles/${sellerProfileSlug}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(profBlocked.status, 403);

      // Buyer cannot follow seller while blocked (403)
      const folBlocked = await fetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ targetUserId: sellerUserId }),
      });
      assert.strictEqual(folBlocked.status, 403);

      // Buyer cannot send message in conversation while blocked (403)
      const msgBlocked = await fetch(`${baseUrl}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ content: 'Can I still message?' }),
      });
      assert.strictEqual(msgBlocked.status, 403);

      // Buyer Following feed no longer shows seller's product
      const feedAfterBlock: any = await (
        await fetch(`${baseUrl}/api/feed/following`, { headers: { Authorization: `Bearer ${buyerToken}` } })
      ).json();
      assert.strictEqual(feedAfterBlock.products.length, 0);

      // Seller GET /api/blocks lists Buyer
      const blocksList: any = await (
        await fetch(`${baseUrl}/api/blocks`, { headers: { Authorization: `Bearer ${sellerToken}` } })
      ).json();
      assert.ok(blocksList.blocks.some((b: any) => b.blockedUserId === buyerUserId));

      // Seller unblocks Buyer -> profile access restored (200)
      const unblkRes = await fetch(`${baseUrl}/api/blocks/${buyerUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(unblkRes.status, 200);

      const profRestored = await fetch(`${baseUrl}/api/profiles/${sellerProfileSlug}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(profRestored.status, 200);
    });

    console.log(`\n=== SOCIAL, CHAT & FILES TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Social/Chat/Files suite crashed:', err);
  process.exit(1);
});

import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import assert from 'assert';

const apiEntryPath = path.resolve(process.cwd(), 'api', 'index.js');

if (!fs.existsSync(apiEntryPath)) {
  console.error(`[smoke-test-api] FAIL: Built API entry missing at ${apiEntryPath}`);
  process.exit(1);
}

// Verify built file contains zero references to frontend src/ or browser storage helpers
const builtCode = fs.readFileSync(apiEntryPath, 'utf8');
if (
  builtCode.includes('src/utils/') ||
  builtCode.includes('safeStorageGet') ||
  builtCode.includes('localStorage.')
) {
  console.error('[smoke-test-api] FAIL: Built API bundle references frontend src/ or browser storage.');
  process.exit(1);
}

// Ensure APP_SECRET is available for in-process module boot without logging its value
if (!process.env.APP_SECRET) {
  process.env.APP_SECRET = crypto.randomBytes(32).toString('hex');
}

// If DATABASE_URL is unavailable during build (e.g. local or isolated CI build), run against pg-mem
const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED
);

if (!hasDatabaseUrl) {
  delete process.env.VERCEL;
  process.env.NODE_ENV = 'test';
}

console.log('[smoke-test-api] Importing built ESM API entry in plain Node:', apiEntryPath);

let mod;
try {
  mod = await import(new URL(`file://${apiEntryPath}`).href);
} catch (err) {
  console.error('[smoke-test-api] FAIL: Failed to import built API entry:', err);
  process.exit(1);
}

try {
  assert.strictEqual(typeof mod.default, 'function', 'Default export (Vercel handler) must be a function');
  assert.strictEqual(typeof mod.app, 'function', 'Named export `app` must be an Express app function');
  assert.strictEqual(mod.config?.api?.bodyParser, false, 'config.api.bodyParser must remain false for webhooks');
} catch (err) {
  console.error('[smoke-test-api] FAIL: Invalid API module exports:', err);
  process.exit(1);
}

const server = http.createServer(mod.default);

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind ephemeral smoke test port');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthText = await healthRes.text();
  console.log(`[smoke-test-api] GET /api/health -> HTTP ${healthRes.status}`);
  console.log(`[smoke-test-api] Body: ${healthText}`);

  assert.strictEqual(healthRes.status, 200, `/api/health must return 200 (got ${healthRes.status})`);
  const healthJson = JSON.parse(healthText);
  assert.strictEqual(healthJson.status, 'OK', '/api/health payload.status must be OK');
  assert.strictEqual(healthJson.databaseConnected, true, '/api/health payload.databaseConnected must be true');

  const versionRes = await fetch(`${baseUrl}/api/version`);
  const versionText = await versionRes.text();
  console.log(`[smoke-test-api] GET /api/version -> HTTP ${versionRes.status} ${versionText}`);
  assert.strictEqual(versionRes.status, 200, `/api/version must return 200 (got ${versionRes.status})`);

  console.log('[smoke-test-api] PASS: Built API entry loaded and passed in-process smoke checks.');
} catch (err) {
  console.error('[smoke-test-api] FAIL: In-process /api/health call failed:', err);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
  process.exit(process.exitCode ?? 0);
}

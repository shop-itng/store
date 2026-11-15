// Preload test-only APP_SECRET before importing backend modules in verification/test scripts.
// Production servers (api/index.ts & server.ts) never import this file and fail closed without APP_SECRET.
if (!process.env.APP_SECRET || !/^[0-9a-fA-F]{64,}$/.test(process.env.APP_SECRET.trim())) {
  process.env.APP_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

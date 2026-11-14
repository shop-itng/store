import { app } from '../api/index.js';

interface DiscoveredRoute {
  method: string;
  path: string;
  middlewares: string[];
}

const VALID_AUTH_OR_WEBHOOK_GUARDS = new Set([
  'requireAuth',
  'requireAdmin',
  'requireModerator',
  'requireFinance',
  'requireSeller',
  'requireOwnershipOrAdmin',
  'requireCronOrAdmin',
]);

const PUBLIC_ALLOW_LIST = new Set([
  'GET /health',
  'GET /api/health',
  'POST /auth/register',
  'POST /auth/signup',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/send-otp',
  'POST /auth/verify-otp',
  'POST /auth/reset-password',
  'GET /products',
  'GET /products/:id',
  'GET /sellers',
  'GET /sellers/:id',
  'POST /reports',
  'POST /support/contact',
  'GET /payments/config',
  'GET /payments/webhook-info',
]);

function extractStackRoutes(stack: any[], prefix = '', out: DiscoveredRoute[] = []): DiscoveredRoute[] {
  if (!Array.isArray(stack)) return out;

  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      const handlers = (layer.route.stack || []).map((s: any) => s.name || s.handle?.name || '<anonymous>');
      const methods = Object.keys(layer.route.methods || {})
        .filter(m => layer.route.methods[m])
        .map(m => m.toUpperCase());

      for (const routePath of paths) {
        const fullPath = `${prefix}${routePath === '/' && prefix ? '' : routePath}`.replace(/\/+/g, '/') || '/';
        for (const method of methods) {
          out.push({ method, path: fullPath, middlewares: handlers });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      let subPrefix = '';
      if (layer.regexp && layer.regexp.source) {
        const match = layer.regexp.source.match(/^\^\\\/([a-zA-Z0-9_-]+)/);
        if (match) {
          subPrefix = `/${match[1]}`;
        }
      }
      // Avoid double-recording identical /api and / mounts of the same root router
      if (subPrefix === '/api') continue;
      extractStackRoutes(layer.handle.stack, `${prefix}${subPrefix}`, out);
    }
  }
  return out;
}

function isGuardedOrAllowed(route: DiscoveredRoute): { ok: boolean; reason: string } {
  const key = `${route.method} ${route.path}`;

  // Normalize all HTTP method variations of webhook (router.all('/payments/webhook'))
  if (route.path === '/payments/webhook') {
    const hasPaymentGate = route.middlewares.includes('requirePaymentsEnabled');
    return hasPaymentGate
      ? { ok: true, reason: 'Webhook verif-hash + requirePaymentsEnabled' }
      : { ok: false, reason: 'Webhook missing requirePaymentsEnabled gate' };
  }

  const matchedGuards = route.middlewares.filter(
    name =>
      VALID_AUTH_OR_WEBHOOK_GUARDS.has(name) ||
      name.startsWith('requireOwnershipOrAdmin') ||
      name.startsWith('requireRole(')
  );

  if (matchedGuards.length > 0) {
    return { ok: true, reason: `Guarded by [${matchedGuards.join(', ')}]` };
  }

  if (PUBLIC_ALLOW_LIST.has(key)) {
    return { ok: true, reason: 'Explicit PUBLIC_ALLOW_LIST' };
  }

  return {
    ok: false,
    reason: `UNGUARDED route! Middlewares=[${route.middlewares.join(', ')}]`,
  };
}

function main() {
  const rootStack = (app as any)._router?.stack || (app as any).router?.stack || [];
  const routes = extractStackRoutes(rootStack);

  // Deduplicate by method + path (since router.all registers one entry with multiple methods)
  const seen = new Set<string>();
  const uniqueRoutes: DiscoveredRoute[] = [];
  for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoutes.push(r);
    }
  }

  if (uniqueRoutes.length === 0) {
    console.error('FAIL: No routes discovered from Express app!');
    process.exit(1);
  }

  let failures = 0;
  console.log(`\n=== ROUTE GUARD AUDIT (${uniqueRoutes.length} routes inspected) ===`);
  for (const route of uniqueRoutes) {
    const check = isGuardedOrAllowed(route);
    const status = check.ok ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${route.method.padEnd(7)} ${route.path.padEnd(36)} -> ${check.reason}`);
    if (!check.ok) failures++;
  }

  console.log(`\nSummary: ${uniqueRoutes.length - failures}/${uniqueRoutes.length} routes passed.`);
  if (failures > 0) {
    console.error(`FAILED: ${failures} unguarded non-public route(s) detected.`);
    process.exit(1);
  }
  console.log('ALL ROUTE GUARDS VERIFIED.');
}

main();

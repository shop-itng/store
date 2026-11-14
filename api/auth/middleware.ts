import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getSession, UserSession, SESSION_COOKIE_NAME, logAuditEvent } from './sessionStore.js';

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
  sessionToken?: string;
  rawBody?: Buffer;
}

/**
 * Extracts session token ONLY from httpOnly cookie, Authorization Bearer header, or x-session-token.
 * x-user-id fallback has been permanently removed.
 */
export function extractToken(req: Request): string | null {
  // 1. Signed or plain httpOnly cookie
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return String(req.cookies[SESSION_COOKIE_NAME]).trim();
  }

  // 2. Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 3. Custom session header
  const customHeader = req.headers['x-session-token'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader.trim();
  }

  return null;
}

/**
 * Middleware: Requires a valid authenticated session.
 * Rejects with 401 Unauthorized if missing, invalid, or expired.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      status: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in to continue.',
    });
  }

  try {
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        status: false,
        error: 'SESSION_EXPIRED',
        message: 'Your session has expired or is invalid. Please sign in again.',
      });
    }

    req.user = session;
    req.sessionToken = token;

    // Enforce password change before accessing protected features
    if (
      session.mustChangePassword &&
      !req.path.includes('/auth/change-password') &&
      !req.path.includes('/auth/logout') &&
      !req.path.includes('/auth/me')
    ) {
      return res.status(403).json({
        status: false,
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your initial password before performing this action.',
      });
    }

    return next();
  } catch (err: any) {
    console.error('[Auth Middleware Error]:', err.message);
    return res.status(500).json({
      status: false,
      error: 'AUTH_ERROR',
      message: 'An error occurred while verifying your session.',
    });
  }
}

/**
 * Optional Auth: Attaches session if present, but allows unauthenticated access.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<any> {
  const token = extractToken(req);
  if (token) {
    try {
      const session = await getSession(token);
      if (session) {
        req.user = session;
        req.sessionToken = token;
      }
    } catch {}
  }
  return next();
}

/**
 * Middleware: Requires specific role(s).
 * Rejects with 403 Forbidden if the user's role does not match.
 */
export function requireRole(...allowedRoles: Array<'admin' | 'seller' | 'buyer'>) {
  const fn = async function requireRoleMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
    if (!req.user) {
      // Run requireAuth first
      const authResult = await new Promise<boolean>(resolve => {
        requireAuth(req, res, () => resolve(true));
      });
      if (!authResult || !req.user) return;
    }

    if (allowedRoles.includes(req.user.role) || req.user.role === 'admin') {
      return next();
    }

    logAuditEvent({
      action: 'ACCESS_DENIED_ROLE_MISMATCH',
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: 'route', id: req.originalUrl || req.url },
      details: { requiredRoles: allowedRoles, actualRole: req.user.role },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(403).json({
      status: false,
      error: 'FORBIDDEN',
      message: `Access denied. Requires one of [${allowedRoles.join(', ')}] role.`,
    });
  };
  Object.defineProperty(fn, 'name', { value: `requireRole(${allowedRoles.join(',')})` });
  return fn;
}

/**
 * Middleware: Strictly requires Admin role.
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware: Requires Admin with Moderator subrole (or superadmin).
 */
export async function requireModerator(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  if (!req.user) {
    const authResult = await new Promise<boolean>(resolve => {
      requireAuth(req, res, () => resolve(true));
    });
    if (!authResult || !req.user) return;
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: false,
      error: 'FORBIDDEN',
      message: 'Access denied. Administrator privileges required.',
    });
  }

  // Explicit Moderator or Superadmin sub-role required
  const sub = req.user.subRole;
  if (sub === 'moderator' || sub === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    status: false,
    error: 'FORBIDDEN',
    message: 'Access denied. Moderator sub-role required.',
  });
}

/**
 * Middleware: Requires Admin with Finance subrole (or superadmin).
 */
export async function requireFinance(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  if (!req.user) {
    const authResult = await new Promise<boolean>(resolve => {
      requireAuth(req, res, () => resolve(true));
    });
    if (!authResult || !req.user) return;
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      status: false,
      error: 'FORBIDDEN',
      message: 'Access denied. Administrator privileges required.',
    });
  }

  // Explicit Finance or Superadmin sub-role required
  const sub = req.user.subRole;
  if (sub === 'finance' || sub === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    status: false,
    error: 'FORBIDDEN',
    message: 'Access denied. Finance sub-role required.',
  });
}

/**
 * Middleware: Requires valid CRON_SECRET Bearer token (for Vercel Crons) OR Admin session.
 */
export async function requireCronOrAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = (req.headers.authorization || '').trim();
  if (cronSecret && authHeader.toLowerCase().startsWith('bearer ')) {
    const provided = authHeader.substring(7).trim();
    const expectedDigest = crypto.createHash('sha256').update(cronSecret).digest();
    const providedDigest = crypto.createHash('sha256').update(provided).digest();
    if (crypto.timingSafeEqual(expectedDigest, providedDigest)) {
      return next();
    }
  }
  return requireAdmin(req, res, next);
}

/**
 * Middleware: Requires Seller or Admin role.
 */
export const requireSeller = requireRole('seller', 'admin');

/**
 * Helper to ensure a user only accesses their own resources, unless they are an admin.
 */
export function requireOwnershipOrAdmin(
  getTargetUserId: (req: AuthenticatedRequest) => string | undefined
) {
  return async function requireOwnershipOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
    if (!req.user) {
      const authResult = await new Promise<boolean>(resolve => {
        requireAuth(req, res, () => resolve(true));
      });
      if (!authResult || !req.user) return;
    }

    const targetUserId = getTargetUserId(req);
    if (!targetUserId) {
      return res.status(400).json({ status: false, message: 'Invalid target identifier' });
    }

    if (req.user.role === 'admin' || req.user.userId === targetUserId) {
      return next();
    }

    logAuditEvent({
      action: 'OWNERSHIP_VIOLATION_BLOCKED',
      actor: { id: req.user.userId, email: req.user.email, role: req.user.role },
      target: { type: 'user_resource', id: targetUserId },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(403).json({
      status: false,
      error: 'FORBIDDEN',
      message: 'Access denied. You may only view or modify your own records.',
    });
  };
}

/**
 * Safety switch middleware: returns HTTP 503 when PAYMENTS_ENABLED is not 'true'.
 */
export function requirePaymentsEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): any {
  if (process.env.PAYMENTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYMENTS_DISABLED',
      message: 'Online payments are coming soon. Arrange directly with the seller',
    });
  }
  return next();
}

/**
 * Safety switch middleware: returns HTTP 503 when PAYOUTS_ENABLED is not 'true'.
 */
export function requirePayoutsEnabled(
  _req: Request,
  res: Response,
  next: NextFunction
): any {
  if (process.env.PAYOUTS_ENABLED !== 'true') {
    return res.status(503).json({
      status: false,
      error: 'PAYOUTS_DISABLED',
      message: 'Seller withdrawals are currently paused by safety switch. No balance was debited.',
    });
  }
  return next();
}


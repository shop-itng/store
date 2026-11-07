import type { Request, Response, NextFunction } from 'express';
import { getSession, UserSession, SESSION_COOKIE_NAME, logAuditEvent } from './sessionStore.js';

export interface AuthenticatedRequest extends Request {
  user?: UserSession;
  sessionToken?: string;
  rawBody?: Buffer;
}

/**
 * Extracts session token from httpOnly cookie, Authorization header, or x-session-token.
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
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
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

  // Moderator or Superadmin allowed
  const sub = req.user.subRole;
  if (!sub || sub === 'moderator' || sub === 'superadmin') {
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

  // Finance or Superadmin allowed
  const sub = req.user.subRole;
  if (!sub || sub === 'finance' || sub === 'superadmin') {
    return next();
  }

  return res.status(403).json({
    status: false,
    error: 'FORBIDDEN',
    message: 'Access denied. Finance sub-role required.',
  });
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
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
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

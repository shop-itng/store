import crypto from 'crypto';
import { query as dbQuery } from '../db/postgres.js';

export interface UserSession {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'seller' | 'buyer';
  subRole?: 'superadmin' | 'moderator' | 'finance';
  sellerId?: string;
  isVerifiedSeller?: boolean;
  mustChangePassword?: boolean;
  createdAt: number;
  expiresAt: number;
}

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

// In-memory cache for development mode when Upstash credentials are not set
const memorySessions = new Map<string, UserSession>();
const memoryLockouts = new Map<string, { count: number; lockedUntil: number }>();

async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  const encodedArgs = args.map(a =>
    encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))
  );
  const url = `${KV_URL.replace(/\/$/, '')}/${command}/${encodedArgs.join('/')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`KV command failed with status ${res.status}`);
  }
  const json: any = await res.json();
  return json.result;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_COOKIE_NAME = 'shopit_session';

/**
 * Creates a cryptographically random session token and persists the session to Redis.
 */
export async function createSession(data: {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'seller' | 'buyer';
  subRole?: 'superadmin' | 'moderator' | 'finance';
  sellerId?: string;
  isVerifiedSeller?: boolean;
  mustChangePassword?: boolean;
}): Promise<{ session: UserSession; token: string }> {
  const token = 'shopit_s_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const session: UserSession = {
    sessionId: token,
    userId: data.userId,
    email: data.email.trim().toLowerCase(),
    name: data.name,
    role: data.role,
    subRole: data.subRole,
    sellerId: data.sellerId,
    isVerifiedSeller: data.isVerifiedSeller ?? false,
    mustChangePassword: Boolean(data.mustChangePassword),
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('setex', `session:${token}`, SESSION_TTL_SECONDS, JSON.stringify(session));
    } catch (err: any) {
      console.warn('[Session Store] Redis setex warning, falling back to memory session:', err.message);
      memorySessions.set(token, session);
    }
  } else {
    memorySessions.set(token, session);
  }

  return { session, token };
}

/**
 * Retrieves a session by token, validating expiration.
 */
export async function getSession(token: string): Promise<UserSession | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();

  let session: UserSession | null = null;

  if (KV_URL && KV_TOKEN) {
    try {
      const raw = await runKvCommand('get', `session:${cleanToken}`);
      if (raw) {
        session = typeof raw === 'string' ? JSON.parse(raw) : (raw as UserSession);
      }
    } catch (err: any) {
      console.warn('[Session Store] Redis get error:', err.message);
    }
  }

  if (!session && memorySessions.has(cleanToken)) {
    session = memorySessions.get(cleanToken) || null;
  }

  if (!session) return null;

  // Verify expiration
  if (Date.now() > session.expiresAt) {
    await destroySession(cleanToken);
    return null;
  }

  return session;
}

/**
 * Destroys a session in Redis and memory.
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const cleanToken = token.trim();

  memorySessions.delete(cleanToken);

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('del', `session:${cleanToken}`);
    } catch (err: any) {
      console.warn('[Session Store] Redis del error:', err.message);
    }
  }
}

/**
 * Rotates a session: destroys old token, generates a new token with fresh expiration.
 */
export async function rotateSession(
  oldToken: string,
  updatedData?: Partial<UserSession>
): Promise<{ session: UserSession; token: string } | null> {
  const existing = await getSession(oldToken);
  if (!existing) return null;

  await destroySession(oldToken);

  return createSession({
    userId: updatedData?.userId || existing.userId,
    email: updatedData?.email || existing.email,
    name: updatedData?.name || existing.name,
    role: updatedData?.role || existing.role,
    subRole: updatedData?.subRole || existing.subRole,
    sellerId: updatedData?.sellerId || existing.sellerId,
    isVerifiedSeller: updatedData?.isVerifiedSeller ?? existing.isVerifiedSeller,
    mustChangePassword: updatedData?.mustChangePassword ?? existing.mustChangePassword,
  });
}

/**
 * Account Lockout Security: tracks failed login attempts per email in Redis.
 * 5 failures within 15 minutes locks the account for 15 minutes.
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function recordLoginFailure(email: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
  lockoutRemainingSeconds?: number;
}> {
  const normEmail = email.trim().toLowerCase();
  const key = `auth_fails:${normEmail}`;
  const now = Date.now();

  let count = 1;

  if (KV_URL && KV_TOKEN) {
    try {
      const res = await runKvCommand('incr', key);
      count = Number(res) || 1;
      if (count === 1) {
        await runKvCommand('expire', key, 900); // 15 mins
      }
    } catch {
      const mem = memoryLockouts.get(normEmail) || { count: 0, lockedUntil: 0 };
      count = mem.count + 1;
      memoryLockouts.set(normEmail, { count, lockedUntil: count >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0 });
    }
  } else {
    const mem = memoryLockouts.get(normEmail) || { count: 0, lockedUntil: 0 };
    count = mem.count + 1;
    memoryLockouts.set(normEmail, { count, lockedUntil: count >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0 });
  }

  if (count >= MAX_FAILED_ATTEMPTS) {
    // Lock account
    if (KV_URL && KV_TOKEN) {
      try {
        await runKvCommand('setex', `auth_locked:${normEmail}`, 900, String(now + LOCKOUT_DURATION_MS));
      } catch {}
    }
    return {
      locked: true,
      remainingAttempts: 0,
      lockoutRemainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - count),
  };
}

export async function isAccountLocked(email: string): Promise<{
  locked: boolean;
  remainingSeconds: number;
}> {
  const normEmail = email.trim().toLowerCase();
  const now = Date.now();

  if (KV_URL && KV_TOKEN) {
    try {
      const lockedUntilStr = await runKvCommand('get', `auth_locked:${normEmail}`);
      if (lockedUntilStr) {
        const lockedUntil = Number(lockedUntilStr);
        if (lockedUntil > now) {
          return { locked: true, remainingSeconds: Math.ceil((lockedUntil - now) / 1000) };
        }
      }
    } catch {}
  }

  const mem = memoryLockouts.get(normEmail);
  if (mem && mem.lockedUntil > now) {
    return { locked: true, remainingSeconds: Math.ceil((mem.lockedUntil - now) / 1000) };
  }

  return { locked: false, remainingSeconds: 0 };
}

export async function clearLoginFailures(email: string): Promise<void> {
  const normEmail = email.trim().toLowerCase();
  memoryLockouts.delete(normEmail);

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('del', `auth_fails:${normEmail}`);
      await runKvCommand('del', `auth_locked:${normEmail}`);
    } catch {}
  }
}

/**
 * Immutable Audit Logging to PostgreSQL shopit_audit_logs table.
 */
export async function logAuditEvent(params: {
  action: string;
  actor: { id?: string; email?: string; role?: string };
  target: { type?: string; id?: string };
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  const auditId = 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  try {
    await dbQuery(
      `INSERT INTO shopit_audit_logs (
        id, action, actor_id, actor_email, actor_role, target_type, target_id, details, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        auditId,
        params.action,
        params.actor.id || null,
        params.actor.email || null,
        params.actor.role || null,
        params.target.type || null,
        params.target.id || null,
        JSON.stringify(params.details || {}),
        params.ip || null,
        params.userAgent || null,
      ]
    );
    console.log(
      `[SECURITY AUDIT] ${params.action} | Actor: ${params.actor.email || 'anon'} (${params.actor.role || 'none'}) | Target: ${params.target.type}:${params.target.id}`
    );
  } catch (err: any) {
    console.warn('[Audit Log Warning] Failed to insert audit log row:', err.message);
  }
}

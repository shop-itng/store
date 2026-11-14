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
  tokenVersion: number;
  createdAt: number;
  expiresAt: number;
}

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const commandPayload = [
      command.toUpperCase(),
      ...args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
    ];
    const url = KV_URL.replace(/\/$/, '');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }
    const json: any = await res.json();
    return json.result;
  } catch {
    return null;
  }
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const SESSION_COOKIE_NAME = 'shopit_session';

/**
 * Creates a cryptographically random session token and persists the session to PostgreSQL (and Redis if configured).
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
  tokenVersion?: number;
}): Promise<{ session: UserSession; token: string }> {
  const token = 'shopit_s_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;

  let resolvedTokenVersion = Number(data.tokenVersion || 1);
  if (!data.tokenVersion) {
    try {
      const uRes = await dbQuery('SELECT token_version FROM shopit_users WHERE id = $1', [data.userId]);
      if (uRes.rows[0]?.token_version) {
        resolvedTokenVersion = Number(uRes.rows[0].token_version);
      }
    } catch {}
  }

  const session: UserSession = {
    sessionId: token,
    userId: data.userId,
    email: data.email.trim().toLowerCase(),
    name: data.name,
    role: data.role,
    subRole: data.role === 'admin' && data.subRole ? data.subRole : undefined,
    sellerId: data.sellerId,
    isVerifiedSeller: data.isVerifiedSeller ?? false,
    mustChangePassword: Boolean(data.mustChangePassword),
    tokenVersion: resolvedTokenVersion,
    createdAt: now,
    expiresAt,
  };

  await dbQuery(
    `INSERT INTO shopit_sessions (token, user_id, data, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET data = $3, expires_at = $4`,
    [token, data.userId, JSON.stringify(session), expiresAt]
  );

  if (KV_URL && KV_TOKEN) {
    await runKvCommand('setex', `session:${token}`, SESSION_TTL_SECONDS, JSON.stringify(session));
  }

  return { session, token };
}

/**
 * Retrieves a session by token from Redis or PostgreSQL, validating expiration, user ban status, and token_version.
 * Direct usr_direct_ / header bypasses are permanently removed.
 */
export async function getSession(token: string): Promise<UserSession | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();

  if (!cleanToken.startsWith('shopit_s_')) {
    return null;
  }

  let session: UserSession | null = null;

  if (KV_URL && KV_TOKEN) {
    try {
      const raw = await runKvCommand('get', `session:${cleanToken}`);
      if (raw) {
        session = typeof raw === 'string' ? JSON.parse(raw) : (raw as UserSession);
      }
    } catch {}
  }

  if (!session) {
    try {
      const pgRes = await dbQuery(
        'SELECT data, expires_at FROM shopit_sessions WHERE token = $1',
        [cleanToken]
      );
      if (pgRes.rows.length > 0) {
        const row = pgRes.rows[0];
        session = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as UserSession);
      }
    } catch (err: any) {
      console.warn('[Session Store] PostgreSQL lookup error:', err.message);
      return null;
    }
  }

  if (!session) return null;

  // Verify expiration
  if (Date.now() > Number(session.expiresAt)) {
    await destroySession(cleanToken);
    return null;
  }

  // Always validate user active state and token_version against PostgreSQL
  try {
    const userRes = await dbQuery(
      `SELECT u.id, u.email, u.name, u.role, u.sub_role, u.is_banned, u.token_version, u.must_change_password,
              s.id AS seller_id, s.is_verified_seller AS s_verified
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON u.id = s.user_id
       WHERE u.id = $1`,
      [session.userId]
    );

    if (userRes.rows.length === 0) {
      await destroySession(cleanToken);
      return null;
    }

    const u = userRes.rows[0];
    if (Boolean(u.is_banned)) {
      await destroySession(cleanToken);
      return null;
    }

    const dbTokenVersion = Number(u.token_version || 1);
    const sessTokenVersion = Number(session.tokenVersion || 1);
    if (dbTokenVersion !== sessTokenVersion) {
      await destroySession(cleanToken);
      return null;
    }

    // Refresh authoritative role & verification state from DB (never default subRole to superadmin)
    session.role = u.role as UserSession['role'];
    session.subRole = u.role === 'admin' && u.sub_role ? u.sub_role : undefined;
    session.sellerId = u.seller_id || session.sellerId;
    session.isVerifiedSeller = Boolean(u.s_verified);
    session.mustChangePassword = Boolean(u.must_change_password);
    session.tokenVersion = dbTokenVersion;
  } catch (err: any) {
    console.warn('[Session Store] User state check error:', err.message);
    return null;
  }

  return session;
}

/**
 * Destroys a session in PostgreSQL and Redis.
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const cleanToken = token.trim();

  try {
    await dbQuery('DELETE FROM shopit_sessions WHERE token = $1', [cleanToken]);
  } catch {}

  if (KV_URL && KV_TOKEN) {
    await runKvCommand('del', `session:${cleanToken}`);
  }
}

/**
 * Revokes ALL sessions for a given user across all serverless instances (password reset/change, ban, etc.).
 */
export async function revokeUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await dbQuery(
      'UPDATE shopit_users SET token_version = COALESCE(token_version, 1) + 1, updated_at = NOW() WHERE id = $1',
      [userId]
    );
    const sessRows = await dbQuery('SELECT token FROM shopit_sessions WHERE user_id = $1', [userId]);
    await dbQuery('DELETE FROM shopit_sessions WHERE user_id = $1', [userId]);
    if (KV_URL && KV_TOKEN && sessRows.rows.length > 0) {
      for (const r of sessRows.rows) {
        await runKvCommand('del', `session:${r.token}`);
      }
    }
  } catch (err: any) {
    console.warn('[Session Revocation Warning]:', err.message);
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
    subRole: updatedData?.subRole !== undefined ? updatedData.subRole : existing.subRole,
    sellerId: updatedData?.sellerId || existing.sellerId,
    isVerifiedSeller: updatedData?.isVerifiedSeller ?? existing.isVerifiedSeller,
    mustChangePassword: updatedData?.mustChangePassword ?? existing.mustChangePassword,
    tokenVersion: updatedData?.tokenVersion ?? existing.tokenVersion,
  });
}

/**
 * Account Lockout Security: tracks failed login attempts per email in Redis + PostgreSQL.
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
  const rlKey = `auth_fails:${normEmail}`;
  const now = Date.now();

  let count = 1;

  if (KV_URL && KV_TOKEN) {
    const res = await runKvCommand('incr', rlKey);
    if (res !== null) {
      count = Number(res) || 1;
      if (count === 1) {
        await runKvCommand('expire', rlKey, 900);
      }
      if (count >= MAX_FAILED_ATTEMPTS) {
        await runKvCommand('setex', `auth_locked:${normEmail}`, 900, String(now + LOCKOUT_DURATION_MS));
      }
    }
  }

  // Persist to PostgreSQL (shared across instances even without Redis)
  try {
    const existing = await dbQuery('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [rlKey]);
    const recent: number[] = (existing.rows[0]?.timestamps || []).filter(
      (t: number) => now - t < LOCKOUT_DURATION_MS
    );
    recent.push(now);
    await dbQuery(
      'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
      [rlKey, JSON.stringify(recent)]
    );
    count = Math.max(count, recent.length);

    if (count >= MAX_FAILED_ATTEMPTS) {
      await dbQuery(
        `UPDATE shopit_users
         SET failed_login_attempts = $1, locked_until = $2, updated_at = NOW()
         WHERE LOWER(email) = LOWER($3)`,
        [count, new Date(now + LOCKOUT_DURATION_MS).toISOString(), normEmail]
      );
    } else {
      await dbQuery(
        `UPDATE shopit_users
         SET failed_login_attempts = $1, updated_at = NOW()
         WHERE LOWER(email) = LOWER($2)`,
        [count, normEmail]
      );
    }
  } catch {}

  if (count >= MAX_FAILED_ATTEMPTS) {
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
  const rlKey = `auth_fails:${normEmail}`;
  const now = Date.now();

  if (KV_URL && KV_TOKEN) {
    const lockedUntilStr = await runKvCommand('get', `auth_locked:${normEmail}`);
    if (lockedUntilStr) {
      const lockedUntil = Number(lockedUntilStr);
      if (lockedUntil > now) {
        return { locked: true, remainingSeconds: Math.ceil((lockedUntil - now) / 1000) };
      }
    }
  }

  try {
    const uRes = await dbQuery(
      'SELECT locked_until FROM shopit_users WHERE LOWER(email) = LOWER($1)',
      [normEmail]
    );
    const lockedUntilPg = uRes.rows[0]?.locked_until;
    if (lockedUntilPg) {
      const ms = new Date(lockedUntilPg).getTime();
      if (ms > now) {
        return { locked: true, remainingSeconds: Math.ceil((ms - now) / 1000) };
      }
    }

    const rlRes = await dbQuery('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [rlKey]);
    const recent: number[] = (rlRes.rows[0]?.timestamps || []).filter(
      (t: number) => now - t < LOCKOUT_DURATION_MS
    );
    if (recent.length >= MAX_FAILED_ATTEMPTS) {
      const oldest = recent[0];
      const rem = Math.ceil((oldest + LOCKOUT_DURATION_MS - now) / 1000);
      if (rem > 0) return { locked: true, remainingSeconds: rem };
    }
  } catch {}

  return { locked: false, remainingSeconds: 0 };
}

export async function clearLoginFailures(email: string): Promise<void> {
  const normEmail = email.trim().toLowerCase();
  const rlKey = `auth_fails:${normEmail}`;

  try {
    await dbQuery('DELETE FROM shopit_rate_limits WHERE key = $1', [rlKey]);
    await dbQuery(
      'UPDATE shopit_users SET failed_login_attempts = 0, locked_until = NULL WHERE LOWER(email) = LOWER($1)',
      [normEmail]
    );
  } catch {}

  if (KV_URL && KV_TOKEN) {
    await runKvCommand('del', rlKey);
    await runKvCommand('del', `auth_locked:${normEmail}`);
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

import { query } from "../config/db";
import { generateSessionToken, hashSessionToken } from "../utils/session-token";
import { env } from "../config/env";

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_seen_at: Date;
}

function expiryDate(): Date {
  return new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
}

/** Creates a session row and returns the raw token — the only time it's ever visible. */
export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null }
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  await query(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, meta?.userAgent ?? null, meta?.ip ?? null, expiryDate()]
  );
  return token;
}

export async function findSessionByToken(token: string): Promise<SessionRow | null> {
  const tokenHash = hashSessionToken(token);
  const result = await query<SessionRow>(
    `SELECT id, user_id, token_hash, expires_at, created_at, last_seen_at
     FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function touchSession(id: string): Promise<void> {
  await query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [id]);
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

/** Useful for a future "log out everywhere" feature or forced password-reset flows. */
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
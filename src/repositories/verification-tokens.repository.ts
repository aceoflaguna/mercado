import { query } from "../config/db";
import { generateSessionToken as generateToken, hashSessionToken as hashToken } from "../utils/session-token";

export type TokenPurpose = "email_verification" | "password_reset";

// Password reset gets a shorter window — it grants account takeover, not just a confirmation.
const TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

export interface VerificationTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  purpose: TokenPurpose;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export async function createVerificationToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]);
  await query(
    `INSERT INTO verification_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, purpose, expiresAt]
  );
  return token;
}

/** Atomically marks the token used and returns it — a token can only ever be consumed once. */
export async function consumeVerificationToken(
  token: string,
  purpose: TokenPurpose
): Promise<VerificationTokenRow | null> {
  const tokenHash = hashToken(token);
  const result = await query<VerificationTokenRow>(
    `UPDATE verification_tokens SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING id, user_id, token_hash, purpose, expires_at, used_at, created_at`,
    [tokenHash, purpose]
  );
  return result.rows[0] ?? null;
}

/** Invalidate any outstanding tokens before issuing a fresh one, so an old email link can't still work. */
export async function invalidateTokensForUser(userId: string, purpose: TokenPurpose): Promise<void> {
  await query(
    `UPDATE verification_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose]
  );
}
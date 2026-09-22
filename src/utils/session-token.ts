import crypto from "crypto";

/** Opaque, high-entropy session token — not a JWT, carries no data itself. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Never store the raw token — only its hash, so a DB leak doesn't leak live sessions. */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
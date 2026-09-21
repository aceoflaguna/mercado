import * as argon2 from "argon2";
import { env } from "../config/env";

/**
 * Hash a plaintext password with Argon2id (argon2's default and the
 * currently recommended variant — resistant to both GPU-cracking and
 * side-channel attacks).
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: env.argon2.memoryCost,
    timeCost: env.argon2.timeCost,
    parallelism: env.argon2.parallelism,
  });
}

/**
 * Verify a plaintext password against a stored Argon2 hash.
 * Returns false (rather than throwing) on malformed hashes so callers
 * can treat it as "invalid credentials" uniformly.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

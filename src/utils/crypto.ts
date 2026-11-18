import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Enterprise password hashing using Node.js native scrypt and environment-level salt.
 * Native, timing-safe, zero external dependency.
 */
export function hashPassword(password: string): string {
  return crypto.scryptSync(password, env.AUTH_SALT, 64).toString('hex');
}

/**
 * Verify a plain-text password against stored scrypt hash using environment salt.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const derivedKey = crypto.scryptSync(password, env.AUTH_SALT, 64);
    const storedKey = Buffer.from(hash, 'hex');

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSessionToken(userId: string): string {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString(36);
  return `pf_sess_${userId.substring(0, 8)}_${timestamp}_${randomPart}`;
}

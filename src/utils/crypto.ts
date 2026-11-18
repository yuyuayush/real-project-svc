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
 * Generate a cryptographically secure, signed random session token.
 * Encodes the userId and timestamp with an HMAC-SHA256 signature.
 * Prevents session amnesia across dev reloads while maintaining zero external JWT dependencies.
 */
export function generateSessionToken(userId: string): string {
  const randomPart = crypto.randomBytes(24).toString('hex');
  const timestamp = Date.now().toString(36);
  const payload = `${userId}:${timestamp}:${randomPart}`;
  const signature = crypto
    .createHmac('sha256', env.AUTH_SALT)
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return `pf_sess_${payload}_${signature}`;
}

/**
 * Verify cryptographic signature of a session token and extract userId.
 */
export function verifySessionTokenSignature(token: string): { userId: string } | null {
  if (!token || !token.startsWith('pf_sess_')) return null;
  const raw = token.slice('pf_sess_'.length);
  const lastUnderscore = raw.lastIndexOf('_');
  if (lastUnderscore === -1) return null;

  const payload = raw.slice(0, lastUnderscore);
  const signature = raw.slice(lastUnderscore + 1);

  const expectedSignature = crypto
    .createHmac('sha256', env.AUTH_SALT)
    .update(payload)
    .digest('hex')
    .slice(0, 32);

  if (signature.length !== expectedSignature.length) return null;

  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isMatch) return null;

    const [userId] = payload.split(':');
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}

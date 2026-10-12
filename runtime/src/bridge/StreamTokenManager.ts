import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

const TOKEN_LIFETIME_MS = 120_000; // 2 minutes

const HEADER_B64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'SSE' })).toString('base64url');

export interface IssuedToken {
  token: string;
  expiresAt: number;
}

/** Generate a short-lived HMAC-SHA256 signed SSE access token. */
export function generateStreamToken(apiKey: string): IssuedToken {
  const now = Date.now();
  const exp = now + TOKEN_LIFETIME_MS;
  const payload = Buffer.from(JSON.stringify({
    jti: randomUUID(),
    iat: now,
    exp,
    pur: 'sse',
  })).toString('base64url');
  const signInput = `${HEADER_B64}.${payload}`;
  const sig = createHmac('sha256', apiKey).update(signInput).digest('base64url');
  return { token: `${signInput}.${sig}`, expiresAt: exp };
}

/**
 * Validate a short-lived SSE token.
 * Returns true and marks the JTI as used on success.
 * usedJtis: Map<jti, expiry> — caller manages this store across requests.
 */
export function validateStreamToken(
  token: string,
  apiKey: string,
  usedJtis: Map<string, number>,
): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payloadB64, sigB64] = parts;

  // Constant-time signature check
  const signInput = `${header}.${payloadB64}`;
  const expectedSig = createHmac('sha256', apiKey).update(signInput).digest();
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return false;
  }
  if (expectedSig.length !== actualSig.length) return false;
  if (!timingSafeEqual(expectedSig, actualSig)) return false;

  // Decode payload
  let payload: { jti?: string; iat?: number; exp?: number; pur?: string };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }

  if (payload.pur !== 'sse') return false;
  if (!payload.exp || Date.now() > payload.exp) return false;
  if (!payload.jti) return false;
  if (usedJtis.has(payload.jti)) return false;

  usedJtis.set(payload.jti, payload.exp);
  return true;
}

/** Remove expired JTI entries from the replay-protection store. */
export function cleanupExpiredJtis(usedJtis: Map<string, number>): void {
  const cutoff = Date.now() - 10_000; // 10s grace beyond exp
  for (const [jti, exp] of usedJtis) {
    if (exp < cutoff) usedJtis.delete(jti);
  }
}

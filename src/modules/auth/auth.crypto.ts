import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type UserRole = 'MASTER' | 'ADMIN_DEV' | 'ADVOGADO';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  nome: string;
  role: UserRole;
  escritorioId: string | null;
  escritorioNome: string | null;
  numeroOab: string;
  ufOab: string;
  exp: number;
}

const DEFAULT_DEV_SECRET = 'ghfs-adv-saas-master-hmac-key-2026-local-only';

function getAuthSecret(customSecret?: string): string {
  return customSecret || process.env.AUTH_SECRET || DEFAULT_DEV_SECRET;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function signAuthToken(
  payload: Omit<AuthTokenPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 12,
  secret?: string
): string {
  const fullPayload: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', getAuthSecret(secret)).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyAuthToken(token: string, secret?: string): AuthTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = createHmac('sha256', getAuthSecret(secret)).update(signingInput).digest();
  const actualSig = Buffer.from(signatureB64, 'base64url');
  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

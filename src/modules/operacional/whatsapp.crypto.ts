import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface EncryptedValue {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
}

export function secretKeyFromHex(value: string | undefined, name: string): Buffer | undefined {
  if (!value) return undefined;
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${name} deve conter exatamente 64 caracteres hexadecimais.`);
  }
  return Buffer.from(value, 'hex');
}

export function encryptValue(value: Buffer | string, key: Buffer): EncryptedValue {
  if (key.length !== 32) throw new Error('A chave de dados deve ter 32 bytes.');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(typeof value === 'string' ? Buffer.from(value, 'utf8') : value),
    cipher.final()
  ]);

  return { ciphertext, nonce, tag: cipher.getAuthTag() };
}

export function decryptValue(value: EncryptedValue, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('A chave de dados deve ter 32 bytes.');
  const decipher = createDecipheriv('aes-256-gcm', key, value.nonce);
  decipher.setAuthTag(value.tag);
  return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]);
}

export function phoneHmac(phone: string, key: Buffer): { normalized: string; hash: string } {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('O telefone recebido não está em formato válido.');
  }
  const normalized = `+${digits}`;
  const hash = createHmac('sha256', key).update(normalized, 'utf8').digest('hex');
  return { normalized, hash };
}

export function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function verifyMetaSignature(body: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const received = Buffer.from(signature.slice('sha256='.length), 'hex');
  if (received.length !== 32) return false;
  const expected = createHmac('sha256', appSecret).update(body).digest();
  return timingSafeEqual(received, expected);
}
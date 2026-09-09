import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not configured');
  }
  return createHash('sha256').update(envKey).digest();
}

export interface EncryptedValue {
  cipher: string;
  tag: string;
  iv: string;
}

export function encryptValue(plaintext: string): EncryptedValue {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipher: encrypted.toString('hex'),
    tag: tag.toString('hex'),
    iv: iv.toString('hex'),
  };
}

export function decryptValue(value: EncryptedValue): string {
  const key = getKey();
  const iv = Buffer.from(value.iv, 'hex');
  const tag = Buffer.from(value.tag, 'hex');
  const encrypted = Buffer.from(value.cipher, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function generateSecurePassword(length = 24): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

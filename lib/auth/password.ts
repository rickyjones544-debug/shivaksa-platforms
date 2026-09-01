import { hash, compare } from 'bcryptjs';

// bcrypt cost factor - production-appropriate (10-12)
// Higher is more secure but slower. 12 is a good balance for production.
const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 * Never store or log the plaintext password.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(plainPassword, hashedPassword);
}

/**
 * Validate password strength.
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

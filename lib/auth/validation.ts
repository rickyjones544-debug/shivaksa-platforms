// Lightweight validation utilities (no external dependency required)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateLogin(data: { email: string; password: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.email || !EMAIL_REGEX.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  if (!data.password || data.password.length < 1) {
    errors.password = 'Password is required';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateRegistration(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!data.email || !EMAIL_REGEX.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  if (!data.password || data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateResetRequest(data: { email: string }): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.email || !EMAIL_REGEX.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateResetConfirm(data: {
  token: string;
  password: string;
  confirmPassword: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.token || data.token.length < 1) {
    errors.token = 'Token is required';
  }

  if (!data.password || data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

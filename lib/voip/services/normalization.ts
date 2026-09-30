import { DestinationType, type DestinationType as DestinationTypeType } from '@/lib/voip/constants';
import { findCountryByCode, detectMobilePrefix, MOBILE_NATIONAL_PREFIXES } from '@/lib/voip/countries';

export interface NormalizedDestination {
  /** Raw input exactly as received. */
  raw: string;
  /** E.164 formatted number with leading '+'. */
  e164: string;
  /** Digits only, no leading '+'. */
  digits: string;
  /** E.164 country calling code (without '+'). */
  countryCode: string;
  /** ISO-3166-1 alpha-2 country code, or null if unknown. */
  countryIso: string | null;
  /** National number portion (digits after country code). */
  nationalNumber: string;
  /** Detected destination type, if the platform can determine it. */
  destinationType?: DestinationTypeType;
}

const E164_MAX_DIGITS = 15;
const E164_MIN_DIGITS = 7;

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizationError';
  }
}

function stripFormatting(value: string): string {
  // Remove common formatting characters and whitespace.
  return value.replace(/[\s().\-]/g, '');
}

function detectDestinationType(
  countryCode: string,
  nationalNumber: string
): DestinationTypeType | undefined {
  if (!countryCode || !nationalNumber) return undefined;
  const isMobile = detectMobilePrefix(countryCode, nationalNumber);
  if (isMobile) return DestinationType.MOBILE;
  // If we have a known country with mobile prefixes and the number did not match,
  // treat it as fixed-line for routing purposes.
  if (MOBILE_NATIONAL_PREFIXES[countryCode]) return DestinationType.FIXED;
  return undefined;
}

/**
 * Normalize and validate an international destination.
 *
 * Rules:
 * - Accepts E.164 with leading '+', e.g. +306912345678.
 * - Rejects non-digit characters except a single leading '+'.
 * - Rejects obviously invalid lengths and non-E.164 inputs.
 * - Extracts country code and ISO from the built-in map.
 * - Returns destination type when known.
 */
export function normalizeDestination(raw: string): NormalizedDestination {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new NormalizationError('Destination is required');
  }

  if (!trimmed.startsWith('+')) {
    throw new NormalizationError('Destination must start with a leading + (E.164 format)');
  }

  const withoutPlus = trimmed.slice(1);
  const digits = stripFormatting(withoutPlus);

  if (!/^\d+$/.test(digits)) {
    throw new NormalizationError('Destination must contain only digits after the optional leading +');
  }

  if (digits.length < E164_MIN_DIGITS) {
    throw new NormalizationError(`Destination is too short (minimum ${E164_MIN_DIGITS} digits)`);
  }

  if (digits.length > E164_MAX_DIGITS) {
    throw new NormalizationError(`Destination is too long (maximum ${E164_MAX_DIGITS} digits)`);
  }

  const country = findCountryByCode(digits);
  if (!country) {
    throw new NormalizationError('Destination country code is not supported');
  }

  const nationalNumber = digits.slice(country.code.length);
  if (!nationalNumber) {
    throw new NormalizationError('Destination is missing a national number');
  }

  const destinationType = detectDestinationType(country.code, nationalNumber);

  return {
    raw: trimmed,
    e164: `+${digits}`,
    digits,
    countryCode: country.code,
    countryIso: country.iso,
    nationalNumber,
    destinationType,
  };
}

export function validateDestination(raw: string): boolean {
  try {
    normalizeDestination(raw);
    return true;
  } catch {
    return false;
  }
}

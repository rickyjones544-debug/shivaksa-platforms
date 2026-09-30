import { Prisma } from '@prisma/client';

// ============================================================================
// Rate Desk — provider rate row validation.
// Whitelist validation for rows entering a ProviderRateSheetVersion. Rates are
// commercial data: persisted via Prisma Decimal, never JS floats.
// ============================================================================

export type ProviderRateRouteTypeValue = 'FIXED' | 'MOBILE' | 'BOTH';

export const PROVIDER_RATE_ROUTE_TYPES: readonly ProviderRateRouteTypeValue[] = [
  'FIXED',
  'MOBILE',
  'BOTH',
];

export interface ProviderRateRowInput {
  destination?: unknown;
  countryIso?: unknown;
  prefix?: unknown;
  routeType?: unknown;
  rate?: unknown;
  currency?: unknown;
  firstIncrementSeconds?: unknown;
  incrementSeconds?: unknown;
  minimumDurationSeconds?: unknown;
  effectiveFrom?: unknown;
  effectiveTo?: unknown;
  notes?: unknown;
}

export interface ValidatedProviderRateRow {
  destination: string | null;
  countryIso: string | null;
  prefix: string;
  routeType: ProviderRateRouteTypeValue;
  rate: Prisma.Decimal;
  currency: string;
  firstIncrementSeconds: number;
  incrementSeconds: number;
  minimumDurationSeconds: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
}

export type RateRowValidationResult =
  | { ok: true; data: ValidatedProviderRateRow }
  | { ok: false; errors: string[] };

const MAX_PREFIX_LENGTH = 15; // E.164 ceiling
const MAX_DESTINATION_LEN = 200;
const MAX_NOTES_LEN = 2000;
// Decimal(14,8) — reject inputs with more than 8 fractional digits rather than
// silently rounding commercial rate data.
const MAX_RATE_DECIMALS = 8;

const PREFIX_RE = /^\d+$/;
const ISO_RE = /^[A-Z]{2}$/;
// ISO-4217 alpha-3 format. Format-validated, not hard-restricted to USD/EUR so
// additional currencies require no schema change.
const CURRENCY_RE = /^[A-Z]{3}$/;

export function validateProviderRateRow(
  raw: unknown,
  index: number
): RateRowValidationResult {
  const errors: string[] = [];
  const field = (name: string) => `rates[${index}].${name}`;

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [`${field('_')} must be an object`] };
  }
  const input = raw as ProviderRateRowInput;

  // Reject unknown keys — rate rows are a closed contract.
  const allowed = new Set([
    'destination',
    'countryIso',
    'prefix',
    'routeType',
    'rate',
    'currency',
    'firstIncrementSeconds',
    'incrementSeconds',
    'minimumDurationSeconds',
    'effectiveFrom',
    'effectiveTo',
    'notes',
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) errors.push(`${field(key)} is not a recognized field`);
  }

  // prefix — required, digits only, no '+'.
  let prefix = '';
  if (typeof input.prefix !== 'string' || !PREFIX_RE.test(input.prefix)) {
    errors.push(`${field('prefix')} must be a digit string without '+'`);
  } else if (input.prefix.length > MAX_PREFIX_LENGTH) {
    errors.push(`${field('prefix')} exceeds ${MAX_PREFIX_LENGTH} digits`);
  } else {
    prefix = input.prefix;
  }

  // routeType — required enum.
  let routeType: ProviderRateRouteTypeValue = 'FIXED';
  if (
    typeof input.routeType !== 'string' ||
    !PROVIDER_RATE_ROUTE_TYPES.includes(input.routeType as ProviderRateRouteTypeValue)
  ) {
    errors.push(`${field('routeType')} must be one of ${PROVIDER_RATE_ROUTE_TYPES.join(', ')}`);
  } else {
    routeType = input.routeType as ProviderRateRouteTypeValue;
  }

  // rate — required, finite, > 0, <= 8 fractional digits.
  let rate = new Prisma.Decimal(0);
  if (input.rate === undefined || input.rate === null) {
    errors.push(`${field('rate')} is required`);
  } else {
    try {
      rate = new Prisma.Decimal(input.rate as string | number);
      if (!rate.isFinite() || rate.lte(0)) {
        errors.push(`${field('rate')} must be a positive finite number`);
      } else if (rate.decimalPlaces() > MAX_RATE_DECIMALS) {
        errors.push(`${field('rate')} exceeds ${MAX_RATE_DECIMALS} decimal places`);
      }
    } catch {
      errors.push(`${field('rate')} must be a valid decimal`);
    }
  }

  // currency — optional, ISO-4217 alpha-3.
  let currency = 'USD';
  if (input.currency !== undefined) {
    if (typeof input.currency !== 'string' || !CURRENCY_RE.test(input.currency)) {
      errors.push(`${field('currency')} must be a 3-letter ISO-4217 code`);
    } else {
      currency = input.currency;
    }
  }

  // countryIso — optional alpha-2.
  let countryIso: string | null = null;
  if (input.countryIso !== undefined && input.countryIso !== null) {
    if (typeof input.countryIso !== 'string' || !ISO_RE.test(input.countryIso)) {
      errors.push(`${field('countryIso')} must be a 2-letter ISO code`);
    } else {
      countryIso = input.countryIso;
    }
  }

  // destination — optional bounded string.
  let destination: string | null = null;
  if (input.destination !== undefined && input.destination !== null) {
    if (typeof input.destination !== 'string' || input.destination.length > MAX_DESTINATION_LEN) {
      errors.push(`${field('destination')} must be a string of at most ${MAX_DESTINATION_LEN} characters`);
    } else {
      destination = input.destination.trim() || null;
    }
  }

  // Increments — positive ints; minimumDuration — non-negative int.
  const intField = (
    value: unknown,
    name: string,
    min: number,
    fallback: number
  ): number => {
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      errors.push(`${field(name)} must be an integer >= ${min}`);
      return fallback;
    }
    return value;
  };
  const firstIncrementSeconds = intField(input.firstIncrementSeconds, 'firstIncrementSeconds', 1, 1);
  const incrementSeconds = intField(input.incrementSeconds, 'incrementSeconds', 1, 1);
  const minimumDurationSeconds = intField(input.minimumDurationSeconds, 'minimumDurationSeconds', 0, 0);

  // Effective dates.
  const dateField = (value: unknown, name: string): Date | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const d = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) {
      errors.push(`${field(name)} must be a valid date`);
      return null;
    }
    return d;
  };
  const effectiveFrom = dateField(input.effectiveFrom, 'effectiveFrom') ?? new Date();
  const effectiveTo = dateField(input.effectiveTo, 'effectiveTo') ?? null;
  if (effectiveTo && effectiveTo.getTime() <= effectiveFrom.getTime()) {
    errors.push(`${field('effectiveTo')} must be after effectiveFrom`);
  }

  let notes: string | null = null;
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string' || input.notes.length > MAX_NOTES_LEN) {
      errors.push(`${field('notes')} must be a string of at most ${MAX_NOTES_LEN} characters`);
    } else {
      notes = input.notes.trim() || null;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      destination,
      countryIso,
      prefix,
      routeType,
      rate,
      currency,
      firstIncrementSeconds,
      incrementSeconds,
      minimumDurationSeconds,
      effectiveFrom,
      effectiveTo,
      notes,
    },
  };
}

export function validateProviderRateRows(
  raw: unknown,
  maxRows = 10000
): { ok: true; data: ValidatedProviderRateRow[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ['rates must be an array'] };
  }
  if (raw.length === 0) {
    return { ok: false, errors: ['rates must contain at least one row'] };
  }
  if (raw.length > maxRows) {
    return { ok: false, errors: [`rates exceeds the ${maxRows} row limit`] };
  }
  const rows: ValidatedProviderRateRow[] = [];
  const errors: string[] = [];
  raw.forEach((row, i) => {
    const result = validateProviderRateRow(row, i);
    if (result.ok) rows.push(result.data);
    else errors.push(...result.errors);
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: rows };
}

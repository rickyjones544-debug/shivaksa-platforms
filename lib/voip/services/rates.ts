import { prisma } from '@/lib/db/prisma';
import { DestinationType } from '@/lib/voip/constants';
import type { NormalizedDestination } from './normalization';
import type { CarrierRate, Prisma } from '@prisma/client';

export interface FindRateOptions {
  /** Normalize destination from the normalization service. */
  destination: NormalizedDestination;
  /** Limit search to a specific carrier. */
  carrierId?: string;
  /** Only consider rates enabled right now. */
  enabledOnly?: boolean;
  /** Moment in time for effective-dated rates (defaults to now). */
  effectiveAt?: Date;
  /** Organization context for tenant-scoped carriers. */
  organizationId?: string;
}

export interface RateMatch {
  rate: CarrierRate;
  /** Length of the matched prefix. */
  prefixLength: number;
  /** Whether the rate is a destination-type-specific match or generic ALL. */
  typeMatch: 'exact' | 'generic';
}

function buildRateWhere(options: FindRateOptions): Prisma.CarrierRateWhereInput {
  const effectiveAt = options.effectiveAt ?? new Date();

  const where: Prisma.CarrierRateWhereInput = {
    enabled: options.enabledOnly !== false,
    effectiveFrom: { lte: effectiveAt },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
  };

  if (options.carrierId) {
    where.carrierId = options.carrierId;
  }

  return where;
}

/**
 * Find all carrier rates whose prefix matches the normalized destination.
 * Results are not ordered; callers should score them.
 */
export async function findMatchingRates(options: FindRateOptions): Promise<RateMatch[]> {
  const where = buildRateWhere(options);

  // Load candidate rows. For very large rate tables this can be replaced by a
  // raw prefix query; the composite index keeps this efficient for Phase 2B volumes.
  const rates = await prisma.carrierRate.findMany({
    where,
    include: { carrier: true },
  });

  const matches: RateMatch[] = [];
  const destinationType = options.destination.destinationType;

  const effectiveAt = options.effectiveAt ?? new Date();

  for (const rate of rates) {
    const carrier = rate.carrier;
    if (!carrier) continue;

    // Tenant isolation: platform-wide carriers are visible to all tenants;
    // organization-scoped carriers are visible only to their tenant.
    if (carrier.organizationId && carrier.organizationId !== options.organizationId) {
      continue;
    }

    // Skip disabled or suspended carriers.
    if (!carrier.enabled) continue;
    if (carrier.status === 'SUSPENDED') continue;

    // Effective-dated rate filtering (also enforced by Prisma; defensive fallback).
    if (rate.effectiveFrom.getTime() > effectiveAt.getTime()) continue;
    if (rate.effectiveTo && rate.effectiveTo.getTime() < effectiveAt.getTime()) continue;

    // Prefix matching: the rate prefix must be a prefix of the destination digits.
    if (!options.destination.digits.startsWith(rate.prefix)) continue;

    // Destination type matching:
    // 1. Exact match (e.g. MOBILE rate for a MOBILE number).
    // 2. Generic ALL rate fallback.
    if (destinationType && rate.destinationType === destinationType) {
      matches.push({ rate, prefixLength: rate.prefix.length, typeMatch: 'exact' });
    } else if (rate.destinationType === DestinationType.ALL) {
      matches.push({ rate, prefixLength: rate.prefix.length, typeMatch: 'generic' });
    }
  }

  return matches;
}

/**
 * Find the best matching rate for a destination.
 *
 * Selection order:
 * 1. Longest prefix match.
 * 2. Exact destination-type match over generic ALL.
 * 3. Higher priority.
 * 4. Latest effectiveFrom.
 */
export async function findBestRate(options: FindRateOptions): Promise<CarrierRate | null> {
  const matches = await findMatchingRates(options);
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (b.prefixLength !== a.prefixLength) return b.prefixLength - a.prefixLength;
    if (a.typeMatch !== b.typeMatch) return a.typeMatch === 'exact' ? -1 : 1;
    if (b.rate.priority !== a.rate.priority) return b.rate.priority - a.rate.priority;
    return b.rate.effectiveFrom.getTime() - a.rate.effectiveFrom.getTime();
  });

  return matches[0].rate;
}

/**
 * Group matching rates by carrier and return the best rate per carrier.
 */
export async function findBestRatesByCarrier(
  options: FindRateOptions
): Promise<Map<string, CarrierRate>> {
  const matches = await findMatchingRates(options);
  const byCarrier = new Map<string, CarrierRate>();

  matches.sort((a, b) => {
    if (b.prefixLength !== a.prefixLength) return b.prefixLength - a.prefixLength;
    if (a.typeMatch !== b.typeMatch) return a.typeMatch === 'exact' ? -1 : 1;
    if (b.rate.priority !== a.rate.priority) return b.rate.priority - a.rate.priority;
    return b.rate.effectiveFrom.getTime() - a.rate.effectiveFrom.getTime();
  });

  for (const match of matches) {
    if (!byCarrier.has(match.rate.carrierId)) {
      byCarrier.set(match.rate.carrierId, match.rate);
    }
  }

  return byCarrier;
}

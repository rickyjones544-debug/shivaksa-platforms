import { prisma } from '@/lib/db/prisma';
import { CallStatus, DestinationType } from '@/lib/voip/constants';
import { normalizeDestination, type NormalizedDestination } from './normalization';
import { findBestRatesByCarrier, type FindRateOptions } from './rates';
import { selectCallerId } from './cli';
import { findApplicableRoutePolicies } from './route-policies';
import type { Carrier, CarrierRate, CarrierRoutePolicy, SipAccount } from '@prisma/client';

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingError';
  }
}

export interface RouteRequest {
  organizationId: string;
  destination: string;
  sipAccount: SipAccount;
}

export interface RouteResult {
  carrier: Carrier;
  rate: CarrierRate;
  normalized: NormalizedDestination;
  /** Fully transformed destination for the carrier (e.g. with tech prefix). */
  dialString: string;
  /** Final caller ID to send. */
  callerId: string;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// In-process CPS token buckets. Acceptable for a single-instance deployment;
// replace with Redis if the platform is horizontally scaled.
const cpsBuckets = new Map<string, TokenBucket>();

function getBucket(carrierId: string, maxCps: number | null): TokenBucket {
  const now = Date.now();
  const existing = cpsBuckets.get(carrierId);
  const capacity = maxCps && maxCps > 0 ? maxCps : Number.MAX_SAFE_INTEGER;

  if (!existing) {
    const bucket: TokenBucket = { tokens: capacity, lastRefill: now };
    cpsBuckets.set(carrierId, bucket);
    return bucket;
  }

  const elapsedSeconds = (now - existing.lastRefill) / 1000;
  if (elapsedSeconds >= 1) {
    const tokensToAdd = Math.floor(elapsedSeconds) * capacity;
    existing.tokens = Math.min(existing.tokens + tokensToAdd, capacity);
    existing.lastRefill = now;
  }

  return existing;
}

function consumeCpsTokens(limits: { key: string; maxCps: number | null }[]): boolean {
  const buckets = limits
    .filter((limit) => limit.maxCps !== null && limit.maxCps > 0)
    .map((limit) => getBucket(limit.key, limit.maxCps));
  if (buckets.some((bucket) => bucket.tokens < 1)) return false;
  buckets.forEach((bucket) => {
    bucket.tokens -= 1;
  });
  return true;
}

async function countActiveCarrierCalls(carrierId: string): Promise<number> {
  return prisma.voipCall.count({
    where: {
      carrierId,
      status: { in: [CallStatus.INITIATED, CallStatus.RINGING, CallStatus.ANSWERED] },
    },
  });
}

function buildDialString(carrier: Carrier, normalized: NormalizedDestination): string {
  const digits = normalized.digits;
  if (carrier.techPrefix) {
    return `${carrier.techPrefix}${digits}`;
  }
  return digits;
}

function effectiveLimit(override: number | null, carrierLimit: number | null): number | null {
  const limits = [override, carrierLimit].filter(
    (value): value is number => value !== null && value > 0
  );
  return limits.length ? Math.min(...limits) : null;
}

function consumePolicyCps(policy: CarrierRoutePolicy, carrier: Carrier): boolean {
  return consumeCpsTokens([
    { key: `carrier:${carrier.id}`, maxCps: carrier.maxCps },
    { key: `route-policy:${policy.id}`, maxCps: policy.maxCpsOverride },
  ]);
}

/**
 * Select a carrier and rate for an outbound call.
 *
 * The router currently uses prefix match + priority + capacity checks.
 * Failover and cost-based routing will be layered on in a later phase.
 */
export async function selectRoute(request: RouteRequest): Promise<RouteResult> {
  const normalized = normalizeDestination(request.destination);

  if (!normalized.countryIso) {
    throw new RoutingError('No country route policy available for destination');
  }
  const destinationType = normalized.destinationType ?? DestinationType.ALL;
  const policies = await findApplicableRoutePolicies({
    organizationId: request.organizationId,
    countryIso: normalized.countryIso,
    destinationType,
  });
  if (policies.length === 0) {
    throw new RoutingError('No country route policy available for destination');
  }

  const findOptions: FindRateOptions = {
    destination: normalized,
    organizationId: request.organizationId,
    enabledOnly: true,
    effectiveAt: new Date(),
  };
  const bestByCarrier = await findBestRatesByCarrier(findOptions);

  for (const policy of policies) {
    const carrier = policy.carrier;
    const rate = bestByCarrier.get(carrier.id);
    if (!rate) continue;

    const channelLimit = effectiveLimit(policy.maxChannelsOverride, carrier.maxChannels);
    if (channelLimit !== null) {
      const active = await countActiveCarrierCalls(carrier.id);
      if (active >= channelLimit) continue;
    }
    if (!consumePolicyCps(policy, carrier)) continue;

    const callerId = await selectCallerId({
      carrier,
      sipAccount: request.sipAccount,
      destinationCountryIso: normalized.countryIso,
      cliProfileId: policy.cliProfileId,
    });

    return {
      carrier,
      rate,
      normalized,
      dialString: buildDialString(carrier, normalized),
      callerId,
    };
  }

  throw new RoutingError(
    'All eligible carrier route policies are at capacity or exceed CPS limits'
  );
}

export function resetCpsBucket(carrierId?: string): void {
  if (carrierId) {
    cpsBuckets.delete(carrierId);
  } else {
    cpsBuckets.clear();
  }
}

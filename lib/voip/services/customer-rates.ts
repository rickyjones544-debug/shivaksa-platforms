import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { toDecimal } from './billing';
import { audit } from './audit';
import type { NormalizedDestination } from './normalization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import type { CustomerRate, CustomerRateCard } from '@prisma/client';

/**
 * Customer selling-rate layer (Phase 3).
 *
 * Deliberately separate from CarrierRate: customers buy a Shivaksa rate card
 * and only ever see selling prices. Carrier wholesale rates, margins and
 * provider details never cross into this module's DTOs.
 *
 * Selection rule: within the organization's single ACTIVE rate card, the
 * longest enabled, currently-effective prefix matching the normalized
 * destination digits wins. If the organization has no ACTIVE rate card at
 * all, the legacy flat `VoipService.customerRate` is used so Phase 1/2
 * customers keep working until a card is assigned. We NEVER fall back to a
 * carrier wholesale rate, and a rate card with no matching prefix rejects the
 * call rather than producing a misleading charge.
 */

export class CustomerRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerRateError';
  }
}

export const RateCardStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;

export interface CustomerRateSelection {
  rate: Prisma.Decimal;
  billingIncrementSeconds: number;
  minimumBillableSeconds: number;
  customerRateCardId: string | null;
  customerRateId: string | null;
  /** RATE_CARD = matched a card entry; SERVICE_DEFAULT = legacy flat rate. */
  source: 'RATE_CARD' | 'SERVICE_DEFAULT';
}

export async function getActiveRateCard(
  organizationId: string
): Promise<CustomerRateCard | null> {
  return prisma.customerRateCard.findFirst({
    where: { organizationId, status: RateCardStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCustomerRate(
  organizationId: string,
  normalized: NormalizedDestination,
  effectiveAt: Date = new Date(),
  fallbackService?: {
    customerRate: Prisma.Decimal | number | string;
    billingIncrementSeconds: number;
    minimumBillableSeconds: number;
  } | null
): Promise<CustomerRateSelection> {
  const card = await prisma.customerRateCard.findFirst({
    where: { organizationId, status: RateCardStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
    include: {
      rates: {
        where: {
          enabled: true,
          effectiveFrom: { lte: effectiveAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveAt } }],
        },
      },
    },
  });

  if (card) {
    let best: CustomerRate | null = null;
    for (const rate of card.rates) {
      // The include filter already restricts to enabled + effective rows;
      // re-check here so a stale/unfiltered relation load can never bill
      // against a disabled or out-of-window rate.
      if (
        rate.enabled &&
        rate.effectiveFrom <= effectiveAt &&
        (!rate.effectiveTo || rate.effectiveTo >= effectiveAt) &&
        normalized.digits.startsWith(rate.prefix) &&
        (!best || rate.prefix.length > best.prefix.length)
      ) {
        best = rate;
      }
    }
    if (!best) {
      throw new CustomerRateError(
        `No customer rate is available for this destination. Contact your account manager to enable this destination.`
      );
    }
    return {
      rate: best.rate,
      billingIncrementSeconds: best.billingIncrementSeconds,
      minimumBillableSeconds: best.minimumBillableSeconds,
      customerRateCardId: card.id,
      customerRateId: best.id,
      source: 'RATE_CARD',
    };
  }

  // No rate card assigned: fall back to the organization's flat selling rate
  // on VoipService. This is a customer selling rate, never a wholesale rate.
  const service =
    fallbackService !== undefined
      ? fallbackService
      : await prisma.voipService.findUnique({ where: { organizationId } });
  if (!service) {
    throw new CustomerRateError('VoIP service not configured');
  }
  return {
    rate: toDecimal(service.customerRate),
    billingIncrementSeconds: service.billingIncrementSeconds,
    minimumBillableSeconds: service.minimumBillableSeconds,
    customerRateCardId: null,
    customerRateId: null,
    source: 'SERVICE_DEFAULT',
  };
}

// ---------------------------------------------------------------------------
// Read/listing helpers (admin + customer-safe views)
// ---------------------------------------------------------------------------

export async function getRateCardWithRates(organizationId: string) {
  return prisma.customerRateCard.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { rates: { orderBy: [{ prefix: 'asc' }, { effectiveFrom: 'desc' }] } },
  });
}

// ---------------------------------------------------------------------------
// Admin management
// ---------------------------------------------------------------------------

export interface CreateRateCardInput {
  name: string;
  description?: string | null;
  currency?: string;
}

export async function createRateCard(
  ctx: AuthenticatedContext,
  organizationId: string,
  input: CreateRateCardInput
) {
  if (!input.name?.trim()) throw new CustomerRateError('Rate card name is required');
  const card = await prisma.customerRateCard.create({
    data: {
      organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      currency: (input.currency || 'USD').toUpperCase(),
      status: RateCardStatus.ACTIVE,
    },
  });
  await audit(ctx, 'RATE_CARD_CREATED', 'CustomerRateCard', card.id, {
    organizationId,
    name: card.name,
  });
  return card;
}

export async function updateRateCard(
  ctx: AuthenticatedContext,
  organizationId: string,
  cardId: string,
  input: { name?: string; description?: string | null; status?: string }
) {
  const card = await prisma.customerRateCard.findFirst({
    where: { id: cardId, organizationId },
  });
  if (!card) throw new CustomerRateError('Rate card not found');
  if (input.status && !Object.values(RateCardStatus).includes(input.status as never)) {
    throw new CustomerRateError('Invalid rate card status');
  }
  const updated = await prisma.customerRateCard.update({
    where: { id: card.id },
    data: {
      name: input.name?.trim() || card.name,
      description: input.description !== undefined ? input.description : card.description,
      status: input.status || card.status,
    },
  });
  await audit(ctx, 'RATE_CARD_UPDATED', 'CustomerRateCard', card.id, {
    organizationId,
    status: updated.status,
  });
  return updated;
}

export interface RateInput {
  prefix: string;
  rate: string | number | Prisma.Decimal;
  destination?: string | null;
  country?: string | null;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  enabled?: boolean;
}

function validateRateInput(input: RateInput) {
  if (!/^\d{1,15}$/.test(input.prefix || '')) {
    throw new CustomerRateError('Prefix must be 1–15 digits without a leading +');
  }
  const rate = toDecimal(input.rate);
  if (rate.isNegative()) {
    throw new CustomerRateError('Rate must not be negative');
  }
  const increment = input.billingIncrementSeconds ?? 60;
  const minimum = input.minimumBillableSeconds ?? 60;
  if (!Number.isInteger(increment) || increment < 1 || increment > 3600) {
    throw new CustomerRateError('Billing increment must be an integer between 1 and 3600 seconds');
  }
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > 3600) {
    throw new CustomerRateError('Minimum billable duration must be an integer between 0 and 3600 seconds');
  }
  return { rate, increment, minimum };
}

export async function addRate(
  ctx: AuthenticatedContext,
  organizationId: string,
  cardId: string,
  input: RateInput
) {
  const card = await prisma.customerRateCard.findFirst({
    where: { id: cardId, organizationId },
  });
  if (!card) throw new CustomerRateError('Rate card not found');
  const { rate, increment, minimum } = validateRateInput(input);
  const entry = await prisma.customerRate.create({
    data: {
      rateCardId: card.id,
      prefix: input.prefix,
      destination: input.destination?.trim() || null,
      country: input.country?.trim().toUpperCase() || null,
      rate,
      billingIncrementSeconds: increment,
      minimumBillableSeconds: minimum,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      enabled: input.enabled ?? true,
    },
  });
  await audit(ctx, 'CUSTOMER_RATE_CREATED', 'CustomerRate', entry.id, {
    organizationId,
    rateCardId: card.id,
    prefix: entry.prefix,
    rate: entry.rate.toString(),
  });
  return entry;
}

export async function updateRate(
  ctx: AuthenticatedContext,
  organizationId: string,
  rateId: string,
  input: Partial<RateInput>
) {
  const entry = await prisma.customerRate.findFirst({
    where: { id: rateId, rateCard: { organizationId } },
  });
  if (!entry) throw new CustomerRateError('Rate not found');

  const data: Prisma.CustomerRateUpdateInput = {};
  if (input.rate !== undefined || input.billingIncrementSeconds !== undefined || input.minimumBillableSeconds !== undefined) {
    const validated = validateRateInput({
      prefix: input.prefix ?? entry.prefix,
      rate: input.rate ?? entry.rate,
      billingIncrementSeconds: input.billingIncrementSeconds ?? entry.billingIncrementSeconds,
      minimumBillableSeconds: input.minimumBillableSeconds ?? entry.minimumBillableSeconds,
    });
    if (input.prefix !== undefined) data.prefix = input.prefix;
    if (input.rate !== undefined) data.rate = validated.rate;
    if (input.billingIncrementSeconds !== undefined) data.billingIncrementSeconds = validated.increment;
    if (input.minimumBillableSeconds !== undefined) data.minimumBillableSeconds = validated.minimum;
  }
  if (input.destination !== undefined) data.destination = input.destination?.trim() || null;
  if (input.country !== undefined) data.country = input.country?.trim().toUpperCase() || null;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.effectiveFrom !== undefined) data.effectiveFrom = new Date(input.effectiveFrom);
  if (input.effectiveTo !== undefined) {
    data.effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;
  }

  const updated = await prisma.customerRate.update({ where: { id: entry.id }, data });
  await audit(ctx, 'CUSTOMER_RATE_UPDATED', 'CustomerRate', entry.id, {
    organizationId,
    rateCardId: entry.rateCardId,
    enabled: updated.enabled,
    rate: updated.rate.toString(),
  });
  return updated;
}

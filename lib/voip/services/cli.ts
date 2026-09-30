import { prisma } from '@/lib/db/prisma';
import { CliMode } from '@/lib/voip/constants';
import { normalizeDestination } from './normalization';
import type { Carrier, SipAccount } from '@prisma/client';

export interface CallerIdSelectionInput {
  carrier: Carrier;
  sipAccount: SipAccount;
  destinationCountryIso?: string | null;
  cliProfileId?: string | null;
  /** Caller ID supplied by a dialer/UI. Only honoured in PASS_THROUGH mode and only if valid. */
  suppliedCallerId?: string | null;
}

export class CallerIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallerIdError';
  }
}

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function isValidE164(value: string): boolean {
  return E164_REGEX.test(value);
}

function defaultCallerId(input: CallerIdSelectionInput): string {
  if (input.carrier.defaultCallerId && isValidE164(input.carrier.defaultCallerId)) {
    return input.carrier.defaultCallerId;
  }
  if (input.sipAccount.callerId && isValidE164(input.sipAccount.callerId)) {
    return input.sipAccount.callerId;
  }
  // Fallback to the SIP account username. This is not a valid CLI for many carriers,
  // but it preserves existing behaviour until a proper CLI is configured.
  return input.sipAccount.username;
}

/**
 * Select a caller ID for an outbound call according to the carrier's CLI mode.
 *
 * - FIXED: use carrier.defaultCallerId (or the SIP account caller ID as fallback).
 * - POOL: pick an approved CLI entry from the carrier's CLI profile pool.
 * - PASS_THROUGH: accept the supplied caller ID only if it is valid E.164.
 *
 * Arbitrary caller IDs from customers are never sent directly to carriers unless
 * they match an approved pool entry or PASS_THROUGH validation passes.
 */
export async function selectCallerId(input: CallerIdSelectionInput): Promise<string> {
  const mode = input.carrier.cliMode ?? CliMode.PASS_THROUGH;

  if (mode === CliMode.FIXED) {
    const cli = input.carrier.defaultCallerId;
    if (!cli || !isValidE164(cli)) {
      throw new CallerIdError(`Carrier ${input.carrier.name} requires a valid fixed caller ID`);
    }
    return cli;
  }

  if (mode === CliMode.POOL) {
    const profile = await prisma.carrierCliProfile.findFirst({
      where: input.cliProfileId
        ? { id: input.cliProfileId, carrierId: input.carrier.id }
        : { carrierId: input.carrier.id },
      include: { entries: { where: { enabled: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (profile?.defaultCli && isValidE164(profile.defaultCli)) {
      return profile.defaultCli;
    }

    for (const entry of profile?.entries ?? []) {
      if (!isValidE164(entry.number)) continue;
      const allowed = entry.allowedCountries;
      if (
        !allowed.length ||
        !input.destinationCountryIso ||
        allowed.includes(input.destinationCountryIso)
      ) {
        return entry.number;
      }
    }

    // No pool entry available; fall back to fixed/default.
    throw new CallerIdError(`Carrier ${input.carrier.name} has no valid CLI pool entry`);
  }

  // PASS_THROUGH: validate supplied CLI, otherwise fall back to default.
  if (input.suppliedCallerId) {
    if (!isValidE164(input.suppliedCallerId)) {
      throw new CallerIdError('Supplied caller ID must be valid E.164');
    }
    return input.suppliedCallerId;
  }

  const fallback = defaultCallerId(input);
  if (!isValidE164(fallback)) {
    throw new CallerIdError(`Carrier ${input.carrier.name} requires a valid caller ID`);
  }
  return fallback;
}

/**
 * Validate that a caller ID is acceptable for a given carrier.
 * This is a stricter gate used by admin/configuration flows.
 */
export async function validateCallerIdForCarrier(
  carrier: Carrier,
  callerId: string
): Promise<boolean> {
  if (!isValidE164(callerId)) return false;

  if (carrier.cliMode === CliMode.POOL) {
    const entry = await prisma.carrierCliEntry.findFirst({
      where: {
        cliProfile: { carrierId: carrier.id },
        number: callerId,
        enabled: true,
      },
    });
    return !!entry;
  }

  return true;
}

/**
 * Convenience helper that also normalizes a raw caller-id input.
 */
export function normalizeCallerId(raw: string): string | null {
  try {
    const normalized = normalizeDestination(raw);
    return normalized.e164;
  } catch {
    return null;
  }
}

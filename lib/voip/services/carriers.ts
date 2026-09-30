import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { encryptValue } from './crypto';
import { audit } from './audit';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import type {
  CarrierType,
  CarrierAuthType,
  CarrierStatus,
  Transport,
  CliMode,
  DestinationType,
} from '@/lib/voip/constants';

export class CarrierAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierAuthorizationError';
  }
}

export interface CreateCarrierInput {
  name: string;
  code: string;
  type: CarrierType;
  organizationId?: string | null;
  authenticationType: CarrierAuthType;
  remoteHost?: string;
  remotePort?: number | null;
  transport?: Transport;
  localHost?: string;
  localPort?: number | null;
  techPrefix?: string;
  codecs?: string[];
  maxChannels?: number | null;
  maxCps?: number | null;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  defaultCallerId?: string;
  cliMode?: CliMode;
  notes?: string;
  status?: CarrierStatus;
  enabled?: boolean;
}

export interface UpdateCarrierInput {
  name?: string;
  enabled?: boolean;
  status?: CarrierStatus;
  remoteHost?: string;
  remotePort?: number | null;
  transport?: Transport;
  localHost?: string;
  localPort?: number | null;
  techPrefix?: string;
  codecs?: string[];
  maxChannels?: number | null;
  maxCps?: number | null;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  defaultCallerId?: string;
  cliMode?: CliMode;
  notes?: string;
}

export interface CreateCarrierRateInput {
  prefix: string;
  country?: string;
  destinationType: DestinationType;
  rate: string | number | Prisma.Decimal;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  priority?: number;
  enabled?: boolean;
}

export interface UpdateCarrierRateInput {
  prefix?: string;
  country?: string;
  destinationType?: DestinationType;
  rate?: string | number | Prisma.Decimal;
  billingIncrementSeconds?: number;
  minimumBillableSeconds?: number;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
  priority?: number;
  enabled?: boolean;
}

export interface CreateCarrierCredentialInput {
  username?: string;
  password: string;
  realm?: string;
}

export interface CreateCarrierCliProfileInput {
  name: string;
  defaultCli?: string;
}

export interface CreateCarrierCliEntryInput {
  number: string;
  allowedCountries?: string[];
}

function canManageCarrier(ctx: AuthenticatedContext, carrier?: { organizationId: string | null } | null): boolean {
  if (ctx.user.isSuperAdmin) return true;
  if (!hasPermission(ctx, 'carrier', 'manage') && !hasPermission(ctx, 'carrier', 'write')) {
    return false;
  }
  // Platform-wide carriers can be managed by operations managers.
  if (!carrier || !carrier.organizationId) return true;
  // Organization-scoped carriers can only be managed within the active organization.
  return ctx.organization?.id === carrier.organizationId;
}

function assertCanManageCarrier(ctx: AuthenticatedContext, carrier?: { organizationId: string | null } | null) {
  if (!canManageCarrier(ctx, carrier)) {
    throw new CarrierAuthorizationError('Forbidden');
  }
}

export async function listCarriers(ctx: AuthenticatedContext) {
  const where: Prisma.CarrierWhereInput = {};

  if (!ctx.user.isSuperAdmin) {
    where.OR = [
      { organizationId: null },
      { organizationId: ctx.organization?.id || '' },
    ];
  }

  return prisma.carrier.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCarrier(ctx: AuthenticatedContext, id: string) {
  const carrier = await prisma.carrier.findUnique({ where: { id } });
  if (!carrier) return null;
  assertCanManageCarrier(ctx, carrier);
  return carrier;
}

export async function getCarrierByCode(code: string, organizationId?: string) {
  const where: Prisma.CarrierWhereUniqueInput & Prisma.CarrierWhereInput = { code };
  const carrier = await prisma.carrier.findFirst({
    where: {
      code,
      OR: [{ organizationId: null }, { organizationId: organizationId || '' }],
    },
  });
  return carrier;
}

export async function createCarrier(
  ctx: AuthenticatedContext,
  input: CreateCarrierInput
): Promise<{ carrier: Awaited<ReturnType<typeof prisma.carrier.create>> }> {
  if (!hasPermission(ctx, 'carrier', 'write') && !hasPermission(ctx, 'carrier', 'manage')) {
    throw new CarrierAuthorizationError('Forbidden');
  }

  const organizationId = input.organizationId ?? null;
  if (organizationId && !ctx.user.isSuperAdmin && ctx.organization?.id !== organizationId) {
    throw new CarrierAuthorizationError('Cannot create carrier for another organization');
  }

  const existing = await prisma.carrier.findUnique({ where: { code: input.code } });
  if (existing) {
    throw new CarrierAuthorizationError(`Carrier code '${input.code}' already exists`);
  }

  const carrier = await prisma.carrier.create({
    data: {
      name: input.name,
      code: input.code.toLowerCase().trim(),
      type: input.type,
      organizationId,
      authenticationType: input.authenticationType,
      remoteHost: input.remoteHost ?? null,
      remotePort: input.remotePort ?? null,
      transport: input.transport ?? 'UDP',
      localHost: input.localHost ?? null,
      localPort: input.localPort ?? null,
      techPrefix: input.techPrefix ?? null,
      codecs: input.codecs ?? [],
      maxChannels: input.maxChannels ?? null,
      maxCps: input.maxCps ?? null,
      billingIncrementSeconds: input.billingIncrementSeconds ?? 60,
      minimumBillableSeconds: input.minimumBillableSeconds ?? 60,
      defaultCallerId: input.defaultCallerId ?? null,
      cliMode: input.cliMode ?? 'PASS_THROUGH',
      notes: input.notes ?? null,
      status: input.status ?? 'TEST',
      enabled: input.enabled ?? true,
    },
  });

  await audit(ctx, 'CARRIER_CREATED', 'Carrier', carrier.id, {
    code: carrier.code,
    type: carrier.type,
    organizationId: carrier.organizationId,
  });

  return { carrier };
}

export async function updateCarrier(
  ctx: AuthenticatedContext,
  id: string,
  input: UpdateCarrierInput
) {
  const carrier = await prisma.carrier.findUnique({ where: { id } });
  if (!carrier) throw new CarrierAuthorizationError('Carrier not found');
  assertCanManageCarrier(ctx, carrier);

  const data: Prisma.CarrierUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.status !== undefined) data.status = input.status;
  if (input.remoteHost !== undefined) data.remoteHost = input.remoteHost ?? null;
  if (input.remotePort !== undefined) data.remotePort = input.remotePort ?? null;
  if (input.transport !== undefined) data.transport = input.transport;
  if (input.localHost !== undefined) data.localHost = input.localHost ?? null;
  if (input.localPort !== undefined) data.localPort = input.localPort ?? null;
  if (input.techPrefix !== undefined) data.techPrefix = input.techPrefix ?? null;
  if (input.codecs !== undefined) data.codecs = input.codecs;
  if (input.maxChannels !== undefined) data.maxChannels = input.maxChannels ?? null;
  if (input.maxCps !== undefined) data.maxCps = input.maxCps ?? null;
  if (input.billingIncrementSeconds !== undefined)
    data.billingIncrementSeconds = input.billingIncrementSeconds;
  if (input.minimumBillableSeconds !== undefined)
    data.minimumBillableSeconds = input.minimumBillableSeconds;
  if (input.defaultCallerId !== undefined) data.defaultCallerId = input.defaultCallerId ?? null;
  if (input.cliMode !== undefined) data.cliMode = input.cliMode;
  if (input.notes !== undefined) data.notes = input.notes ?? null;

  const updated = await prisma.carrier.update({ where: { id }, data });

  await audit(ctx, 'CARRIER_UPDATED', 'Carrier', updated.id, {
    changes: Object.keys(input),
  });

  return updated;
}

export async function disableCarrier(ctx: AuthenticatedContext, id: string) {
  const updated = await updateCarrier(ctx, id, { enabled: false, status: 'SUSPENDED' });
  await audit(ctx, 'CARRIER_DISABLED', 'Carrier', updated.id, { enabled: updated.enabled });
  return updated;
}

export async function createCarrierCredential(
  ctx: AuthenticatedContext,
  carrierId: string,
  input: CreateCarrierCredentialInput
) {
  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } });
  if (!carrier) throw new CarrierAuthorizationError('Carrier not found');
  assertCanManageCarrier(ctx, carrier);

  const encrypted = encryptValue(input.password);

  const credential = await prisma.carrierCredential.upsert({
    where: { carrierId },
    update: {
      username: input.username ?? null,
      passwordCipher: encrypted.cipher,
      passwordTag: encrypted.tag,
      passwordIv: encrypted.iv,
      realm: input.realm ?? null,
    },
    create: {
      carrierId,
      username: input.username ?? null,
      passwordCipher: encrypted.cipher,
      passwordTag: encrypted.tag,
      passwordIv: encrypted.iv,
      realm: input.realm ?? null,
    },
  });

  await audit(ctx, 'CARRIER_CREDENTIAL_UPDATED', 'CarrierCredential', credential.id, {
    carrierId,
  });

  return credential;
}

export async function listCarrierRates(
  ctx: AuthenticatedContext,
  carrierId: string,
  options?: { effectiveAt?: Date; enabledOnly?: boolean }
) {
  const carrier = await getCarrier(ctx, carrierId);
  if (!carrier) throw new CarrierAuthorizationError('Carrier not found');

  const where: Prisma.CarrierRateWhereInput = { carrierId };

  if (options?.enabledOnly) {
    where.enabled = true;
  }

  if (options?.effectiveAt) {
    where.effectiveFrom = { lte: options.effectiveAt };
    where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: options.effectiveAt } }];
  }

  return prisma.carrierRate.findMany({
    where,
    orderBy: [{ prefix: 'desc' }, { effectiveFrom: 'desc' }],
  });
}

export async function getCarrierRate(ctx: AuthenticatedContext, rateId: string) {
  const rate = await prisma.carrierRate.findUnique({
    where: { id: rateId },
    include: { carrier: true },
  });
  if (!rate) return null;
  assertCanManageCarrier(ctx, rate.carrier);
  return rate;
}

export async function createCarrierRate(
  ctx: AuthenticatedContext,
  carrierId: string,
  input: CreateCarrierRateInput
) {
  const carrier = await getCarrier(ctx, carrierId);
  if (!carrier) throw new CarrierAuthorizationError('Carrier not found');

  const rate = await prisma.carrierRate.create({
    data: {
      carrierId,
      prefix: stripPrefix(input.prefix),
      country: input.country?.toUpperCase() ?? null,
      destinationType: input.destinationType,
      rate: new Prisma.Decimal(input.rate.toString()),
      billingIncrementSeconds: input.billingIncrementSeconds ?? carrier.billingIncrementSeconds,
      minimumBillableSeconds: input.minimumBillableSeconds ?? carrier.minimumBillableSeconds,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      effectiveTo: input.effectiveTo ?? null,
      priority: input.priority ?? 0,
      enabled: input.enabled ?? true,
    },
  });

  await audit(ctx, 'CARRIER_RATE_CREATED', 'CarrierRate', rate.id, {
    carrierId,
    prefix: rate.prefix,
    destinationType: rate.destinationType,
    rate: rate.rate.toString(),
  });

  return rate;
}

export async function updateCarrierRate(
  ctx: AuthenticatedContext,
  rateId: string,
  input: UpdateCarrierRateInput
) {
  const rate = await getCarrierRate(ctx, rateId);
  if (!rate) throw new CarrierAuthorizationError('Rate not found');

  const data: Prisma.CarrierRateUpdateInput = {};
  if (input.prefix !== undefined) data.prefix = stripPrefix(input.prefix);
  if (input.country !== undefined) data.country = input.country?.toUpperCase() ?? null;
  if (input.destinationType !== undefined) data.destinationType = input.destinationType;
  if (input.rate !== undefined) data.rate = new Prisma.Decimal(input.rate.toString());
  if (input.billingIncrementSeconds !== undefined)
    data.billingIncrementSeconds = input.billingIncrementSeconds;
  if (input.minimumBillableSeconds !== undefined)
    data.minimumBillableSeconds = input.minimumBillableSeconds;
  if (input.effectiveFrom !== undefined) data.effectiveFrom = input.effectiveFrom;
  if (input.effectiveTo !== undefined) data.effectiveTo = input.effectiveTo ?? null;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  const updated = await prisma.carrierRate.update({ where: { id: rateId }, data });

  await audit(ctx, 'CARRIER_RATE_UPDATED', 'CarrierRate', updated.id, {
    carrierId: updated.carrierId,
    changes: Object.keys(input),
  });

  return updated;
}

export async function disableCarrierRate(ctx: AuthenticatedContext, rateId: string) {
  return updateCarrierRate(ctx, rateId, { enabled: false });
}

export async function createCarrierCliProfile(
  ctx: AuthenticatedContext,
  carrierId: string,
  input: CreateCarrierCliProfileInput
) {
  const carrier = await getCarrier(ctx, carrierId);
  if (!carrier) throw new CarrierAuthorizationError('Carrier not found');

  const profile = await prisma.carrierCliProfile.create({
    data: {
      carrierId,
      name: input.name,
      defaultCli: input.defaultCli ?? null,
    },
  });

  await audit(ctx, 'CARRIER_CLI_UPDATED', 'CarrierCliProfile', profile.id, {
    carrierId,
    action: 'profile_created',
  });

  return profile;
}

export async function addCarrierCliEntry(
  ctx: AuthenticatedContext,
  cliProfileId: string,
  input: CreateCarrierCliEntryInput
) {
  const profile = await prisma.carrierCliProfile.findUnique({
    where: { id: cliProfileId },
    include: { carrier: true },
  });
  if (!profile) throw new CarrierAuthorizationError('CLI profile not found');
  assertCanManageCarrier(ctx, profile.carrier);

  const entry = await prisma.carrierCliEntry.create({
    data: {
      cliProfileId,
      number: input.number,
      allowedCountries: input.allowedCountries ?? [],
    },
  });

  await audit(ctx, 'CARRIER_CLI_UPDATED', 'CarrierCliEntry', entry.id, {
    cliProfileId,
    action: 'entry_added',
  });

  return entry;
}

function stripPrefix(prefix: string): string {
  return prefix.replace(/\+/g, '').replace(/\s/g, '');
}

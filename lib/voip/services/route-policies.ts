import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { DestinationType } from '@/lib/voip/constants';
import { hasPermission } from '@/lib/rbac/authorization';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { audit } from './audit';

export class RoutePolicyAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutePolicyAuthorizationError';
  }
}

export interface CreateRoutePolicyInput {
  organizationId?: string | null;
  countryIso: string;
  destinationType: DestinationType;
  carrierId: string;
  priority?: number;
  enabled?: boolean;
  maxCpsOverride?: number | null;
  maxChannelsOverride?: number | null;
  cliProfileId?: string | null;
}

export interface UpdateRoutePolicyInput {
  countryIso?: string;
  destinationType?: DestinationType;
  carrierId?: string;
  priority?: number;
  enabled?: boolean;
  maxCpsOverride?: number | null;
  maxChannelsOverride?: number | null;
  cliProfileId?: string | null;
}

const policyInclude = {
  carrier: true,
  cliProfile: true,
} as const satisfies Prisma.CarrierRoutePolicyInclude;

function assertRoutePermission(ctx: AuthenticatedContext, action: 'read' | 'write' | 'delete') {
  if (
    !ctx.user.isSuperAdmin &&
    !hasPermission(ctx, 'carrier-route', action) &&
    !hasPermission(ctx, 'carrier-route', 'manage')
  ) {
    throw new RoutePolicyAuthorizationError('Forbidden');
  }
}

function assertOrganizationAccess(ctx: AuthenticatedContext, organizationId: string | null) {
  if (ctx.user.isSuperAdmin || organizationId === null) return;
  if (ctx.organization?.id !== organizationId) {
    throw new RoutePolicyAuthorizationError('Forbidden');
  }
}

function normalizeCountryIso(countryIso: string): string {
  const normalized = countryIso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new RoutePolicyAuthorizationError('Country must be an ISO-3166-1 alpha-2 code');
  }
  return normalized;
}

function normalizeDestinationType(value: DestinationType): DestinationType {
  if (!Object.values(DestinationType).includes(value)) {
    throw new RoutePolicyAuthorizationError('Invalid destination type');
  }
  return value;
}

function validateNonNegativeInteger(value: number | null | undefined, field: string) {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new RoutePolicyAuthorizationError(`${field} must be a non-negative integer`);
  }
}

async function validateReferences(input: {
  organizationId: string | null;
  carrierId: string;
  cliProfileId?: string | null;
}) {
  const carrier = await prisma.carrier.findUnique({ where: { id: input.carrierId } });
  if (!carrier) throw new RoutePolicyAuthorizationError('Carrier not found');
  if (input.organizationId === null && carrier.organizationId !== null) {
    throw new RoutePolicyAuthorizationError('Platform policies require a platform carrier');
  }
  if (
    input.organizationId !== null &&
    carrier.organizationId !== null &&
    carrier.organizationId !== input.organizationId
  ) {
    throw new RoutePolicyAuthorizationError('Carrier belongs to another organization');
  }

  if (input.cliProfileId) {
    const cliProfile = await prisma.carrierCliProfile.findUnique({
      where: { id: input.cliProfileId },
    });
    if (!cliProfile || cliProfile.carrierId !== input.carrierId) {
      throw new RoutePolicyAuthorizationError(
        'CLI profile does not belong to the selected carrier'
      );
    }
  }
}

export async function listRoutePolicies(
  ctx: AuthenticatedContext,
  options?: { organizationId?: string | null }
) {
  assertRoutePermission(ctx, 'read');
  const requestedOrganization = options?.organizationId;
  if (requestedOrganization !== undefined) {
    assertOrganizationAccess(ctx, requestedOrganization);
  }

  const where: Prisma.CarrierRoutePolicyWhereInput = {};
  if (ctx.user.isSuperAdmin) {
    if (requestedOrganization !== undefined) where.organizationId = requestedOrganization;
  } else if (requestedOrganization !== undefined) {
    where.organizationId = requestedOrganization;
  } else {
    where.OR = [{ organizationId: null }, { organizationId: ctx.organization?.id ?? '' }];
  }

  return prisma.carrierRoutePolicy.findMany({
    where,
    include: policyInclude,
    orderBy: [
      { countryIso: 'asc' },
      { destinationType: 'asc' },
      { priority: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });
}

export async function getRoutePolicy(ctx: AuthenticatedContext, id: string) {
  assertRoutePermission(ctx, 'read');
  const policy = await prisma.carrierRoutePolicy.findUnique({
    where: { id },
    include: policyInclude,
  });
  if (!policy) return null;
  assertOrganizationAccess(ctx, policy.organizationId);
  return policy;
}

export async function createRoutePolicy(ctx: AuthenticatedContext, input: CreateRoutePolicyInput) {
  assertRoutePermission(ctx, 'write');
  const organizationId = input.organizationId ?? null;
  assertOrganizationAccess(ctx, organizationId);
  validateNonNegativeInteger(input.priority ?? 100, 'priority');
  validateNonNegativeInteger(input.maxCpsOverride, 'maxCpsOverride');
  validateNonNegativeInteger(input.maxChannelsOverride, 'maxChannelsOverride');
  const countryIso = normalizeCountryIso(input.countryIso);
  const destinationType = normalizeDestinationType(input.destinationType);
  await validateReferences({
    organizationId,
    carrierId: input.carrierId,
    cliProfileId: input.cliProfileId,
  });

  const existing = await prisma.carrierRoutePolicy.findFirst({
    where: {
      organizationId,
      countryIso,
      destinationType,
      carrierId: input.carrierId,
    },
    select: { id: true },
  });
  if (existing) {
    throw new RoutePolicyAuthorizationError('Route policy already exists');
  }

  const policy = await prisma.carrierRoutePolicy.create({
    data: {
      organizationId,
      countryIso,
      destinationType,
      carrierId: input.carrierId,
      priority: input.priority ?? 100,
      enabled: input.enabled ?? true,
      maxCpsOverride: input.maxCpsOverride ?? null,
      maxChannelsOverride: input.maxChannelsOverride ?? null,
      cliProfileId: input.cliProfileId ?? null,
    },
    include: policyInclude,
  });

  await audit(ctx, 'CARRIER_ROUTE_POLICY_CREATED', 'CarrierRoutePolicy', policy.id, {
    organizationId,
    countryIso,
    destinationType: policy.destinationType,
    carrierId: policy.carrierId,
    priority: policy.priority,
  });
  return policy;
}

export async function updateRoutePolicy(
  ctx: AuthenticatedContext,
  id: string,
  input: UpdateRoutePolicyInput
) {
  assertRoutePermission(ctx, 'write');
  const existing = await prisma.carrierRoutePolicy.findUnique({ where: { id } });
  if (!existing) throw new RoutePolicyAuthorizationError('Route policy not found');
  assertOrganizationAccess(ctx, existing.organizationId);
  validateNonNegativeInteger(input.priority, 'priority');
  validateNonNegativeInteger(input.maxCpsOverride, 'maxCpsOverride');
  validateNonNegativeInteger(input.maxChannelsOverride, 'maxChannelsOverride');

  const carrierId = input.carrierId ?? existing.carrierId;
  const cliProfileId =
    input.cliProfileId === undefined ? existing.cliProfileId : input.cliProfileId;
  await validateReferences({
    organizationId: existing.organizationId,
    carrierId,
    cliProfileId,
  });
  const countryIso =
    input.countryIso === undefined ? existing.countryIso : normalizeCountryIso(input.countryIso);
  const destinationType =
    input.destinationType === undefined
      ? existing.destinationType
      : normalizeDestinationType(input.destinationType);
  const duplicate = await prisma.carrierRoutePolicy.findFirst({
    where: {
      id: { not: id },
      organizationId: existing.organizationId,
      countryIso,
      destinationType,
      carrierId,
    },
    select: { id: true },
  });
  if (duplicate) throw new RoutePolicyAuthorizationError('Route policy already exists');

  const data: Prisma.CarrierRoutePolicyUpdateInput = {};
  if (input.countryIso !== undefined) data.countryIso = countryIso;
  if (input.destinationType !== undefined) data.destinationType = destinationType;
  if (input.carrierId !== undefined) data.carrier = { connect: { id: input.carrierId } };
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.maxCpsOverride !== undefined) data.maxCpsOverride = input.maxCpsOverride;
  if (input.maxChannelsOverride !== undefined) data.maxChannelsOverride = input.maxChannelsOverride;
  if (input.cliProfileId !== undefined) {
    data.cliProfile = input.cliProfileId
      ? { connect: { id: input.cliProfileId } }
      : { disconnect: true };
  }

  const policy = await prisma.carrierRoutePolicy.update({
    where: { id },
    data,
    include: policyInclude,
  });
  await audit(ctx, 'CARRIER_ROUTE_POLICY_UPDATED', 'CarrierRoutePolicy', policy.id, {
    changes: Object.keys(input),
  });
  return policy;
}

export async function disableRoutePolicy(ctx: AuthenticatedContext, id: string) {
  return updateRoutePolicy(ctx, id, { enabled: false });
}

export async function findApplicableRoutePolicies(input: {
  organizationId: string;
  countryIso: string;
  destinationType: DestinationType;
}) {
  const countryIso = normalizeCountryIso(input.countryIso);
  const policies = await prisma.carrierRoutePolicy.findMany({
    where: {
      OR: [{ organizationId: input.organizationId }, { organizationId: null }],
      countryIso,
      enabled: true,
      destinationType: { in: [input.destinationType, DestinationType.ALL] },
      carrier: {
        enabled: true,
        status: { not: 'SUSPENDED' },
        OR: [{ organizationId: null }, { organizationId: input.organizationId }],
      },
    },
    include: policyInclude,
  });

  const eligible = policies.filter(
    (policy) =>
      policy.enabled &&
      policy.countryIso === countryIso &&
      (policy.destinationType === input.destinationType ||
        policy.destinationType === DestinationType.ALL) &&
      (policy.organizationId === null || policy.organizationId === input.organizationId) &&
      policy.carrier.enabled &&
      policy.carrier.status !== 'SUSPENDED' &&
      (policy.carrier.organizationId === null ||
        policy.carrier.organizationId === input.organizationId)
  );
  const tenantPolicies = eligible.filter(
    (policy) => policy.organizationId === input.organizationId
  );
  const applicable = tenantPolicies.length
    ? tenantPolicies
    : eligible.filter((policy) => policy.organizationId === null);

  return applicable.sort((a, b) => {
    const aExact = a.destinationType === input.destinationType ? 0 : 1;
    const bExact = b.destinationType === input.destinationType ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    if (a.priority !== b.priority) return a.priority - b.priority;
    const created = a.createdAt.getTime() - b.createdAt.getTime();
    return created || a.id.localeCompare(b.id);
  });
}

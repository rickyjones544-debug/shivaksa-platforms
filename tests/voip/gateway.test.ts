import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { POST as handleGatewayEvent } from '@/app/api/internal/gateway/events/route';
import { POST as handleHangup } from '@/app/api/internal/gateway/calls/[id]/hangup/route';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

import { reconcileCallBilling } from '@/lib/voip/services/calls';

vi.mock('@/lib/voip/services/calls', () => ({
  reconcileCallBilling: vi.fn(),
}));

function makeEventRequest(body: unknown, apiKey?: string) {
  return new NextRequest('http://localhost/api/internal/gateway/events', {
    method: 'POST',
    headers: apiKey ? { 'x-gateway-api-key': apiKey } : {},
    body: JSON.stringify({ organizationId: 'org-1', ...(body as object) }),
  });
}

function makeHangupRequest(id: string, body: unknown, apiKey?: string) {
  return new NextRequest(`http://localhost/api/internal/gateway/calls/${id}/hangup`, {
    method: 'POST',
    headers: apiKey ? { 'x-gateway-api-key': apiKey } : {},
    body: JSON.stringify({ organizationId: 'org-1', ...(body as object) }),
  });
}

function makeCallRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'call-1',
    gatewayCallId: 'gw-1',
    status: 'RINGING',
    billingProcessed: false,
    direction: 'OUTBOUND',
    reservationId: 'res-1',
    organizationId: 'org-1',
    customerRate: new Prisma.Decimal('0.05'),
    wholesaleRate: new Prisma.Decimal('0.018'),
    carrierRate: {
      rate: new Prisma.Decimal('0.018'),
      billingIncrementSeconds: 1,
      minimumBillableSeconds: 1,
    },
    durationSeconds: 0,
    answerTime: null,
    endTime: null,
    ...overrides,
  };
}

describe('Internal gateway events endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('rejects requests without an API key', async () => {
    const req = makeEventRequest({ gatewayCallId: 'gw-1', eventType: 'call.ringing' });
    const res = await handleGatewayEvent(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid API key', async () => {
    const req = makeEventRequest({ gatewayCallId: 'gw-1', eventType: 'call.ringing' }, 'wrong-key');
    const res = await handleGatewayEvent(req);
    expect(res.status).toBe(401);
  });

  it('accepts requests with the correct API key', async () => {
    const call = makeCallRecord();
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
      update: vi.fn().mockResolvedValue({ ...call, status: 'RINGING' }),
    };

    const req = makeEventRequest({ gatewayCallId: 'gw-1', eventType: 'call.ringing' }, 'gateway-secret');
    const res = await handleGatewayEvent(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('RINGING');
  });

  it('does not return the API key in a response', async () => {
    const call = makeCallRecord();
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
      update: vi.fn().mockResolvedValue(call),
    };

    const req = makeEventRequest({ gatewayCallId: 'gw-1', eventType: 'call.ringing' }, 'gateway-secret');
    const res = await handleGatewayEvent(req);
    const text = await res.text();
    expect(text).not.toContain('gateway-secret');
    expect(text).not.toContain('x-gateway-api-key');
  });

  it('updates call status for a ringing event', async () => {
    const call = makeCallRecord({ status: 'INITIATED' });
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
      update: vi.fn().mockResolvedValue({ ...call, status: 'RINGING' }),
    };

    const req = makeEventRequest({ gatewayCallId: 'gw-1', eventType: 'call.ringing' }, 'gateway-secret');
    const res = await handleGatewayEvent(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect((prisma as any).voipCall.update).toHaveBeenCalled();
  });

  it('returns 404 when the call is unknown', async () => {
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };

    const req = makeEventRequest({ gatewayCallId: 'missing', eventType: 'call.ringing' }, 'gateway-secret');
    const res = await handleGatewayEvent(req);
    expect(res.status).toBe(404);
  });

  it('rejects events missing required fields', async () => {
    const req = makeEventRequest({ eventType: 'call.ringing' }, 'gateway-secret');
    const res = await handleGatewayEvent(req);
    expect(res.status).toBe(400);
  });

  it('rejects cross-tenant event updates', async () => {
    const call = makeCallRecord();
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
      update: vi.fn().mockResolvedValue(call),
    };

    const req = makeEventRequest(
      { gatewayCallId: 'gw-1', eventType: 'call.ringing', organizationId: 'org-2' },
      'gateway-secret'
    );
    const res = await handleGatewayEvent(req);
    expect(res.status).toBe(403);
  });

  it('is idempotent for final events and bills only once', async () => {
    const call = makeCallRecord({ status: 'ANSWERED', answerTime: new Date() });
    (prisma as any).voipCall = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(call)
        .mockResolvedValueOnce({ ...call, billingProcessed: true }),
      update: vi.fn().mockImplementation((args) => ({ ...call, ...args.data })),
    };

    const req = makeEventRequest(
      { gatewayCallId: 'gw-1', eventType: 'call.completed', durationSeconds: 60 },
      'gateway-secret'
    );

    await handleGatewayEvent(req);
    await handleGatewayEvent(req);

    expect(reconcileCallBilling).toHaveBeenCalledTimes(1);
  });

  it('does not bill for non-final duplicate events', async () => {
    const call = makeCallRecord();
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
      update: vi.fn().mockResolvedValue(call),
    };

    const req = makeEventRequest(
      { gatewayCallId: 'gw-1', eventType: 'call.ringing' },
      'gateway-secret'
    );

    await handleGatewayEvent(req);
    await handleGatewayEvent(req);

    expect(reconcileCallBilling).not.toHaveBeenCalled();
  });
});

describe('Internal gateway hangup endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GATEWAY_API_KEY', 'gateway-secret');
  });

  it('rejects hangup without an API key', async () => {
    const req = makeHangupRequest('gw-1', {});
    const res = await handleHangup(req, { params: Promise.resolve({ id: 'gw-1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant hangup attempts', async () => {
    const call = makeCallRecord();
    (prisma as any).voipCall = {
      findFirst: vi.fn().mockResolvedValue(call),
    };

    const req = makeHangupRequest('gw-1', { organizationId: 'org-2' }, 'gateway-secret');
    const res = await handleHangup(req, { params: Promise.resolve({ id: 'gw-1' }) });
    expect(res.status).toBe(403);
  });
});

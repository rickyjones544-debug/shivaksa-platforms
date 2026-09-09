import { createPublicKey, verify } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  type VoipProvider,
  type OutboundCallInput,
  type ProviderCallResult,
  type ProviderCall,
  type ProviderWebhookResult,
  type ProviderWebhookEvent,
  type SipConnectionInput,
  type SipConnectionResult,
  type NumberAssignmentInput,
} from './interface';
import { toDecimal } from '@/lib/voip/services/billing';
import { CallStatus } from '@/lib/voip/constants';

const TELNYX_WEBHOOK_TOLERANCE_SECONDS = 300;

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

function getApiKey(): string {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error('TELNYX_API_KEY is not configured');
  return key;
}

function getDefaultConnectionId(): string | undefined {
  return process.env.TELNYX_CONNECTION_ID;
}

interface TelnyxResponse<T = unknown> {
  data?: T;
  errors?: Array<{ detail: string; title?: string }>;
}

async function telnyxRequest<T>(path: string, options: RequestInit): Promise<TelnyxResponse<T>> {
  const url = `${TELNYX_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as TelnyxResponse<T>;

  if (!response.ok) {
    const detail = body?.errors?.[0]?.detail || `Telnyx API error ${response.status}`;
    throw new Error(detail);
  }

  return body;
}

function normalizeStatus(eventType: string, rawStatus?: string): string {
  const status = rawStatus?.toLowerCase();
  switch (eventType) {
    case 'call.initiated':
      return CallStatus.INITIATED;
    case 'call.answered':
      return CallStatus.ANSWERED;
    case 'call.hangup':
      if (status === 'failed') return CallStatus.FAILED;
      if (status === 'busy') return CallStatus.BUSY;
      if (status === 'no_answer') return CallStatus.NO_ANSWER;
      return CallStatus.COMPLETED;
    case 'call.failed':
      return CallStatus.FAILED;
    case 'call.busy':
      return CallStatus.BUSY;
    case 'call.no_answer':
      return CallStatus.NO_ANSWER;
    default:
      return CallStatus.INITIATED;
  }
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value === 'string' && value) return new Date(value);
  return undefined;
}

function parseDuration(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : Math.round(parsed);
  }
  return undefined;
}

function parseCost(value: unknown): Prisma.Decimal | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return toDecimal(value.toString());
  if (typeof value === 'string' && value) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return undefined;
    return toDecimal(value);
  }
  return undefined;
}

export class TelnyxProvider implements VoipProvider {
  name = 'telnyx';

  async createOutboundCall(input: OutboundCallInput): Promise<ProviderCallResult> {
    const connectionId = input.providerConnectionId || getDefaultConnectionId();
    if (!connectionId) {
      throw new Error('No Telnyx connection_id available for outbound call');
    }

    const payload: Record<string, unknown> = {
      connection_id: connectionId,
      to: input.to,
      from: input.from,
      caller_id_number: input.callerId || input.from,
      time_limit: input.maxDurationSeconds,
      webhook_url: input.webhookUrl,
    };

    if (input.clientState) {
      payload.client_state = input.clientState;
    }

    const response = await telnyxRequest<{ call_control_id: string; call_session_id?: string; call_leg_id?: string; call_status?: string }>(
      '/calls',
      {
        method: 'POST',
        body: JSON.stringify({ data: payload }),
      }
    );

    const data = response.data;
    if (!data?.call_control_id) {
      throw new Error('Telnyx response missing call_control_id');
    }

    return {
      providerCallId: data.call_control_id,
      callSessionId: data.call_session_id,
      callLegId: data.call_leg_id,
      status: data.call_status,
      rawResponse: response,
    };
  }

  async getCall(providerCallId: string): Promise<ProviderCall | null> {
    // Telnyx does not expose a stable GET call endpoint in the public API.
    // Call state is reconciled through webhooks.
    void providerCallId;
    return null;
  }

  async hangupCall(providerCallId: string): Promise<void> {
    await telnyxRequest(`/calls/${providerCallId}/actions/hangup`, {
      method: 'POST',
      body: JSON.stringify({ data: {} }),
    });
  }

  async handleWebhook(rawBody: string, signature: string, timestamp: string): Promise<ProviderWebhookResult> {
    const publicKey = process.env.TELNYX_PUBLIC_KEY;
    if (!publicKey) {
      return { processed: false, providerEventId: '', error: 'TELNYX_PUBLIC_KEY is not configured' };
    }

    if (!signature) {
      return { processed: false, providerEventId: '', error: 'Missing webhook signature' };
    }

    if (!timestamp) {
      return { processed: false, providerEventId: '', error: 'Missing webhook timestamp' };
    }

    try {
      verifyTelnyxWebhook(rawBody, timestamp, signature, publicKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook signature verification failed';
      return { processed: false, providerEventId: '', error: message };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { processed: false, providerEventId: '', error: 'Malformed webhook body' };
    }

    const event = parseTelnyxEvent(payload);
    if (!event) {
      return { processed: false, providerEventId: '', error: 'Unrecognized webhook payload' };
    }

    return { processed: true, providerEventId: event.providerEventId, event };
  }

  async createSipConnection(input: SipConnectionInput): Promise<SipConnectionResult> {
    const payload: Record<string, unknown> = {
      user_name: input.username,
      password: input.password,
      active: true,
      connection_name: input.name || `Shivaksa SIP ${input.username}`,
    };

    if (process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID) {
      payload.outbound_voice_profile_id = process.env.TELNYX_OUTBOUND_VOICE_PROFILE_ID;
    }

    const response = await telnyxRequest<{ id: string; user_name: string; active?: boolean }>(
      '/credential_connections',
      {
        method: 'POST',
        body: JSON.stringify({ data: payload }),
      }
    );

    if (!response.data?.id) {
      throw new Error('Telnyx response missing credential connection id');
    }

    return {
      providerConnectionId: response.data.id,
      username: response.data.user_name || input.username,
      status: response.data.active ? 'active' : 'inactive',
      rawResponse: response,
    };
  }

  async assignNumberToConnection(input: NumberAssignmentInput): Promise<void> {
    await telnyxRequest(`/phone_numbers/${input.providerNumberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: { connection_id: input.providerConnectionId } }),
    });
  }
}

function parseTelnyxEvent(payload: unknown): ProviderWebhookEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const eventId = typeof data.id === 'string' ? data.id : 'unknown';
  const eventType = typeof data.event_type === 'string' ? data.event_type : '';
  const inner = (data.payload as Record<string, unknown>) || {};

  const providerCallId =
    typeof inner.call_control_id === 'string' ? inner.call_control_id : undefined;

  const rawStatus = typeof inner.call_status === 'string' ? inner.call_status : undefined;
  const status = normalizeStatus(eventType, rawStatus);

  const direction =
    typeof inner.direction === 'string' ? inner.direction.toUpperCase() : undefined;

  return {
    providerEventId: eventId,
    eventType,
    providerCallId,
    callStatus: status,
    from: typeof inner.from === 'string' ? inner.from : undefined,
    to: typeof inner.to === 'string' ? inner.to : undefined,
    direction,
    durationSeconds: parseDuration(inner.duration),
    startTime: parseDate(inner.start_time),
    answerTime: parseDate(inner.answer_time),
    endTime: parseDate(inner.end_time),
    wholesaleCost: parseCost(inner.cost),
    failureReason: typeof inner.failure_reason === 'string' ? inner.failure_reason : undefined,
    rawPayload: payload,
  };
}

export function createTelnyxProvider(): VoipProvider {
  return new TelnyxProvider();
}

export function verifyTelnyxWebhook(
  rawBody: string,
  timestamp: string,
  signatureB64: string,
  publicKeyB64: string
): void {
  const ts = timestamp.trim();
  if (!ts || !/^\d+$/.test(ts)) {
    throw new Error('Invalid or missing webhook timestamp');
  }

  const timestampSeconds = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > TELNYX_WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  if (!signatureB64 || !signatureB64.trim()) {
    throw new Error('Missing webhook signature');
  }

  const publicKeyInput = publicKeyB64.trim().replace(/\s/g, '');
  const publicKeyBytes = Buffer.from(publicKeyInput, 'base64');
  if (publicKeyBytes.length !== 32) {
    throw new Error('Invalid Telnyx public key length');
  }

  const signatureInput = signatureB64.trim();
  const signature = Buffer.from(signatureInput, 'base64');
  if (signature.length !== 64) {
    throw new Error('Invalid Telnyx signature length');
  }

  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    x: publicKeyBytes.toString('base64url'),
  };

  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw new Error('Invalid Telnyx public key');
  }

  const message = Buffer.from(`${ts}|${rawBody}`, 'utf8');
  const valid = verify(null, message, publicKey, signature);
  if (!valid) {
    throw new Error('Invalid webhook signature');
  }
}

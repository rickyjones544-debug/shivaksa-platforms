import type { Prisma } from '@prisma/client';
import type { Carrier, CarrierRate } from '@prisma/client';

export interface OutboundCallInput {
  providerConnectionId: string;
  from: string;
  to: string;
  callerId?: string;
  webhookUrl: string;
  maxDurationSeconds: number;
  clientState?: string;
  organizationId?: string;
  // Multi-carrier routing context (optional; API providers such as Telnyx ignore these).
  carrier?: Carrier;
  carrierRate?: CarrierRate;
  dialString?: string;
  gatewayCallId?: string;
}

export interface ProviderCallResult {
  providerCallId: string;
  callSessionId?: string;
  callLegId?: string;
  status?: string;
  rawResponse?: unknown;
}

export interface ProviderCall {
  providerCallId: string;
  status: string;
  direction?: string;
  from?: string;
  to?: string;
  durationSeconds?: number;
  startTime?: Date;
  answerTime?: Date;
  endTime?: Date;
  rawResponse?: unknown;
}

export interface ProviderWebhookEvent {
  providerEventId: string;
  eventType: string;
  providerCallId?: string;
  callStatus?: string;
  from?: string;
  to?: string;
  direction?: string;
  durationSeconds?: number;
  startTime?: Date;
  answerTime?: Date;
  endTime?: Date;
  wholesaleCost?: Prisma.Decimal;
  failureReason?: string;
  rawPayload: unknown;
}

export interface ProviderWebhookResult {
  processed: boolean;
  providerEventId: string;
  callId?: string;
  event?: ProviderWebhookEvent;
  error?: string;
}

export interface SipConnectionInput {
  username: string;
  password: string;
  name?: string;
}

export interface SipConnectionResult {
  providerConnectionId: string;
  username: string;
  status?: string;
  rawResponse?: unknown;
}

export interface NumberAssignmentInput {
  providerNumberId: string;
  providerConnectionId: string;
}

export interface VoipProvider {
  name: string;
  createOutboundCall(input: OutboundCallInput): Promise<ProviderCallResult>;
  getCall(providerCallId: string): Promise<ProviderCall | null>;
  hangupCall(providerCallId: string, organizationId?: string): Promise<void>;
  handleWebhook(rawBody: string, signature: string, timestamp: string): Promise<ProviderWebhookResult>;
  createSipConnection?(input: SipConnectionInput): Promise<SipConnectionResult>;
  assignNumberToConnection?(input: NumberAssignmentInput): Promise<void>;
}

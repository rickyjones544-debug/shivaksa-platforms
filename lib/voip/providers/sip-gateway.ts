import {
  type VoipProvider,
  type OutboundCallInput,
  type ProviderCallResult,
  type ProviderCall,
  type ProviderWebhookResult,
} from './interface';

function getGatewayApiKey(): string {
  const key = process.env.GATEWAY_API_KEY;
  if (!key) throw new Error('GATEWAY_API_KEY is not configured');
  return key;
}

function getApplicationUrl(): string {
  return process.env.APPLICATION_URL || 'http://localhost:3000';
}

/**
 * SIP gateway provider adapter.
 *
 * This provider does NOT implement SIP/RTP. It communicates with the separate
 * Asterisk + PJSIP gateway over an internal authenticated HTTP API.
 *
 * Phase 2B: the gateway call endpoint returns a generated call id without an
 * actual Asterisk connection, so the architecture and API contract are defined
 * before Asterisk is installed.
 */
export class SipGatewayProvider implements VoipProvider {
  name = 'sip-gateway';

  async createOutboundCall(input: OutboundCallInput): Promise<ProviderCallResult> {
    const url = `${getApplicationUrl()}/api/internal/gateway/calls`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-api-key': getGatewayApiKey(),
      },
      body: JSON.stringify({
        callId: input.clientState,
        organizationId: input.organizationId,
        carrierCode: input.carrier?.code,
        carrierId: input.carrier?.id,
        dialString: input.dialString,
        from: input.from,
        to: input.to,
        callerId: input.callerId,
        maxDurationSeconds: input.maxDurationSeconds,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `SIP gateway returned ${response.status}`);
    }

    const body = (await response.json()) as {
      data?: { gatewayCallId?: string; accepted?: boolean };
    };
    if (!body.data?.gatewayCallId) {
      throw new Error('SIP gateway response missing gatewayCallId');
    }

    return {
      providerCallId: body.data.gatewayCallId,
      status: 'initiated',
      rawResponse: body.data,
    };
  }

  async getCall(providerCallId: string): Promise<ProviderCall | null> {
    void providerCallId;
    // Call state is reconciled through the internal gateway events endpoint.
    return null;
  }

  async hangupCall(providerCallId: string, organizationId?: string): Promise<void> {
    const url = `${getApplicationUrl()}/api/internal/gateway/calls/${providerCallId}/hangup`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-api-key': getGatewayApiKey(),
      },
      body: JSON.stringify({ organizationId }),
    });
    if (!response.ok) {
      throw new Error(`SIP gateway returned ${response.status}`);
    }
  }

  async handleWebhook(): Promise<ProviderWebhookResult> {
    // Webhooks are not used; events arrive via the authenticated internal API.
    return {
      processed: false,
      providerEventId: '',
      error: 'SIP gateway events use the internal gateway API',
    };
  }
}

export function createSipGatewayProvider(): VoipProvider {
  return new SipGatewayProvider();
}

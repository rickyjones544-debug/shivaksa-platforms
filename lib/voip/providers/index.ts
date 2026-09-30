import type { Carrier } from '@prisma/client';
import { CarrierType } from '@/lib/voip/constants';
import { type VoipProvider } from './interface';
import { createTelnyxProvider } from './telnyx';
import { createSipGatewayProvider } from './sip-gateway';

export function getProvider(name?: string): VoipProvider {
  const providerName = (name || 'telnyx').toLowerCase();
  if (providerName === 'telnyx') return createTelnyxProvider();
  throw new Error(`Unsupported VoIP provider: ${providerName}`);
}

export function getProviderForCarrier(carrier: Carrier): VoipProvider {
  if (carrier.type === CarrierType.API) {
    return createTelnyxProvider();
  }
  if (carrier.type === CarrierType.SIP_GATEWAY) {
    return createSipGatewayProvider();
  }
  throw new Error(`Unsupported carrier type: ${carrier.type}`);
}

export * from './interface';

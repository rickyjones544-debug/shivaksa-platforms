import { type VoipProvider } from './interface';
import { createTelnyxProvider } from './telnyx';

export function getProvider(name?: string): VoipProvider {
  const providerName = (name || 'telnyx').toLowerCase();
  if (providerName === 'telnyx') return createTelnyxProvider();
  throw new Error(`Unsupported VoIP provider: ${providerName}`);
}

export * from './interface';

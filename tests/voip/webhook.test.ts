import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync, sign } from 'crypto';
import { verifyTelnyxWebhook, TelnyxProvider } from '../../lib/voip/providers/telnyx';

function base64PublicKeyFromJwk(jwk: JsonWebKey): string {
  if (!jwk.x) throw new Error('Missing Ed25519 public key coordinate');
  return Buffer.from(jwk.x, 'base64url').toString('base64');
}

function createTestPayload(): string {
  return JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt_123',
      payload: {
        call_control_id: 'cc-1',
        call_status: 'completed',
        from: '+15551234567',
        to: '+15559876543',
      },
    },
  });
}

describe('Telnyx webhook signature verification', () => {
  const keyPair = generateKeyPairSync('ed25519');
  const jwk = keyPair.publicKey.export({ format: 'jwk' });
  const publicKeyB64 = base64PublicKeyFromJwk(jwk);
  const rawBody = createTestPayload();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = Buffer.from(`${timestamp}|${rawBody}`, 'utf8');
  const signature = sign(null, message, keyPair.privateKey);
  const signatureB64 = signature.toString('base64');

  beforeAll(() => {
    process.env.TELNYX_PUBLIC_KEY = publicKeyB64;
  });

  afterAll(() => {
    delete process.env.TELNYX_PUBLIC_KEY;
  });

  it('accepts a valid signature', () => {
    expect(() => verifyTelnyxWebhook(rawBody, timestamp, signatureB64, publicKeyB64)).not.toThrow();
  });

  it('rejects an invalid signature', () => {
    const badSig = Buffer.alloc(64, 0).toString('base64');
    expect(() => verifyTelnyxWebhook(rawBody, timestamp, badSig, publicKeyB64)).toThrow(
      'Invalid webhook signature'
    );
  });

  it('rejects a missing signature', () => {
    expect(() => verifyTelnyxWebhook(rawBody, timestamp, '', publicKeyB64)).toThrow(
      'Missing webhook signature'
    );
  });

  it('rejects a missing timestamp', () => {
    expect(() => verifyTelnyxWebhook(rawBody, '', signatureB64, publicKeyB64)).toThrow(
      'Invalid or missing webhook timestamp'
    );
  });

  it('rejects a malformed signature', () => {
    expect(() => verifyTelnyxWebhook(rawBody, timestamp, 'not-base64', publicKeyB64)).toThrow();
  });

  it('rejects an expired timestamp', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 1000).toString();
    const oldMessage = Buffer.from(`${oldTimestamp}|${rawBody}`, 'utf8');
    const oldSignature = sign(null, oldMessage, keyPair.privateKey).toString('base64');
    expect(() =>
      verifyTelnyxWebhook(rawBody, oldTimestamp, oldSignature, publicKeyB64)
    ).toThrow('Webhook timestamp outside tolerance');
  });

  it('handleWebhook rejects missing public key', async () => {
    const saved = process.env.TELNYX_PUBLIC_KEY;
    delete process.env.TELNYX_PUBLIC_KEY;
    const provider = new TelnyxProvider();
    const result = await provider.handleWebhook(rawBody, signatureB64, timestamp);
    expect(result.processed).toBe(false);
    expect(result.error).toContain('TELNYX_PUBLIC_KEY');
    process.env.TELNYX_PUBLIC_KEY = saved;
  });

  it('handleWebhook processes a valid signed event', async () => {
    const provider = new TelnyxProvider();
    const result = await provider.handleWebhook(rawBody, signatureB64, timestamp);
    expect(result.processed).toBe(true);
    expect(result.providerEventId).toBe('evt_123');
  });
});

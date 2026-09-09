import { NextRequest, NextResponse } from 'next/server';
import { handleProviderWebhook } from '@/lib/voip/services/calls';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('telnyx-signature-ed25519') ?? '';
    const timestamp = request.headers.get('telnyx-timestamp') ?? '';

    const result = await handleProviderWebhook(rawBody, signature, timestamp);

    if (!result.processed) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, providerEventId: result.providerEventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[Telnyx webhook] Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

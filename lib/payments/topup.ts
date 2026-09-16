import { addCredit } from '@/lib/voip/services/wallet';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';

// Wallet top-up abstraction.
//
// Phase 2B does NOT integrate a payment gateway. This function is the only
// safe entry point for crediting a wallet from a verified external payment.
// Callers must supply a payment-provider reference that uniquely identifies the
// payment; this reference is used as an idempotency key so the same payment
// cannot credit the wallet twice.
//
// In later phases this function will be invoked by:
//   - Stripe/webhook handlers
//   - Bank-transfer reconciliation jobs
//   - Other approved payment-provider webhooks
//
// The browser must NEVER be allowed to call this directly or to claim
// "payment successful" and receive funds.

export async function processVerifiedTopUp(
  ctx: AuthenticatedContext | null,
  organizationId: string,
  amount: string | number,
  paymentReference: string,
  description = 'Wallet top-up'
) {
  if (!paymentReference || paymentReference.trim().length === 0) {
    throw new Error('A verified payment reference is required');
  }

  return addCredit(
    ctx,
    organizationId,
    amount,
    description,
    ctx?.user.id,
    `topup:${paymentReference}`
  );
}

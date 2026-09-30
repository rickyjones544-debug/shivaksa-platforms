import { withRateDeskAuth } from '../utils';
import { listProvidersForRateDesk } from '@/lib/rate-desk/services/rate-sheets';

export async function GET() {
  return withRateDeskAuth({
    action: 'read',
    handler: (ctx) => listProvidersForRateDesk(ctx),
  });
}

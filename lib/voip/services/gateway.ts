import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { CallStatus } from '@/lib/voip/constants';
import {
  authorizeGatewayCall,
  CallAuthorizationError,
} from './call-authorization';
import { InsufficientBalanceError, releaseReservation } from './wallet';
import { selectRoute, RoutingError } from './routing';

export interface GatewayAuthorizeInput {
  /** Digest-auth username = Asterisk endpoint name. Trusted identity. */
  username: string;
  /** Raw dialed digits from the customer. */
  destination: string;
  /** Asterisk channel name, e.g. PJSIP/shv_x-00000001 (for hangup). */
  channel?: string;
  /** Observed remote address of the customer (diagnostics only). */
  remoteAddress?: string;
}

export type GatewayAuthorizeResult =
  | {
      authorized: true;
      gatewayCallId: string;
      callId: string;
      organizationId: string;
      carrierEndpoint: string;
      dialString: string;
      callerId: string;
      maxDurationSeconds: number;
    }
  | { authorized: false; reason: string; hangupCause: number };

function rejection(reason: string, hangupCause = 21): GatewayAuthorizeResult {
  return { authorized: false, reason, hangupCause };
}

/**
 * Authorize + route a SIP-originated customer call.
 *
 * Called by the gateway AGI script before Asterisk dials the upstream carrier.
 * Runs the full server-side pipeline: account status, service suspension,
 * wallet/reservation, concurrency cap (advisory-locked), destination
 * normalization, route/carrier selection restricted to SIP_GATEWAY carriers,
 * and CLI policy via selectCallerId. The customer's From header never reaches
 * this path — the endpoint's auth username is the identity and the selected
 * callerId is policy-derived.
 */
export async function authorizeAndRouteGatewayCall(
  input: GatewayAuthorizeInput
): Promise<GatewayAuthorizeResult> {
  if (!input.username || !input.destination) {
    return rejection('Missing username or destination', 28);
  }

  try {
    const { authorization, sipAccount } = await authorizeGatewayCall(
      input.username,
      input.destination
    );

    const gatewayCallId = `gw_${randomUUID()}`;

    try {
      const route = await selectRoute({
        organizationId: sipAccount.organizationId,
        destination: input.destination,
        sipAccount,
        carrierType: 'SIP_GATEWAY',
      });

      const carrierEndpoint = route.carrier.gatewayEndpoint || route.carrier.code;

      await prisma.voipCall.update({
        where: { id: authorization.callId },
        data: {
          carrierId: route.carrier.id,
          carrierRateId: route.rate.id,
          normalizedDestination: route.normalized.digits,
          destinationCountry: route.normalized.countryIso,
          destinationType: route.normalized.destinationType,
          callerId: route.callerId,
          provider: route.carrier.code,
          wholesaleRate: route.rate.rate,
          gatewayCallId,
          startTime: new Date(),
          routingInfo: {
            gateway: 'asterisk',
            asteriskChannel: input.channel || null,
            remoteAddress: input.remoteAddress || null,
          },
        },
      });

      return {
        authorized: true,
        gatewayCallId,
        callId: authorization.callId,
        organizationId: sipAccount.organizationId,
        carrierEndpoint,
        dialString: route.dialString,
        callerId: route.callerId,
        maxDurationSeconds: authorization.maxDurationMinutes * 60,
      };
    } catch (routeError) {
      // Routing/carrier failure: release the reservation and mark the call
      // FAILED so billing reconciles it as a zero-charge failed call.
      await releaseReservation(authorization.reservationId);
      const reason =
        routeError instanceof RoutingError || routeError instanceof Error
          ? routeError.message
          : 'Routing failed';
      await prisma.voipCall.update({
        where: { id: authorization.callId },
        data: {
          gatewayCallId,
          status: CallStatus.FAILED,
          failureReason: reason,
          endTime: new Date(),
          durationSeconds: 0,
        },
      });
      return rejection(reason, 34);
    }
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return rejection('Insufficient balance', 21);
    }
    if (error instanceof CallAuthorizationError) {
      const isConcurrency = /concurrent/i.test(error.message);
      const isDestination = /destination|number/i.test(error.message) && !isConcurrency;
      return rejection(
        error.message,
        isConcurrency ? 17 : isDestination ? 28 : 21
      );
    }
    throw error;
  }
}

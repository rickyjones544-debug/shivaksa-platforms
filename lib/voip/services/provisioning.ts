import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

/**
 * Provisioning bridge between the platform and the on-VPS Asterisk gateway
 * agent.
 *
 * The platform NEVER connects to the VPS (no SSH, no AMI). Instead it writes
 * idempotent tasks to `provisioning_tasks`; the agent polls them over HTTPS
 * with `x-gateway-api-key`, applies them to the isolated
 * `pjsip_customer_platform.conf` include, reloads res_pjsip, and reports the
 * result back. SipAccount.provisioningState is the customer/admin-visible
 * state machine: PENDING -> PROVISIONED | FAILED.
 *
 * Credentials: the SIP plaintext password never leaves the platform database
 * in clear form. Endpoint auth is delivered to Asterisk as
 * md5(username:realm:password) (`auth_type=md5`), which is what Asterisk needs
 * for digest auth but is not usable to recover the plaintext.
 */

export const ProvisioningActions = {
  UPSERT_ENDPOINT: 'UPSERT_ENDPOINT',
  DISABLE_ENDPOINT: 'DISABLE_ENDPOINT',
  HANGUP_CALL: 'HANGUP_CALL',
} as const;

export const ProvisioningStates = {
  PENDING: 'PENDING',
  PROVISIONED: 'PROVISIONED',
  FAILED: 'FAILED',
} as const;

export const ProvisioningTaskStatuses = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;

const MAX_TASK_ATTEMPTS = 5;

export function getSipAuthRealm(): string {
  return process.env.ASTERISK_AUTH_REALM || 'asterisk';
}

export function computeSipAuthMd5(username: string, plaintextPassword: string): string {
  return createHash('md5')
    .update(`${username}:${getSipAuthRealm()}:${plaintextPassword}`)
    .digest('hex');
}

/**
 * Queue an idempotent endpoint upsert (create, re-enable, or credential
 * rotation). Applying the same upsert twice produces identical config.
 */
export async function queueEndpointUpsert(
  sipAccountId: string,
  input: { username: string; md5Cred: string; maxConcurrentCalls: number }
): Promise<void> {
  await prisma.$transaction([
    prisma.sipAccount.update({
      where: { id: sipAccountId },
      data: {
        provisioningState: ProvisioningStates.PENDING,
        asteriskEndpoint: input.username,
      },
    }),
    prisma.provisioningTask.create({
      data: {
        action: ProvisioningActions.UPSERT_ENDPOINT,
        sipAccountId,
        payload: {
          username: input.username,
          md5Cred: input.md5Cred,
          maxConcurrentCalls: input.maxConcurrentCalls,
        },
      },
    }),
  ]);
}

/**
 * Queue an idempotent endpoint disable. The agent removes the endpoint so the
 * credential stops authenticating; the SipAccount row is kept for re-enable.
 */
export async function queueEndpointDisable(
  sipAccountId: string,
  username: string
): Promise<void> {
  await prisma.$transaction([
    prisma.sipAccount.update({
      where: { id: sipAccountId },
      data: { provisioningState: ProvisioningStates.PENDING },
    }),
    prisma.provisioningTask.create({
      data: {
        action: ProvisioningActions.DISABLE_ENDPOINT,
        sipAccountId,
        payload: { username },
      },
    }),
  ]);
}

/** Queue a channel hangup for an in-progress gateway call. */
export async function queueCallHangup(callId: string, asteriskChannel: string): Promise<void> {
  await prisma.provisioningTask.create({
    data: {
      action: ProvisioningActions.HANGUP_CALL,
      callId,
      payload: { channel: asteriskChannel },
    },
  });
}

/**
 * Apply a task result reported by the gateway agent. Failed tasks are
 * re-queued up to MAX_TASK_ATTEMPTS, then marked FAILED and the owning SIP
 * account's provisioningState is set to FAILED so the error is visible to
 * operators instead of silently succeeding.
 */
export async function applyProvisioningResult(
  taskId: string,
  result: { ok: boolean; error?: string }
): Promise<{ applied: boolean }> {
  const task = await prisma.provisioningTask.findUnique({ where: { id: taskId } });
  if (!task || task.status === ProvisioningTaskStatuses.DONE) {
    return { applied: false };
  }

  if (result.ok) {
    await prisma.$transaction([
      prisma.provisioningTask.update({
        where: { id: task.id },
        data: {
          status: ProvisioningTaskStatuses.DONE,
          lastError: null,
          processedAt: new Date(),
        },
      }),
      ...(task.sipAccountId
        ? [
            prisma.sipAccount.update({
              where: { id: task.sipAccountId },
              data: {
                provisioningState: ProvisioningStates.PROVISIONED,
                provisioningError: null,
                provisionedAt: new Date(),
              },
            }),
          ]
        : []),
    ]);
    return { applied: true };
  }

  const error = (result.error || 'Gateway provisioning failed').slice(0, 500);
  const exhausted = task.attempts >= MAX_TASK_ATTEMPTS;

  await prisma.$transaction([
    prisma.provisioningTask.update({
      where: { id: task.id },
      data: {
        status: exhausted ? ProvisioningTaskStatuses.FAILED : ProvisioningTaskStatuses.PENDING,
        lastError: error,
      },
    }),
    ...(task.sipAccountId && exhausted
      ? [
          prisma.sipAccount.update({
            where: { id: task.sipAccountId },
            data: {
              provisioningState: ProvisioningStates.FAILED,
              provisioningError: error,
            },
          }),
        ]
      : []),
  ]);

  return { applied: !exhausted };
}

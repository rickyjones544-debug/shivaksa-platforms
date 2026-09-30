import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { selectCallerId, normalizeCallerId, CallerIdError } from '@/lib/voip/services/cli';
import { CliMode } from '@/lib/voip/constants';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const sipAccount = {
  id: 'sip-1',
  username: 'user1',
  callerId: '+15551234567',
};

function makeCarrier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    code: 'teloz',
    name: 'Teloz',
    type: 'SIP_GATEWAY',
    cliMode: CliMode.PASS_THROUGH,
    defaultCallerId: null,
    username: 'user1',
    ...overrides,
  };
}

describe('CLI selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PASS_THROUGH uses a valid supplied caller ID', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.PASS_THROUGH });
    const cli = await selectCallerId({
      carrier: carrier as any,
      sipAccount: sipAccount as any,
      suppliedCallerId: '+442071234567',
    });
    expect(cli).toBe('+442071234567');
  });

  it('PASS_THROUGH rejects an invalid supplied caller ID', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.PASS_THROUGH });
    await expect(
      selectCallerId({
        carrier: carrier as any,
        sipAccount: sipAccount as any,
        suppliedCallerId: 'not-a-number',
      })
    ).rejects.toThrow(CallerIdError);
  });

  it('FIXED uses the carrier default CLI when available', async () => {
    const carrier = makeCarrier({
      cliMode: CliMode.FIXED,
      defaultCallerId: '+306971234567',
    });
    const cli = await selectCallerId({
      carrier: carrier as any,
      sipAccount: sipAccount as any,
    });
    expect(cli).toBe('+306971234567');
  });

  it('FIXED rejects a SIP account caller ID that is not carrier-approved', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.FIXED });
    await expect(
      selectCallerId({
        carrier: carrier as any,
        sipAccount: sipAccount as any,
      })
    ).rejects.toThrow(CallerIdError);
  });

  it('throws when FIXED has no valid caller ID', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.FIXED });
    await expect(
      selectCallerId({
        carrier: carrier as any,
        sipAccount: { ...sipAccount, callerId: null } as any,
      })
    ).rejects.toThrow(CallerIdError);
  });

  it('POOL selects an approved CLI entry', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.POOL });

    (prisma as any).carrierCliProfile = {
      findFirst: vi.fn().mockResolvedValue({
        defaultCli: null,
        entries: [
          { number: '+306971234567', allowedCountries: ['GR'], enabled: true },
          { number: '+37061234567', allowedCountries: ['LT'], enabled: true },
        ],
      }),
    };

    const cli = await selectCallerId({
      carrier: carrier as any,
      sipAccount: sipAccount as any,
      destinationCountryIso: 'GR',
    });
    expect(cli).toBe('+306971234567');
  });

  it('POOL filters CLI entries by allowed countries', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.POOL });

    (prisma as any).carrierCliProfile = {
      findFirst: vi.fn().mockResolvedValue({
        defaultCli: null,
        entries: [
          { number: '+37061234567', allowedCountries: ['LT'], enabled: true },
        ],
      }),
    };

    // No matching pool entry; falls back to SIP account caller ID.
    await expect(
      selectCallerId({
        carrier: carrier as any,
        sipAccount: sipAccount as any,
        destinationCountryIso: 'GR',
      })
    ).rejects.toThrow(CallerIdError);
  });

  it('POOL uses defaultCli when entries do not match', async () => {
    const carrier = makeCarrier({ cliMode: CliMode.POOL });

    (prisma as any).carrierCliProfile = {
      findFirst: vi.fn().mockResolvedValue({
        defaultCli: '+306971234567',
        entries: [],
      }),
    };

    const cli = await selectCallerId({
      carrier: carrier as any,
      sipAccount: sipAccount as any,
      destinationCountryIso: 'GR',
    });
    expect(cli).toBe('+306971234567');
  });

  it('normalizes a raw caller ID to E.164', () => {
    expect(normalizeCallerId('+44 20 7123 4567')).toBe('+442071234567');
    expect(normalizeCallerId('not-a-number')).toBeNull();
  });
});

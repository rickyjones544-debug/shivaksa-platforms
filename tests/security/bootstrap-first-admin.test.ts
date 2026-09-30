import { beforeAll, describe, expect, it, vi } from 'vitest';

let BootstrapError: typeof Error;
let hashBootstrapToken: (token: string) => string;
let runBootstrap: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;

beforeAll(async () => {
  const modulePath = '../../scripts/bootstrap-first-admin.mjs';
  const bootstrap = await import(modulePath);
  BootstrapError = bootstrap.BootstrapError;
  hashBootstrapToken = bootstrap.hashBootstrapToken;
  runBootstrap = bootstrap.runBootstrap;
});

const token = 'one-time-bootstrap-token';
const password = 'Strong1!Password';

function environment(overrides: Record<string, string> = {}) {
  return {
    DATABASE_URL: 'postgresql://not-used-by-unit-tests',
    BOOTSTRAP_OWNER_EMAIL: 'owner@example.com',
    BOOTSTRAP_OWNER_NAME: 'Platform Owner',
    BOOTSTRAP_ORGANIZATION_NAME: 'Shivaksa Technologies',
    BOOTSTRAP_TOKEN_HASH: hashBootstrapToken(token),
    BOOTSTRAP_MARKER_PATH: '/secure/first-admin.completed',
    ...overrides,
  };
}

function superAdminRole() {
  return {
    id: 'role-super-admin',
    permissions: [
      'admin:manage',
      'organization:write',
      'membership:write',
      'voip:manage',
    ].map((key) => ({ permission: { key } })),
  };
}

function database(options: { userCount?: number; role?: unknown } = {}) {
  let createdUserCount = 0;
  const tx = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    user: {
      count: vi.fn().mockImplementation(() => Promise.resolve(createdUserCount || (options.userCount ?? 0))),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(() => {
        createdUserCount += 1;
        return Promise.resolve({ id: 'user-1' });
      }),
    },
    role: { findUnique: vi.fn().mockResolvedValue(options.role === undefined ? superAdminRole() : options.role) },
    organization: { create: vi.fn().mockResolvedValue({ id: 'org-1' }) },
    organizationMembership: { create: vi.fn().mockResolvedValue({ id: 'membership-1' }) },
  };
  const db = {
    user: {
      count: vi.fn().mockResolvedValue(options.userCount ?? 0),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    role: { findUnique: vi.fn().mockResolvedValue(options.role === undefined ? superAdminRole() : options.role) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { db, tx };
}

function options(overrides: Record<string, unknown> = {}) {
  const { db, tx } = database();
  return {
    env: environment(),
    execute: false,
    db,
    validateRegistration: vi.fn().mockReturnValue({ valid: true, errors: {} }),
    validatePasswordStrength: vi.fn().mockReturnValue({ valid: true }),
    hashPassword: vi.fn().mockResolvedValue('bcrypt-hash'),
    promptSecrets: vi.fn().mockResolvedValue({ token, password, confirmPassword: password }),
    markerExists: vi.fn().mockReturnValue(false),
    validateMarker: vi.fn(),
    writeMarker: vi.fn(),
    uid: 0,
    logger: { log: vi.fn(), error: vi.fn() },
    tx,
    ...overrides,
  };
}

describe('first-admin bootstrap', () => {
  it('rejects missing configuration before prompting or connecting', async () => {
    const setup = options({ env: {} });
    await expect(runBootstrap(setup)).rejects.toBeInstanceOf(BootstrapError);
    expect(setup.promptSecrets).not.toHaveBeenCalled();
    expect((setup.db as ReturnType<typeof database>['db']).user.count).not.toHaveBeenCalled();
  });

  it('rejects an invalid bootstrap token without database writes', async () => {
    const setup = options({
      promptSecrets: vi.fn().mockResolvedValue({ token: 'invalid', password, confirmPassword: password }),
    });
    await expect(runBootstrap(setup)).rejects.toThrow('Invalid bootstrap token');
    expect((setup.db as ReturnType<typeof database>['db']).$transaction).not.toHaveBeenCalled();
  });

  it('rejects a weak password before database inspection', async () => {
    const setup = options({
      validatePasswordStrength: vi.fn().mockReturnValue({ valid: false, message: 'Password is too weak' }),
    });
    await expect(runBootstrap(setup)).rejects.toThrow('Password is too weak');
    expect((setup.db as ReturnType<typeof database>['db']).user.count).not.toHaveBeenCalled();
  });

  it('rejects a non-empty user table without opening a write transaction', async () => {
    const state = database({ userCount: 1 });
    const setup = options({ db: state.db, tx: state.tx });
    await expect(runBootstrap(setup)).rejects.toThrow('database already contains users');
    expect(state.db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects missing RBAC without opening a write transaction', async () => {
    const state = database({ role: null });
    const setup = options({ db: state.db, tx: state.tx });
    await expect(runBootstrap(setup)).rejects.toThrow('SUPER_ADMIN role is missing');
    expect(state.db.$transaction).not.toHaveBeenCalled();
  });

  it('defaults to dry-run and performs no writes or marker creation', async () => {
    const setup = options();
    const result = await runBootstrap(setup);
    expect(result).toEqual({ executed: false });
    expect((setup.db as ReturnType<typeof database>['db']).$transaction).not.toHaveBeenCalled();
    expect(setup.hashPassword).not.toHaveBeenCalled();
    expect(setup.writeMarker).not.toHaveBeenCalled();
  });

  it('creates only one user, organization, and membership when explicitly executed', async () => {
    const setup = options({ execute: true });
    const result = await runBootstrap(setup);
    expect(result).toMatchObject({ executed: true, userId: 'user-1', organizationId: 'org-1' });
    expect((setup.db as ReturnType<typeof database>['db']).$transaction).toHaveBeenCalledOnce();
    expect(setup.tx.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', 724_483_981);
    expect(setup.tx.user.create).toHaveBeenCalledOnce();
    expect(setup.tx.organization.create).toHaveBeenCalledOnce();
    expect(setup.tx.organizationMembership.create).toHaveBeenCalledOnce();
    expect(setup.writeMarker).toHaveBeenCalledOnce();
    expect('session' in setup.tx).toBe(false);
  });

  it('blocks a concurrent bootstrap after acquiring the advisory lock', async () => {
    const setup = options({ execute: true });
    setup.tx.user.count.mockResolvedValueOnce(1);
    await expect(runBootstrap(setup)).rejects.toThrow('database already contains users');
    expect(setup.tx.$executeRawUnsafe).toHaveBeenCalledOnce();
    expect(setup.tx.user.create).not.toHaveBeenCalled();
    expect(setup.writeMarker).not.toHaveBeenCalled();
  });

  it('does not log token, password, hash, or database URL', async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const setup = options({ logger });
    await runBootstrap(setup);
    const output = logger.log.mock.calls.flat().join(' ');
    expect(output).not.toContain(token);
    expect(output).not.toContain(password);
    expect(output).not.toContain(hashBootstrapToken(token));
    expect(output).not.toContain('postgresql://');
  });
});

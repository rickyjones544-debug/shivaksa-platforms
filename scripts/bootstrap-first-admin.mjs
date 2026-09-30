import { createHash, timingSafeEqual } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });

const REQUIRED_CONFIG = [
  'DATABASE_URL',
  'BOOTSTRAP_OWNER_EMAIL',
  'BOOTSTRAP_OWNER_NAME',
  'BOOTSTRAP_ORGANIZATION_NAME',
  'BOOTSTRAP_TOKEN_HASH',
];
const REQUIRED_PERMISSION_KEYS = [
  'admin:manage',
  'organization:write',
  'membership:write',
  'voip:manage',
];
const DEFAULT_MARKER_PATH = '/var/lib/shivaksa-platform/first-admin-bootstrap.completed';
const ADVISORY_LOCK_ID = 724_483_981;

export class BootstrapError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export function hashBootstrapToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token, expectedHash) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashBootstrapToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getBootstrapConfig(env) {
  const missing = REQUIRED_CONFIG.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new BootstrapError(`Missing required server configuration: ${missing.join(', ')}`);
  }
  return {
    databaseUrl: env.DATABASE_URL,
    ownerEmail: env.BOOTSTRAP_OWNER_EMAIL.trim().toLowerCase(),
    ownerName: env.BOOTSTRAP_OWNER_NAME.trim(),
    organizationName: env.BOOTSTRAP_ORGANIZATION_NAME.trim(),
    tokenHash: env.BOOTSTRAP_TOKEN_HASH.trim().toLowerCase(),
    markerPath: env.BOOTSTRAP_MARKER_PATH?.trim() || DEFAULT_MARKER_PATH,
  };
}

export async function readSecret(promptText, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new BootstrapError('Interactive TTY input is required');
  }
  output.write(promptText);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
    };
    const onData = (character) => {
      if (character === '\u0003') {
        cleanup();
        reject(new BootstrapError('Bootstrap cancelled'));
        return;
      }
      if (character === '\r' || character === '\n') {
        cleanup();
        resolve(value);
        return;
      }
      if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1);
        return;
      }
      if (character >= ' ') value += character;
    };
    input.on('data', onData);
  });
}

function validateMarkerParent(markerPath, uid) {
  if (uid !== 0) throw new BootstrapError('--execute must run as root to create the protected completion marker');
  const parent = dirname(markerPath);
  let stat;
  try {
    stat = statSync(parent);
  } catch {
    throw new BootstrapError(`Completion marker directory does not exist: ${parent}`);
  }
  if (!stat.isDirectory() || stat.uid !== 0 || (stat.mode & 0o022) !== 0) {
    throw new BootstrapError('Completion marker directory must be root-owned and not group/world writable');
  }
}

function writeCompletionMarker(markerPath, result) {
  const handle = openSync(markerPath, 'wx', 0o600);
  try {
    writeFileSync(
      handle,
      `${JSON.stringify({ completedAt: new Date().toISOString(), userId: result.userId, organizationId: result.organizationId })}\n`,
      { encoding: 'utf8' }
    );
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  const stat = statSync(markerPath);
  if (stat.uid !== 0 || (stat.mode & 0o777) !== 0o600) {
    throw new BootstrapError('Completion marker ownership or mode is invalid');
  }
}

function checkRole(role) {
  if (!role) throw new BootstrapError('Required SUPER_ADMIN role is missing; seed RBAC before bootstrap');
  const keys = new Set(role.permissions.map(({ permission }) => permission.key));
  const missing = REQUIRED_PERMISSION_KEYS.filter((key) => !keys.has(key));
  if (missing.length) {
    throw new BootstrapError(`SUPER_ADMIN role is missing required permission relationships: ${missing.join(', ')}`);
  }
}

async function inspectDatabase(db, ownerEmail) {
  const [userCount, owner, role] = await Promise.all([
    db.user.count(),
    db.user.findUnique({ where: { email: ownerEmail }, select: { id: true } }),
    db.role.findUnique({
      where: { name: 'SUPER_ADMIN' },
      include: { permissions: { include: { permission: true } } },
    }),
  ]);
  if (userCount !== 0) throw new BootstrapError('Bootstrap refused: database already contains users');
  if (owner) throw new BootstrapError('Bootstrap refused: owner email already exists');
  checkRole(role);
  return role;
}

export async function runBootstrap(options) {
  const {
    env,
    execute,
    db,
    validateRegistration,
    validatePasswordStrength,
    hashPassword,
    promptSecrets,
    markerExists = existsSync,
    validateMarker = validateMarkerParent,
    writeMarker = writeCompletionMarker,
    uid = typeof process.getuid === 'function' ? process.getuid() : -1,
    logger = console,
  } = options;
  const config = getBootstrapConfig(env);
  if (markerExists(config.markerPath)) throw new BootstrapError('Bootstrap refused: completion marker already exists');

  const secrets = await promptSecrets();
  if (!tokenMatches(secrets.token, config.tokenHash)) throw new BootstrapError('Invalid bootstrap token');
  if (secrets.password !== secrets.confirmPassword) throw new BootstrapError('Owner password confirmation does not match');

  const registration = validateRegistration({
    name: config.ownerName,
    email: config.ownerEmail,
    password: secrets.password,
    confirmPassword: secrets.confirmPassword,
  });
  if (!registration.valid) throw new BootstrapError(Object.values(registration.errors)[0] || 'Invalid owner configuration');
  const strength = validatePasswordStrength(secrets.password);
  if (!strength.valid) throw new BootstrapError(strength.message || 'Owner password does not meet policy');

  await inspectDatabase(db, config.ownerEmail);
  if (!execute) {
    logger.log('First-admin bootstrap validation passed. Dry run only; no records were created.');
    return { executed: false };
  }

  validateMarker(config.markerPath, uid);
  const passwordHash = await hashPassword(secrets.password);
  const slugBase = config.ownerEmail.split('@')[0].replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const organizationSlug = `${slugBase || 'owner'}-bootstrap`;

  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', ADVISORY_LOCK_ID);
      if (markerExists(config.markerPath)) throw new BootstrapError('Bootstrap refused: completion marker already exists');
      const role = await inspectDatabase(tx, config.ownerEmail);
      const user = await tx.user.create({
        data: {
          name: config.ownerName,
          email: config.ownerEmail,
          passwordHash,
          status: 'ACTIVE',
          isSuperAdmin: true,
        },
        select: { id: true },
      });
      const organization = await tx.organization.create({
        data: { name: config.organizationName, slug: organizationSlug, status: 'ACTIVE' },
        select: { id: true },
      });
      await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          roleId: role.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      const finalCount = await tx.user.count();
      if (finalCount !== 1) throw new BootstrapError('Bootstrap invariant failed: expected exactly one user');
      return { userId: user.id, organizationId: organization.id };
    },
    { isolationLevel: 'Serializable' }
  );

  writeMarker(config.markerPath, result);
  logger.log('First administrator created successfully. Sign in through the normal login page.');
  return { executed: true, ...result };
}

async function createProductionOptions(execute) {
  const scriptPath = fileURLToPath(import.meta.url);
  const jiti = createJiti(scriptPath);
  const { prisma } = jiti('../lib/db/prisma.ts');
  const { hashPassword, validatePasswordStrength } = jiti('../lib/auth/password.ts');
  const { validateRegistration } = jiti('../lib/auth/validation.ts');
  return {
    env: process.env,
    execute,
    db: prisma,
    hashPassword,
    validatePasswordStrength,
    validateRegistration,
    promptSecrets: async () => ({
      token: await readSecret('Bootstrap token: '),
      password: await readSecret('Owner password: '),
      confirmPassword: await readSecret('Confirm owner password: '),
    }),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--execute');
  if (unknown.length) throw new BootstrapError(`Unknown argument: ${unknown[0]}`);
  const options = await createProductionOptions(args.includes('--execute'));
  try {
    await runBootstrap(options);
  } finally {
    await options.db.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const message = error instanceof BootstrapError ? error.message : 'Bootstrap failed safely';
    console.error(message);
    process.exitCode = 1;
  });
}

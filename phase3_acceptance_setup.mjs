// Phase 3 acceptance setup — runs on the VPS inside /opt/shivaksa-platform.
// 1) Finds the Phase 2 test account's org.
// 2) Creates (idempotent) an ACTIVE customer rate card + GR selling rate.
// 3) Rotates the SIP password to a known test value and queues UPSERT_ENDPOINT
//    with the md5 digest (plaintext never in the payload).
// Usage: node phase3_acceptance_setup.mjs
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { parse } from 'pg-connection-string';
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const parsed = parse(process.env.DATABASE_URL);
const pool = new pg.Pool({
  host: parsed.host,
  port: parsed.port ? parseInt(parsed.port, 10) : undefined,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const USERNAME = process.env.ACCEPTANCE_SIP_USERNAME || 'shv_7b829bcb3ff0';
const TEST_PASSWORD = process.env.ACCEPTANCE_SIP_PASSWORD;
if (!TEST_PASSWORD) {
  console.error('Set ACCEPTANCE_SIP_PASSWORD in the environment.');
  process.exit(1);
}
const REALM = process.env.ASTERISK_AUTH_REALM || 'asterisk';

function sha256Key(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(plaintext) {
  const key = sha256Key(process.env.ENCRYPTION_KEY || '');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { cipher: enc.toString('hex'), tag: cipher.getAuthTag().toString('hex'), iv: iv.toString('hex') };
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

const acct = await prisma.sipAccount.findFirst({ where: { username: USERNAME } });
if (!acct) throw new Error('test account not found');
const orgId = acct.organizationId;

// --- Rate card + rates (idempotent) ---
let card = await prisma.customerRateCard.findFirst({
  where: { organizationId: orgId, name: 'Acceptance Card' },
});
if (!card) {
  card = await prisma.customerRateCard.create({
    data: {
      organizationId: orgId,
      name: 'Acceptance Card',
      description: 'Phase 3 acceptance',
      currency: 'USD',
      status: 'ACTIVE',
    },
  });
}
console.log('rateCard:', card.id, card.status);

const existing = await prisma.customerRate.findFirst({
  where: { rateCardId: card.id, prefix: '30' },
});
if (!existing) {
  await prisma.customerRate.create({
    data: {
      rateCardId: card.id,
      prefix: '30',
      destination: 'Greece',
      country: 'GR',
      rate: '0.0250',
      billingIncrementSeconds: 30,
      minimumBillableSeconds: 30,
      effectiveFrom: new Date('2026-01-01'),
      enabled: true,
    },
  });
}
const uk = await prisma.customerRate.findFirst({ where: { rateCardId: card.id, prefix: '44' } });
if (!uk) {
  await prisma.customerRate.create({
    data: {
      rateCardId: card.id,
      prefix: '44',
      destination: 'United Kingdom',
      country: 'GB',
      rate: '0.0120',
      billingIncrementSeconds: 60,
      minimumBillableSeconds: 60,
      effectiveFrom: new Date('2026-01-01'),
      enabled: true,
    },
  });
}
const rates = await prisma.customerRate.findMany({ where: { rateCardId: card.id } });
console.log('rates:', rates.map((r) => `+${r.prefix}=${r.rate}`).join(', '));

// --- Rotate SIP password + queue reprovision ---
const enc = encryptValue(TEST_PASSWORD);
await prisma.sipAccount.update({
  where: { id: acct.id },
  data: {
    passwordCipher: enc.cipher,
    passwordTag: enc.tag,
    passwordIv: enc.iv,
    status: 'ACTIVE',
    provisioningState: 'PENDING',
  },
});
await prisma.provisioningTask.create({
  data: {
    sipAccountId: acct.id,
    action: 'UPSERT_ENDPOINT',
    status: 'PENDING',
    payload: {
      username: acct.username,
      md5Cred: md5(`${acct.username}:${REALM}:${TEST_PASSWORD}`),
      maxConcurrentCalls: acct.maxConcurrentCalls,
    },
  },
});
console.log('provisioning queued for', acct.username, '| org:', orgId);

await prisma.$disconnect();

// Phase 2 acceptance fixture/driver — runs ON the VPS against the live app DB.
// Usage: node scripts/phase2_acceptance.mjs [provision|report|cleanup]
//   provision: create test org + voip service + wallet + SIP account + task
//   report:    print sip account / provisioning task / calls state
//   cleanup:   delete the test org (cascades)
// Never prints the SIP password or secrets.
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { createCipheriv, randomBytes, createHash } from 'crypto';
import { parse } from 'pg-connection-string';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Load .env.local (dotenv/config only reads .env)
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

const encKey = createHash('sha256').update(process.env.ENCRYPTION_KEY).digest();
function encryptValue(plaintext) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const cipherText = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { cipher: cipherText.toString('hex'), tag: cipher.getAuthTag().toString('hex'), iv: iv.toString('hex') };
}

const TEST_ORG_SLUG = 'phase2-acceptance-org';
const mode = process.argv[2] || 'provision';

async function provision() {
  const password = randomBytes(24).toString('base64url').slice(0, 24);
  const username = 'shv_' + randomBytes(6).toString('hex');
  const enc = encryptValue(password);

  let org = await prisma.organization.findUnique({ where: { slug: TEST_ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Phase2 Acceptance Org', slug: TEST_ORG_SLUG },
    });
  }
  const service = await prisma.voipService.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, customerRate: '0.05' },
    update: {},
  });
  const wallet = await prisma.wallet.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, balance: '100' },
    update: {},
  });

  const account = await prisma.sipAccount.create({
    data: {
      organizationId: org.id,
      username,
      passwordCipher: enc.cipher,
      passwordTag: enc.tag,
      passwordIv: enc.iv,
      domain: process.env.SIP_DOMAIN || 'sip.shivaksatechnology.com',
      status: 'ACTIVE',
      maxConcurrentCalls: 2,
      callerId: '+15551234567',
      provisioningState: 'PENDING',
      asteriskEndpoint: username,
    },
  });

  const md5Cred = createHash('md5')
    .update(`${username}:${process.env.ASTERISK_AUTH_REALM || 'asterisk'}:${password}`)
    .digest('hex');

  await prisma.provisioningTask.create({
    data: {
      action: 'UPSERT_ENDPOINT',
      sipAccountId: account.id,
      payload: { username, md5Cred, maxConcurrentCalls: 2 },
    },
  });

  console.log(JSON.stringify({
    orgId: org.id, sipAccountId: account.id, username,
    password, // the ONLY place this is printed — operator copies it to the softphone
    serviceId: service.id, walletId: wallet.id,
  }));
}

async function report() {
  const accounts = await prisma.sipAccount.findMany({
    select: {
      username: true, status: true, provisioningState: true,
      provisioningError: true, provisionedAt: true,
      registrationStatus: true, lastRegisteredAt: true,
      lastContactAddress: true, asteriskEndpoint: true,
    },
  });
  const tasks = await prisma.provisioningTask.findMany({
    orderBy: { createdAt: 'desc' }, take: 10,
    select: { action: true, status: true, attempts: true, lastError: true, createdAt: true },
  });
  const calls = await prisma.voipCall.findMany({
    orderBy: { createdAt: 'desc' }, take: 5,
    select: {
      id: true, gatewayCallId: true, destination: true, status: true,
      callerId: true, durationSeconds: true, billableSeconds: true,
      customerCharge: true, billingProcessed: true, carrierId: true,
      failureReason: true, createdAt: true,
    },
  });
  console.log(JSON.stringify({ accounts, tasks, calls }, null, 1));
}

async function cleanup() {
  const org = await prisma.organization.findUnique({ where: { slug: TEST_ORG_SLUG } });
  if (org) {
    await prisma.organization.delete({ where: { id: org.id } });
    console.log('deleted org', org.id);
  } else {
    console.log('nothing to clean');
  }
}

try {
  if (mode === 'provision') await provision();
  else if (mode === 'report') await report();
  else if (mode === 'cleanup') await cleanup();
} finally {
  await prisma.$disconnect();
  await pool.end();
}

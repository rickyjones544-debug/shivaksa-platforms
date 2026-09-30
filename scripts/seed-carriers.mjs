import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed script for the multi-carrier wholesale VoIP migration.
 *
 * SAFETY:
 * - This script is NOT run automatically.
 * - It should only be executed in a controlled deployment after Phase 2A migration
 *   has been applied with `npx prisma migrate deploy`.
 * - It inserts a platform-level Telnyx carrier record so existing Telnyx calls can
 *   be associated with a Carrier row in future phases.
 * - Teloz test data is ONLY inserted when SEED_TELOZ_TEST=true.
 * - The Teloz rates and configuration are TEST DATA supplied by the carrier and are
 *   not permanent commercial rates.
 */

async function seedTelnyx() {
  const telnyx = await prisma.carrier.upsert({
    where: { code: 'telnyx' },
    update: {},
    create: {
      name: 'Telnyx',
      code: 'telnyx',
      type: 'API',
      enabled: true,
      status: 'ACTIVE',
      authenticationType: 'CREDENTIAL_AUTH',
      billingIncrementSeconds: 60,
      minimumBillableSeconds: 60,
      notes: 'Existing Call Control provider. Credentials remain in environment variables.',
    },
  });
  console.log(`  Carrier: ${telnyx.name} (${telnyx.code})`);
}

async function seedTeloz() {
  const teloz = await prisma.carrier.upsert({
    where: { code: 'teloz' },
    update: {},
    create: {
      name: 'Teloz',
      code: 'teloz',
      type: 'SIP_GATEWAY',
      enabled: true,
      status: 'TEST',
      authenticationType: 'IP_AUTH',
      remoteHost: '38.65.82.55',
      remotePort: 5060,
      transport: 'UDP',
      localHost: '82.152.141.69',
      techPrefix: '78542',
      maxChannels: 100,
      maxCps: 10,
      billingIncrementSeconds: 1,
      minimumBillableSeconds: 1,
      cliMode: 'PASS_THROUGH',
      notes:
        'TEST configuration. Tech prefix placement and dialing format must be confirmed with the carrier before traffic.',
    },
  });
  console.log(`  Carrier: ${teloz.name} (${teloz.code})`);

  /**
   * TEST rates supplied by Teloz for the initial test arrangement.
   * These are NOT permanent commercial rates and should be reviewed/updated
   * before production traffic.
   *
   * Prefix convention: digits without leading '+'. Destination type is set
   * according to the supplied rate sheet; generic country rates use ALL.
   */
  const testRates = [
    { prefix: '30', country: 'GR', destinationType: 'ALL', rate: '0.018' },
    { prefix: '370', country: 'LT', destinationType: 'ALL', rate: '0.15' },
    { prefix: '372', country: 'EE', destinationType: 'ALL', rate: '0.19' },
    { prefix: '40', country: 'RO', destinationType: 'ALL', rate: '0.009' },
    { prefix: '371', country: 'LV', destinationType: 'ALL', rate: '0.245' },
    { prefix: '359', country: 'BG', destinationType: 'FIXED', rate: '0.10' },
    { prefix: '359', country: 'BG', destinationType: 'MOBILE', rate: '0.35' },
    { prefix: '386', country: 'SI', destinationType: 'FIXED', rate: '0.185' },
    { prefix: '386', country: 'SI', destinationType: 'MOBILE', rate: '0.065' },
    { prefix: '43', country: 'AT', destinationType: 'ALL', rate: '0.019' },
    { prefix: '385', country: 'HR', destinationType: 'ALL', rate: '0.042' },
    { prefix: '356', country: 'MT', destinationType: 'ALL', rate: '0.05' },
  ];

  for (const r of testRates) {
    // Effective-dated rates are not unique on (carrier, prefix, destinationType),
    // so this seed inserts a fresh record when run rather than upserting.
    const existing = await prisma.carrierRate.findFirst({
      where: {
        carrierId: teloz.id,
        prefix: r.prefix,
        country: r.country,
        destinationType: r.destinationType,
        rate: r.rate,
        billingIncrementSeconds: 1,
        minimumBillableSeconds: 1,
      },
    });

    if (!existing) {
      await prisma.carrierRate.create({
        data: {
          carrierId: teloz.id,
          prefix: r.prefix,
          country: r.country,
          destinationType: r.destinationType,
          rate: r.rate,
          billingIncrementSeconds: 1,
          minimumBillableSeconds: 1,
          priority: 0,
          enabled: true,
        },
      });
      console.log(`    Rate: ${r.country}/${r.destinationType} ${r.prefix} @ ${r.rate}/min`);
    } else {
      console.log(`    Skipped duplicate rate: ${r.country}/${r.destinationType} ${r.prefix} @ ${r.rate}/min`);
    }
  }
}

async function seed() {
  console.log('Seeding carrier data...');
  await seedTelnyx();

  if (process.env.SEED_TELOZ_TEST === 'true') {
    console.log('SEED_TELOZ_TEST=true — seeding Teloz TEST data.');
    await seedTeloz();
  } else {
    console.log('SEED_TELOZ_TEST not set — skipping Teloz test data.');
  }

  console.log('Carrier seed complete.');
}

seed()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });

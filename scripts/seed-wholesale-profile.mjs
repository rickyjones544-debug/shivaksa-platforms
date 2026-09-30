import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SET_NAME = 'Shivaksa Wholesale Provider Requirements';
const PROFILE_TITLE = 'Wholesale Voice Partnership — Shivaksa Technologies LLC';
const PROFILE_SUBTITLE =
  'International wholesale termination · carrier relationships · traffic coordination';

async function seed() {
  console.log('Seeding Wholesale Profile...');

  // Resolve the existing Shivaksa organization dynamically — never hard-coded.
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new Error('No organization found — run the requirements seed first');
  console.log(`  Organization: ${org.name} (${org.id})`);

  const adminUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  const set = await prisma.requirementSet.findUnique({
    where: { organizationId_name: { organizationId: org.id, name: SET_NAME } },
  });
  if (!set) throw new Error(`Requirement set "${SET_NAME}" not found — run seed-requirements.mjs first`);

  // The profile must point at an existing PUBLISHED version — version 1 was
  // seeded by seed-requirements.mjs. Never create a duplicate version.
  const version1 = await prisma.requirementVersion.findUnique({
    where: { requirementSetId_versionNumber: { requirementSetId: set.id, versionNumber: 1 } },
  });
  if (!version1 || version1.status !== 'PUBLISHED') {
    throw new Error('RequirementVersion 1 is missing or not PUBLISHED — run seed-requirements.mjs first');
  }

  const profile = await prisma.wholesaleProfile.upsert({
    where: { organizationId: org.id },
    update: {
      requirementSetId: set.id,
      title: PROFILE_TITLE,
      subtitle: PROFILE_SUBTITLE,
      status: 'ACTIVE',
      publishedVersionNumber: 1,
      updatedById: adminUser?.id ?? undefined,
    },
    create: {
      organizationId: org.id,
      requirementSetId: set.id,
      title: PROFILE_TITLE,
      subtitle: PROFILE_SUBTITLE,
      status: 'ACTIVE',
      publishedVersionNumber: 1,
      createdById: adminUser?.id ?? null,
      updatedById: adminUser?.id ?? null,
    },
  });

  const publishableCount = await prisma.requirementVersionSection.count({
    where: { requirementVersionId: version1.id, visibility: 'PUBLISHABLE' },
  });

  console.log(`  WholesaleProfile: ${profile.title} (${profile.id})`);
  console.log(`  Status: ${profile.status}, publishedVersionNumber: ${profile.publishedVersionNumber}`);
  console.log(`  Publishable sections resolvable: ${publishableCount}`);
  console.log('Wholesale Profile seed complete.');
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

import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SET_NAME = 'Shivaksa Wholesale Provider Requirements';

// Initial wholesale provider requirements. Section keys are stable strings;
// `content` is structured JSON so requirement detail can evolve without schema
// changes. PUBLISHABLE = eligible for a future provider-facing Wholesale
// Profile; it does not mean publicly accessible.
const SECTIONS = [
  {
    key: 'COMPANY_PROFILE',
    title: 'Company Profile',
    sortOrder: 10,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      body: 'Shivaksa Technologies LLC is a U.S.-registered technology and communications company supporting wholesale voice traffic, business communications, and technology solutions.',
    },
  },
  {
    key: 'BUSINESS_PROFILE',
    title: 'Wholesale Communications Profile',
    sortOrder: 20,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      body: 'Shivaksa works with telecommunications and business-communication partners requiring international voice termination. We source wholesale termination capacity from carrier partners and route traffic based on destination, route quality, technical availability, commercial terms, and capacity.',
    },
  },
  {
    key: 'TRAFFIC_PROFILE',
    title: 'Traffic Profile',
    sortOrder: 30,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      items: [
        { key: 'traffic_type', label: 'Traffic type', values: ['WHOLESALE_INTERNATIONAL_VOICE_TERMINATION'] },
        { key: 'traffic_nature', label: 'Traffic nature', values: ['RECURRING', 'DESTINATION_BASED'] },
        {
          key: 'volume_expectation',
          label: 'Expected volume',
          values: ['Traffic volume may scale approximately 100,000 to 500,000+ minutes per month depending on destination, route quality, commercial availability, and capacity.'],
        },
        {
          key: 'minimum_commitment',
          label: 'Minimum commitment',
          values: ['No fixed monthly minimum is committed to any single route unless agreed contractually.'],
        },
      ],
    },
  },
  {
    key: 'DESTINATIONS',
    title: 'Target Destinations',
    sortOrder: 40,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      destinations: [
        { name: 'Greece', iso2: 'GR', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Lithuania', iso2: 'LT', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Estonia', iso2: 'EE', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Romania', iso2: 'RO', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Latvia', iso2: 'LV', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Bulgaria', iso2: 'BG', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Slovenia', iso2: 'SI', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Austria', iso2: 'AT', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Croatia', iso2: 'HR', classification: 'BOTH', priority: 'PRIORITY' },
        { name: 'Malta', iso2: 'MT', classification: 'BOTH', priority: 'PRIORITY' },
      ],
      note: 'Both fixed and mobile termination are of interest where rates and quality permit. Rates for additional European and international destinations are also welcome.',
    },
  },
  {
    key: 'EXPECTED_VOLUME',
    title: 'Expected Traffic Volume',
    sortOrder: 50,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      approximateRangeMinutesPerMonth: { min: 100000, target: '500000+' },
      qualifiers: ['DESTINATION_DEPENDENT', 'QUALITY_DEPENDENT', 'COMMERCIAL_AND_CAPACITY_DEPENDENT'],
      note: 'Volume is destination- and route-dependent and may scale over time. No guaranteed volume is implied.',
    },
  },
  {
    key: 'CONNECTIVITY',
    title: 'Connectivity & Technical Requirements',
    sortOrder: 60,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      items: [
        { key: 'interconnect', label: 'Interconnect', values: ['SIP_OVER_IP'] },
        { key: 'authentication', label: 'Authentication', values: ['IP_AUTH_PREFERRED', 'SIP_CREDENTIALS_SUPPORTED'] },
        { key: 'transport', label: 'Transport', values: ['UDP', 'TCP', 'TLS'] },
        { key: 'codecs', label: 'Codecs', values: ['PROVIDER_TO_INDICATE_SUPPORTED_CODECS'] },
        { key: 'capacity', label: 'Capacity', values: ['PROVIDER_TO_INDICATE_CPS_AND_CONCURRENT_CHANNELS'] },
        { key: 'tech_prefix', label: 'Tech prefix', values: ['WHERE_REQUIRED_BY_PROVIDER'] },
        { key: 'nat_registration', label: 'Registration / NAT', values: ['PROVIDER_TO_INDICATE_WHERE_APPLICABLE'] },
      ],
      note: 'Credential details are exchanged during interconnection testing, never through public forms.',
    },
  },
  {
    key: 'CLI_ANI',
    title: 'CLI / ANI Requirements',
    sortOrder: 70,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      items: [
        { key: 'passthrough', label: 'CLI/ANI passthrough', values: ['PROVIDER_TO_INDICATE'] },
        { key: 'presentation', label: 'Presentation rules', values: ['PROVIDER_TO_INDICATE'] },
        { key: 'restricted_anonymous', label: 'Restricted / anonymous handling', values: ['PROVIDER_TO_INDICATE'] },
        { key: 'rewriting_validation', label: 'Rewriting / validation policies', values: ['PROVIDER_TO_INDICATE'] },
        { key: 'destination_restrictions', label: 'Per-destination restrictions', values: ['PROVIDER_TO_INDICATE'] },
      ],
      note: 'These are requirements and information requested from providers; not every provider is expected to support every CLI/ANI mode.',
    },
  },
  {
    key: 'CDR',
    title: 'CDR & Reporting Requirements',
    sortOrder: 80,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      note: 'CDR transparency is required for reconciliation and operational management.',
      requestedFields: [
        'CALL_ID',
        'PROVIDER_REFERENCE',
        'CLI_ANI',
        'DESTINATION',
        'CALL_START_TIME',
        'ANSWER_TIME',
        'END_TIME',
        'DURATION',
        'BILLABLE_DURATION',
        'ANSWER_STATUS',
        'PROVIDER_COST_RATE_WHERE_SUPPLIED',
      ],
      requestedProperties: ['FORMAT', 'DELIVERY_METHOD', 'DELIVERY_FREQUENCY', 'TIMEZONE'],
    },
  },
  {
    key: 'COMMERCIAL',
    title: 'Commercial Requirements',
    sortOrder: 90,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      requestedRateFields: [
        'DESTINATION',
        'PREFIX',
        'FIXED_OR_MOBILE',
        'RATE',
        'CURRENCY',
        'BILLING_INCREMENT',
        'MINIMUM_DURATION',
        'EFFECTIVE_DATE',
        'EXPIRATION_DATE_IF_APPLICABLE',
      ],
      requestedTerms: ['PREPAID_OR_POSTPAID', 'PAYMENT_TERMS', 'MINIMUM_COMMITMENTS_IF_ANY'],
    },
  },
  {
    key: 'BILLING',
    title: 'Billing Requirements',
    sortOrder: 100,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      requested: [
        'BILLING_CONTACT',
        'INVOICE_FORMAT',
        'BILLING_PERIOD',
        'PAYMENT_TERMS',
        'ACCOUNT_AND_BALANCE_INFORMATION',
        'CREDITS_AND_ADJUSTMENTS',
        'RECONCILIATION_PROCESS',
      ],
    },
  },
  {
    key: 'COMPLIANCE',
    title: 'Compliance & Documentation',
    sortOrder: 110,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      note: 'Providers may be asked to supply relevant company, regulatory, or interconnection documentation. Specific document requirements are communicated during review.',
    },
  },
  {
    key: 'INFORMATION_REQUESTED',
    title: 'Information Requested From Providers',
    sortOrder: 120,
    visibility: 'PUBLISHABLE',
    isRequired: true,
    content: {
      requested: [
        'COMPANY_DETAILS',
        'WEBSITE',
        'COUNTRY',
        'SALES_CONTACT',
        'NOC_AND_TECHNICAL_CONTACT',
        'BILLING_CONTACT',
        'RATES_CONTACT',
        'CONNECTIVITY_DETAILS',
        'CLI_ANI_POLICY',
        'CDR_DETAILS',
        'COMMERCIAL_TERMS',
        'RELEVANT_AGREEMENTS_AND_DOCUMENTS',
      ],
    },
  },
  {
    key: 'CONTACT',
    title: 'Contact',
    sortOrder: 130,
    visibility: 'PUBLISHABLE',
    isRequired: false,
    content: {
      note: 'Shivaksa wholesale relationship contact. Configured as requirement content — edit this section to update the published contact details.',
      channels: [
        { type: 'EMAIL', value: 'wholesale@shivaksatechnology.com' },
        { type: 'WEBSITE', value: 'https://shivaksatechnology.com/' },
      ],
    },
  },
];

async function seed() {
  console.log('Seeding Requirements Center data...');

  // Resolve the existing Shivaksa organization. There is exactly one internal
  // organization in this deployment; requirements are never global.
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    throw new Error('No organization found — cannot seed requirements without a Shivaksa organization');
  }
  console.log(`  Organization: ${org.name} (${org.id})`);

  // Attribute authorship to the first (admin) user if one exists.
  const adminUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  const set = await prisma.requirementSet.upsert({
    where: { organizationId_name: { organizationId: org.id, name: SET_NAME } },
    update: { updatedById: adminUser?.id ?? undefined },
    create: {
      organizationId: org.id,
      name: SET_NAME,
      description: "Shivaksa's permanent internal source of truth for what the company requires from wholesale traffic providers.",
      status: 'ACTIVE',
      createdById: adminUser?.id ?? null,
      updatedById: adminUser?.id ?? null,
    },
  });
  console.log(`  RequirementSet: ${set.name} (${set.id})`);

  for (const s of SECTIONS) {
    await prisma.requirementSection.upsert({
      where: { requirementSetId_key: { requirementSetId: set.id, key: s.key } },
      update: {
        title: s.title,
        sortOrder: s.sortOrder,
        visibility: s.visibility,
        isRequired: s.isRequired,
        content: s.content,
      },
      create: {
        requirementSetId: set.id,
        key: s.key,
        title: s.title,
        sortOrder: s.sortOrder,
        visibility: s.visibility,
        isRequired: s.isRequired,
        content: s.content,
      },
    });
    console.log(`    Section: ${s.key}`);
  }

  // Initial immutable version snapshot. Skip if version 1 already exists.
  const existingVersion = await prisma.requirementVersion.findUnique({
    where: { requirementSetId_versionNumber: { requirementSetId: set.id, versionNumber: 1 } },
  });

  if (existingVersion) {
    console.log('  Version 1 already exists — leaving historical snapshot unchanged.');
  } else {
    const version = await prisma.requirementVersion.create({
      data: {
        requirementSetId: set.id,
        versionNumber: 1,
        status: 'PUBLISHED',
        changeSummary: 'Initial wholesale provider requirements',
        createdById: adminUser?.id ?? null,
        publishedById: adminUser?.id ?? null,
        publishedAt: new Date(),
      },
    });

    const liveSections = await prisma.requirementSection.findMany({
      where: { requirementSetId: set.id },
      orderBy: { sortOrder: 'asc' },
    });

    await prisma.requirementVersionSection.createMany({
      data: liveSections.map((s) => ({
        requirementVersionId: version.id,
        key: s.key,
        title: s.title,
        description: s.description,
        sortOrder: s.sortOrder,
        visibility: s.visibility,
        isRequired: s.isRequired,
        content: s.content ?? undefined,
      })),
    });

    await prisma.requirementSet.update({
      where: { id: set.id },
      data: { currentVersion: 1 },
    });

    console.log(`  Version 1 created with ${liveSections.length} immutable section snapshots.`);
  }

  console.log('Requirements seed complete.');
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

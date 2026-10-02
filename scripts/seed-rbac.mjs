import { config } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function permissionKey(scope, action, resource) {
  return resource ? `${scope}:${action}:${resource}` : `${scope}:${action}`;
}

const allPermissions = [
  // Admin
  { scope: 'admin', action: 'manage', description: 'Full platform administration' },
  { scope: 'admin', action: 'read', resource: 'organizations' },
  { scope: 'admin', action: 'write', resource: 'organizations' },
  { scope: 'admin', action: 'delete', resource: 'organizations' },
  { scope: 'admin', action: 'read', resource: 'users' },
  { scope: 'admin', action: 'write', resource: 'users' },
  { scope: 'admin', action: 'read', resource: 'roles' },
  { scope: 'admin', action: 'write', resource: 'roles' },
  { scope: 'admin', action: 'read', resource: 'settings' },
  { scope: 'admin', action: 'write', resource: 'settings' },

  // Organization self-management
  { scope: 'organization', action: 'read' },
  { scope: 'organization', action: 'write' },
  { scope: 'organization', action: 'delete' },
  { scope: 'membership', action: 'read' },
  { scope: 'membership', action: 'write' },
  { scope: 'membership', action: 'delete' },
  { scope: 'invitation', action: 'read' },
  { scope: 'invitation', action: 'write' },
  { scope: 'invitation', action: 'delete' },

  // CRM
  { scope: 'crm', action: 'manage' },
  { scope: 'crm', action: 'read', resource: 'contacts' },
  { scope: 'crm', action: 'write', resource: 'contacts' },
  { scope: 'crm', action: 'delete', resource: 'contacts' },
  { scope: 'crm', action: 'read', resource: 'leads' },
  { scope: 'crm', action: 'write', resource: 'leads' },
  { scope: 'crm', action: 'delete', resource: 'leads' },
  { scope: 'crm', action: 'read', resource: 'campaigns' },
  { scope: 'crm', action: 'write', resource: 'campaigns' },
  { scope: 'crm', action: 'delete', resource: 'campaigns' },
  { scope: 'crm', action: 'read', resource: 'notes' },
  { scope: 'crm', action: 'write', resource: 'notes' },
  { scope: 'crm', action: 'delete', resource: 'notes' },

  // BPO
  { scope: 'bpo', action: 'manage' },
  { scope: 'bpo', action: 'read', resource: 'queues' },
  { scope: 'bpo', action: 'write', resource: 'queues' },
  { scope: 'bpo', action: 'delete', resource: 'queues' },
  { scope: 'bpo', action: 'read', resource: 'teams' },
  { scope: 'bpo', action: 'write', resource: 'teams' },
  { scope: 'bpo', action: 'delete', resource: 'teams' },
  { scope: 'bpo', action: 'read', resource: 'agents' },
  { scope: 'bpo', action: 'write', resource: 'agents' },
  { scope: 'bpo', action: 'delete', resource: 'agents' },

  // QA
  { scope: 'qa', action: 'manage' },
  { scope: 'qa', action: 'read', resource: 'forms' },
  { scope: 'qa', action: 'write', resource: 'forms' },
  { scope: 'qa', action: 'delete', resource: 'forms' },
  { scope: 'qa', action: 'read', resource: 'reviews' },
  { scope: 'qa', action: 'write', resource: 'reviews' },
  { scope: 'qa', action: 'delete', resource: 'reviews' },

  // Reports
  { scope: 'reports', action: 'read' },
  { scope: 'reports', action: 'write' },
  { scope: 'reports', action: 'manage' },

  // Billing
  { scope: 'billing', action: 'manage' },
  { scope: 'billing', action: 'read', resource: 'accounts' },
  { scope: 'billing', action: 'write', resource: 'accounts' },
  { scope: 'billing', action: 'read', resource: 'invoices' },
  { scope: 'billing', action: 'write', resource: 'invoices' },
  { scope: 'billing', action: 'delete', resource: 'invoices' },

  // Development
  { scope: 'development', action: 'manage' },
  { scope: 'development', action: 'read', resource: 'projects' },
  { scope: 'development', action: 'write', resource: 'projects' },
  { scope: 'development', action: 'delete', resource: 'projects' },
  { scope: 'development', action: 'read', resource: 'tasks' },
  { scope: 'development', action: 'write', resource: 'tasks' },
  { scope: 'development', action: 'delete', resource: 'tasks' },

  // AI
  { scope: 'ai', action: 'manage' },
  { scope: 'ai', action: 'read', resource: 'agents' },
  { scope: 'ai', action: 'write', resource: 'agents' },
  { scope: 'ai', action: 'delete', resource: 'agents' },
  { scope: 'ai', action: 'read', resource: 'calls' },

  // VoIP
  { scope: 'voip', action: 'manage' },
  { scope: 'voip', action: 'read', resource: 'numbers' },
  { scope: 'voip', action: 'write', resource: 'numbers' },
  { scope: 'voip', action: 'delete', resource: 'numbers' },
  { scope: 'voip', action: 'read', resource: 'calls' },
  { scope: 'voip', action: 'write', resource: 'calls' },
  { scope: 'voip', action: 'read', resource: 'sip' },
  { scope: 'voip', action: 'write', resource: 'sip' },
  { scope: 'voip', action: 'read', resource: 'rates' },
  { scope: 'voip', action: 'read', resource: 'usage' },

  // Wallet / prepaid balance
  { scope: 'wallet', action: 'manage' },
  { scope: 'wallet', action: 'read' },
  { scope: 'wallet', action: 'write' },

  // Multi-carrier wholesale VoIP administration
  { scope: 'carrier', action: 'manage' },
  { scope: 'carrier', action: 'read' },
  { scope: 'carrier', action: 'write' },
  { scope: 'carrier', action: 'delete' },
  { scope: 'carrier-rate', action: 'manage' },
  { scope: 'carrier-rate', action: 'read' },
  { scope: 'carrier-rate', action: 'write' },
  { scope: 'carrier-rate', action: 'delete' },
  { scope: 'carrier-route', action: 'manage' },
  { scope: 'carrier-route', action: 'read' },
  { scope: 'carrier-route', action: 'write' },
  { scope: 'carrier-route', action: 'delete' },

  // Provider CRM — wholesale carrier relationship management (internal only)
  { scope: 'provider', action: 'manage' },
  { scope: 'provider', action: 'read' },
  { scope: 'provider', action: 'write' },
  { scope: 'provider', action: 'delete' },
  { scope: 'provider', action: 'read', resource: 'submissions' },
  { scope: 'provider', action: 'write', resource: 'submissions' },
  { scope: 'provider', action: 'read', resource: 'links' },
  { scope: 'provider', action: 'write', resource: 'links' },
  { scope: 'rate-desk', action: 'manage' },
  { scope: 'rate-desk', action: 'read' },
  { scope: 'rate-desk', action: 'write' },
  { scope: 'rate-desk', action: 'delete' },
  { scope: 'connectivity', action: 'manage' },
  { scope: 'connectivity', action: 'read' },
  { scope: 'connectivity', action: 'write' },
  { scope: 'connectivity', action: 'delete' },
  { scope: 'traffic', action: 'manage' },
  { scope: 'traffic', action: 'read' },
  { scope: 'traffic', action: 'write' },
  { scope: 'traffic', action: 'delete' },
  { scope: 'provider-billing', action: 'manage' },
  { scope: 'provider-billing', action: 'read' },
  { scope: 'provider-billing', action: 'write' },
  { scope: 'provider-billing', action: 'delete' },
  { scope: 'documents', action: 'manage' },
  { scope: 'documents', action: 'read' },
  { scope: 'documents', action: 'write' },
  { scope: 'documents', action: 'delete' },
  { scope: 'wholesale-profile', action: 'manage' },
  { scope: 'wholesale-profile', action: 'read' },
  { scope: 'wholesale-profile', action: 'write' },
  { scope: 'wholesale-profile', action: 'delete' },
  { scope: 'wholesale-profile', action: 'publish' },
  { scope: 'wholesale-profile', action: 'archive' },

  // Requirements Center — internal wholesale provider requirements
  { scope: 'requirements', action: 'manage' },
  { scope: 'requirements', action: 'read' },
  { scope: 'requirements', action: 'write' },
  { scope: 'requirements', action: 'delete' },
  { scope: 'requirements', action: 'publish' },
  { scope: 'requirements', action: 'archive' },

  // Audit logging
  { scope: 'audit', action: 'manage' },
  { scope: 'audit', action: 'read' },
];

function allInScopes(scopes, actions = ['read', 'write', 'delete', 'manage']) {
  return allPermissions
    .filter((p) => scopes.includes(p.scope) && actions.includes(p.action))
    .map((p) => permissionKey(p.scope, p.action, p.resource));
}

const systemRoles = [
  {
    name: 'SUPER_ADMIN',
    description: 'Platform-wide super administrator with unrestricted access',
    permissions: allInScopes([
      'admin', 'organization', 'membership', 'invitation', 'crm', 'bpo', 'qa', 'reports', 'billing', 'development', 'ai', 'voip', 'wallet', 'carrier', 'carrier-rate', 'carrier-route', 'provider', 'rate-desk', 'connectivity', 'traffic', 'provider-billing', 'documents', 'wholesale-profile', 'requirements', 'audit',
    ], ['read', 'write', 'delete', 'manage', 'publish', 'archive']),
  },
  {
    name: 'OPERATIONS_MANAGER',
    description: 'Manages platform operations across organizations',
    permissions: allInScopes(
      ['admin', 'organization', 'membership', 'invitation', 'bpo', 'qa', 'reports', 'ai', 'voip', 'wallet', 'carrier', 'carrier-rate', 'carrier-route', 'provider', 'rate-desk', 'connectivity', 'traffic', 'provider-billing', 'documents', 'wholesale-profile', 'requirements', 'audit'],
      ['read', 'write', 'delete', 'manage', 'publish', 'archive']
    ),
  },
  {
    name: 'QA_MANAGER',
    description: 'Oversees quality assurance and agent performance',
    permissions: allInScopes(['qa', 'reports', 'bpo'], ['read', 'manage']),
  },
  {
    name: 'INTERNAL_STAFF',
    description: 'Internal platform staff with limited operational access',
    permissions: allInScopes(['reports', 'bpo', 'crm', 'provider', 'rate-desk', 'traffic', 'requirements', 'wholesale-profile'], ['read']),
  },
  {
    name: 'CLIENT_ADMIN',
    description: 'Client organization administrator with full access within their tenant',
    permissions: allInScopes([
      'organization', 'membership', 'invitation', 'crm', 'bpo', 'qa', 'reports', 'billing', 'development', 'ai', 'voip', 'wallet',
    ]),
  },
  {
    name: 'CLIENT_VIEWER',
    description: 'Read-only access within the client organization',
    permissions: allInScopes(
      ['organization', 'membership', 'invitation', 'crm', 'bpo', 'qa', 'reports', 'billing', 'development', 'ai', 'voip', 'wallet'],
      ['read']
    ),
  },
  {
    name: 'CLIENT_VOIP_SUPPORT',
    description: 'Tenant-scoped browser calling and VoIP support access',
    permissions: [
      permissionKey('voip', 'read', 'calls'),
      permissionKey('voip', 'write', 'calls'),
      permissionKey('voip', 'read', 'sip'),
      permissionKey('voip', 'read', 'numbers'),
      permissionKey('wallet', 'read'),
    ],
  },
  {
    name: 'SUPERVISOR',
    description: 'Supervises BPO agents and QA within an organization',
    permissions: allInScopes(['bpo', 'qa', 'reports'], ['read', 'write', 'manage']),
  },
  {
    name: 'BPO_AGENT',
    description: 'Handles calls and queues within assigned BPO teams',
    permissions: [
      permissionKey('bpo', 'read', 'queues'),
      permissionKey('bpo', 'read', 'agents'),
      permissionKey('qa', 'read', 'forms'),
      permissionKey('qa', 'write', 'reviews'),
      permissionKey('reports', 'read'),
    ],
  },
  {
    name: 'CARRIER_MANAGER',
    description: 'Manages wholesale provider relationships, rates, connectivity and commercial terms',
    permissions: [
      ...allInScopes(
        ['provider', 'rate-desk', 'connectivity', 'traffic', 'provider-billing', 'documents', 'wholesale-profile', 'carrier', 'carrier-rate', 'carrier-route', 'audit'],
        ['read', 'write', 'manage']
      ),
      // Carrier managers read and update requirements but cannot publish, archive or delete them
      permissionKey('requirements', 'read'),
      permissionKey('requirements', 'write'),
    ],
  },
];

async function seed() {
  console.log('Seeding RBAC data...');

  const permissionMap = new Map();
  for (const perm of allPermissions) {
    const key = permissionKey(perm.scope, perm.action, perm.resource);

    const existing = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        scope: perm.scope,
        action: perm.action,
        resource: perm.resource ?? null,
      },
    });

    permissionMap.set(key, existing.id);
    console.log(`  Permission: ${key}`);
  }

  for (const roleDef of systemRoles) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {
        description: roleDef.description,
        isSystem: true,
      },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });

    console.log(`  Role: ${role.name}`);

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    const permissionIds = new Set();
    for (const key of roleDef.permissions) {
      const permId = permissionMap.get(key);
      if (permId) {
        permissionIds.add(permId);
      } else {
        console.warn(`    Unknown permission key: ${key}`);
      }
    }

    if (permissionIds.size > 0) {
      await prisma.rolePermission.createMany({
        data: Array.from(permissionIds).map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
      console.log(`    Linked ${permissionIds.size} permissions`);
    }
  }

  console.log('RBAC seed complete.');
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

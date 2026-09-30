import { allPermissions, permissionKey } from './permissions';

export type SystemRole =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'QA_MANAGER'
  | 'INTERNAL_STAFF'
  | 'CLIENT_ADMIN'
  | 'CLIENT_VIEWER'
  | 'CLIENT_VOIP_SUPPORT'
  | 'SUPERVISOR'
  | 'BPO_AGENT'
  | 'CARRIER_MANAGER';

export interface RoleDefinition {
  name: SystemRole;
  description: string;
  isSystem: true;
  permissions: string[]; // formatted permission keys
}

// Helper to collect all permission keys from a set of scopes/actions.
function allInScopes(
  scopes: string[],
  actions: string[] = ['read', 'write', 'delete', 'manage']
): string[] {
  return allPermissions
    .filter((p) => scopes.includes(p.scope) && actions.includes(p.action))
    .map((p) => permissionKey(p.scope, p.action, p.resource));
}

export const systemRoles: RoleDefinition[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Platform-wide super administrator with unrestricted access',
    isSystem: true,
    permissions: ['*'], // bypass flag, not stored in DB
  },
  {
    name: 'OPERATIONS_MANAGER',
    description: 'Manages platform operations across organizations',
    isSystem: true,
    permissions: allInScopes(
      ['admin', 'organization', 'membership', 'invitation', 'bpo', 'qa', 'reports', 'ai', 'voip', 'wallet', 'carrier', 'carrier-rate', 'carrier-route', 'provider', 'rate-desk', 'connectivity', 'traffic', 'provider-billing', 'documents', 'wholesale-profile', 'requirements', 'audit'],
      ['read', 'write', 'delete', 'manage', 'publish', 'archive']
    ),
  },
  {
    name: 'QA_MANAGER',
    description: 'Oversees quality assurance and agent performance',
    isSystem: true,
    permissions: allInScopes(['qa', 'reports', 'bpo'], ['read', 'manage']),
  },
  {
    name: 'INTERNAL_STAFF',
    description: 'Internal platform staff with limited operational access',
    isSystem: true,
    permissions: allInScopes(['reports', 'bpo', 'crm', 'provider', 'rate-desk', 'traffic', 'requirements', 'wholesale-profile'], ['read']),
  },
  {
    name: 'CLIENT_ADMIN',
    description: 'Client organization administrator with full access within their tenant',
    isSystem: true,
    permissions: allInScopes([
      'organization',
      'membership',
      'invitation',
      'crm',
      'bpo',
      'qa',
      'reports',
      'billing',
      'development',
      'ai',
      'voip',
      'wallet',
    ]),
  },
  {
    name: 'CLIENT_VIEWER',
    description: 'Read-only access within the client organization',
    isSystem: true,
    permissions: allInScopes(
      ['crm', 'bpo', 'qa', 'reports', 'billing', 'development', 'ai', 'voip', 'wallet'],
      ['read']
    ),
  },
  {
    name: 'CLIENT_VOIP_SUPPORT',
    description: 'Tenant-scoped browser calling and VoIP support access',
    isSystem: true,
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
    isSystem: true,
    permissions: allInScopes(['bpo', 'qa', 'reports'], ['read', 'write', 'manage']),
  },
  {
    name: 'BPO_AGENT',
    description: 'Handles calls and queues within assigned BPO teams',
    isSystem: true,
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
    isSystem: true,
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

export function getRolePermissions(roleName: string): string[] {
  const role = systemRoles.find((r) => r.name === roleName);
  return role ? role.permissions : [];
}

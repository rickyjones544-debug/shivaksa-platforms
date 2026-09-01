import { allPermissions, permissionKey, type PermissionDefinition } from './permissions';

export type SystemRole =
  | 'SUPER_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'QA_MANAGER'
  | 'INTERNAL_STAFF'
  | 'CLIENT_ADMIN'
  | 'CLIENT_VIEWER'
  | 'SUPERVISOR'
  | 'BPO_AGENT';

export interface RoleDefinition {
  name: SystemRole;
  description: string;
  isSystem: true;
  permissions: string[]; // formatted permission keys
}

function keys(...perms: PermissionDefinition[]): string[] {
  return perms.map((p) => permissionKey(p.scope, p.action, p.resource));
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
    permissions: allInScopes(['admin', 'bpo', 'qa', 'reports', 'ai', 'voip']),
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
    permissions: allInScopes(['reports', 'bpo', 'crm'], ['read']),
  },
  {
    name: 'CLIENT_ADMIN',
    description: 'Client organization administrator with full access within their tenant',
    isSystem: true,
    permissions: allInScopes([
      'crm',
      'bpo',
      'qa',
      'reports',
      'billing',
      'development',
      'ai',
      'voip',
    ]),
  },
  {
    name: 'CLIENT_VIEWER',
    description: 'Read-only access within the client organization',
    isSystem: true,
    permissions: allInScopes(
      ['crm', 'bpo', 'qa', 'reports', 'billing', 'development', 'ai', 'voip'],
      ['read']
    ),
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
];

export function getRolePermissions(roleName: string): string[] {
  const role = systemRoles.find((r) => r.name === roleName);
  return role ? role.permissions : [];
}

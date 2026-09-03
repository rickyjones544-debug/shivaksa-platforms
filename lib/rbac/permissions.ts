// Permission definitions for the Shivaksa Platform.
// Each permission is a tuple: [scope, action, resource?]
// Resource is optional; null/undefined means "all resources within the scope".

export const PermissionAction = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE: 'manage',
} as const;

export type PermissionActionType = (typeof PermissionAction)[keyof typeof PermissionAction];

export interface PermissionDefinition {
  scope: string;
  action: PermissionActionType;
  resource?: string;
  description: string;
}

export function permissionKey(scope: string, action: string, resource?: string): string {
  return resource ? `${scope}:${action}:${resource}` : `${scope}:${action}`;
}

// Admin / platform management
const adminPermissions: PermissionDefinition[] = [
  { scope: 'admin', action: 'manage', description: 'Full platform administration' },
  { scope: 'admin', action: 'read', resource: 'organizations', description: 'Read organizations' },
  { scope: 'admin', action: 'write', resource: 'organizations', description: 'Create/update organizations' },
  { scope: 'admin', action: 'delete', resource: 'organizations', description: 'Delete organizations' },
  { scope: 'admin', action: 'read', resource: 'users', description: 'Read platform users' },
  { scope: 'admin', action: 'write', resource: 'users', description: 'Manage platform users' },
  { scope: 'admin', action: 'read', resource: 'roles', description: 'Read roles' },
  { scope: 'admin', action: 'write', resource: 'roles', description: 'Manage roles' },
  { scope: 'admin', action: 'read', resource: 'settings', description: 'Read platform settings' },
  { scope: 'admin', action: 'write', resource: 'settings', description: 'Manage platform settings' },
];

// Organization self-management (available to organization admins, not platform-only)
const organizationPermissions: PermissionDefinition[] = [
  { scope: 'organization', action: 'read', description: 'Read own organization details' },
  { scope: 'organization', action: 'write', description: 'Update own organization details' },
  { scope: 'organization', action: 'delete', description: 'Delete own organization' },
  { scope: 'membership', action: 'read', description: 'Read organization memberships' },
  { scope: 'membership', action: 'write', description: 'Manage organization memberships' },
  { scope: 'membership', action: 'delete', description: 'Delete organization memberships' },
  { scope: 'invitation', action: 'read', description: 'Read organization invitations' },
  { scope: 'invitation', action: 'write', description: 'Create organization invitations' },
  { scope: 'invitation', action: 'delete', description: 'Revoke organization invitations' },
];

// CRM module
const crmPermissions: PermissionDefinition[] = [
  { scope: 'crm', action: 'manage', description: 'Full CRM management' },
  { scope: 'crm', action: 'read', resource: 'contacts', description: 'Read contacts' },
  { scope: 'crm', action: 'write', resource: 'contacts', description: 'Create/update contacts' },
  { scope: 'crm', action: 'delete', resource: 'contacts', description: 'Delete contacts' },
  { scope: 'crm', action: 'read', resource: 'leads', description: 'Read leads' },
  { scope: 'crm', action: 'write', resource: 'leads', description: 'Create/update leads' },
  { scope: 'crm', action: 'delete', resource: 'leads', description: 'Delete leads' },
  { scope: 'crm', action: 'read', resource: 'campaigns', description: 'Read campaigns' },
  { scope: 'crm', action: 'write', resource: 'campaigns', description: 'Create/update campaigns' },
  { scope: 'crm', action: 'delete', resource: 'campaigns', description: 'Delete campaigns' },
  { scope: 'crm', action: 'read', resource: 'notes', description: 'Read notes' },
  { scope: 'crm', action: 'write', resource: 'notes', description: 'Create/update notes' },
  { scope: 'crm', action: 'delete', resource: 'notes', description: 'Delete notes' },
];

// BPO module
const bpoPermissions: PermissionDefinition[] = [
  { scope: 'bpo', action: 'manage', description: 'Full BPO management' },
  { scope: 'bpo', action: 'read', resource: 'queues', description: 'Read queues' },
  { scope: 'bpo', action: 'write', resource: 'queues', description: 'Manage queues' },
  { scope: 'bpo', action: 'delete', resource: 'queues', description: 'Delete queues' },
  { scope: 'bpo', action: 'read', resource: 'teams', description: 'Read teams' },
  { scope: 'bpo', action: 'write', resource: 'teams', description: 'Manage teams' },
  { scope: 'bpo', action: 'delete', resource: 'teams', description: 'Delete teams' },
  { scope: 'bpo', action: 'read', resource: 'agents', description: 'Read agents' },
  { scope: 'bpo', action: 'write', resource: 'agents', description: 'Manage agents' },
  { scope: 'bpo', action: 'delete', resource: 'agents', description: 'Delete agents' },
];

// QA module
const qaPermissions: PermissionDefinition[] = [
  { scope: 'qa', action: 'manage', description: 'Full QA management' },
  { scope: 'qa', action: 'read', resource: 'forms', description: 'Read QA forms' },
  { scope: 'qa', action: 'write', resource: 'forms', description: 'Manage QA forms' },
  { scope: 'qa', action: 'delete', resource: 'forms', description: 'Delete QA forms' },
  { scope: 'qa', action: 'read', resource: 'reviews', description: 'Read QA reviews' },
  { scope: 'qa', action: 'write', resource: 'reviews', description: 'Conduct QA reviews' },
  { scope: 'qa', action: 'delete', resource: 'reviews', description: 'Delete QA reviews' },
];

// Reports module
const reportsPermissions: PermissionDefinition[] = [
  { scope: 'reports', action: 'read', description: 'Read reports across modules' },
  { scope: 'reports', action: 'write', description: 'Create custom reports' },
  { scope: 'reports', action: 'manage', description: 'Manage report templates and schedules' },
];

// Billing module
const billingPermissions: PermissionDefinition[] = [
  { scope: 'billing', action: 'manage', description: 'Full billing management' },
  { scope: 'billing', action: 'read', resource: 'accounts', description: 'Read billing accounts' },
  { scope: 'billing', action: 'write', resource: 'accounts', description: 'Manage billing accounts' },
  { scope: 'billing', action: 'read', resource: 'invoices', description: 'Read invoices' },
  { scope: 'billing', action: 'write', resource: 'invoices', description: 'Create/update invoices' },
  { scope: 'billing', action: 'delete', resource: 'invoices', description: 'Delete invoices' },
];

// Development module
const developmentPermissions: PermissionDefinition[] = [
  { scope: 'development', action: 'manage', description: 'Full development project management' },
  { scope: 'development', action: 'read', resource: 'projects', description: 'Read projects' },
  { scope: 'development', action: 'write', resource: 'projects', description: 'Create/update projects' },
  { scope: 'development', action: 'delete', resource: 'projects', description: 'Delete projects' },
  { scope: 'development', action: 'read', resource: 'tasks', description: 'Read tasks' },
  { scope: 'development', action: 'write', resource: 'tasks', description: 'Create/update tasks' },
  { scope: 'development', action: 'delete', resource: 'tasks', description: 'Delete tasks' },
];

// AI module
const aiPermissions: PermissionDefinition[] = [
  { scope: 'ai', action: 'manage', description: 'Full AI agent management' },
  { scope: 'ai', action: 'read', resource: 'agents', description: 'Read AI agents' },
  { scope: 'ai', action: 'write', resource: 'agents', description: 'Create/update AI agents' },
  { scope: 'ai', action: 'delete', resource: 'agents', description: 'Delete AI agents' },
  { scope: 'ai', action: 'read', resource: 'calls', description: 'Read AI call logs' },
];

// VoIP module
const voipPermissions: PermissionDefinition[] = [
  { scope: 'voip', action: 'manage', description: 'Full VoIP management' },
  { scope: 'voip', action: 'read', resource: 'numbers', description: 'Read phone numbers' },
  { scope: 'voip', action: 'write', resource: 'numbers', description: 'Manage phone numbers' },
  { scope: 'voip', action: 'read', resource: 'calls', description: 'Read VoIP call logs' },
  { scope: 'voip', action: 'write', resource: 'calls', description: 'Initiate/manage calls' },
];

export const allPermissions: PermissionDefinition[] = [
  ...adminPermissions,
  ...organizationPermissions,
  ...crmPermissions,
  ...bpoPermissions,
  ...qaPermissions,
  ...reportsPermissions,
  ...billingPermissions,
  ...developmentPermissions,
  ...aiPermissions,
  ...voipPermissions,
];

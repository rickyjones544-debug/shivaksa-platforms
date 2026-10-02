// Permission definitions for the Shivaksa Platform.
// Each permission is a tuple: [scope, action, resource?]
// Resource is optional; null/undefined means "all resources within the scope".

export const PermissionAction = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  MANAGE: 'manage',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
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
  { scope: 'voip', action: 'delete', resource: 'numbers', description: 'Delete phone numbers' },
  { scope: 'voip', action: 'read', resource: 'calls', description: 'Read VoIP call logs and CDR' },
  { scope: 'voip', action: 'write', resource: 'calls', description: 'Initiate/manage calls' },
  { scope: 'voip', action: 'read', resource: 'sip', description: 'Read SIP accounts' },
  { scope: 'voip', action: 'write', resource: 'sip', description: 'Manage SIP accounts' },
  { scope: 'voip', action: 'read', resource: 'rates', description: 'Read customer selling rates (rate card)' },
  { scope: 'voip', action: 'read', resource: 'usage', description: 'Read usage aggregates and active call counts' },
];

// Wallet / prepaid balance
const walletPermissions: PermissionDefinition[] = [
  { scope: 'wallet', action: 'manage', description: 'Full wallet management' },
  { scope: 'wallet', action: 'read', description: 'Read wallet and ledger' },
  { scope: 'wallet', action: 'write', description: 'Credit, debit, refund, and adjust wallet' },
];

// Multi-carrier wholesale VoIP administration
const carrierPermissions: PermissionDefinition[] = [
  { scope: 'carrier', action: 'manage', description: 'Full carrier management' },
  { scope: 'carrier', action: 'read', description: 'Read carriers' },
  { scope: 'carrier', action: 'write', description: 'Create/update carriers' },
  { scope: 'carrier', action: 'delete', description: 'Delete carriers' },
  { scope: 'carrier-rate', action: 'manage', description: 'Full carrier rate management' },
  { scope: 'carrier-rate', action: 'read', description: 'Read carrier rates' },
  { scope: 'carrier-rate', action: 'write', description: 'Create/update carrier rates' },
  { scope: 'carrier-rate', action: 'delete', description: 'Delete carrier rates' },
  { scope: 'carrier-route', action: 'manage', description: 'Full carrier routing management' },
  { scope: 'carrier-route', action: 'read', description: 'Read carrier routes' },
  { scope: 'carrier-route', action: 'write', description: 'Create/update carrier routes' },
  { scope: 'carrier-route', action: 'delete', description: 'Delete carrier routes' },
];

// Provider CRM — wholesale carrier relationship management (internal only)
const providerPermissions: PermissionDefinition[] = [
  { scope: 'provider', action: 'manage', description: 'Full provider CRM management' },
  { scope: 'provider', action: 'read', description: 'Read provider records' },
  { scope: 'provider', action: 'write', description: 'Create/update providers, contacts, tasks and notes' },
  { scope: 'provider', action: 'delete', description: 'Delete provider records' },
  { scope: 'provider', action: 'read', resource: 'submissions', description: 'Read provider submissions' },
  { scope: 'provider', action: 'write', resource: 'submissions', description: 'Review and process provider submissions' },
  { scope: 'provider', action: 'read', resource: 'links', description: 'Read onboarding links' },
  { scope: 'provider', action: 'write', resource: 'links', description: 'Create, expire and revoke onboarding links' },
  // Rate Desk — received/negotiated provider rates (internal only)
  { scope: 'rate-desk', action: 'manage', description: 'Full rate desk management' },
  { scope: 'rate-desk', action: 'read', description: 'Read provider rate sheets and comparisons' },
  { scope: 'rate-desk', action: 'write', description: 'Create/update provider rate sheets' },
  { scope: 'rate-desk', action: 'delete', description: 'Delete provider rate sheets' },
  // Connectivity — provider interconnection records and tests
  { scope: 'connectivity', action: 'manage', description: 'Full connectivity management' },
  { scope: 'connectivity', action: 'read', description: 'Read provider connections' },
  { scope: 'connectivity', action: 'write', description: 'Create/update provider connections and tests' },
  { scope: 'connectivity', action: 'delete', description: 'Delete provider connections' },
  // Traffic & CDR — internal traffic views and reconciliation
  { scope: 'traffic', action: 'manage', description: 'Full traffic management' },
  { scope: 'traffic', action: 'read', description: 'Read internal traffic and CDR data' },
  { scope: 'traffic', action: 'write', description: 'Manage CDR reconciliation' },
  { scope: 'traffic', action: 'delete', description: 'Delete traffic records' },
  // Provider billing — counterparty accounts, invoices, disputes
  { scope: 'provider-billing', action: 'manage', description: 'Full provider billing management' },
  { scope: 'provider-billing', action: 'read', description: 'Read provider accounts and invoices' },
  { scope: 'provider-billing', action: 'write', description: 'Manage provider invoices and payments' },
  { scope: 'provider-billing', action: 'delete', description: 'Delete provider billing records' },
  // Provider documents
  { scope: 'documents', action: 'manage', description: 'Full provider document management' },
  { scope: 'documents', action: 'read', description: 'Read provider documents' },
  { scope: 'documents', action: 'write', description: 'Upload and publish provider documents' },
  { scope: 'documents', action: 'delete', description: 'Delete provider documents' },
  // Wholesale profile — provider-facing published requirements
  { scope: 'wholesale-profile', action: 'manage', description: 'Full wholesale profile management' },
  { scope: 'wholesale-profile', action: 'read', description: 'Read wholesale profile' },
  { scope: 'wholesale-profile', action: 'write', description: 'Edit wholesale profile' },
  { scope: 'wholesale-profile', action: 'delete', description: 'Delete wholesale profile versions' },
  { scope: 'wholesale-profile', action: 'publish', description: 'Publish a wholesale profile version' },
  { scope: 'wholesale-profile', action: 'archive', description: 'Archive a wholesale profile' },
];

// Requirements Center — Shivaksa's internal wholesale provider requirements
const requirementsPermissions: PermissionDefinition[] = [
  { scope: 'requirements', action: 'manage', description: 'Full requirements management' },
  { scope: 'requirements', action: 'read', description: 'Read requirement sets and versions' },
  { scope: 'requirements', action: 'write', description: 'Create/update requirement sets and sections' },
  { scope: 'requirements', action: 'delete', description: 'Delete requirement sets' },
  { scope: 'requirements', action: 'publish', description: 'Publish requirement versions' },
  { scope: 'requirements', action: 'archive', description: 'Archive requirement sets and versions' },
];

// Audit logging
const auditPermissions: PermissionDefinition[] = [
  { scope: 'audit', action: 'manage', description: 'Full audit log management' },
  { scope: 'audit', action: 'read', description: 'Read audit logs' },
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
  ...walletPermissions,
  ...carrierPermissions,
  ...providerPermissions,
  ...requirementsPermissions,
  ...auditPermissions,
];

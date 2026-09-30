// Requirements Center constants.
// Mirrors the lib/voip/constants.ts pattern: plain const objects so values are
// usable without importing generated Prisma types.

export const RequirementSetStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type RequirementSetStatus = (typeof RequirementSetStatus)[keyof typeof RequirementSetStatus];

export const RequirementVersionStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type RequirementVersionStatus =
  (typeof RequirementVersionStatus)[keyof typeof RequirementVersionStatus];

// INTERNAL: never leaves internal scope.
// PUBLISHABLE: eligible for inclusion in a future provider-facing Wholesale
// Profile. PUBLISHABLE does not mean publicly accessible.
export const RequirementVisibility = {
  INTERNAL: 'INTERNAL',
  PUBLISHABLE: 'PUBLISHABLE',
} as const;

export type RequirementVisibility =
  (typeof RequirementVisibility)[keyof typeof RequirementVisibility];

// Standard section keys for the Shivaksa wholesale provider requirements.
// Not a closed set — future custom sections are allowed. Keys are validated
// for format at the application layer (see isValidRequirementSectionKey).
export const REQUIREMENT_SECTION_KEYS = [
  'COMPANY_PROFILE',
  'BUSINESS_PROFILE',
  'TRAFFIC_PROFILE',
  'DESTINATIONS',
  'EXPECTED_VOLUME',
  'CONNECTIVITY',
  'CLI_ANI',
  'CDR',
  'COMMERCIAL',
  'BILLING',
  'COMPLIANCE',
  'INFORMATION_REQUESTED',
  'CONTACT',
] as const;

export type RequirementSectionKey = (typeof REQUIREMENT_SECTION_KEYS)[number];

export function isValidRequirementSectionKey(key: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(key);
}

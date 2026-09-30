// Wholesale Profile constants — mirrors the lib/voip/constants.ts pattern.

export const WholesaleProfileStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type WholesaleProfileStatus =
  (typeof WholesaleProfileStatus)[keyof typeof WholesaleProfileStatus];

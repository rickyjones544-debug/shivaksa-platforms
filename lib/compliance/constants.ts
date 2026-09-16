export { KycRecordStatus } from '@prisma/client';

export const KycDocumentStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type KycDocumentStatus = (typeof KycDocumentStatus)[keyof typeof KycDocumentStatus];

export const KycDocumentSource = {
  METADATA_ONLY: 'METADATA_ONLY',
  STORED: 'STORED',
} as const;

export type KycDocumentSource = (typeof KycDocumentSource)[keyof typeof KycDocumentSource];

// Storage abstraction for compliance/KYC documents.
// Storage provider integration is pending; document references can still be
// stored on the KycDocument model, but the actual upload/retrieval is not
// implemented here until a storage provider (S3, R2, Azure Blob, etc.) is
// configured and its credentials are provisioned.

export type KycDocumentFile = {
  name: string;
  contentType: string;
  buffer: Buffer;
};

export async function uploadKycDocument(
  _file: KycDocumentFile,
  _organizationId: string
): Promise<string | null> {
  console.warn('[storage] KYC document upload is not yet configured.');
  // Return null until storage integration is completed.
  return null;
}

export async function getKycDocumentUrl(_storageKey: string): Promise<string | null> {
  console.warn('[storage] KYC document URL generation is not yet configured.');
  return null;
}

// Storage abstraction.
//
// Two layers:
//
// 1. KYC document helpers — pre-existing stubs. Storage provider integration
//    for KYC is still pending; the functions below remain placeholders.
//
// 2. Private object storage — used by Phase 3C provider submission documents.
//    Objects are addressed by random keys under a caller-supplied prefix,
//    written outside the public web root, and retrieved only through
//    authorized server-side code. There is intentionally NO public URL for
//    any stored object.
//
// Backend selection (OBJECT_STORAGE_BACKEND):
//   local — private filesystem directory (default). OBJECT_STORAGE_DIR sets
//           the root; defaults to <cwd>/storage/private. Suitable for the
//           self-hosted deployment and for tests.
//   s3    — S3/R2-compatible object storage. Requires AWS_S3_BUCKET,
//           AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY AND an S3
//           client implementation. Not installed yet — selecting it fails
//           closed rather than silently degrading.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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

// ============================================================================
// Private object storage
// ============================================================================

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'INVALID_KEY' | 'IO'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

function storageBackend(): 'local' | 's3' {
  const backend = (process.env.OBJECT_STORAGE_BACKEND ?? 'local').toLowerCase();
  return backend === 's3' ? 's3' : 'local';
}

function localRoot(): string {
  const configured = process.env.OBJECT_STORAGE_DIR;
  const root = configured && configured.trim() ? configured.trim() : path.join(process.cwd(), 'storage', 'private');
  return path.resolve(root);
}

// Object keys are namespaced relative paths (e.g.
// "provider-submissions/<link>/<uuid>.pdf"). They must never be able to escape
// the storage root or smuggle absolute paths.
export function validateObjectKey(key: string): void {
  if (
    !key ||
    key.length > 512 ||
    key.includes('\0') ||
    key.includes('\\') ||
    key.startsWith('/') ||
    /^[a-zA-Z]:/.test(key) ||
    key.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')
  ) {
    throw new StorageError('Invalid storage object key', 'INVALID_KEY');
  }
}

function localPathFor(key: string): string {
  validateObjectKey(key);
  const root = localRoot();
  const resolved = path.resolve(root, ...key.split('/'));
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new StorageError('Invalid storage object key', 'INVALID_KEY');
  }
  return resolved;
}

function requireS3(): never {
  throw new StorageError(
    'S3 object storage backend is selected but not configured (AWS_S3_BUCKET/AWS credentials and an S3 client are required)',
    'NOT_CONFIGURED'
  );
}

export async function putPrivateObject(key: string, data: Buffer): Promise<void> {
  if (storageBackend() === 's3') requireS3();
  const target = localPathFor(key);
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' }); // never overwrite an existing object
  } catch (error) {
    throw new StorageError(
      `Failed to store object: ${error instanceof Error ? error.message : 'unknown'}`,
      'IO'
    );
  }
}

export async function getPrivateObject(key: string): Promise<Buffer | null> {
  if (storageBackend() === 's3') requireS3();
  try {
    return await readFile(localPathFor(key));
  } catch {
    return null;
  }
}

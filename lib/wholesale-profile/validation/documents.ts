// Server-side validation for provider document uploads.
//
// Defense in depth: extension allowlist AND MIME allowlist AND magic-byte
// signature checks AND size limits AND filename sanitization. Content-Type
// and the provider's filename are treated as claims, never as truth — the
// file signature decides the real type for binary formats.
//
// There is NO malware scanner installed in this environment. These checks
// prevent executable/script uploads and obvious extension spoofing; they do
// not constitute malware scanning.

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_DOCUMENTS_PER_LINK = 20;
export const MAX_DESCRIPTION_LEN = 500;

export const DOCUMENT_CATEGORIES = [
  'COMPANY_DOCUMENT',
  'LICENSE',
  'RATE_CARD',
  'AGREEMENT',
  'TECHNICAL_DOCUMENT',
  'COMPLIANCE_DOCUMENT',
  'OTHER',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// extension → allowed MIME types
const EXT_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

const SIGNATURES: Record<string, { bytes: number[]; label: string }[]> = {
  pdf: [{ bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], label: '%PDF-' }],
  png: [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: 'PNG' }],
  jpg: [{ bytes: [0xff, 0xd8, 0xff], label: 'JPEG SOI' }],
  jpeg: [{ bytes: [0xff, 0xd8, 0xff], label: 'JPEG SOI' }],
  // Office Open XML formats are ZIP containers — require a real ZIP header
  // so a non-OOXML file can't masquerade behind the extension.
  docx: [{ bytes: [0x50, 0x4b, 0x03, 0x04], label: 'ZIP/OOXML' }],
  xlsx: [{ bytes: [0x50, 0x4b, 0x03, 0x04], label: 'ZIP/OOXML' }],
};

// Binary signatures that must never be uploaded regardless of claimed type.
const FORBIDDEN_SIGNATURES: { bytes: number[]; label: string }[] = [
  { bytes: [0x4d, 0x5a], label: 'PE/MZ executable' }, // Windows .exe/.dll
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF executable' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: 'Java class / Mach-O' },
];

export type DocumentRejectReason =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'BAD_CATEGORY'
  | 'BAD_FILENAME'
  | 'BAD_EXTENSION'
  | 'MIME_MISMATCH'
  | 'SIGNATURE_MISMATCH'
  | 'EXECUTABLE_CONTENT';

export interface DocumentValidationOk {
  ok: true;
  ext: string;
  safeFileName: string;
}

export interface DocumentValidationRejected {
  ok: false;
  reason: DocumentRejectReason;
  message: string;
}

export function isAllowedDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

function hasSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((b, i) => buffer[i] === b);
}

// Sanitize a provider-supplied filename for DISPLAY and metadata only — it is
// never used as a storage key. Strips path segments, traversal, control
// characters, and null bytes.
export function sanitizeFileName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\.\./g, '')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  return cleaned.slice(0, 200);
}

export function documentExtension(safeFileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(safeFileName);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext in EXT_MIME ? ext : null;
}

export function validateDocumentUpload(input: {
  fileName: unknown;
  mimeType: unknown;
  buffer: Buffer;
}): DocumentValidationOk | DocumentValidationRejected {
  const { fileName, mimeType, buffer } = input;

  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'EMPTY', message: 'File is empty' };
  }
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, reason: 'TOO_LARGE', message: 'File exceeds the 10 MB limit' };
  }

  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    return { ok: false, reason: 'BAD_FILENAME', message: 'Invalid file name' };
  }

  const ext = documentExtension(safeFileName);
  if (!ext) {
    return { ok: false, reason: 'BAD_EXTENSION', message: 'File type is not supported' };
  }

  if (typeof mimeType !== 'string' || !EXT_MIME[ext].includes(mimeType)) {
    return {
      ok: false,
      reason: 'MIME_MISMATCH',
      message: 'File content type does not match the file type',
    };
  }

  // Executable signatures are rejected for every file type.
  for (const sig of FORBIDDEN_SIGNATURES) {
    if (hasSignature(buffer, sig.bytes)) {
      return { ok: false, reason: 'EXECUTABLE_CONTENT', message: 'Executable files are not accepted' };
    }
  }

  // Binary formats must carry their real signature — this catches files like
  // "report.pdf" that are actually scripts or executables.
  const required = SIGNATURES[ext];
  if (required && !required.some((sig) => hasSignature(buffer, sig.bytes))) {
    return { ok: false, reason: 'SIGNATURE_MISMATCH', message: 'File contents do not match the file type' };
  }

  // Text formats: reject control bytes that indicate disguised binary content.
  if (ext === 'txt' || ext === 'csv') {
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
    if (sample.includes(0x00)) {
      return { ok: false, reason: 'SIGNATURE_MISMATCH', message: 'File contents do not match the file type' };
    }
  }

  return { ok: true, ext, safeFileName };
}

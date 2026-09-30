import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import {
  validateDocumentUpload,
  sanitizeFileName,
  isAllowedDocumentCategory,
  MAX_DOCUMENT_BYTES,
  DOCUMENT_CATEGORIES,
} from '@/lib/wholesale-profile/validation/documents';
import {
  uploadProviderDocument,
  getSubmissionDocument,
} from '@/lib/wholesale-profile/services/documents';
import { getRolePermissions } from '@/lib/rbac/roles';
import type { AuthenticatedContext } from '@/lib/rbac/authorization';
import { putPrivateObject, getPrivateObject, validateObjectKey } from '@/lib/storage';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

const objects = new Map<string, Buffer>();
vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    putPrivateObject: vi.fn(async (key: string, data: Buffer) => {
      mod.validateObjectKey(key);
      objects.set(key, data);
    }),
    getPrivateObject: vi.fn(async (key: string) => objects.get(key) ?? null),
  };
});

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'vt_' + 'a'.repeat(40);

const PDF = Buffer.concat([Buffer.from('%PDF-1.4 fake'), Buffer.alloc(64, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
const TXT = Buffer.from('destination,rate\nGR,0.0125\n');
const EXE = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(64)]);
const SCRIPT = Buffer.from('#!/bin/sh\necho hi');

function validLink(overrides: object = {}) {
  return {
    id: 'ol1',
    organizationId: 'org-1',
    tokenHash: sha256(TOKEN),
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    maxSubmissions: 3,
    submissionCount: 0,
    ...overrides,
  };
}

function mockBackend(link: object | null = validLink()) {
  (prisma as any).onboardingLink = {
    findUnique: vi.fn(async ({ where }: any) =>
      link && where.tokenHash === (link as any).tokenHash ? link : null
    ),
  };
  (prisma as any).wholesaleProfile = {
    findUnique: vi.fn(async () => ({
      organizationId: 'org-1', requirementSetId: 'rs1',
      publishedVersionNumber: 1, status: 'ACTIVE', title: 't', subtitle: null,
    })),
  };
  (prisma as any).requirementVersion = {
    findUnique: vi.fn(async () => ({ id: 'rv1', status: 'PUBLISHED' })),
  };
  (prisma as any).requirementVersionSection = {
    findMany: vi.fn(async () => [{ id: 's1', key: 'K', title: 't', description: null, sortOrder: 1, visibility: 'PUBLISHABLE', isRequired: true, content: {} }]),
  };
  (prisma as any).providerSubmissionDocument = {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: any) => ({ id: 'doc-1', ...data })),
    findUnique: vi.fn(async () => null),
  };
  (prisma as any).providerSubmission = {
    findUnique: vi.fn(async () => null),
  };
}

const opsCtx: AuthenticatedContext = {
  user: { id: 'u2', name: 'Ops', email: 'ops@example.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Shivaksa', slug: 'shivaksa' },
  role: { id: 'r1', name: 'OPERATIONS_MANAGER' },
  permissions: getRolePermissions('OPERATIONS_MANAGER'),
};

const clientCtx: AuthenticatedContext = {
  ...opsCtx,
  role: { id: 'r4', name: 'CLIENT_ADMIN' },
  permissions: getRolePermissions('CLIENT_ADMIN'),
};

const attachedDoc = {
  id: 'doc-1',
  organizationId: 'org-1',
  onboardingLinkId: 'ol1',
  submissionId: 'ps1',
  category: 'RATE_CARD',
  originalFileName: 'rates.pdf',
  storedObjectKey: 'provider-submissions/ol1/abc-123.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 128,
  status: 'ATTACHED',
};

const attachedSubmission = { id: 'ps1', organizationId: 'org-1' };

describe('validateDocumentUpload — file security boundary', () => {
  it.each([
    ['rates.pdf', 'application/pdf', PDF],
    ['deck.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ZIP],
    ['rates.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ZIP],
    ['rates.csv', 'text/csv', TXT],
    ['notes.txt', 'text/plain', TXT],
    ['logo.png', 'image/png', PNG],
    ['scan.jpg', 'image/jpeg', JPEG],
    ['scan.jpeg', 'image/jpeg', JPEG],
  ])('accepts a valid %s', (fileName, mimeType, buffer) => {
    const r = validateDocumentUpload({ fileName, mimeType, buffer });
    expect(r.ok).toBe(true);
  });

  it.each([
    ['x.exe', 'application/octet-stream'], ['x.dll', 'application/octet-stream'],
    ['x.bat', 'text/plain'], ['x.cmd', 'text/plain'], ['x.ps1', 'text/plain'],
    ['x.sh', 'text/plain'], ['x.php', 'text/plain'], ['x.js', 'text/plain'],
    ['x.mjs', 'text/plain'], ['x.html', 'text/html'], ['x.htm', 'text/html'],
    ['x.svg', 'image/svg+xml'], ['x.pdf.exe', 'application/pdf'],
  ])('rejects %s', (fileName, mimeType) => {
    expect(validateDocumentUpload({ fileName, mimeType, buffer: PDF }).ok).toBe(false);
  });

  it('rejects MIME mismatch (pdf ext + text/plain)', () => {
    const r = validateDocumentUpload({ fileName: 'a.pdf', mimeType: 'text/plain', buffer: PDF });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('MIME_MISMATCH');
  });

  it('rejects a spoofed PDF (script content behind .pdf)', () => {
    const r = validateDocumentUpload({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: SCRIPT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('SIGNATURE_MISMATCH');
  });

  it('rejects a spoofed PNG and a spoofed DOCX', () => {
    expect(validateDocumentUpload({ fileName: 'a.png', mimeType: 'image/png', buffer: TXT }).ok).toBe(false);
    expect(validateDocumentUpload({
      fileName: 'a.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: PDF,
    }).ok).toBe(false);
  });

  it('rejects executable signatures even behind an allowed extension', () => {
    const r = validateDocumentUpload({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: EXE });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('EXECUTABLE_CONTENT');
  });

  it('rejects oversized and empty files', () => {
    const big = Buffer.concat([PDF, Buffer.alloc(MAX_DOCUMENT_BYTES)]);
    expect(validateDocumentUpload({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: big }).ok).toBe(false);
    expect(validateDocumentUpload({ fileName: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) }).ok).toBe(false);
  });

  it('rejects CSV/TXT carrying binary control bytes', () => {
    const bad = Buffer.concat([Buffer.from('a,b\n'), Buffer.from([0x00, 0x01])]);
    expect(validateDocumentUpload({ fileName: 'a.csv', mimeType: 'text/csv', buffer: bad }).ok).toBe(false);
  });

  it('sanitizes traversal filenames — the provider name is never a storage key', () => {
    for (const [name, expected] of [
      ['../../etc/passwd.pdf', 'passwd.pdf'],
      ['..\\..\\win\\x.pdf', 'x.pdf'],
      ['C:\\dir\\file.pdf', 'file.pdf'],
      ['/abs/path/file.pdf', 'file.pdf'],
      ['normal name (v2).pdf', 'normal name (v2).pdf'],
    ]) {
      expect(sanitizeFileName(name)).toBe(expected);
    }
    expect(sanitizeFileName('a\0b.pdf')).not.toContain('\0');
    expect(sanitizeFileName('..')).toBeNull();
  });

  it('enforces the category contract', () => {
    for (const c of DOCUMENT_CATEGORIES) expect(isAllowedDocumentCategory(c)).toBe(true);
    expect(isAllowedDocumentCategory('SECRET')).toBe(false);
    expect(isAllowedDocumentCategory('')).toBe(false);
  });

  it('storage key validation blocks traversal', () => {
    expect(() => validateObjectKey('provider-submissions/ol1/abc.pdf')).not.toThrow();
    for (const bad of ['../x', 'a/../../x', '/abs', 'a\\b', 'C:\\x', 'a//b', 'a/./b']) {
      expect(() => validateObjectKey(bad), bad).toThrow();
    }
  });
});

describe('uploadProviderDocument — token-scoped private upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    objects.clear();
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
  });

  it('stores a valid PDF privately and records PENDING metadata', async () => {
    const doc = await uploadProviderDocument(TOKEN, {
      category: 'RATE_CARD', fileName: 'rates.pdf', mimeType: 'application/pdf', buffer: PDF,
    });

    const data = (prisma as any).providerSubmissionDocument.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
    expect(data.onboardingLinkId).toBe('ol1');
    expect(data.submissionId).toBeNull();
    expect(data.status).toBe('PENDING');
    expect(data.scanStatus).toBe('NOT_SCANNED');
    expect(data.originalFileName).toBe('rates.pdf');

    // Object written under provider-submissions/<link>/<uuid>.pdf — random,
    // never derived from the provider's filename or token.
    expect(data.storedObjectKey).toMatch(/^provider-submissions\/ol1\/[0-9a-f-]{36}\.pdf$/);
    expect(data.storedObjectKey).not.toContain('rates');
    expect(data.storedObjectKey).not.toContain(TOKEN);
    expect(putPrivateObject).toHaveBeenCalledWith(data.storedObjectKey, PDF);
    expect(objects.get(data.storedObjectKey)).toEqual(PDF);

    // Response carries only safe metadata — no storage key, no token.
    expect(doc.fileName).toBe('rates.pdf');
    expect(JSON.stringify(doc)).not.toContain(data.storedObjectKey);
    expect(JSON.stringify(doc)).not.toContain(TOKEN);
  });

  it('two uploads get different random keys', async () => {
    (prisma as any).providerSubmissionDocument.create
      .mockImplementationOnce(async ({ data }: any) => ({ id: 'd1', ...data }))
      .mockImplementationOnce(async ({ data }: any) => ({ id: 'd2', ...data }));
    await uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF });
    await uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF });
    const keys = objects.keys();
    expect(new Set(keys).size).toBe(2);
  });

  it.each([
    ['invalid token', () => mockBackend(null)],
    ['expired link', () => mockBackend(validLink({ expiresAt: new Date(Date.now() - 1) }))],
    ['revoked link', () => mockBackend(validLink({ revokedAt: new Date() }))],
    ['maxSubmissions reached', () => mockBackend(validLink({ submissionCount: 3 }))],
  ])('fails closed: %s → nothing stored, nothing written', async (_name, setup) => {
    setup();
    await expect(
      uploadProviderDocument(TOKEN, { category: 'RATE_CARD', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF })
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(objects.size).toBe(0);
    expect((prisma as any).providerSubmissionDocument.create).not.toHaveBeenCalled();
  });

  it('fails when the published profile no longer resolves', async () => {
    (prisma as any).wholesaleProfile.findUnique.mockResolvedValue({ status: 'ARCHIVED' });
    await expect(
      uploadProviderDocument(TOKEN, { category: 'RATE_CARD', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF })
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(objects.size).toBe(0);
  });

  it('rejects a bad category and audits the rejection without content', async () => {
    await expect(
      uploadProviderDocument(TOKEN, { category: 'SECRET', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_DOCUMENT_REJECTED');
    expect(auditArgs).toContain('BAD_CATEGORY');
    expect(auditArgs).not.toContain(TOKEN);
    expect(auditArgs).not.toContain('%PDF-1.4');
    expect(objects.size).toBe(0);
    expect((prisma as any).providerSubmissionDocument.create).not.toHaveBeenCalled();
  });

  it('rejects an executable and audits the rejection', async () => {
    await expect(
      uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: EXE })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('EXECUTABLE_CONTENT');
    expect(objects.size).toBe(0);
  });

  it('enforces the per-link document cap', async () => {
    (prisma as any).providerSubmissionDocument.count.mockResolvedValue(20);
    await expect(
      uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF })
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(objects.size).toBe(0);
  });

  it('uploading never touches submissionCount', async () => {
    await uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF });
    expect((prisma as any).onboardingLink.update).toBeUndefined();
  });

  it('upload audit contains no token, hash, or file content', async () => {
    await uploadProviderDocument(TOKEN, { category: 'OTHER', fileName: 'a.pdf', mimeType: 'application/pdf', buffer: PDF });
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_DOCUMENT_UPLOADED');
    expect(auditArgs).not.toContain(TOKEN);
    expect(auditArgs).not.toContain(sha256(TOKEN));
    expect(auditArgs).not.toContain('%PDF-1.4');
  });
});

describe('getSubmissionDocument — internal authorized retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    objects.clear();
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
    objects.set('provider-submissions/ol1/abc-123.pdf', PDF);
    (prisma as any).providerSubmission.findUnique.mockResolvedValue(attachedSubmission);
    (prisma as any).providerSubmissionDocument.findUnique.mockResolvedValue(attachedDoc);
  });

  it('returns the file to authorized staff in the owning org', async () => {
    const doc = await getSubmissionDocument(opsCtx, 'ps1', 'doc-1');
    expect(doc.buffer).toEqual(PDF);
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.fileName).toBe('rates.pdf');
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('PROVIDER_SUBMISSION_DOCUMENT_ACCESSED');
  });

  it('denies client roles', async () => {
    await expect(getSubmissionDocument(clientCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getPrivateObject).not.toHaveBeenCalled();
  });

  it('denies a submission outside the org', async () => {
    (prisma as any).providerSubmission.findUnique.mockResolvedValue({ ...attachedSubmission, organizationId: 'org-2' });
    await expect(getSubmissionDocument(opsCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('denies a document attached to a different submission', async () => {
    (prisma as any).providerSubmissionDocument.findUnique.mockResolvedValue({ ...attachedDoc, submissionId: 'ps-other' });
    await expect(getSubmissionDocument(opsCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(getPrivateObject).not.toHaveBeenCalled();
  });

  it('denies a document in another organization even when IDs match', async () => {
    (prisma as any).providerSubmissionDocument.findUnique.mockResolvedValue({ ...attachedDoc, organizationId: 'org-2' });
    await expect(getSubmissionDocument(opsCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('denies access to PENDING documents through the submission path', async () => {
    (prisma as any).providerSubmissionDocument.findUnique.mockResolvedValue({ ...attachedDoc, status: 'PENDING', submissionId: null });
    await expect(getSubmissionDocument(opsCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns 404 when the object is absent from storage', async () => {
    objects.clear();
    await expect(getSubmissionDocument(opsCtx, 'ps1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

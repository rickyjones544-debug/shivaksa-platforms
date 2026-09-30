import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import Page from '@/app/wholesale/provider/[token]/page';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {} as any,
}));

// Deterministic headers + a controllable rate-limit verdict
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

const rateLimitState = { allowed: true };
vi.mock('@/lib/rate-limit', () => ({
  checkIdentifierRateLimit: vi.fn(() => rateLimitState.allowed),
}));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const TOKEN = 'vt_' + 'a'.repeat(40);

function mockBackend({
  link = undefined as object | null | undefined,
  profile = undefined as object | null | undefined,
  version = undefined as object | null | undefined,
  sections = undefined as object[] | undefined,
} = {}) {
  const validLink = link === undefined ? {
    id: 'ol1',
    organizationId: 'org-1',
    tokenHash: sha256(TOKEN),
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    viewCount: 0,
    submissionCount: 0,
  } : link;

  const activeProfile = profile === undefined ? {
    id: 'wp1',
    organizationId: 'org-1',
    requirementSetId: 'rs1',
    publishedVersionNumber: 1,
    status: 'ACTIVE',
    title: 'Wholesale Voice Partnership — Shivaksa Technologies LLC',
    subtitle: 'International wholesale termination · carrier relationships · traffic coordination',
  } : profile;

  const publishedVersion = version === undefined ? {
    id: 'rv1', requirementSetId: 'rs1', versionNumber: 1, status: 'PUBLISHED',
  } : version;

  const publishableSections = sections === undefined ? [
    {
      id: 's1', requirementVersionId: 'rv1', key: 'COMPANY_PROFILE',
      title: 'Company Profile', description: null, sortOrder: 10,
      visibility: 'PUBLISHABLE', isRequired: true,
      content: { body: 'Shivaksa Technologies LLC is a U.S.-registered technology and communications company.' },
    },
    {
      id: 's2', requirementVersionId: 'rv1', key: 'DESTINATIONS',
      title: 'Target Destinations', description: null, sortOrder: 40,
      visibility: 'PUBLISHABLE', isRequired: true,
      content: { destinations: [{ name: 'Greece', iso2: 'GR', classification: 'BOTH', priority: 'PRIORITY' }] },
    },
  ] : sections;

  (prisma as any).onboardingLink = {
    findUnique: vi.fn(async ({ where }: any) =>
      validLink && where.tokenHash === (validLink as any).tokenHash ? validLink : null
    ),
    update: vi.fn(async () => ({})),
  };
  (prisma as any).wholesaleProfile = {
    findUnique: vi.fn(async ({ where }: any) =>
      activeProfile && (activeProfile as any).organizationId === where.organizationId
        ? activeProfile
        : null
    ),
  };
  (prisma as any).requirementVersion = {
    findUnique: vi.fn(async () => publishedVersion),
  };
  (prisma as any).requirementVersionSection = {
    findMany: vi.fn(async ({ where }: any) =>
      (publishableSections ?? []).filter((s: any) => s.visibility === where.visibility)
    ),
  };
}

async function render(token: string): Promise<string> {
  const element = await Page({ params: Promise.resolve({ token }) });
  return renderToStaticMarkup(element as ReactElement);
}

describe('Provider-facing wholesale page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitState.allowed = true;
    (prisma as any).auditLog = { create: vi.fn() };
    mockBackend();
  });

  it('renders the published profile for a valid token', async () => {
    const html = await render(TOKEN);
    expect(html).toContain('Wholesale Voice Partnership — Shivaksa Technologies LLC');
    expect(html).toContain('Company Profile');
    expect(html).toContain('Target Destinations');
    expect(html).toContain('Greece');
    expect(html).toContain('U.S.-registered technology');
  });

  it('increments viewCount via the service path for a valid view', async () => {
    await render(TOKEN);
    const update = (prisma as any).onboardingLink.update;
    expect(update).toHaveBeenCalledTimes(1);
    const args = update.mock.calls[0][0];
    expect(args.data.viewCount).toEqual({ increment: 1 });
    expect(args.data).not.toHaveProperty('submissionCount');
  });

  it('writes an audit event containing no raw token or token hash', async () => {
    await render(TOKEN);
    const auditArgs = JSON.stringify((prisma as any).auditLog.create.mock.calls);
    expect(auditArgs).toContain('ONBOARDING_LINK_VIEWED');
    expect(auditArgs).not.toContain(TOKEN);
    expect(auditArgs).not.toContain(sha256(TOKEN));
  });

  it('shows one generic message for invalid, expired, and revoked tokens', async () => {
    const invalid = await render('vt_' + 'z'.repeat(40));
    expect(invalid).toContain('no longer available');
    expect(invalid).not.toContain('Company Profile');

    for (const bad of [
      { expiresAt: new Date(Date.now() - 1000), revokedAt: null },
      { expiresAt: new Date(Date.now() + 86400_000), revokedAt: new Date() },
    ]) {
      mockBackend({ link: { id: 'ol1', organizationId: 'org-1', tokenHash: sha256(TOKEN), viewCount: 0, submissionCount: 0, ...bad } });
      const html = await render(TOKEN);
      expect(html).toContain('no longer available');
      // Never reveal WHY the link failed
      for (const reason of ['expired', 'revoked', 'invalid', 'not found']) {
        expect(html.toLowerCase()).not.toContain(reason);
      }
    }
  });

  it('rate-limited requests render the same generic failure', async () => {
    rateLimitState.allowed = false;
    const html = await render(TOKEN);
    expect(html).toContain('no longer available');
    expect(html).not.toContain('rate limit');
    expect((prisma as any).onboardingLink.update).not.toHaveBeenCalled();
  });

  it('does not increment viewCount for invalid tokens', async () => {
    await render('vt_' + 'z'.repeat(40));
    expect((prisma as any).onboardingLink.update).not.toHaveBeenCalled();
  });

  it('fails closed when the profile is inactive or archived', async () => {
    for (const status of ['DRAFT', 'ARCHIVED']) {
      vi.clearAllMocks();
      (prisma as any).auditLog = { create: vi.fn() };
      mockBackend({ profile: { id: 'wp1', organizationId: 'org-1', requirementSetId: 'rs1', publishedVersionNumber: 1, status, title: 't', subtitle: null } });
      const html = await render(TOKEN);
      expect(html).toContain('no longer available');
      expect((prisma as any).onboardingLink.update).not.toHaveBeenCalled();
    }
  });

  it('fails closed when publishedVersionNumber is missing', async () => {
    mockBackend({ profile: { id: 'wp1', organizationId: 'org-1', requirementSetId: 'rs1', publishedVersionNumber: null, status: 'ACTIVE', title: 't', subtitle: null } });
    expect(await render(TOKEN)).toContain('no longer available');
  });

  it('fails closed when the requirement version is not PUBLISHED', async () => {
    for (const status of ['DRAFT', 'SUPERSEDED', 'ARCHIVED']) {
      mockBackend({ version: { id: 'rv1', requirementSetId: 'rs1', versionNumber: 1, status } });
      expect(await render(TOKEN)).toContain('no longer available');
    }
  });

  it('fails closed when there are no publishable sections', async () => {
    mockBackend({ sections: [] });
    expect(await render(TOKEN)).toContain('no longer available');
  });

  it('INTERNAL sections never render, even alongside publishable ones', async () => {
    mockBackend({
      sections: [
        { id: 's1', key: 'COMPANY_PROFILE', title: 'Company Profile', description: null, sortOrder: 10, visibility: 'PUBLISHABLE', isRequired: true, content: { body: 'safe' } },
        { id: 'sX', key: 'INTERNAL_NOTES', title: 'Internal Only', description: 'secret', sortOrder: 99, visibility: 'INTERNAL', isRequired: false, content: { body: 'internal secret' } },
      ],
    });
    const html = await render(TOKEN);
    expect(html).toContain('Company Profile');
    expect(html).not.toContain('Internal Only');
    expect(html).not.toContain('internal secret');
  });

  it('never embeds the bearer token or internal IDs in the rendered page', async () => {
    const html = await render(TOKEN);
    for (const secret of [TOKEN, sha256(TOKEN), 'tokenHash', 'viewCount', 'ol1', 'wp1', 'rs1', 'rv1', 'org-1', 's1', 's2', 'requirementVersionId', 'organizationId']) {
      expect(html, `page must not contain "${secret}"`).not.toContain(secret);
    }
  });

  it('exposes no internal navigation, login, or admin surface', async () => {
    const html = await render(TOKEN);
    for (const nav of ['href="/admin', 'href="/client', 'href="/login', 'href="/register', 'href="/voip', 'Dashboard']) {
      expect(html).not.toContain(nav);
    }
  });

  it('resolves the organization only through the validated link — no query input', async () => {
    await render(TOKEN);
    expect((prisma as any).wholesaleProfile.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
    // The version query uses the profile's own pointer, never request input
    expect((prisma as any).requirementVersion.findUnique).toHaveBeenCalledWith({
      where: { requirementSetId_versionNumber: { requirementSetId: 'rs1', versionNumber: 1 } },
    });
  });

  it('metadata forbids indexing', async () => {
    const { metadata } = await import('@/app/wholesale/provider/[token]/page');
    expect(metadata?.robots).toMatchObject({ index: false, follow: false });
    expect(String(metadata?.title)).not.toContain(TOKEN);
  });
});

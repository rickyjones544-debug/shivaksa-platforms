import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOrganizationApprovedForVoip, assertVoipEligibility } from '@/lib/voip/services/eligibility';
import { canEditKycRecord, canReviewKycRecord } from '@/lib/compliance/service';
import { KycRecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    kycRecord: { findUnique: vi.fn() },
  },
}));

const customerCtx = {
  user: { id: 'u1', name: 'Customer', email: 'c@a.com', isSuperAdmin: false },
  membership: { id: 'm1', organizationId: 'org-1', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
  role: { id: 'r1', name: 'CLIENT_ADMIN' },
  permissions: [],
};

const otherCustomerCtx = {
  user: { id: 'u2', name: 'Customer 2', email: 'c2@a.com', isSuperAdmin: false },
  membership: { id: 'm2', organizationId: 'org-2', roleId: 'r1', status: 'ACTIVE' },
  organization: { id: 'org-2', name: 'Org 2', slug: 'org-2' },
  role: { id: 'r1', name: 'CLIENT_ADMIN' },
  permissions: [],
};

const superAdminCtx = {
  user: { id: 'u3', name: 'Admin', email: 'admin@a.com', isSuperAdmin: true },
  membership: null,
  organization: null,
  role: null,
  permissions: [],
};

const complianceAdminCtx = {
  user: { id: 'u4', name: 'Compliance', email: 'compliance@a.com', isSuperAdmin: false },
  membership: { id: 'm4', organizationId: 'org-admin', roleId: 'r2', status: 'ACTIVE' },
  organization: { id: 'org-admin', name: 'Admin Org', slug: 'admin' },
  role: { id: 'r2', name: 'COMPLIANCE_ADMIN' },
  permissions: ['compliance:manage:organizations'],
};

describe('KYC/KYB onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves VoIP eligibility when organization is ACTIVE and KYC is APPROVED', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.APPROVED });

    const result = await isOrganizationApprovedForVoip('org-1');
    expect(result).toBe(true);
  });

  it('rejects VoIP eligibility when organization is SUSPENDED', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'SUSPENDED' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.APPROVED });

    const result = await isOrganizationApprovedForVoip('org-1');
    expect(result).toBe(false);
  });

  it('rejects VoIP eligibility when KYC record is missing', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue(null);

    const result = await isOrganizationApprovedForVoip('org-1');
    expect(result).toBe(false);
  });

  it('rejects VoIP eligibility when KYC is REJECTED', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.REJECTED });

    const result = await isOrganizationApprovedForVoip('org-1');
    expect(result).toBe(false);
  });

  it('rejects VoIP eligibility when KYC is MORE_INFORMATION_REQUIRED', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.MORE_INFORMATION_REQUIRED });

    const result = await isOrganizationApprovedForVoip('org-1');
    expect(result).toBe(false);
  });

  it('assertVoipEligibility does not throw for approved organization', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.APPROVED });

    await expect(assertVoipEligibility('org-1')).resolves.not.toThrow();
  });

  it('assertVoipEligibility throws for unapproved organization', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ status: 'ACTIVE' });
    (prisma.kycRecord.findUnique as any).mockResolvedValue({ status: KycRecordStatus.SUBMITTED });

    await expect(assertVoipEligibility('org-1')).rejects.toThrow('not approved for VoIP');
  });

  it('customer can edit own onboarding record when status is DRAFT', () => {
    expect(canEditKycRecord(customerCtx, 'org-1', KycRecordStatus.DRAFT)).toBe(true);
  });

  it('customer cannot edit own onboarding record when status is SUBMITTED', () => {
    expect(canEditKycRecord(customerCtx, 'org-1', KycRecordStatus.SUBMITTED)).toBe(false);
  });

  it('customer cannot edit another organizations onboarding record', () => {
    expect(canEditKycRecord(customerCtx, 'org-2', KycRecordStatus.DRAFT)).toBe(false);
  });

  it('super admin can review any onboarding record', () => {
    expect(canReviewKycRecord(superAdminCtx)).toBe(true);
  });

  it('compliance admin without super admin cannot review onboarding records', () => {
    expect(canReviewKycRecord(complianceAdminCtx)).toBe(false);
  });

  it('regular client cannot review onboarding records', () => {
    expect(canReviewKycRecord(customerCtx)).toBe(false);
  });
});

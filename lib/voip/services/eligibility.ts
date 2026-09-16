import { prisma } from '@/lib/db/prisma';
import { KycRecordStatus } from '@prisma/client';

export async function isOrganizationApprovedForVoip(organizationId: string): Promise<boolean> {
  const [organization, kycRecord] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { status: true } }),
    prisma.kycRecord.findUnique({ where: { organizationId }, select: { status: true } }),
  ]);

  return organization?.status === 'ACTIVE' && kycRecord?.status === KycRecordStatus.APPROVED;
}

export async function assertVoipEligibility(organizationId: string): Promise<void> {
  if (!(await isOrganizationApprovedForVoip(organizationId))) {
    throw new Error('Organization is not approved for VoIP. Complete KYC/KYB onboarding first.');
  }
}

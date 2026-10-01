import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';

const INTERESTS = new Set([
  'software-development',
  'voip-wholesale-voice',
  'dialer-solutions',
  'ai-voice-agents',
  'crm-automation',
  'other',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, 'contact', 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request.' },
        { status: 400 }
      );
    }

    // Honeypot: hidden field that real users never fill. Bots get a fake success
    // so they do not learn that the submission was dropped.
    if (clean(body.website, 200)) {
      return NextResponse.json({ success: true });
    }

    const name = clean(body.name, 120);
    const email = clean(body.email, 200).toLowerCase();
    const company = clean(body.company, 200);
    const interest = clean(body.interest, 60);
    const phone = clean(body.phone, 40);
    const message = clean(body.message, 2000);

    if (!name || !EMAIL_RE.test(email) || !company || !INTERESTS.has(interest)) {
      return NextResponse.json(
        { success: false, error: 'Please complete all required fields.' },
        { status: 400 }
      );
    }

    await prisma.auditLog.create({
      data: {
        action: 'PUBLIC_CONTACT_SUBMISSION',
        resource: 'contact_form',
        ipAddress: getRateLimitIdentifier(request),
        metadata: {
          name,
          email,
          company,
          interest,
          ...(phone ? { phone } : {}),
          ...(message ? { message } : {}),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

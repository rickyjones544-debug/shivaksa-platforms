import { describe, it, expect } from 'vitest';
import { validateProviderSubmission } from '@/lib/wholesale-profile/validation/submission';

const minimal = { company: { companyName: 'Acme Telecom Ltd' } };

const full = {
  company: {
    companyName: 'Acme Telecom Ltd',
    legalName: 'Acme Telecom Holdings Ltd',
    website: 'https://acme.example.com',
    country: 'Greece',
    registrationJurisdiction: 'Athens',
    companyType: 'LLC',
    yearsInBusiness: 12,
    businessDescription: 'Wholesale VoIP termination provider.',
  },
  contacts: [
    { role: 'SALES', name: 'Jane Sales', email: 'sales@acme.example.com', phone: '+30210' },
    { role: 'NOC', name: 'Noc Guy', timezone: 'EET' },
  ],
  wholesaleProfile: {
    serviceType: 'Wholesale voice termination',
    internationalTermination: true,
    wholesaleOnly: true,
  },
  destinations: [
    { country: 'Greece', countryCode: 'GR', prefix: '30', routeType: 'BOTH', availability: 'Direct routes' },
  ],
  rates: [
    { destination: 'Greece Mobile', prefix: '3069', routeType: 'MOBILE', rate: '0.0125', currency: 'USD', billingIncrement: '60/60' },
  ],
  connectivity: {
    connectionType: 'SIP',
    providerIp: '203.0.113.10',
    providerPort: 5060,
    transport: 'UDP',
    cps: 20,
    maxChannels: 500,
    codecs: 'G.711, G.729',
    registrationRequired: false,
    authenticationMethod: 'IP auth',
  },
  cliAni: { cliModes: ['passthrough', 'restricted'], cliNotes: 'Passthrough on GR routes' },
  cdr: {
    cdrAvailable: true,
    cdrFormat: 'CSV',
    deliveryMethod: 'SFTP',
    deliveryFrequency: 'daily',
    fieldsAvailable: ['CALL_ID', 'DURATION'],
    perCallCostAvailable: true,
  },
  commercial: { billingModel: 'prepaid', billingCurrency: 'USD', paymentTerms: 'Net 7' },
  compliance: { companyRegistrationAvailable: true, fraudControls: 'Traffic monitoring' },
  additionalNotes: 'Available for testing weekdays.',
};

describe('Provider submission validation', () => {
  it('accepts a minimal valid payload', () => {
    const r = validateProviderSubmission(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.company?.companyName).toBe('Acme Telecom Ltd');
  });

  it('accepts a full valid payload', () => {
    const r = validateProviderSubmission(full);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.rates).toHaveLength(1);
      expect(r.data.connectivity?.providerPort).toBe(5060);
    }
  });

  it('rejects non-object input', () => {
    for (const bad of [null, 'x', 42, [1, 2]]) {
      expect(validateProviderSubmission(bad).ok).toBe(false);
    }
  });

  it('requires company.companyName', () => {
    expect(validateProviderSubmission({}).ok).toBe(false);
    expect(validateProviderSubmission({ company: {} }).ok).toBe(false);
  });

  it('rejects unknown top-level fields', () => {
    const r = validateProviderSubmission({ ...minimal, internalFlag: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('internalFlag');
  });

  it('rejects unknown nested fields', () => {
    const r = validateProviderSubmission({
      ...minimal,
      company: { ...minimal.company, secretField: 'x' },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects request-injected ownership/identity fields', () => {
    for (const key of ['organizationId', 'providerId', 'submissionId', 'userId', 'onboardingLinkId', 'submissionCount', 'documents']) {
      const r = validateProviderSubmission({ ...minimal, [key]: 'injected' });
      expect(r.ok, `${key} must be rejected`).toBe(false);
    }
  });

  it('contact role OTHER is rejected — approved roles only', () => {
    const bad = validateProviderSubmission({ ...minimal, contacts: [{ role: 'OTHER', name: 'x' }] });
    expect(bad.ok).toBe(false);
    for (const role of ['SALES', 'NOC', 'TECHNICAL', 'BILLING', 'RATES', 'ACCOUNT']) {
      expect(validateProviderSubmission({ ...minimal, contacts: [{ role, name: 'x' }] }).ok, role).toBe(true);
    }
  });

  it.each([
    'password', 'sipPassword', 'apiKey', 'api_key', 'secret', 'privateKey',
    'private_key', 'credential', 'credentials', 'bearerToken', 'auth_token', 'passphrase',
  ])('rejects credential-bearing key: %s', (key) => {
    const r = validateProviderSubmission({ ...minimal, company: { ...minimal.company, [key]: 'x' } });
    expect(r.ok).toBe(false);
  });

  it('rejects secret keys nested anywhere in the payload', () => {
    const r = validateProviderSubmission({
      ...minimal,
      rates: [{ destination: 'GR', sipSecret: 'abc' }],
    });
    expect(r.ok).toBe(false);
  });

  it('enforces enum values', () => {
    expect(validateProviderSubmission({ ...minimal, contacts: [{ role: 'CEO', name: 'x' }] }).ok).toBe(false);
    expect(validateProviderSubmission({ ...minimal, connectivity: { connectionType: 'H323' } }).ok).toBe(false);
    expect(validateProviderSubmission({ ...minimal, commercial: { billingModel: 'net30' } }).ok).toBe(false);
    expect(validateProviderSubmission({ ...minimal, destinations: [{ country: 'GR', routeType: 'VOIP' }] }).ok).toBe(false);
  });

  it('validates contact email format', () => {
    const r = validateProviderSubmission({ ...minimal, contacts: [{ role: 'SALES', name: 'x', email: 'not-an-email' }] });
    expect(r.ok).toBe(false);
  });

  it('validates cliModes values', () => {
    expect(validateProviderSubmission({ ...minimal, cliAni: { cliModes: ['passthrough', 'spoofing'] } }).ok).toBe(false);
  });

  it('enforces type and length bounds', () => {
    expect(validateProviderSubmission({ ...minimal, company: { companyName: 'x'.repeat(301) } }).ok).toBe(false);
    expect(validateProviderSubmission({ ...minimal, connectivity: { providerPort: 70000 } }).ok).toBe(false);
    expect(validateProviderSubmission({ ...minimal, company: { companyName: 'x', yearsInBusiness: 'many' } }).ok).toBe(false);
  });

  it('enforces array size bounds', () => {
    const r = validateProviderSubmission({
      ...minimal,
      contacts: Array.from({ length: 26 }, (_, i) => ({ role: 'SALES', name: `c${i}` })),
    });
    expect(r.ok).toBe(false);
  });

  it('output contains only declared fields — no prototype pollution or extras survive', () => {
    const r = validateProviderSubmission({
      ...minimal,
      company: { ...minimal.company, __proto__: { admin: true }, hacker: 1 },
    });
    expect(r.ok).toBe(false);
    const ok = validateProviderSubmission(full);
    if (ok.ok) {
      const json = JSON.stringify(ok.data);
      for (const k of ['organizationId', 'providerId', 'status', 'reviewNotes', 'onboardingLinkId']) {
        expect(json).not.toContain(k);
      }
    }
  });

  it('trims strings and coerces numeric strings for number fields', () => {
    const r = validateProviderSubmission({
      company: { companyName: '  Acme  ' },
      connectivity: { cps: '20' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.company?.companyName).toBe('Acme');
      expect(r.data.connectivity?.cps).toBe(20);
    }
  });
});

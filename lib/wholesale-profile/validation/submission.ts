// Strict server-side schema for provider intake submissions.
//
// No validation library exists in this codebase, so this is an explicit
// whitelist validator: every object only accepts declared keys, every value
// is type-checked and length-bounded, and keys that look like credential
// material are rejected at any depth. Provider input never reaches the
// database without passing this boundary first.

export interface ProviderSubmissionPayload {
  company?: {
    companyName: string;
    legalName?: string;
    website?: string;
    country?: string;
    registrationJurisdiction?: string;
    companyType?: string;
    yearsInBusiness?: number;
    businessDescription?: string;
  };
  contacts?: Array<{
    role: string;
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    messaging?: string;
    timezone?: string;
    notes?: string;
  }>;
  wholesaleProfile?: {
    serviceType?: string;
    trafficType?: string;
    coverage?: string;
    terminationCapabilities?: string;
    originationCapabilities?: string;
    internationalTermination?: boolean;
    wholesaleOnly?: boolean;
    expectedTrafficDescription?: string;
  };
  destinations?: Array<{
    country: string;
    countryCode?: string;
    prefix?: string;
    routeType?: string;
    availability?: string;
    notes?: string;
  }>;
  rates?: Array<{
    destination: string;
    prefix?: string;
    routeType?: string;
    rate?: string;
    currency?: string;
    billingIncrement?: string;
    minimumDuration?: string;
    effectiveDate?: string;
    notes?: string;
  }>;
  connectivity?: {
    connectionType?: string;
    providerIp?: string;
    providerPort?: number;
    transport?: string;
    techPrefix?: string;
    cps?: number;
    maxChannels?: number;
    codecs?: string;
    registrationRequired?: boolean;
    natRequirements?: string;
    authenticationMethod?: string;
    mediaRequirements?: string;
    technicalNotes?: string;
  };
  cliAni?: {
    cliModes?: string[];
    destinationRestrictions?: string;
    aniRequirements?: string;
    cliNotes?: string;
  };
  cdr?: {
    cdrAvailable?: boolean;
    cdrFormat?: string;
    deliveryMethod?: string;
    deliveryFrequency?: string;
    timezone?: string;
    fieldsAvailable?: string[];
    perCallCostAvailable?: boolean;
    providerReferenceAvailable?: boolean;
    cdrNotes?: string;
  };
  commercial?: {
    billingModel?: string;
    paymentTerms?: string;
    minimumCommitment?: string;
    creditTerms?: string;
    billingCurrency?: string;
    billingIncrement?: string;
    minimumDuration?: string;
    rateValidity?: string;
    commercialNotes?: string;
  };
  compliance?: {
    companyRegistrationAvailable?: boolean;
    telecomLicensingInformation?: string;
    complianceDocumentationAvailable?: boolean;
    acceptableUsePolicyAvailable?: boolean;
    fraudControls?: string;
    complianceNotes?: string;
  };
  additionalNotes?: string;
}

export const CONTACT_ROLES = ['SALES', 'NOC', 'TECHNICAL', 'BILLING', 'RATES', 'ACCOUNT'] as const;
export const ROUTE_TYPES = ['FIXED', 'MOBILE', 'BOTH'] as const;
export const CONNECTION_TYPES = ['SIP', 'IP_AUTH', 'SIP_CREDENTIAL', 'OTHER'] as const;
export const CLI_MODES = ['passthrough', 'presentation', 'rewriting', 'restricted', 'validation'] as const;
export const BILLING_MODELS = ['prepaid', 'postpaid'] as const;

// Keys that indicate credential material — rejected at ANY depth. Provider
// submissions must never carry secrets; credentials move through a separate
// internal encrypted workflow.
const FORBIDDEN_KEY = /pass(word|wd|phrase)|secret|api[_-]?key|private[_-]?key|credential|bearer|auth[_-]?token/i;

type FieldSpec =
  | { kind: 'string'; required?: boolean; max?: number }
  | { kind: 'number'; required?: boolean; min?: number; max?: number }
  | { kind: 'boolean'; required?: boolean }
  | { kind: 'enum'; values: readonly string[]; required?: boolean }
  | { kind: 'stringArray'; required?: boolean; maxItems?: number; maxLen?: number }
  | { kind: 'object'; required?: boolean; spec: Record<string, FieldSpec> }
  | { kind: 'objectArray'; required?: boolean; spec: Record<string, FieldSpec>; maxItems?: number };

const S = (max = 500, required = false): FieldSpec => ({ kind: 'string', max, required });
const OPT_S = (max = 500): FieldSpec => S(max, false);
const B = (): FieldSpec => ({ kind: 'boolean' });
const N = (max = 1_000_000): FieldSpec => ({ kind: 'number', min: 0, max });
const E = (values: readonly string[], required = false): FieldSpec => ({ kind: 'enum', values, required });
const SA = (maxItems = 50, maxLen = 200): FieldSpec => ({ kind: 'stringArray', maxItems, maxLen });

const CONTACT_SPEC: Record<string, FieldSpec> = {
  role: E(CONTACT_ROLES, true),
  name: S(200, true),
  title: OPT_S(200),
  email: OPT_S(320),
  phone: OPT_S(64),
  messaging: OPT_S(200),
  timezone: OPT_S(100),
  notes: OPT_S(2000),
};

const DESTINATION_SPEC: Record<string, FieldSpec> = {
  country: S(120, true),
  countryCode: OPT_S(8),
  prefix: OPT_S(32),
  routeType: E(ROUTE_TYPES),
  availability: OPT_S(500),
  notes: OPT_S(2000),
};

const RATE_SPEC: Record<string, FieldSpec> = {
  destination: S(200, true),
  prefix: OPT_S(32),
  routeType: E(ROUTE_TYPES),
  rate: OPT_S(64),
  currency: OPT_S(8),
  billingIncrement: OPT_S(32),
  minimumDuration: OPT_S(32),
  effectiveDate: OPT_S(40),
  notes: OPT_S(2000),
};

const ROOT_SPEC: Record<string, FieldSpec> = {
  company: {
    kind: 'object',
    spec: {
      companyName: S(300, true),
      legalName: OPT_S(300),
      website: OPT_S(500),
      country: OPT_S(120),
      registrationJurisdiction: OPT_S(200),
      companyType: OPT_S(200),
      yearsInBusiness: N(500),
      businessDescription: OPT_S(5000),
    },
  },
  contacts: { kind: 'objectArray', spec: CONTACT_SPEC, maxItems: 25 },
  wholesaleProfile: {
    kind: 'object',
    spec: {
      serviceType: OPT_S(300),
      trafficType: OPT_S(300),
      coverage: OPT_S(2000),
      terminationCapabilities: OPT_S(2000),
      originationCapabilities: OPT_S(2000),
      internationalTermination: B(),
      wholesaleOnly: B(),
      expectedTrafficDescription: OPT_S(2000),
    },
  },
  destinations: { kind: 'objectArray', spec: DESTINATION_SPEC, maxItems: 500 },
  rates: { kind: 'objectArray', spec: RATE_SPEC, maxItems: 2000 },
  connectivity: {
    kind: 'object',
    spec: {
      connectionType: E(CONNECTION_TYPES),
      providerIp: OPT_S(200),
      providerPort: N(65535),
      transport: OPT_S(50),
      techPrefix: OPT_S(50),
      cps: N(100_000),
      maxChannels: N(1_000_000),
      codecs: OPT_S(500),
      registrationRequired: B(),
      natRequirements: OPT_S(1000),
      authenticationMethod: OPT_S(200),
      mediaRequirements: OPT_S(1000),
      technicalNotes: OPT_S(3000),
    },
  },
  cliAni: {
    kind: 'object',
    spec: {
      cliModes: SA(10, 40),
      destinationRestrictions: OPT_S(2000),
      aniRequirements: OPT_S(2000),
      cliNotes: OPT_S(3000),
    },
  },
  cdr: {
    kind: 'object',
    spec: {
      cdrAvailable: B(),
      cdrFormat: OPT_S(200),
      deliveryMethod: OPT_S(200),
      deliveryFrequency: OPT_S(200),
      timezone: OPT_S(100),
      fieldsAvailable: SA(100, 120),
      perCallCostAvailable: B(),
      providerReferenceAvailable: B(),
      cdrNotes: OPT_S(3000),
    },
  },
  commercial: {
    kind: 'object',
    spec: {
      billingModel: E(BILLING_MODELS),
      paymentTerms: OPT_S(500),
      minimumCommitment: OPT_S(500),
      creditTerms: OPT_S(1000),
      billingCurrency: OPT_S(8),
      billingIncrement: OPT_S(32),
      minimumDuration: OPT_S(32),
      rateValidity: OPT_S(200),
      commercialNotes: OPT_S(3000),
    },
  },
  compliance: {
    kind: 'object',
    spec: {
      companyRegistrationAvailable: B(),
      telecomLicensingInformation: OPT_S(2000),
      complianceDocumentationAvailable: B(),
      acceptableUsePolicyAvailable: B(),
      fraudControls: OPT_S(2000),
      complianceNotes: OPT_S(3000),
    },
  },
  additionalNotes: OPT_S(5000),
};

const ALLOWED_CLI_MODES = new Set<string>(CLI_MODES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubmissionValidationResult =
  | { ok: true; data: ProviderSubmissionPayload }
  | { ok: false; errors: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function scanForbiddenKeys(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => scanForbiddenKeys(item, `${path}[${i}]`, errors));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      errors.push(`${path ? `${path}.` : ''}${key}: credential or secret fields are not accepted`);
    }
    scanForbiddenKeys(child, path ? `${path}.${key}` : key, errors);
  }
}

function validateField(
  value: unknown,
  spec: FieldSpec,
  path: string,
  errors: string[],
  out: Record<string, unknown>,
  key: string
): void {
  if (value === undefined || value === null || value === '') {
    if (spec.required) errors.push(`${path} is required`);
    return;
  }

  switch (spec.kind) {
    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${path} must be a string`);
        return;
      }
      const v = value.trim();
      if (!v) {
        if (spec.required) errors.push(`${path} is required`);
        return;
      }
      if (spec.max && v.length > spec.max) {
        errors.push(`${path} exceeds ${spec.max} characters`);
        return;
      }
      out[key] = v;
      return;
    }
    case 'number': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        errors.push(`${path} must be a number`);
        return;
      }
      if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
        errors.push(`${path} is out of range`);
        return;
      }
      out[key] = n;
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push(`${path} must be true or false`);
        return;
      }
      out[key] = value;
      return;
    }
    case 'enum': {
      if (typeof value !== 'string' || !spec.values.includes(value)) {
        errors.push(`${path} must be one of: ${spec.values.join(', ')}`);
        return;
      }
      out[key] = value;
      return;
    }
    case 'stringArray': {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be a list`);
        return;
      }
      if (spec.maxItems && value.length > spec.maxItems) {
        errors.push(`${path} has too many entries (max ${spec.maxItems})`);
        return;
      }
      const items: string[] = [];
      for (const item of value) {
        if (typeof item !== 'string') {
          errors.push(`${path} entries must be strings`);
          return;
        }
        const t = item.trim();
        if (t) items.push(spec.maxLen ? t.slice(0, spec.maxLen) : t);
      }
      out[key] = items;
      return;
    }
    case 'object': {
      if (!isPlainObject(value)) {
        errors.push(`${path} must be an object`);
        return;
      }
      const nested = validateObject(value, spec.spec, path, errors);
      if (Object.keys(nested).length > 0) out[key] = nested;
      else if (spec.required) errors.push(`${path} is required`);
      return;
    }
    case 'objectArray': {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be a list`);
        return;
      }
      if (spec.maxItems && value.length > spec.maxItems) {
        errors.push(`${path} has too many entries (max ${spec.maxItems})`);
        return;
      }
      const rows: Record<string, unknown>[] = [];
      value.forEach((row, i) => {
        const rowPath = `${path}[${i}]`;
        if (!isPlainObject(row)) {
          errors.push(`${rowPath} must be an object`);
          return;
        }
        rows.push(validateObject(row, spec.spec, rowPath, errors));
      });
      // Drop entirely-empty rows; keep rows with content.
      const kept = rows.filter((r) => Object.keys(r).length > 0);
      if (kept.length > 0) out[key] = kept;
      return;
    }
  }
}

function validateObject(
  input: Record<string, unknown>,
  spec: Record<string, FieldSpec>,
  path: string,
  errors: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!(key in spec)) {
      errors.push(`${path ? `${path}.` : ''}${key}: unknown field`);
    }
  }
  for (const [key, fieldSpec] of Object.entries(spec)) {
    validateField(input[key], fieldSpec, path ? `${path}.${key}` : key, errors, out, key);
  }
  return out;
}

export function validateProviderSubmission(input: unknown): SubmissionValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['Submission must be a JSON object'] };
  }

  scanForbiddenKeys(input, '', errors);

  const data = validateObject(input, ROOT_SPEC, '', errors) as ProviderSubmissionPayload;

  // Cross-field checks
  if (!data.company?.companyName) {
    if (!errors.some((e) => e.startsWith('company.companyName'))) {
      errors.push('company.companyName is required');
    }
  }

  if (data.contacts) {
    data.contacts.forEach((c, i) => {
      if (c.email && !EMAIL_RE.test(c.email)) {
        errors.push(`contacts[${i}].email is not a valid email address`);
      }
    });
  }

  if (data.cliAni?.cliModes) {
    const bad = data.cliAni.cliModes.filter((m) => !ALLOWED_CLI_MODES.has(m));
    if (bad.length > 0) {
      errors.push(`cliAni.cliModes contains unsupported values: ${bad.join(', ')}`);
    }
  }

  if (data.company?.website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(data.company.website)) {
    errors.push('company.website is not a valid website');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data };
}

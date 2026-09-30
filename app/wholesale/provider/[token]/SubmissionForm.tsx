'use client';

import { useState, type ReactNode } from 'react';

const input =
  'w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none';
const label = 'mb-1 block text-xs font-medium text-slate-400';
const h3 = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

const CONTACT_ROLES = ['SALES', 'NOC', 'TECHNICAL', 'BILLING', 'RATES', 'ACCOUNT'];
const ROUTE_TYPES = ['FIXED', 'MOBILE', 'BOTH'];
const CONNECTION_TYPES = ['SIP', 'IP_AUTH', 'SIP_CREDENTIAL', 'OTHER'];
const CLI_MODES = ['passthrough', 'presentation', 'rewriting', 'restricted', 'validation'];
const BILLING_MODELS = ['prepaid', 'postpaid'];
const DOCUMENT_CATEGORIES = [
  'COMPANY_DOCUMENT',
  'LICENSE',
  'RATE_CARD',
  'AGREEMENT',
  'TECHNICAL_DOCUMENT',
  'COMPLIANCE_DOCUMENT',
  'OTHER',
];

const SECTIONS = [
  'Company Information',
  'Contacts',
  'Wholesale Voice Profile',
  'Destinations',
  'Rates',
  'Connectivity',
  'CLI / ANI',
  'CDR',
  'Commercial & Billing',
  'Compliance',
  'Documents',
  'Additional Information',
  'Review & Submit',
];

type Dict = Record<string, string>;
const row = (o: Dict): Dict => o;
const emptyContact = () => row({ role: 'SALES', name: '', title: '', email: '', phone: '', messaging: '', timezone: '', notes: '' });
const emptyDestination = () => row({ country: '', countryCode: '', prefix: '', routeType: 'BOTH', availability: '', notes: '' });
const emptyRate = () => row({ destination: '', prefix: '', routeType: 'FIXED', rate: '', currency: '', billingIncrement: '', minimumDuration: '', effectiveDate: '', notes: '' });
type DocRow = {
  category: string;
  file: File | null;
  description: string;
  status: 'idle' | 'uploading' | 'uploaded' | 'error';
  error?: string;
};
const emptyDocRow = (): DocRow => ({ category: 'COMPANY_DOCUMENT', file: null, description: '', status: 'idle' });
const ALLOWED_FILE_TYPES = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg';
const MAX_FILE_MB = 10;

function F({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={label}>{l}</label>
      {children}
    </div>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={`s-${n}`} className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-xs font-semibold text-blue-400">{String(n).padStart(2, '0')}</span>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      {hint && <p className="mb-5 text-sm text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function RowEditor({
  rows, setRows, make, min = 0, children: renderRow, addLabel,
}: {
  rows: Dict[];
  setRows: (rows: Dict[]) => void;
  make: () => Dict;
  min?: number;
  children: (row: Dict, i: number, set: (k: string, v: string) => void) => ReactNode;
  addLabel: string;
}) {
  const update = (i: number, k: string, v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-4">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className={h3}>Entry {i + 1}</span>
            {rows.length > min && (
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-xs text-slate-500 hover:text-red-400 transition">
                Remove
              </button>
            )}
          </div>
          {renderRow(r, i, (k, v) => update(i, k, v))}
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, make()])}
        className="text-sm text-blue-300 hover:text-blue-200 transition">
        + {addLabel}
      </button>
    </div>
  );
}

// The bearer token is derived from the request path in the browser — it is
// never serialized into props or embedded in the rendered markup.
function bearerToken(): string {
  if (typeof window === 'undefined') return '';
  return decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? '');
}

export function SubmissionForm() {
  const [company, setCompany] = useState<Dict>(row({
    companyName: '', legalName: '', website: '', country: '',
    registrationJurisdiction: '', companyType: '', yearsInBusiness: '', businessDescription: '',
  }));
  const [contacts, setContacts] = useState<Dict[]>([emptyContact()]);
  const [wholesale, setWholesale] = useState<Dict>(row({
    serviceType: '', trafficType: '', coverage: '', terminationCapabilities: '',
    originationCapabilities: '', expectedTrafficDescription: '',
  }));
  const [wholesaleFlags, setWholesaleFlags] = useState({ internationalTermination: false, wholesaleOnly: false });
  const [destinations, setDestinations] = useState<Dict[]>([emptyDestination()]);
  const [rates, setRates] = useState<Dict[]>([]);
  const [connectivity, setConnectivity] = useState<Dict>(row({
    connectionType: 'SIP', providerIp: '', providerPort: '', transport: '', techPrefix: '',
    cps: '', maxChannels: '', codecs: '', natRequirements: '', authenticationMethod: '',
    mediaRequirements: '', technicalNotes: '',
  }));
  const [registrationRequired, setRegistrationRequired] = useState<boolean | null>(null);
  const [cliModes, setCliModes] = useState<string[]>([]);
  const [cliAni, setCliAni] = useState<Dict>(row({ destinationRestrictions: '', aniRequirements: '', cliNotes: '' }));
  const [cdr, setCdr] = useState<Dict>(row({
    cdrFormat: '', deliveryMethod: '', deliveryFrequency: '', timezone: '', fieldsAvailable: '', cdrNotes: '',
  }));
  const [cdrFlags, setCdrFlags] = useState({ cdrAvailable: null as boolean | null, perCallCostAvailable: null as boolean | null, providerReferenceAvailable: null as boolean | null });
  const [commercial, setCommercial] = useState<Dict>(row({
    billingModel: 'prepaid', paymentTerms: '', minimumCommitment: '', creditTerms: '',
    billingCurrency: '', billingIncrement: '', minimumDuration: '', rateValidity: '', commercialNotes: '',
  }));
  const [compliance, setCompliance] = useState<Dict>(row({ telecomLicensingInformation: '', fraudControls: '', complianceNotes: '' }));
  const [complianceFlags, setComplianceFlags] = useState({ companyRegistrationAvailable: null as boolean | null, complianceDocumentationAvailable: null as boolean | null, acceptableUsePolicyAvailable: null as boolean | null });
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const setC = (k: string, v: string) => setCompany((c) => ({ ...c, [k]: v }));
  const setW = (k: string, v: string) => setWholesale((c) => ({ ...c, [k]: v }));
  const setX = (k: string, v: string) => setConnectivity((c) => ({ ...c, [k]: v }));
  const setD = (k: string, v: string) => setCdr((c) => ({ ...c, [k]: v }));
  const setM = (k: string, v: string) => setCommercial((c) => ({ ...c, [k]: v }));
  const setK = (k: string, v: string) => setCompliance((c) => ({ ...c, [k]: v }));
  const setL = (k: string, v: string) => setCliAni((c) => ({ ...c, [k]: v }));

  const clean = (o: Dict) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== ''));
  const cleanRows = (rows: Dict[]) =>
    rows.map(clean).filter((r) => Object.keys(r).length > 1 || (Object.keys(r).length === 1 && !('role' in r) && !('routeType' in r) && !('category' in r)));

  function tri(v: boolean | null): boolean | undefined {
    return v === null ? undefined : v;
  }

  function updateDocRow(i: number, patch: Partial<DocRow>) {
    setDocRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function uploadDocument(i: number) {
    const r = docRows[i];
    if (!r.file || r.status === 'uploading' || r.status === 'uploaded') return;
    updateDocRow(i, { status: 'uploading', error: undefined });
    try {
      const fd = new FormData();
      fd.set('category', r.category);
      if (r.description) fd.set('description', r.description);
      fd.set('file', r.file);
      const res = await fetch(
        `/api/wholesale/provider/${encodeURIComponent(bearerToken())}/submission/document`,
        { method: 'POST', body: fd }
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        updateDocRow(i, { status: 'uploaded' });
      } else {
        updateDocRow(i, {
          status: 'error',
          error: typeof json.error === 'string' ? json.error : 'Upload failed',
        });
      }
    } catch {
      updateDocRow(i, { status: 'error', error: 'Upload failed' });
    }
  }

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    setFailed(null);
    try {
      const payload: Record<string, unknown> = {
        company: clean(company),
        contacts: cleanRows(contacts),
        wholesaleProfile: { ...clean(wholesale), ...wholesaleFlags },
        destinations: cleanRows(destinations),
        rates: cleanRows(rates),
        connectivity: {
          ...clean(connectivity),
          ...(connectivity.providerPort ? { providerPort: Number(connectivity.providerPort) } : {}),
          ...(connectivity.cps ? { cps: Number(connectivity.cps) } : {}),
          ...(connectivity.maxChannels ? { maxChannels: Number(connectivity.maxChannels) } : {}),
          ...(registrationRequired !== null ? { registrationRequired } : {}),
        },
        cliAni: { ...(cliModes.length ? { cliModes } : {}), ...clean(cliAni) },
        cdr: {
          ...clean(cdr),
          ...(cdr.fieldsAvailable ? { fieldsAvailable: cdr.fieldsAvailable.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
          cdrAvailable: tri(cdrFlags.cdrAvailable),
          perCallCostAvailable: tri(cdrFlags.perCallCostAvailable),
          providerReferenceAvailable: tri(cdrFlags.providerReferenceAvailable),
        },
        commercial: clean(commercial),
        compliance: {
          ...clean(compliance),
          companyRegistrationAvailable: tri(complianceFlags.companyRegistrationAvailable),
          complianceDocumentationAvailable: tri(complianceFlags.complianceDocumentationAvailable),
          acceptableUsePolicyAvailable: tri(complianceFlags.acceptableUsePolicyAvailable),
        },
        additionalNotes,
        ...(company.yearsInBusiness ? {} : {}),
        hp: honeypot,
      };
      if (company.yearsInBusiness) {
        (payload.company as Dict).yearsInBusiness = company.yearsInBusiness;
      }
      // Strip undefined values before sending.
      const body = JSON.parse(JSON.stringify(payload));

      const res = await fetch(`/api/wholesale/provider/${encodeURIComponent(bearerToken())}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (Array.isArray(json.details) && json.details.length) {
        setErrors(json.details.slice(0, 20));
      } else {
        setFailed(typeof json.error === 'string' ? json.error : 'Submission unavailable.');
      }
    } catch {
      setFailed('Submission unavailable.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 sm:p-10">
        <h3 className="text-xl font-semibold text-white">Thank you</h3>
        <p className="mt-4 text-sm text-slate-300 leading-relaxed">
          Thank you — we have received your wholesale partnership information. Our commercial and
          technical team will review it and contact you regarding applicable destinations, rates,
          connectivity, and next steps.
        </p>
        <p className="mt-4 text-sm text-slate-400 leading-relaxed">
          Submission does not constitute acceptance, activation, or a traffic commitment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Honeypot — invisible to humans, filled by naive bots */}
      <input
        type="text"
        name="hp"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <nav className="hidden lg:block rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <p className={h3 + ' mb-3'}>Sections</p>
        <ol className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-400">
          {SECTIONS.map((s, i) => (
            <li key={s}>
              <a href={`#s-${i + 1}`} className="hover:text-white transition">
                {String(i + 1).padStart(2, '0')} · {s}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section n={1} title="Company Information">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Company name *"><input className={input} value={company.companyName} onChange={(e) => setC('companyName', e.target.value)} /></F>
          <F label="Legal name"><input className={input} value={company.legalName} onChange={(e) => setC('legalName', e.target.value)} /></F>
          <F label="Website"><input className={input} value={company.website} onChange={(e) => setC('website', e.target.value)} placeholder="https://" /></F>
          <F label="Country"><input className={input} value={company.country} onChange={(e) => setC('country', e.target.value)} /></F>
          <F label="Registration / jurisdiction"><input className={input} value={company.registrationJurisdiction} onChange={(e) => setC('registrationJurisdiction', e.target.value)} /></F>
          <F label="Company type"><input className={input} value={company.companyType} onChange={(e) => setC('companyType', e.target.value)} /></F>
          <F label="Years in business"><input className={input} type="number" min="0" value={company.yearsInBusiness} onChange={(e) => setC('yearsInBusiness', e.target.value)} /></F>
        </div>
        <div className="mt-4">
          <F label="Business description"><textarea className={input} rows={3} value={company.businessDescription} onChange={(e) => setC('businessDescription', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={2} title="Contacts" hint="Sales, NOC, technical, billing, rates, and account contacts we can work with.">
        <RowEditor rows={contacts} setRows={setContacts} make={emptyContact} min={1} addLabel="Add contact">
          {(r, _i, set) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <F label="Role">
                <select className={input} value={r.role} onChange={(e) => set('role', e.target.value)}>
                  {CONTACT_ROLES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </F>
              <F label="Name *"><input className={input} value={r.name} onChange={(e) => set('name', e.target.value)} /></F>
              <F label="Title"><input className={input} value={r.title} onChange={(e) => set('title', e.target.value)} /></F>
              <F label="Email"><input className={input} value={r.email} onChange={(e) => set('email', e.target.value)} /></F>
              <F label="Phone"><input className={input} value={r.phone} onChange={(e) => set('phone', e.target.value)} /></F>
              <F label="Messaging / Skype"><input className={input} value={r.messaging} onChange={(e) => set('messaging', e.target.value)} /></F>
              <F label="Timezone"><input className={input} value={r.timezone} onChange={(e) => set('timezone', e.target.value)} /></F>
              <div className="sm:col-span-2">
                <F label="Notes"><input className={input} value={r.notes} onChange={(e) => set('notes', e.target.value)} /></F>
              </div>
            </div>
          )}
        </RowEditor>
      </Section>

      <Section n={3} title="Wholesale Voice Profile" hint="Describe the wholesale services and routes you offer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Service type"><input className={input} value={wholesale.serviceType} onChange={(e) => setW('serviceType', e.target.value)} /></F>
          <F label="Traffic type"><input className={input} value={wholesale.trafficType} onChange={(e) => setW('trafficType', e.target.value)} /></F>
        </div>
        <div className="mt-4 grid gap-4">
          <F label="Coverage"><textarea className={input} rows={2} value={wholesale.coverage} onChange={(e) => setW('coverage', e.target.value)} /></F>
          <F label="Termination capabilities"><textarea className={input} rows={2} value={wholesale.terminationCapabilities} onChange={(e) => setW('terminationCapabilities', e.target.value)} /></F>
          <F label="Origination capabilities"><textarea className={input} rows={2} value={wholesale.originationCapabilities} onChange={(e) => setW('originationCapabilities', e.target.value)} /></F>
          <F label="Expected traffic description"><textarea className={input} rows={2} value={wholesale.expectedTrafficDescription} onChange={(e) => setW('expectedTrafficDescription', e.target.value)} /></F>
        </div>
        <div className="mt-4 flex gap-6">
          {([['internationalTermination', 'International termination'], ['wholesaleOnly', 'Wholesale only']] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={wholesaleFlags[k]} onChange={(e) => setWholesaleFlags((f) => ({ ...f, [k]: e.target.checked }))} className="accent-blue-500" />
              {l}
            </label>
          ))}
        </div>
      </Section>

      <Section n={4} title="Destinations" hint="Destinations you can serve — fixed, mobile, or both.">
        <RowEditor rows={destinations} setRows={setDestinations} make={emptyDestination} min={1} addLabel="Add destination">
          {(r, _i, set) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <F label="Country *"><input className={input} value={r.country} onChange={(e) => set('country', e.target.value)} /></F>
              <F label="Country code"><input className={input} value={r.countryCode} onChange={(e) => set('countryCode', e.target.value)} placeholder="GR" /></F>
              <F label="Prefix"><input className={input} value={r.prefix} onChange={(e) => set('prefix', e.target.value)} placeholder="30" /></F>
              <F label="Route type">
                <select className={input} value={r.routeType} onChange={(e) => set('routeType', e.target.value)}>
                  {ROUTE_TYPES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </F>
              <F label="Availability"><input className={input} value={r.availability} onChange={(e) => set('availability', e.target.value)} /></F>
              <F label="Notes"><input className={input} value={r.notes} onChange={(e) => set('notes', e.target.value)} /></F>
            </div>
          )}
        </RowEditor>
      </Section>

      <Section n={5} title="Rates" hint="Wholesale rates you can offer. Submitted rates are reviewed commercially — they are not automatically applied.">
        <RowEditor rows={rates} setRows={setRates} make={emptyRate} addLabel="Add rate">
          {(r, _i, set) => (
            <div className="grid gap-3 sm:grid-cols-4">
              <F label="Destination *"><input className={input} value={r.destination} onChange={(e) => set('destination', e.target.value)} /></F>
              <F label="Prefix"><input className={input} value={r.prefix} onChange={(e) => set('prefix', e.target.value)} /></F>
              <F label="Route type">
                <select className={input} value={r.routeType} onChange={(e) => set('routeType', e.target.value)}>
                  {ROUTE_TYPES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </F>
              <F label="Rate"><input className={input} value={r.rate} onChange={(e) => set('rate', e.target.value)} placeholder="0.0125" /></F>
              <F label="Currency"><input className={input} value={r.currency} onChange={(e) => set('currency', e.target.value)} placeholder="USD" /></F>
              <F label="Billing increment"><input className={input} value={r.billingIncrement} onChange={(e) => set('billingIncrement', e.target.value)} placeholder="60/60" /></F>
              <F label="Minimum duration"><input className={input} value={r.minimumDuration} onChange={(e) => set('minimumDuration', e.target.value)} /></F>
              <F label="Effective date"><input className={input} value={r.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} placeholder="YYYY-MM-DD" /></F>
              <div className="sm:col-span-4">
                <F label="Notes"><input className={input} value={r.notes} onChange={(e) => set('notes', e.target.value)} /></F>
              </div>
            </div>
          )}
        </RowEditor>
      </Section>

      <Section n={6} title="Connectivity" hint="Technical interconnection details. Do not send passwords, API keys, or secrets — credentials are exchanged later through a secure internal process.">
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Connection type">
            <select className={input} value={connectivity.connectionType} onChange={(e) => setX('connectionType', e.target.value)}>
              {CONNECTION_TYPES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </F>
          <F label="Provider IP"><input className={input} value={connectivity.providerIp} onChange={(e) => setX('providerIp', e.target.value)} /></F>
          <F label="Port"><input className={input} type="number" min="0" value={connectivity.providerPort} onChange={(e) => setX('providerPort', e.target.value)} /></F>
          <F label="Transport"><input className={input} value={connectivity.transport} onChange={(e) => setX('transport', e.target.value)} placeholder="UDP / TCP / TLS" /></F>
          <F label="Tech prefix"><input className={input} value={connectivity.techPrefix} onChange={(e) => setX('techPrefix', e.target.value)} /></F>
          <F label="CPS"><input className={input} type="number" min="0" value={connectivity.cps} onChange={(e) => setX('cps', e.target.value)} /></F>
          <F label="Max channels"><input className={input} type="number" min="0" value={connectivity.maxChannels} onChange={(e) => setX('maxChannels', e.target.value)} /></F>
          <F label="Codecs"><input className={input} value={connectivity.codecs} onChange={(e) => setX('codecs', e.target.value)} placeholder="G.711, G.729…" /></F>
          <F label="Authentication method"><input className={input} value={connectivity.authenticationMethod} onChange={(e) => setX('authenticationMethod', e.target.value)} placeholder="IP auth / SIP credentials" /></F>
          <F label="Registration required">
            <select className={input} value={registrationRequired === null ? '' : String(registrationRequired)} onChange={(e) => setRegistrationRequired(e.target.value === '' ? null : e.target.value === 'true')}>
              <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </F>
        </div>
        <div className="mt-4 grid gap-4">
          <F label="NAT requirements"><input className={input} value={connectivity.natRequirements} onChange={(e) => setX('natRequirements', e.target.value)} /></F>
          <F label="Media requirements"><input className={input} value={connectivity.mediaRequirements} onChange={(e) => setX('mediaRequirements', e.target.value)} /></F>
          <F label="Technical notes"><textarea className={input} rows={2} value={connectivity.technicalNotes} onChange={(e) => setX('technicalNotes', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={7} title="CLI / ANI">
        <div className="mb-4 flex flex-wrap gap-4">
          {CLI_MODES.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={cliModes.includes(m)} onChange={(e) => setCliModes(e.target.checked ? [...cliModes, m] : cliModes.filter((x) => x !== m))} className="accent-blue-500" />
              {m}
            </label>
          ))}
        </div>
        <div className="grid gap-4">
          <F label="Destination restrictions"><textarea className={input} rows={2} value={cliAni.destinationRestrictions} onChange={(e) => setL('destinationRestrictions', e.target.value)} /></F>
          <F label="ANI requirements"><textarea className={input} rows={2} value={cliAni.aniRequirements} onChange={(e) => setL('aniRequirements', e.target.value)} /></F>
          <F label="CLI notes"><textarea className={input} rows={2} value={cliAni.cliNotes} onChange={(e) => setL('cliNotes', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={8} title="CDR">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {([['cdrAvailable', 'CDR available'], ['perCallCostAvailable', 'Per-call cost in CDR'], ['providerReferenceAvailable', 'Provider reference in CDR']] as const).map(([k, l]) => (
            <F key={k} label={l}>
              <select className={input} value={cdrFlags[k] === null ? '' : String(cdrFlags[k])} onChange={(e) => setCdrFlags((f) => ({ ...f, [k]: e.target.value === '' ? null : e.target.value === 'true' }))}>
                <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </F>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="CDR format"><input className={input} value={cdr.cdrFormat} onChange={(e) => setD('cdrFormat', e.target.value)} /></F>
          <F label="Delivery method"><input className={input} value={cdr.deliveryMethod} onChange={(e) => setD('deliveryMethod', e.target.value)} /></F>
          <F label="Delivery frequency"><input className={input} value={cdr.deliveryFrequency} onChange={(e) => setD('deliveryFrequency', e.target.value)} /></F>
          <F label="Timezone"><input className={input} value={cdr.timezone} onChange={(e) => setD('timezone', e.target.value)} /></F>
        </div>
        <div className="mt-4 grid gap-4">
          <F label="Fields available (comma-separated)"><input className={input} value={cdr.fieldsAvailable} onChange={(e) => setD('fieldsAvailable', e.target.value)} placeholder="CALL_ID, CLI_ANI, DURATION…" /></F>
          <F label="CDR notes"><textarea className={input} rows={2} value={cdr.cdrNotes} onChange={(e) => setD('cdrNotes', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={9} title="Commercial & Billing">
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Billing model">
            <select className={input} value={commercial.billingModel} onChange={(e) => setM('billingModel', e.target.value)}>
              {BILLING_MODELS.map((v) => <option key={v}>{v}</option>)}
            </select>
          </F>
          <F label="Billing currency"><input className={input} value={commercial.billingCurrency} onChange={(e) => setM('billingCurrency', e.target.value)} placeholder="USD" /></F>
          <F label="Billing increment"><input className={input} value={commercial.billingIncrement} onChange={(e) => setM('billingIncrement', e.target.value)} /></F>
          <F label="Minimum duration"><input className={input} value={commercial.minimumDuration} onChange={(e) => setM('minimumDuration', e.target.value)} /></F>
          <F label="Rate validity"><input className={input} value={commercial.rateValidity} onChange={(e) => setM('rateValidity', e.target.value)} /></F>
          <F label="Minimum commitment"><input className={input} value={commercial.minimumCommitment} onChange={(e) => setM('minimumCommitment', e.target.value)} /></F>
        </div>
        <div className="mt-4 grid gap-4">
          <F label="Payment terms"><input className={input} value={commercial.paymentTerms} onChange={(e) => setM('paymentTerms', e.target.value)} /></F>
          <F label="Credit terms"><input className={input} value={commercial.creditTerms} onChange={(e) => setM('creditTerms', e.target.value)} /></F>
          <F label="Commercial notes"><textarea className={input} rows={2} value={commercial.commercialNotes} onChange={(e) => setM('commercialNotes', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={10} title="Compliance" hint="Information you supply here is treated as submitted claims and is verified during review.">
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          {([['companyRegistrationAvailable', 'Company registration docs'], ['complianceDocumentationAvailable', 'Compliance documentation'], ['acceptableUsePolicyAvailable', 'Acceptable use policy']] as const).map(([k, l]) => (
            <F key={k} label={l}>
              <select className={input} value={complianceFlags[k] === null ? '' : String(complianceFlags[k])} onChange={(e) => setComplianceFlags((f) => ({ ...f, [k]: e.target.value === '' ? null : e.target.value === 'true' }))}>
                <option value="">—</option><option value="true">Available</option><option value="false">Not available</option>
              </select>
            </F>
          ))}
        </div>
        <div className="grid gap-4">
          <F label="Telecom licensing information"><textarea className={input} rows={2} value={compliance.telecomLicensingInformation} onChange={(e) => setK('telecomLicensingInformation', e.target.value)} /></F>
          <F label="Fraud controls"><textarea className={input} rows={2} value={compliance.fraudControls} onChange={(e) => setK('fraudControls', e.target.value)} /></F>
          <F label="Compliance notes"><textarea className={input} rows={2} value={compliance.complianceNotes} onChange={(e) => setK('complianceNotes', e.target.value)} /></F>
        </div>
      </Section>

      <Section n={11} title="Documents" hint={`Upload supporting documents (rate cards, licenses, agreements, company documents). Accepted types: PDF, DOCX, XLSX, CSV, TXT, PNG, JPG — up to ${MAX_FILE_MB} MB each.`}>
        <div className="space-y-4">
          {docRows.map((r, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={h3}>Document {i + 1}</span>
                <button type="button" onClick={() => setDocRows(docRows.filter((_, j) => j !== i))}
                  className="text-xs text-slate-500 hover:text-red-400 transition">
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <F label="Category">
                  <select className={input} value={r.category} onChange={(e) => updateDocRow(i, { category: e.target.value })} disabled={r.status === 'uploaded'}>
                    {DOCUMENT_CATEGORIES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </F>
                <F label="File *">
                  <input type="file" accept={ALLOWED_FILE_TYPES} className={input + ' file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-slate-300'}
                    onChange={(e) => updateDocRow(i, { file: e.target.files?.[0] ?? null, status: 'idle' })} disabled={r.status === 'uploaded'} />
                </F>
                <F label="Description">
                  <input className={input} value={r.description} onChange={(e) => updateDocRow(i, { description: e.target.value })} disabled={r.status === 'uploaded'} />
                </F>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {r.status !== 'uploaded' && (
                  <button type="button" onClick={() => uploadDocument(i)} disabled={!r.file || r.status === 'uploading'}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/5 disabled:opacity-40">
                    {r.status === 'uploading' ? 'Uploading…' : 'Upload'}
                  </button>
                )}
                {r.status === 'uploaded' && (
                  <span className="text-xs font-medium text-emerald-400">Uploaded — attached to your submission</span>
                )}
                {r.status === 'error' && <span className="text-xs text-red-400">{r.error}</span>}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setDocRows([...docRows, emptyDocRow()])}
            className="text-sm text-blue-300 hover:text-blue-200 transition">
            + Add document
          </button>
        </div>
      </Section>

      <Section n={12} title="Additional Information">
        <textarea className={input} rows={4} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} placeholder="Anything else we should know about your network, routes, or capabilities." />
      </Section>

      <section id="s-13" className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Review &amp; Submit</h3>
        <p className="mt-2 text-sm text-slate-400">
          By submitting, you confirm the information supplied is accurate for review by Shivaksa
          Technologies LLC. Submission does not constitute acceptance, activation, or a traffic
          commitment.
        </p>

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        {failed && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {failed === 'This wholesale partnership link is no longer accepting submissions.'
              ? 'This wholesale partnership link is no longer accepting submissions. Please contact Shivaksa Technologies LLC.'
              : failed}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit partnership information'}
        </button>
      </section>
    </div>
  );
}

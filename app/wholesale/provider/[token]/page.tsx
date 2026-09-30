import { headers } from 'next/headers';
import type { Metadata } from 'next';
import {
  findOnboardingLinkByToken,
  recordOnboardingView,
} from '@/lib/wholesale-profile/services/onboarding-link';
import { getPublishedWholesaleProfile } from '@/lib/wholesale-profile/services/profile';
import type { ProviderRequirementSectionDto } from '@/lib/wholesale-profile/services/profile';
import { checkIdentifierRateLimit } from '@/lib/rate-limit';
import { SubmissionForm } from './SubmissionForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wholesale Voice Partnership — Shivaksa Technologies LLC',
  description:
    'International wholesale termination · carrier relationships · traffic coordination',
  robots: { index: false, follow: false, nocache: true },
};

// Token-bearer pages: capped per client identifier to blunt brute-force
// attempts. A blocked request renders the same generic unavailable state.
const TOKEN_RATE_LIMIT = 30;
const TOKEN_RATE_WINDOW_MS = 5 * 60 * 1000;

function clientIdentifier(h: Awaited<ReturnType<typeof headers>>): string {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip')?.trim() ?? 'anonymous';
}

function fmt(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

// Whitelisted renderers for the structured content shapes published by the
// Requirements Center. Unknown keys are ignored — content is never dumped raw.

function StringChips({ values }: { values: unknown }) {
  if (!Array.isArray(values)) return null;
  const items = values.filter(str);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v) => (
        <span
          key={v}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
        >
          {fmt(v)}
        </span>
      ))}
    </div>
  );
}

function LabelValueRows({ items }: { items: unknown }) {
  if (!Array.isArray(items)) return null;
  const rows = items.filter(isRecord).filter((r) => str(r.label));
  if (rows.length === 0) return null;
  return (
    <dl className="divide-y divide-white/5">
      {rows.map((r) => (
        <div
          key={String(r.key ?? r.label)}
          className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4"
        >
          <dt className="text-sm font-medium text-slate-300">{String(r.label)}</dt>
          <dd className="sm:col-span-2">
            {Array.isArray(r.values) ? (
              <div className="space-y-1">
                {r.values.filter(str).map((v, i) => (
                  <p key={i} className="text-sm text-slate-400 leading-relaxed">
                    {/^[A-Z0-9_]+$/.test(v) ? fmt(v) : v}
                  </p>
                ))}
              </div>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DestinationsTable({ rows }: { rows: unknown }) {
  if (!Array.isArray(rows)) return null;
  const entries = rows.filter(isRecord).filter((r) => str(r.name));
  if (entries.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Destination</th>
            <th className="py-2 pr-4 font-medium">Code</th>
            <th className="py-2 pr-4 font-medium">Traffic</th>
            <th className="py-2 font-medium">Priority</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {entries.map((r) => (
            <tr key={String(r.name)}>
              <td className="py-2.5 pr-4 text-slate-200">{String(r.name)}</td>
              <td className="py-2.5 pr-4 text-slate-400">{str(r.iso2) ? r.iso2 : '—'}</td>
              <td className="py-2.5 pr-4 text-slate-400">
                {str(r.classification) ? fmt(r.classification) : '—'}
              </td>
              <td className="py-2.5 text-slate-400">
                {str(r.priority) ? fmt(r.priority) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VolumeRange({ range }: { range: unknown }) {
  if (!isRecord(range)) return null;
  const min = typeof range.min === 'number' ? range.min.toLocaleString('en-US') : null;
  const target = str(range.target) ? String(range.target) : null;
  if (!min && !target) return null;
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-blue-300/80">
        Approximate range · minutes per month
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">
        {min}
        {min && target ? ' – ' : ''}
        {target ? String(Number.isNaN(Number(target)) ? target : Number(target).toLocaleString('en-US')) : ''}
      </div>
    </div>
  );
}

function ContactChannels({ channels }: { channels: unknown }) {
  if (!Array.isArray(channels)) return null;
  const list = channels.filter(isRecord).filter((c) => str(c.type) && str(c.value));
  if (list.length === 0) return null;
  return (
    <ul className="space-y-2">
      {list.map((c, i) => {
        const type = String(c.type);
        const value = String(c.value);
        const href =
          type === 'EMAIL'
            ? `mailto:${value}`
            : type === 'WEBSITE' && /^https?:\/\//.test(value)
              ? value
              : null;
        return (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-slate-500">
              {fmt(type)}
            </span>
            {href ? (
              <a href={href} className="text-blue-300 hover:text-blue-200 transition">
                {value}
              </a>
            ) : (
              <span className="text-slate-300">{value}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SectionBody({ content }: { content: unknown }) {
  if (!isRecord(content)) return null;
  return (
    <div className="space-y-5">
      {str(content.body) && (
        <p className="text-slate-400 leading-relaxed">{content.body}</p>
      )}
      <LabelValueRows items={content.items} />
      <DestinationsTable rows={content.destinations} />
      <VolumeRange range={content.approximateRangeMinutesPerMonth} />
      {Array.isArray(content.requestedFields) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Requested fields
          </p>
          <StringChips values={content.requestedFields} />
        </div>
      )}
      {Array.isArray(content.requestedProperties) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Requested properties
          </p>
          <StringChips values={content.requestedProperties} />
        </div>
      )}
      {Array.isArray(content.requestedRateFields) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Requested rate-sheet fields
          </p>
          <StringChips values={content.requestedRateFields} />
        </div>
      )}
      {Array.isArray(content.requestedTerms) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Requested terms
          </p>
          <StringChips values={content.requestedTerms} />
        </div>
      )}
      <StringChips values={content.requested} />
      <StringChips values={content.qualifiers} />
      {str(content.note) && (
        <p className="text-sm text-slate-500 leading-relaxed border-l-2 border-white/10 pl-3">
          {content.note}
        </p>
      )}
      <ContactChannels channels={content.channels} />
    </div>
  );
}

function LinkUnavailable() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold">
          S
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Link unavailable</h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          This wholesale partnership link is no longer available. Please contact
          Shivaksa Technologies LLC for an updated link.
        </p>
      </div>
    </div>
  );
}

export default async function ProviderWholesalePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const h = await headers();

  if (!checkIdentifierRateLimit(clientIdentifier(h), 'wholesale-provider', TOKEN_RATE_LIMIT, TOKEN_RATE_WINDOW_MS)) {
    return <LinkUnavailable />;
  }

  const link = await findOnboardingLinkByToken(token);
  if (!link) return <LinkUnavailable />;

  const profile = await getPublishedWholesaleProfile(link.organizationId);
  if (!profile) return <LinkUnavailable />;

  await recordOnboardingView({ id: link.id, organizationId: link.organizationId });

  const acceptingSubmissions =
    link.maxSubmissions == null || link.submissionCount < link.maxSubmissions;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Shivaksa Technologies LLC
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            Carrier &amp; VoIP provider introduction
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {profile.title}
          </h1>
          {profile.subtitle && (
            <p className="mt-3 text-lg text-slate-400">{profile.subtitle}</p>
          )}
        </div>

        <div className="mt-12 space-y-6">
          {profile.sections.map((section: ProviderRequirementSectionDto) => (
            <section
              key={section.key}
              className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                {section.isRequired && (
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                    Requested
                  </span>
                )}
              </div>
              {section.description && (
                <p className="mb-4 text-sm text-slate-400">{section.description}</p>
              )}
              <SectionBody content={section.content} />
            </section>
          ))}
        </div>

        <div className="mt-16 border-t border-white/10 pt-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              Partnership intake
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Submit your wholesale partnership information
            </h2>
            <p className="mt-3 text-slate-400">
              Provide your company, network, and commercial details for review by our
              carrier-relations team.
            </p>
          </div>

          <div className="mt-8">
            {acceptingSubmissions ? (
              <SubmissionForm />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-sm text-slate-400">
                This wholesale partnership link is no longer accepting submissions. Please
                contact Shivaksa Technologies LLC if you need an updated link.
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs text-slate-500 leading-relaxed">
            This page is shared with invited carrier and VoIP provider partners.
            It contains no pricing commitments and does not constitute an offer
            or guarantee of traffic volume.
          </p>
          <p className="mt-3 text-xs text-slate-600">
            © {new Date().getFullYear()} Shivaksa Technologies LLC
          </p>
        </div>
      </footer>
    </div>
  );
}

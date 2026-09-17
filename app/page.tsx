import Link from 'next/link';

const nav = [
  { href: '#solutions', label: 'Solutions' },
  { href: '#technology', label: 'Technology' },
  { href: '#industries', label: 'Industries' },
  { href: '#company', label: 'Company' },
];

const solutions = [
  {
    title: 'AI Voice Agents',
    description: 'Inbound and outbound voice workflows that qualify leads, schedule appointments, and hand off to live agents with full context.',
    items: ['Natural language conversations', 'Lead qualification', 'CRM triggers', 'Human handoff'],
    color: 'from-violet-500 to-blue-600',
    icon: 'voice',
  },
  {
    title: 'VoIP & SIP',
    description: 'Business-class prepaid calling with SIP accounts, call routing, CDR, wallet management, and usage monitoring.',
    items: ['SIP trunking', 'Call routing & CDR', 'Prepaid wallets', 'Usage monitoring'],
    color: 'from-blue-500 to-cyan-500',
    icon: 'phone',
  },
  {
    title: 'CRM & Automation',
    description: 'Connect conversations, contacts, and workflows so customer data moves automatically across your operation.',
    items: ['Contact & lead sync', 'Campaign workflows', 'Custom triggers', 'Audit trail'],
    color: 'from-emerald-500 to-teal-500',
    icon: 'automation',
  },
  {
    title: 'Custom Software',
    description: 'Web applications, mobile apps, dashboards, APIs, and internal business systems built around your workflow.',
    items: ['Web & mobile apps', 'APIs & integrations', 'Dashboards', 'Custom business systems'],
    color: 'from-amber-500 to-orange-500',
    icon: 'code',
  },
];

const capabilities = [
  { title: 'AI Voice', description: 'Conversational agents and voice workflows' },
  { title: 'Communications', description: 'VoIP, SIP, and call routing' },
  { title: 'CRM', description: 'Contact, lead, and campaign data' },
  { title: 'Automation', description: 'Business logic and triggers' },
  { title: 'Software', description: 'Custom apps and integrations' },
  { title: 'Operations', description: 'BPO and quality-enabled workflows' },
];

const industries = [
  'Professional services', 'Sales organizations', 'Real estate', 'Automotive', 'Healthcare operations', 'Financial operations', 'E-commerce', 'Growing startups',
];

const trust = [
  'Tenant-isolated multi-tenant architecture',
  'Role-based access control and audit logging',
  'KYC/KYB business onboarding review',
  'Prepaid wallet with signed transaction ledger',
  'Approved carrier and infrastructure providers',
];

function Icon({ name }: { name: string }) {
  const cn = 'h-6 w-6';
  if (name === 'voice') {
    return (
      <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    );
  }
  if (name === 'phone') {
    return (
      <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    );
  }
  if (name === 'automation') {
    return (
      <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    );
  }
  return (
    <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-14">
      <div className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-4">
        {eyebrow}
      </div>
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">{title}</h2>
      <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{subtitle}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">S</span>
            <span className="text-lg font-semibold tracking-tight">Shivaksa Technologies LLC</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition">
              Client Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition"
            >
              Request access
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-grid px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="max-w-2xl animate-fade-in">
                <div className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6">
                  AI + Voice + Communications + Software
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] text-zinc-900 dark:text-zinc-50">
                  Infrastructure for{' '}
                  <span className="gradient-text">AI voice, VoIP and business operations.</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                  Shivaksa Technologies LLC builds secure, multi-tenant technology for AI voice agents, business VoIP/SIP, CRM automation, lead operations, and custom software.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition shadow-lg shadow-blue-900/10"
                  >
                    Request platform access
                  </Link>
                  <a
                    href="#solutions"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 transition"
                  >
                    Explore solutions
                  </a>
                </div>
              </div>

              <div className="relative hidden lg:block animate-fade-in" style={{ animationDelay: '150ms' }}>
                <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-blue-100/50 to-violet-100/50 dark:from-blue-900/20 dark:to-violet-900/20 blur-2xl rounded-3xl" />
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/10 dark:shadow-zinc-950/30 p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                      Platform live
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">app.shivaksatechnology.com</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Prepaid wallet', value: '$1,240.00' },
                      { label: 'Customer rate', value: '$0.0160/min' },
                      { label: 'Active calls', value: '12' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</div>
                        <div className="mt-1 text-lg font-semibold">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-4 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800">
                    AI voice agent scheduled a callback, reserved wallet funds, and routed the call to a human agent with full audit trail.
                  </div>
                  <div className="flex gap-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">VoIP</span>
                    <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">AI Agent</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">CRM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="technology" className="py-20 px-4 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto">
            <SectionTitle
              eyebrow="How it fits together"
              title="One connected technology platform"
              subtitle="Voice, AI, CRM, automation, and custom software designed to work as a single operating layer rather than disconnected tools."
            />
            <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-8 sm:p-12 overflow-hidden">
              <div className="absolute inset-0 -z-10 bg-grid" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {capabilities.map((c, i) => (
                  <div
                    key={c.title}
                    className="animate-fade-in rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover-lift"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{c.title}</h3>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Voice & AI</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Data & CRM</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Automation</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Software</span>
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="py-20 px-4 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <SectionTitle
              eyebrow="Core solutions"
              title="Technology built for operations"
              subtitle="Every solution is designed for secure multi-tenant delivery, transparent usage, and real business workflows."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {solutions.map((s, i) => (
                <div
                  key={s.title}
                  className="animate-fade-in group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 hover-lift"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`absolute top-0 right-0 h-32 w-32 -mr-8 -mt-8 rounded-full bg-gradient-to-br ${s.color} opacity-10 blur-2xl`} />
                  <div className="flex items-start justify-between mb-6">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <Icon name={s.icon} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{s.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">{s.description}</p>
                  <ul className="space-y-2">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">
                  AI Voice Agents that handle real conversations
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                  Configure voice agents for inbound support, outbound follow-up, lead qualification, and appointment scheduling. Conversations can trigger CRM updates, create tasks, reserve funds, and transfer to live agents when needed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['Inbound & outbound calls', 'Natural language understanding', 'Lead qualification', 'Appointment scheduling', 'CRM integration', 'Human handoff'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                      <span className="inline-flex h-2 w-2 rounded-full bg-violet-500" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 sm:p-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">AI Voice Agent</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Inbound call answered, caller identified, intent captured</p>
                      </div>
                    </div>
                    <div className="ml-5 h-8 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex items-start gap-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.258-4.218.424-6.378.424-2.16 0-4.29-.166-6.378-.424-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0v-2.25c0-1.094-.787-2.036-1.872-2.18-2.087-.258-4.218-.424-6.378-.424-2.16 0-4.29.166-6.378.424-1.085.144-1.872 1.086-1.872 2.18v2.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.1-.787-2.052-1.872-2.201-2.116-.261-4.264-.43-6.378-.43-2.113 0-4.262.169-6.378.43C3.787 6.654 3 7.606 3 8.706v3.813A2.18 2.18 0 003.75 14.15" />
                        </svg>
                      </div>
                      <div className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Wallet Reservation</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Funds reserved for the call before routing begins</p>
                      </div>
                    </div>
                    <div className="ml-5 h-8 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex items-start gap-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <div className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">CRM Update</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Contact record and call outcome logged automatically</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Business VoIP & SIP</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Prepaid calling platform</div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Active</span>
                  </div>
                  <div className="space-y-3">
                    {['SIP account registration', 'Outbound call routing', 'Call detail records (CDR)', 'Low-balance protection', 'Usage monitoring'].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{item}</span>
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">
                  Business VoIP & SIP, built for control
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                  Provision SIP accounts, route business calls, capture CDR, and monitor usage in real time. Prepaid wallet architecture protects against unexpected spend and keeps billing transparent.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['SIP trunking', 'Call routing', 'CDR exports', 'Prepaid wallets', 'Usage monitoring', 'Low-balance alerts'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
                      <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto">
            <SectionTitle
              eyebrow="Built for serious operations"
              title="Security, isolation and auditability by design"
              subtitle="Multi-tenant architecture with role-based access, KYC/KYB onboarding, and a signed financial ledger."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trust.map((item, i) => (
                <div key={item} className="animate-fade-in rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mb-4">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="py-20 px-4 bg-zinc-50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            <SectionTitle
              eyebrow="Use cases"
              title="Operations we support"
              subtitle="Shivaksa technology is adapted for different workflows, operating models, and customer experiences."
            />
            <div className="flex flex-wrap justify-center gap-3">
              {industries.map((ind) => (
                <span key={ind} className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {ind}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-zinc-900 text-zinc-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Ready to build your operations layer?
            </h2>
            <p className="text-lg text-zinc-300 mb-8 max-w-2xl mx-auto">
              Request access and our team will review your business details before enabling VoIP and AI voice services.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-zinc-900 bg-white rounded-xl hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/40 transition"
            >
              Request access
            </Link>
          </div>
        </section>
      </main>

      <footer id="company" className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs">S</span>
              <span className="text-sm font-medium">Shivaksa Technologies LLC</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              AI voice, VoIP/SIP, CRM automation, and custom software for modern business operations.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">Solutions</h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><a href="#solutions" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">AI Voice Agents</a></li>
              <li><a href="#solutions" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">VoIP & SIP</a></li>
              <li><a href="#solutions" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">CRM & Automation</a></li>
              <li><a href="#solutions" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Custom Software</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Terms of Service</Link></li>
              <li><Link href="/acceptable-use" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Acceptable Use</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><a href="mailto:info@shivaksatechnology.com" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">info@shivaksatechnology.com</a></li>
              <li><Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Client Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-8 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-500">
          © {new Date().getFullYear()} Shivaksa Technologies LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

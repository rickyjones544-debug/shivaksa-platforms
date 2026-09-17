import Link from 'next/link';

const services = [
  {
    title: 'Business Process Outsourcing',
    description: 'Customer support, back-office operations, lead verification, quality assurance, and business process support.',
  },
  {
    title: 'AI Voice Agents',
    description: 'Inbound and outbound AI voice workflows, lead qualification, appointment scheduling, customer support automation, and human handoff.',
  },
  {
    title: 'VoIP & SIP Solutions',
    description: 'Business VoIP, SIP connectivity, prepaid calling, call records/CDR, usage monitoring, and low-balance protection.',
  },
  {
    title: 'Lead Generation',
    description: 'Data-driven prospecting, lead qualification, verification, B2B outreach, and CRM-ready lead workflows.',
  },
  {
    title: 'Web & Mobile Development',
    description: 'Custom web applications, portals, and integrations built with modern, secure technologies.',
  },
  {
    title: 'Automation, CRM & AI Integration',
    description: 'Workflow automation, CRM integrations, and AI-powered business process improvements.',
  },
];

const differentiators = [
  { title: 'Multi-tenant by design', description: 'Each customer organization is isolated, with role-based access and audit logging.' },
  { title: 'Prepaid financial controls', description: 'Wallets, reservations, idempotent transactions, and a signed ledger keep usage transparent.' },
  { title: 'Built for compliance', description: 'KYC/KYB onboarding, review workflows, and metadata-only document handling until storage is integrated.' },
  { title: 'U.S. business focused', description: 'Professional support, truthful pricing, and service terms that do not overpromise coverage or uptime.' },
];

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
            <a href="#services" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Services</a>
            <a href="#about" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Platform</a>
            <a href="#contact" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition">
              Sign in
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
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 mb-6">
                  Production platform for U.S. businesses
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1]">
                  AI voice, VoIP/SIP and BPO technology for{' '}
                  <span className="gradient-text">modern operations.</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                  Shivaksa Technologies LLC delivers secure, multi-tenant BPO, AI voice agents, business VoIP, lead generation, and software development infrastructure.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition shadow-lg shadow-blue-900/10"
                  >
                    Request platform access
                  </Link>
                  <a
                    href="#services"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 transition"
                  >
                    Explore services
                  </a>
                </div>
              </div>
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-blue-100/50 to-violet-100/50 dark:from-blue-900/20 dark:to-violet-900/20 blur-2xl rounded-3xl" />
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/10 dark:shadow-zinc-950/30 p-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                    Platform live on app.shivaksatechnology.com
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
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-4 text-sm text-zinc-600 dark:text-zinc-400">
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

        <section id="services" className="py-20 px-4 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-16">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Services</h2>
              <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
                Integrated technology services designed for secure, multi-tenant operations and transparent billing.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => (
                <div
                  key={s.title}
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/20 transition"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-6">
                  Built for secure, multi-tenant operations
                </h2>
                <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Shivaksa provides prepaid VoIP and communications services through approved infrastructure and service providers. Customer accounts are isolated, financial operations are auditable, and service access is approved through a business onboarding review. Specific rates, destinations, features, and availability are subject to customer approval, routing availability, and applicable provider terms.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {differentiators.map((d) => (
                  <div key={d.title} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                    <h3 className="font-semibold mb-2">{d.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{d.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-zinc-900 text-zinc-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Ready to power your operations?
            </h2>
            <p className="text-lg text-zinc-300 mb-8 max-w-2xl mx-auto">
              Request access and our team will review your business details before enabling VoIP and AI voice services.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-zinc-900 bg-white rounded-xl hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/40 transition"
            >
              Request VoIP access
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs">S</span>
            <span className="text-sm font-medium">Shivaksa Technologies LLC</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Terms of Service</Link>
            <Link href="/acceptable-use" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition">Acceptable Use</Link>
          </nav>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} Shivaksa Technologies LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

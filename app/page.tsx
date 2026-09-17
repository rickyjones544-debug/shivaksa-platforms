import Link from 'next/link';

const nav = [
  { href: '#solutions', label: 'Solutions' },
  { href: '#technology', label: 'Technology' },
  { href: '#industries', label: 'Industries' },
];

const services = [
  {
    title: 'AI Voice Agents',
    description: 'Conversational agents for inbound, outbound, scheduling, and handoff.',
    accent: 'border-t-indigo-500',
    glow: 'glow-purple',
    icon: 'voice',
  },
  {
    title: 'VoIP & SIP',
    description: 'Business-class calling with SIP, routing, CDR, and prepaid controls.',
    accent: 'border-t-blue-500',
    glow: 'glow-blue',
    icon: 'phone',
  },
  {
    title: 'CRM & Automation',
    description: 'Connect contact data to workflows and automate business processes.',
    accent: 'border-t-emerald-500',
    glow: '',
    icon: 'automation',
  },
  {
    title: 'Lead Generation',
    description: 'Prospecting, qualification, and verification for B2B pipelines.',
    accent: 'border-t-amber-500',
    glow: '',
    icon: 'target',
  },
  {
    title: 'BPO Operations',
    description: 'Technology-enabled operations, QA, and back-office workflows.',
    accent: 'border-t-violet-500',
    glow: '',
    icon: 'operations',
  },
  {
    title: 'Software Development',
    description: 'Web apps, mobile apps, dashboards, APIs, and custom business systems.',
    accent: 'border-t-cyan-500',
    glow: '',
    icon: 'code',
  },
];

const trust = [
  'Multi-tenant isolation',
  'Role-based access control',
  'Audit logging',
  'KYC/KYB onboarding',
  'Prepaid wallet ledger',
  'Approved infrastructure',
];

const industries = [
  'Professional services',
  'Sales organizations',
  'Real estate',
  'Automotive',
  'Healthcare operations',
  'Financial operations',
  'E-commerce',
  'Startups',
];

function Icon({ name, className }: { name: string; className?: string }) {
  const props = { className: `h-6 w-6 ${className || ''}`, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.5 };
  if (name === 'voice') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    );
  }
  if (name === 'phone') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    );
  }
  if (name === 'automation') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 4.992l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    );
  }
  if (name === 'target') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5 12 3.75 12 3.75s7.5 3.608 7.5 6.75z" />
      </svg>
    );
  }
  if (name === 'operations') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-blue-300 mb-4">
      {children}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full max-w-xl mx-auto lg:mx-0">
      <div className="absolute -inset-8 bg-blue-500/10 blur-3xl rounded-full" />
      <div className="absolute -inset-8 bg-violet-500/10 blur-3xl rounded-full translate-x-12 translate-y-8" />
      <div className="relative rounded-2xl card-glass p-6 sm:p-8 glow-blue">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400 border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Example platform preview
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">DEMO</span>
        </div>

        <svg viewBox="0 0 360 160" className="w-full h-auto mb-5" fill="none" stroke="currentColor">
          <defs>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path d="M40,120 C80,120 90,60 140,60 S200,130 260,80 S320,80 340,50" stroke="url(#line-grad)" strokeWidth="1.5" className="animate-dash" />
          <circle cx="40" cy="120" r="8" className="fill-blue-500/20 stroke-blue-400" strokeWidth="1.5" />
          <circle cx="140" cy="60" r="8" className="fill-violet-500/20 stroke-violet-400" strokeWidth="1.5" />
          <circle cx="260" cy="80" r="8" className="fill-indigo-500/20 stroke-indigo-400" strokeWidth="1.5" />
          <circle cx="340" cy="50" r="8" className="fill-cyan-500/20 stroke-cyan-400" strokeWidth="1.5" />
        </svg>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Prepaid wallet', value: '$0.00' },
            { label: 'Customer rate', value: '$0.0160/min' },
            { label: 'Active calls', value: '0' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/5 bg-white/5 p-4">
              <div className="text-xs text-slate-400">{stat.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{stat.value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
          AI agent answered, reserved wallet funds, routed call, logged CRM outcome, and audited the event.
        </div>
      </div>
    </div>
  );
}

function FlowStep({ label, icon, last = false }: { label: string; icon: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 border border-white/10 text-blue-300">
          <Icon name={icon} />
        </div>
        {!last && <div className="h-10 w-px bg-gradient-to-b from-blue-500/50 to-transparent my-1" />}
      </div>
      <div className="text-sm sm:text-base font-medium text-slate-200 pb-10 last:pb-0">{label}</div>
    </div>
  );
}

function HorizontalFlow({ steps }: { steps: { label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2 sm:gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            {step.label}
          </div>
          {i < steps.length - 1 && <span className="text-blue-400 text-lg">→</span>}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-sm">S</span>
            <span className="text-lg font-semibold tracking-tight text-white">Shivaksa Technologies LLC</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-white transition">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-slate-300 hover:text-white transition">
              Client Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-950 bg-white rounded-lg hover:bg-slate-200 transition"
            >
              Request access
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        <section className="relative overflow-hidden px-4 pt-24 pb-28 sm:pt-32 sm:pb-36 bg-grid-fine">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] bg-blue-500/10 blur-[100px] rounded-full" />
          <div className="absolute top-40 -left-40 h-[400px] w-[400px] bg-violet-500/10 blur-[100px] rounded-full" />

          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="max-w-2xl animate-fade-in">
                <div className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-6">
                  AI • Voice • Communications • Automation • Software
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1]">
                  Infrastructure for{' '}
                  <span className="gradient-text-hero">AI voice, VoIP and business operations.</span>
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed max-w-xl">
                  Shivaksa Technologies LLC builds secure, multi-tenant technology for AI voice agents, business VoIP/SIP, CRM automation, lead operations, and custom software.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-950 bg-white rounded-xl hover:bg-slate-200 transition shadow-lg shadow-white/5"
                  >
                    Request platform access
                  </Link>
                  <a
                    href="#solutions"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-200 border border-white/20 rounded-xl hover:bg-white/5 transition"
                  >
                    Explore solutions
                  </a>
                </div>
              </div>
              <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="relative py-24 px-4 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-16">
              <SectionEyebrow>Core solutions</SectionEyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Technology built for operations</h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                Integrated technology services designed for secure, multi-tenant delivery and transparent usage.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => (
                <div
                  key={s.title}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-8 hover-lift ${s.accent} border-t-4 ${s.glow}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-6 bg-slate-800/60 text-blue-300`}>
                    <Icon name={s.icon} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-4 bg-slate-900/40 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <SectionEyebrow>AI Voice</SectionEyebrow>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-6">Conversational agents for real business workflows</h2>
                <p className="text-lg text-slate-400 leading-relaxed mb-8">
                  Voice agents handle inbound and outbound calls, qualify leads, schedule appointments, and hand off to live agents — while automatically updating CRM and reserving call funds.
                </p>
              </div>
              <div className="card-glass rounded-2xl p-8 glow-purple">
                <div className="space-y-2">
                  <FlowStep label="Customer calls" icon="phone" />
                  <FlowStep label="AI Voice Agent answers" icon="voice" />
                  <FlowStep label="Conversation & qualification" icon="automation" />
                  <FlowStep label="CRM record updated" icon="automation" />
                  <FlowStep label="Automation triggered" icon="automation" />
                  <FlowStep label="Human handoff when needed" icon="phone" last />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-4 bg-slate-950 bg-grid">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 card-glass rounded-2xl p-8 glow-blue">
                <HorizontalFlow steps={[
                  { label: 'SIP' },
                  { label: 'Routing' },
                  { label: 'Call' },
                  { label: 'CDR' },
                  { label: 'Usage' },
                  { label: 'Business' },
                ]} />
                <div className="mt-8 space-y-3">
                  {['Prepaid wallet', 'Low-balance protection', 'Usage monitoring', 'Business CDR'].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <SectionEyebrow>VoIP & SIP</SectionEyebrow>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-6">Business calling with full control</h2>
                <p className="text-lg text-slate-400 leading-relaxed">
                  Provision SIP accounts, route calls, capture CDR, and monitor usage in real time. Prepaid wallet architecture prevents unexpected spend and keeps billing transparent.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="technology" className="py-24 px-4 bg-slate-900/40 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <SectionEyebrow>Technology</SectionEyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">One connected operating layer</h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                Voice, AI, CRM, automation, and software designed to work as a single system rather than disconnected tools.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {['AI', 'Voice', 'VoIP', 'CRM', 'Automation', 'Operations'].map((item, i) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-center hover-lift"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="text-2xl font-semibold text-white mb-1">{item}</div>
                  <div className="text-xs text-slate-500">Shivaksa {item}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-4 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <SectionEyebrow>Security</SectionEyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Built for secure operations</h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                Multi-tenant architecture with access control, audit logging, and business onboarding.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trust.map((item, i) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 flex items-start gap-4 hover-lift"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <span className="text-slate-200 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="py-24 px-4 bg-slate-900/40 border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <SectionEyebrow>Industries</SectionEyebrow>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">Use cases</h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                Shivaksa technology is adapted for different workflows and operating models.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/60 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition"
                >
                  {ind}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-4 bg-slate-950">
          <div className="max-w-4xl mx-auto text-center">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-10 sm:p-14 glow-blue">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
                Build the next layer of your business with Shivaksa.
              </h2>
              <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
                Request access and our team will review your business details before enabling VoIP and AI voice services.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-950 bg-white rounded-xl hover:bg-slate-200 transition"
                >
                  Request access
                </Link>
                <a
                  href="mailto:info@shivaksatechnology.com"
                  className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-200 border border-white/20 rounded-xl hover:bg-white/5 transition"
                >
                  Talk to Shivaksa
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 py-14 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-xs">S</span>
              <span className="text-sm font-medium text-white">Shivaksa Technologies LLC</span>
            </div>
            <p className="text-sm text-slate-400">
              AI voice, VoIP/SIP, CRM automation, and custom software for modern business operations.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-white mb-4">Solutions</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#solutions" className="hover:text-white transition">AI Voice Agents</a></li>
              <li><a href="#solutions" className="hover:text-white transition">VoIP & SIP</a></li>
              <li><a href="#solutions" className="hover:text-white transition">CRM & Automation</a></li>
              <li><a href="#solutions" className="hover:text-white transition">Custom Software</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/acceptable-use" className="hover:text-white transition">Acceptable Use</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-white mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="mailto:info@shivaksatechnology.com" className="hover:text-white transition">info@shivaksatechnology.com</a></li>
              <li><Link href="/login" className="hover:text-white transition">Client Login</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-sm text-slate-500">
          © {new Date().getFullYear()} Shivaksa Technologies LLC. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

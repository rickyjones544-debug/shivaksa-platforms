import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Shivaksa Technologies LLC</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <a href="#services" className="hover:text-blue-600">Services</a>
            <a href="#about" className="hover:text-blue-600">About</a>
            <a href="#contact" className="hover:text-blue-600">Contact</a>
            <Link href="/login" className="text-blue-600 hover:text-blue-700">Sign in</Link>
            <Link href="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Get started</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 sm:py-28 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              Technology solutions that power modern business operations
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400">
              Shivaksa Technologies LLC delivers secure, scalable BPO, AI voice, VoIP/SIP, lead generation, and software development services for growing organizations.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Request access
              </Link>
              <a
                href="#services"
                className="w-full sm:w-auto px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                Explore services
              </a>
            </div>
          </div>
        </section>

        <section id="services" className="py-16 px-4 bg-zinc-50 dark:bg-zinc-900">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
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
              ].map((s) => (
                <div
                  key={s.title}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 hover:shadow-sm transition"
                >
                  <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Built for secure, multi-tenant operations</h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Shivaksa provides prepaid VoIP and communications services through approved infrastructure and service providers. Customer accounts are isolated, financial operations are auditable, and service access is approved through a business onboarding review. Specific rates, destinations, features, and availability are subject to customer approval, routing availability, and applicable provider terms.
            </p>
          </div>
        </section>

        <section id="contact" className="py-16 px-4 bg-zinc-50 dark:bg-zinc-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Talk to our team</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              Ready to learn more? Request access and our team will reach out to discuss your requirements.
            </p>
            <Link
              href="/register"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Request VoIP access
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <p>© {new Date().getFullYear()} Shivaksa Technologies LLC. All rights reserved.</p>
          <nav className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-100">Terms of Service</Link>
            <Link href="/acceptable-use" className="hover:text-zinc-900 dark:hover:text-zinc-100">Acceptable Use</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

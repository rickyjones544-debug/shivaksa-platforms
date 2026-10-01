import Link from 'next/link';
import type { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Shivaksa Technologies LLC about AI voice agents, VoIP/SIP, dialer solutions, CRM automation, or custom software development.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white font-bold text-sm">
              S
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">Shivaksa Technologies LLC</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-16 sm:py-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Talk to Shivaksa
            </h1>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed">
              Tell us what you are building and our team will follow up with the right next step — no account required.
            </p>

            <div className="mt-10 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Email</h2>
                <a
                  href="mailto:info@shivaksatechnology.com"
                  className="mt-1 block text-blue-300 hover:text-blue-200 transition"
                >
                  info@shivaksatechnology.com
                </a>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">What we can help with</h2>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
                  <li>Software Development</li>
                  <li>VoIP / SIP / Wholesale Voice</li>
                  <li>Dialer Solutions</li>
                  <li>AI Voice Agents</li>
                  <li>CRM / Automation</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
                Already a customer?{' '}
                <Link href="/login" className="text-blue-300 hover:text-blue-200 transition">
                  Sign in
                </Link>{' '}
                or{' '}
                <Link href="/register" className="text-blue-300 hover:text-blue-200 transition">
                  request platform access
                </Link>
                .
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Shivaksa Technologies LLC. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms</Link>
            <Link href="/acceptable-use" className="hover:text-white transition">Acceptable Use</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Shivaksa Technologies LLC',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Terms of Service</h1>
        <p className="text-slate-400 mb-4 leading-relaxed">
          These Terms of Service govern your use of the Shivaksa Technologies LLC platform and services. By creating an account or using our services, you agree to these terms.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Account eligibility</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          You must provide accurate business information and complete our onboarding review before accessing VoIP or other restricted services. We may approve or decline accounts at our discretion.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Prepaid services</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          VoIP and related communications services are prepaid. Usage is charged against your wallet balance according to your customer rate and applicable billing increments. Rates, destinations, and features are subject to approval, routing availability, and provider terms.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Acceptable use</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          You may use our services only for lawful business purposes. Prohibited uses include fraud, abuse, unauthorized access, and any activity that violates applicable law or provider policies.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Service changes</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          We may modify, suspend, or discontinue services at any time. Pricing and service availability may change with notice to affected customers.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

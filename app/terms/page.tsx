import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-6">Terms of Service</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          These Terms of Service govern your use of the Shivaksa Technologies LLC platform and services. By creating an account or using our services, you agree to these terms.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Account eligibility</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          You must provide accurate business information and complete our onboarding review before accessing VoIP or other restricted services. We may approve or decline accounts at our discretion.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Prepaid services</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          VoIP and related communications services are prepaid. Usage is charged against your wallet balance according to your customer rate and applicable billing increments. Rates, destinations, and features are subject to approval, routing availability, and provider terms.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Acceptable use</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          You may use our services only for lawful business purposes. Prohibited uses include fraud, abuse, unauthorized access, and any activity that violates applicable law or provider policies.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Service changes</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          We may modify, suspend, or discontinue services at any time. Pricing and service availability may change with notice to affected customers.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Acceptable Use Policy — Shivaksa Technologies LLC',
};

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Acceptable Use Policy</h1>
        <p className="text-slate-400 mb-4 leading-relaxed">
          This policy sets the rules for using Shivaksa Technologies LLC services. Violations may result in suspension or termination.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Prohibited activities</h2>
        <ul className="list-disc list-inside text-slate-400 space-y-1 mb-4">
          <li>Illegal, fraudulent, or deceptive activities</li>
          <li>Harassment, abuse, or unwanted communications</li>
          <li>Unauthorized access to accounts, systems, or data</li>
          <li>Distribution of malware or malicious code</li>
          <li>Use that violates applicable telecommunications or provider policies</li>
          <li>Resale or redistribution of services without written approval</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">Calling requirements</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          All calling use cases must be disclosed during onboarding and approved. Customers are responsible for compliance with call-recording, do-not-call, and telecommunications laws.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Enforcement</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          We may investigate suspected violations, suspend accounts, and cooperate with law enforcement or providers as required.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Shivaksa Technologies LLC',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">Privacy Policy</h1>
        <p className="text-slate-400 mb-4 leading-relaxed">
          Shivaksa Technologies LLC respects your privacy. This policy describes how we collect, use, and protect information you provide to us.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Information we collect</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          We collect business and contact information necessary to provide our services, including account registration details, business verification information, call usage data, and billing information.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">How we use information</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          We use your information to provide, maintain, and improve our services, to verify accounts, to process billing, and to communicate with you about your account.
        </p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Data protection</h2>
        <p className="text-slate-400 mb-4 leading-relaxed">
          We implement reasonable administrative, technical, and physical safeguards to protect the information we collect. We do not sell your personal information.
        </p>
        <p className="text-slate-500 mt-8">
          For questions about this policy, contact us through your account representative or the registration inquiry process.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 transition">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

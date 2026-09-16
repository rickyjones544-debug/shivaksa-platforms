import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-6">Privacy Policy</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Shivaksa Technologies LLC respects your privacy. This policy describes how we collect, use, and protect information you provide to us.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Information we collect</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          We collect business and contact information necessary to provide our services, including account registration details, business verification information, call usage data, and billing information.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">How we use information</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          We use your information to provide, maintain, and improve our services, to verify accounts, to process billing, and to communicate with you about your account.
        </p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mt-6 mb-2">Data protection</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          We implement reasonable administrative, technical, and physical safeguards to protect the information we collect. We do not sell your personal information.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400 mt-8">
          For questions about this policy, contact us through your account representative or the registration inquiry process.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

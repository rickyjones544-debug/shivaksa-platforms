'use client';

import { useState } from 'react';

const INTEREST_OPTIONS = [
  { value: '', label: 'Select an interest' },
  { value: 'software-development', label: 'Software Development' },
  { value: 'voip-wholesale-voice', label: 'VoIP / SIP / Wholesale Voice' },
  { value: 'dialer-solutions', label: 'Dialer Solutions' },
  { value: 'ai-voice-agents', label: 'AI Voice Agents' },
  { value: 'crm-automation', label: 'CRM / Automation' },
  { value: 'other', label: 'Other' },
];

const inputClass =
  'w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition';

export default function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    interest: '',
    phone: '',
    message: '',
    website: '', // honeypot
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    setError('');
    setStatus('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(data?.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-emerald-300">
          Thank you. Your message has been received.
        </p>
        <p className="mt-1 text-sm text-slate-400">Our team will contact you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — invisible to humans */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={update}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
            Full Name <span className="text-blue-400">*</span>
          </label>
          <input id="name" name="name" type="text" required value={form.name} onChange={update} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            Work Email <span className="text-blue-400">*</span>
          </label>
          <input id="email" name="email" type="email" required value={form.email} onChange={update} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-slate-300 mb-1.5">
            Company <span className="text-blue-400">*</span>
          </label>
          <input id="company" name="company" type="text" required value={form.company} onChange={update} className={inputClass} />
        </div>
        <div>
          <label htmlFor="interest" className="block text-sm font-medium text-slate-300 mb-1.5">
            Interest / Service <span className="text-blue-400">*</span>
          </label>
          <select id="interest" name="interest" required value={form.interest} onChange={update} className={inputClass}>
            {INTEREST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={o.value === ''}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1.5">
          Phone / WhatsApp <span className="text-slate-500">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" value={form.phone} onChange={update} className={inputClass} />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">
          Message <span className="text-slate-500">(optional)</span>
        </label>
        <textarea id="message" name="message" rows={4} value={form.message} onChange={update} className={inputClass} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-950 bg-white rounded-xl hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

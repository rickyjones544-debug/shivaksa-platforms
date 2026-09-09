'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface CustomerDetail {
  id: string;
  name: string;
  service: {
    status: string;
    customerRate: string;
    reserveMinutes: number;
    maxCallDurationMinutes: number;
  } | null;
  wallet: {
    balance: string;
    reserved: string;
    available: string;
  } | null;
}

export default function VoipCustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/voip/admin/customers/${id}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setCustomer(json.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  async function updateService(payload: Record<string, unknown>) {
    setMessage(null);
    const res = await fetch(`/api/voip/admin/customers/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setCustomer((prev) => (prev ? { ...prev, service: json.data } : prev));
      setMessage('Service settings updated');
    } else {
      setError(json.error || 'Update failed');
    }
  }

  async function addCredit(amount: string) {
    setMessage(null);
    const res = await fetch(`/api/voip/admin/customers/${id}/wallet/credit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), description: 'Admin credit' }),
    });
    const json = await res.json();
    if (json.success) {
      setMessage('Credit added');
    } else {
      setError(json.error || 'Failed to add credit');
    }
  }

  async function setSuspension(suspended: boolean) {
    setMessage(null);
    const res = await fetch(`/api/voip/admin/customers/${id}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended }),
    });
    const json = await res.json();
    if (json.success) {
      setCustomer((prev) => (prev && prev.service ? { ...prev, service: { ...prev.service, status: json.data.status } } : prev));
      setMessage(suspended ? 'Customer suspended' : 'Customer reactivated');
    } else {
      setError(json.error || 'Failed to update status');
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!customer) return <div className="p-6">Customer not found</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{customer.name}</h1>
      {message && <div className="text-green-600">{message}</div>}

      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Service Settings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            updateService({
              customerRate: formData.get('customerRate')?.toString(),
              reserveMinutes: parseInt(formData.get('reserveMinutes')?.toString() || '5', 10),
              maxCallDurationMinutes: parseInt(formData.get('maxCallDurationMinutes')?.toString() || '60', 10),
            });
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <input
            name="customerRate"
            type="number"
            step="0.001"
            defaultValue={customer.service?.customerRate || '0.016'}
            className="border rounded px-3 py-2"
          />
          <input
            name="reserveMinutes"
            type="number"
            defaultValue={customer.service?.reserveMinutes || 5}
            className="border rounded px-3 py-2"
          />
          <input
            name="maxCallDurationMinutes"
            type="number"
            defaultValue={customer.service?.maxCallDurationMinutes || 60}
            className="border rounded px-3 py-2"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Update Rate & Limits
          </button>
        </form>

        <div className="flex gap-2">
          <button
            onClick={() => setSuspension(true)}
            className="px-4 py-2 border rounded text-red-600 hover:bg-red-50"
          >
            Suspend
          </button>
          <button
            onClick={() => setSuspension(false)}
            className="px-4 py-2 border rounded text-green-600 hover:bg-green-50"
          >
            Reactivate
          </button>
        </div>
      </section>

      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Wallet</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>Balance: ${parseFloat(customer.wallet?.balance || '0').toFixed(2)}</div>
          <div>Reserved: ${parseFloat(customer.wallet?.reserved || '0').toFixed(2)}</div>
          <div>Available: ${parseFloat(customer.wallet?.available || '0').toFixed(2)}</div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            addCredit(formData.get('amount')?.toString() || '0');
          }}
          className="flex gap-2"
        >
          <input name="amount" type="number" step="0.01" placeholder="Amount" className="border rounded px-3 py-2" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Add Credit
          </button>
        </form>
      </section>

      <section className="flex gap-4">
        <a href={`/api/voip/admin/customers/${id}/cdr?format=csv`} className="text-blue-600 hover:underline">
          Download CDR CSV
        </a>
      </section>
    </div>
  );
}

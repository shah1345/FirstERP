import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Vendor {
  id: number; name: string; phone: string; email: string; address: string;
  company: string; total_purchase: number; total_paid: number; total_due: number;
  notes: string; status: string; total_purchases: number; created_at: string;
}

interface Purchase {
  id: number; batch_number: string; product_name: string; quantity_added: number;
  purchase_price: number; purchase_total: number; purchase_paid: number;
  purchase_due: number; created_at: string;
}

interface Payment {
  id: number; amount: number; payment_method: string; reference_number: string;
  receipt_number: string; notes: string; paid_by_name: string; created_at: string;
}

export default function VendorPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', company: '', notes: '', status: 'active' });

  // Detail view
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<'purchases' | 'payments'>('purchases');

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', reference_number: '', notes: '', bank_account_id: '' });
  const [payLoading, setPayLoading] = useState(false);

  // Bank accounts for payment
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { loadVendors(); loadAccounts(); }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vendors', { params: { search: search || undefined } });
      if (res.data.success) setVendors(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/finance/bank-accounts');
      if (res.data.success) setAccounts(res.data.data || []);
    } catch (e) { console.error('Load accounts:', e); }
  };

  useEffect(() => { const t = setTimeout(() => loadVendors(), 300); return () => clearTimeout(t); }, [search]);

  const loadDetail = async (id: number) => {
    try {
      const res = await api.get(`/vendors/${id}`);
      if (res.data.success) { setSelectedVendor(res.data.data); setDetailTab('purchases'); }
    } catch (err) { console.error(err); }
  };

  const saveVendor = async () => {
    if (!form.name) { alert('Vendor name is required'); return; }
    try {
      if (editId) {
        await api.put(`/vendors/${editId}`, form);
      } else {
        await api.post('/vendors', form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', phone: '', email: '', address: '', company: '', notes: '', status: 'active' });
      loadVendors();
      if (selectedVendor?.vendor?.id === editId) loadDetail(editId!);
    } catch (err: any) { alert(err.response?.data?.message || 'Save failed'); }
  };

  const deleteVendor = async (id: number) => {
    if (!confirm('Delete this vendor?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      loadVendors();
      if (selectedVendor?.vendor?.id === id) setSelectedVendor(null);
    } catch (err: any) { alert(err.response?.data?.message || 'Delete failed'); }
  };

  const makePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { alert('Enter a valid amount'); return; }
    setPayLoading(true);
    try {
      const res = await api.post(`/vendors/${selectedVendor.vendor.id}/payments`, {
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number || null,
        notes: payForm.notes || null,
        bank_account_id: payForm.bank_account_id || null,
      });
      if (res.data.success) {
        alert(`Payment recorded! Receipt: ${res.data.receipt_number}`);
        setShowPayment(false);
        setPayForm({ amount: '', payment_method: 'cash', reference_number: '', notes: '', bank_account_id: '' });
        loadDetail(selectedVendor.vendor.id);
        loadVendors();
      }
    } catch (err: any) { alert(err.response?.data?.message || 'Payment failed'); }
    finally { setPayLoading(false); }
  };

  const printReceipt = (payment: Payment) => {
    const v = selectedVendor?.vendor;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Receipt</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#000;padding:20px;max-width:400px;margin:auto}
      .header{text-align:center;border-bottom:3px double #000;padding-bottom:10px;margin-bottom:15px}
      .header h1{font-size:18px;font-weight:900}
      .header p{font-size:11px;font-weight:700}
      .row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;font-weight:700}
      .row span{font-weight:800}
      .amount{font-size:20px;text-align:center;padding:12px;border:2px solid #000;margin:15px 0;font-weight:900}
      .footer{text-align:center;margin-top:15px;padding-top:10px;border-top:2px dashed #000;font-size:10px}
      @media print{body{padding:5px}@page{margin:5mm}}
    </style></head><body>
      <div class="header">
        <h1>PAYMENT RECEIPT</h1>
        <p>Vendor Payment Voucher</p>
      </div>
      <div class="row"><div>Receipt No:</div><span>${payment.receipt_number}</span></div>
      <div class="row"><div>Date:</div><span>${new Date(payment.created_at).toLocaleDateString('en-GB')}</span></div>
      <hr style="border-top:1px dashed #000;margin:8px 0">
      <div class="row"><div>Vendor:</div><span>${v?.name || ''}</span></div>
      ${v?.company ? `<div class="row"><div>Company:</div><span>${v.company}</span></div>` : ''}
      ${v?.phone ? `<div class="row"><div>Phone:</div><span>${v.phone}</span></div>` : ''}
      <hr style="border-top:1px dashed #000;margin:8px 0">
      <div class="amount">৳${parseFloat(payment.amount as any).toLocaleString()}</div>
      <div class="row"><div>Method:</div><span>${(payment.payment_method || 'cash').replace('_', ' ').toUpperCase()}</span></div>
      ${payment.reference_number ? `<div class="row"><div>Reference:</div><span>${payment.reference_number}</span></div>` : ''}
      ${payment.notes ? `<div class="row"><div>Notes:</div><span>${payment.notes}</span></div>` : ''}
      <div class="row"><div>Paid By:</div><span>${payment.paid_by_name || 'Staff'}</span></div>
      <hr style="border-top:1px dashed #000;margin:8px 0">
      <div class="row"><div>Total Purchase:</div><span>৳${(v?.total_purchase || 0).toLocaleString()}</span></div>
      <div class="row"><div>Total Paid:</div><span>৳${(v?.total_paid || 0).toLocaleString()}</span></div>
      <div class="row" style="font-size:14px;border:1px solid #000;padding:6px"><div>Remaining Due:</div><span>৳${(v?.total_due || 0).toLocaleString()}</span></div>
      <div class="footer">
        <p>Thank you!</p>
        <p style="margin-top:4px">Printed: ${new Date().toLocaleString('en-GB')}</p>
      </div>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      iframe.contentWindow!.onafterprint = () => iframe.remove();
      setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 10000);
    }, 500);
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  // ─── DETAIL VIEW ──────────────────────────────────
  if (selectedVendor) {
    const v = selectedVendor.vendor;
    const purchases: Purchase[] = selectedVendor.purchases || [];
    const payments: Payment[] = selectedVendor.payments || [];

    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <button onClick={() => setSelectedVendor(null)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition">
          ← Back to Vendors
        </button>

        {/* Vendor Header */}
        <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)' }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'Barlow Condensed' }}>{v.name}</h1>
              <p className="text-teal-100 text-sm">{v.company || ''} {v.phone ? `• ${v.phone}` : ''} {v.email ? `• ${v.email}` : ''}</p>
              {v.address && <p className="text-teal-200 text-xs mt-1">{v.address}</p>}
            </div>
            <button onClick={() => { setShowPayment(true); setPayForm({ ...payForm, amount: String(v.total_due || '') }); }}
              className="px-4 py-2 rounded-xl bg-white text-teal-700 font-bold text-sm hover:bg-teal-50 transition shadow">
              💸 Make Payment
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <p className="text-xs text-gray-500 font-semibold">Total Purchase</p>
            <p className="text-lg font-black text-gray-900">{fmt(v.total_purchase)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <p className="text-xs text-gray-500 font-semibold">Total Paid</p>
            <p className="text-lg font-black text-green-600">{fmt(v.total_paid)}</p>
          </div>
          <div className={`rounded-xl p-4 border shadow-sm text-center ${v.total_due > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <p className="text-xs text-gray-500 font-semibold">Due Balance</p>
            <p className={`text-lg font-black ${v.total_due > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(v.total_due)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setDetailTab('purchases')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${detailTab === 'purchases' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            📦 Purchases ({purchases.length})
          </button>
          <button onClick={() => setDetailTab('payments')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${detailTab === 'payments' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            💸 Payments ({payments.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border p-4">
          {detailTab === 'purchases' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2">Date</th><th className="text-left">Batch</th><th className="text-left">Product</th>
                  <th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th>
                  <th className="text-right">Paid</th><th className="text-right">Due</th>
                </tr></thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="font-mono text-xs">{p.batch_number}</td>
                      <td className="font-semibold">{p.product_name}</td>
                      <td className="text-right">{p.quantity_added}</td>
                      <td className="text-right">{fmt(p.purchase_price)}</td>
                      <td className="text-right font-bold">{fmt(p.purchase_total)}</td>
                      <td className="text-right text-green-600">{fmt(p.purchase_paid)}</td>
                      <td className={`text-right font-bold ${parseFloat(p.purchase_due as any) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(p.purchase_due)}
                      </td>
                    </tr>
                  ))}
                  {purchases.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400">No purchases yet</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500 text-xs">
                  <th className="text-left py-2">Date</th><th className="text-left">Receipt</th><th className="text-right">Amount</th>
                  <th className="text-center">Method</th><th className="text-left">Reference</th><th className="text-left">By</th><th></th>
                </tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                      <td className="font-mono text-xs font-bold text-blue-600">{p.receipt_number}</td>
                      <td className="text-right font-black text-green-600">{fmt(p.amount)}</td>
                      <td className="text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-semibold">
                          {(p.payment_method || 'cash').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-xs text-gray-500">{p.reference_number || '—'}</td>
                      <td className="text-xs">{p.paid_by_name || '—'}</td>
                      <td className="text-right">
                        <button onClick={() => printReceipt(p)} className="text-xs text-blue-600 font-bold hover:underline">🖨 Print</button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payments yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPayment(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-black text-gray-900 mb-4" style={{ fontFamily: 'Barlow Condensed' }}>💸 Pay Vendor — {v.name}</h3>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-red-500 font-semibold">Current Due Balance</p>
                <p className="text-2xl font-black text-red-600">{fmt(v.total_due)}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Payment Amount (৳) *</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-lg font-bold" placeholder="0" min={1} step="0.01" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Payment Method</label>
                  <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="cash">💵 Cash</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="cheque">📝 Cheque</option>
                    <option value="mobile_banking">📱 Mobile Banking</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Reference No. (cheque/txn ID)</label>
                  <input value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Pay From Account</label>
                  <select value={payForm.bank_account_id} onChange={e => setPayForm({ ...payForm, bank_account_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="">💵 Cash (Others) — not tracked in finance</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.icon || '🏦'} {a.account_name} — Balance: ৳{Number(a.current_balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: payForm.bank_account_id ? '#059669' : '#9ca3af' }}>
                    {payForm.bank_account_id ? '✅ Will deduct from account & record in finance' : 'Cash — will NOT be recorded in finance'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                  <input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowPayment(false)} className="flex-1 py-2.5 rounded-xl border font-semibold">Cancel</button>
                <button onClick={makePayment} disabled={payLoading}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold disabled:opacity-50 hover:bg-teal-700 transition">
                  {payLoading ? '⏳...' : '💸 Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── VENDOR LIST VIEW ─────────────────────────────
  const totalDue = vendors.reduce((s, v) => s + (v.total_due || 0), 0);
  const totalPurchase = vendors.reduce((s, v) => s + (v.total_purchase || 0), 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Barlow Condensed' }}>🏭 VENDORS / SUPPLIERS</h1>
          <p className="text-xs text-gray-500">{vendors.length} vendors • Total Due: <span className="text-red-600 font-bold">{fmt(totalDue)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm w-48" placeholder="🔍 Search vendors..." />
          <button onClick={() => { setEditId(null); setForm({ name: '', phone: '', email: '', address: '', company: '', notes: '', status: 'active' }); setShowForm(true); }}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 transition">
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
          <p className="text-xs text-gray-500 font-semibold">Total Vendors</p>
          <p className="text-xl font-black text-gray-900">{vendors.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
          <p className="text-xs text-gray-500 font-semibold">Total Purchase</p>
          <p className="text-xl font-black text-blue-600">{fmt(totalPurchase)}</p>
        </div>
        <div className={`rounded-xl p-4 border shadow-sm text-center ${totalDue > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <p className="text-xs text-gray-500 font-semibold">Total Due</p>
          <p className={`text-xl font-black ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalDue)}</p>
        </div>
      </div>

      {/* Vendor Cards */}
      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No vendors found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {vendors.map(v => (
            <div key={v.id} onClick={() => loadDetail(v.id)}
              className="bg-white rounded-xl border p-4 cursor-pointer hover:shadow-lg hover:border-teal-300 transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 truncate group-hover:text-teal-600 transition">{v.name}</h3>
                  <p className="text-xs text-gray-400 truncate">{v.company || v.phone || v.email || '—'}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={e => { e.stopPropagation(); setEditId(v.id); setForm({ name: v.name, phone: v.phone || '', email: v.email || '', address: v.address || '', company: v.company || '', notes: v.notes || '', status: v.status }); setShowForm(true); }}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-blue-100 text-blue-600 font-bold">✏</button>
                  <button onClick={e => { e.stopPropagation(); deleteVendor(v.id); }}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-red-100 text-red-500 font-bold">🗑</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Purchase</p>
                  <p className="text-sm font-bold text-gray-800">{fmt(v.total_purchase)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Paid</p>
                  <p className="text-sm font-bold text-green-600">{fmt(v.total_paid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Due</p>
                  <p className={`text-sm font-bold ${v.total_due > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(v.total_due)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">{v.total_purchases || 0} purchases</span>
                <span className="text-xs text-teal-500 font-bold group-hover:text-teal-700">Details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900" style={{ fontFamily: 'Barlow Condensed' }}>{editId ? '✏ Edit Vendor' : '🏭 Add Vendor'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Vendor Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Vendor name" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Company name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Phone number" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Email" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Address" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Notes" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border font-semibold">Cancel</button>
              <button onClick={saveVendor}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition">
                {editId ? '✅ Update' : '🏭 Create Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

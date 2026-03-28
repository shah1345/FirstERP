import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function BankDepositPage() {
  const { isAdmin, isOutletUser, outletName } = useAuth();
  const [data, setData] = useState<any>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [openingOverride, setOpeningOverride] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => { loadOutlets(); }, []);
  useEffect(() => { loadData(); }, [selectedOutlet]);

  const loadOutlets = async () => {
    if (!isOutletUser) {
      try { const r = await api.get('/deposits/outlets'); if (r.data.success) setOutlets(r.data.data || []); } catch { }
    }
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedOutlet) params.outlet_id = selectedOutlet;
      const r = await api.get('/deposits/today', { params });
      if (r.data.success) {
        setData(r.data.data);
        if (!r.data.data.is_admin_view) {
          setOpeningOverride(String(r.data.data.opening_balance || 0));
          if (r.data.data.banks?.length) setBankAccountId(String(r.data.data.banks[0].id));
        }
      }
    } catch (e: any) {
      console.error(e);
      setData(null);
    } finally { setLoading(false); }
  };

  const handleDeposit = async () => {
    if (!depositAmt || parseFloat(depositAmt) <= 0) { alert('Enter deposit amount'); return; }
    const outletId = isOutletUser ? undefined : (selectedOutlet || undefined);
    if (!isOutletUser && !outletId) { alert('Please select an outlet first'); return; }

    const opening = parseFloat(openingOverride) || 0;
    const cashSales = data?.today_cash_sales || 0;
    const totalCash = opening + cashSales - (data?.today_expenses || 0);

    setSaving(true);
    try {
      const payload: any = { deposit_amount: depositAmt, opening_balance: opening, total_cash: totalCash, notes, bank_account_id: bankAccountId || null };
      if (outletId) payload.outlet_id = outletId;

      if (editId) { await api.put(`/deposits/${editId}`, payload); }
      else { await api.post('/deposits', payload); }
      setDepositAmt(''); setNotes(''); setEditId(null); loadData();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openEdit = (d: any) => {
    setEditId(d.id);
    setDepositAmt(String(d.deposit_amount));
    setOpeningOverride(String(d.opening_balance));
    setNotes(d.notes || '');
    setBankAccountId(String(d.bank_account_id || ''));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deposit?')) return;
    try {
      const r = await api.delete(`/deposits/${id}`);
      if (r.status === 202) alert(r.data.message);
      loadData();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  if (loading) return <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  const showForm = data && !data.is_admin_view;
  const opening = parseFloat(openingOverride) || 0;
  const cashSales = data?.today_cash_sales || 0;
  const expenses = data?.today_expenses || 0;
  const totalCash = opening + cashSales - expenses;
  const remaining = totalCash - (data?.already_deposited || 0);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Bank Deposit</h1>
          <p className="page-subtitle">
            {isOutletUser ? `${outletName || 'Outlet'} — Daily cash management` : 'Admin — Deposit for any outlet'}
          </p>
        </div>
        {/* Admin outlet selector */}
        {!isOutletUser && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Outlet:</label>
            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)}
              className="power-input py-2 text-sm w-48" style={{ minWidth: 180 }}>
              <option value="">📊 All Outlets Overview</option>
              {outlets.map(o => <option key={o.id} value={o.id}>🏪 {o.name} ({o.code})</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ─── ADMIN: ALL OUTLETS OVERVIEW ─────────────── */}
      {data?.is_admin_view && (
        <div className="space-y-5">
          {/* Outlet cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data.outlets || []).map((o: any) => (
              <div key={o.id} className="power-card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedOutlet(String(o.id))}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <div>
                      <p className="font-bold text-sm">{o.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.code}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{o.bank_count} banks</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cash Sales</p>
                    <p className="font-bold text-sm text-green-600">{fmt(o.today_cash_sales)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Deposited</p>
                    <p className="font-bold text-sm text-blue-600">{fmt(o.today_deposited)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cash Bal.</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{fmt(o.cash_balance)}</p>
                  </div>
                </div>
              </div>
            ))}
            {(data.outlets || []).length === 0 && (
              <div className="power-card p-8 text-center col-span-3" style={{ color: 'var(--text-muted)' }}>No outlets. Create outlets in Warehouse module first.</div>
            )}
          </div>

          {/* All deposits history */}
          {(data.history || []).length > 0 && (
            <div className="power-card overflow-hidden">
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📋 All Deposit History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Outlet</th><th>Opening</th><th>Sales</th><th>Total</th><th className="text-right">Deposited</th><th>Closing</th><th>Bank</th><th>By</th><th></th></tr></thead>
                  <tbody>
                    {data.history.map((d: any) => (
                      <tr key={d.id}>
                        <td className="text-sm whitespace-nowrap">{new Date(d.deposit_date).toLocaleDateString('en-GB')}</td>
                        <td><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{d.outlet_name || d.outlet_code || '-'}</span></td>
                        <td className="text-sm">{fmt(d.opening_balance)}</td>
                        <td className="text-sm text-green-600">{fmt(d.cash_sales)}</td>
                        <td className="text-sm font-bold">{fmt(d.total_cash)}</td>
                        <td className="text-right font-bold text-blue-600">{fmt(d.deposit_amount)}</td>
                        <td className="text-sm">{fmt(d.closing_balance)}</td>
                        <td className="text-xs">{d.bank_icon} {d.account_name || '-'}</td>
                        <td className="text-xs">{d.deposited_by_name || '-'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedOutlet(String(d.outlet_id)); setTimeout(() => openEdit(d), 300); }} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                            <button onClick={() => handleDelete(d.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SINGLE OUTLET VIEW (Admin selected or Outlet user) ── */}
      {showForm && data && (
        <>
          {/* Outlet name badge for admin */}
          {!isOutletUser && data.outlet_name && (
            <div className="power-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏪</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{data.outlet_name}</span>
              </div>
              <button onClick={() => setSelectedOutlet('')} className="btn-ghost text-xs py-1 px-3">← All Outlets</button>
            </div>
          )}

          {/* Today's Cash Summary */}
          <div className="power-card p-5 md:p-6">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Today's Cash Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Total Sales</p>
                <p className="text-lg font-black text-blue-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(data.today_total_sales)}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.today_invoices} invoices</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Cash Received</p>
                <p className="text-lg font-black text-green-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(data.today_paid)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Credit Sales</p>
                <p className="text-lg font-black text-red-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(data.today_credit)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--body-bg)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Expenses</p>
                <p className="text-lg font-black text-orange-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(expenses)}</p>
              </div>
            </div>

            {/* Cash calculation */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Opening Cash Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>৳</span>
                  <input type="number" value={openingOverride} onChange={e => setOpeningOverride(e.target.value)}
                    className="power-input w-32 text-right font-bold py-1.5 text-sm" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(editable)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">+ Cash Sales</span>
                <span className="font-bold text-green-600">{fmt(cashSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">- Expenses</span>
                <span className="font-bold text-orange-600">-{fmt(expenses)}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
                <span className="text-base font-black">= Total Cash in Hand</span>
                <span className="text-xl font-black" style={{ fontFamily: 'Barlow Condensed', color: 'var(--primary)' }}>{fmt(totalCash)}</span>
              </div>
              {(data.already_deposited || 0) > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span>- Already Deposited</span>
                    <span className="font-bold text-blue-600">-{fmt(data.already_deposited)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">= Remaining</span>
                    <span className={`text-lg font-black ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: 'Barlow Condensed' }}>{fmt(remaining)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Deposit Form */}
          <div className="power-card p-5 md:p-6">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
              {editId ? '✏️ Edit Deposit' : '💰 Make Deposit'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="power-label">Deposit Amount (৳) *</label>
                <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                  className="power-input text-lg font-bold" placeholder="0" min="0"
                  onFocus={() => { if (!depositAmt && remaining > 0) setDepositAmt(String(Math.floor(remaining))); }} />
              </div>
              <div>
                <label className="power-label">Deposit To</label>
                <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="power-input">
                  <option value="">Select bank account</option>
                  {(data.banks || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.icon || '🏦'} {b.account_name} {b.outlet_name ? `(${b.outlet_name})` : ''} — {fmt(b.current_balance)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="power-label">Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="power-input" placeholder="Deposit note..." />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleDeposit} disabled={saving} className="btn-power py-2.5 px-6">
                {saving ? '⏳ Processing...' : editId ? '💾 Update Deposit' : '🏦 Deposit Now'}
              </button>
              {editId && <button onClick={() => { setEditId(null); setDepositAmt(''); setNotes(''); }} className="btn-ghost px-4">Cancel</button>}
              {remaining > 0 && !editId && (
                <button onClick={() => setDepositAmt(String(Math.floor(remaining)))} className="btn-outline text-xs px-3">
                  Deposit All ({fmt(remaining)})
                </button>
              )}
            </div>
          </div>

          {/* Deposit History */}
          <div className="power-card overflow-hidden">
            <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📋 Deposit History</h3>
            </div>
            {(data.history || []).length === 0 ? (
              <p className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No deposits yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Opening</th><th>Sales</th><th>Total Cash</th><th className="text-right">Deposited</th><th>Closing</th><th>Bank</th><th></th></tr></thead>
                  <tbody>
                    {data.history.map((d: any) => (
                      <tr key={d.id}>
                        <td className="text-sm whitespace-nowrap">{new Date(d.deposit_date).toLocaleDateString('en-GB')}</td>
                        <td className="text-sm">{fmt(d.opening_balance)}</td>
                        <td className="text-sm text-green-600">{fmt(d.cash_sales)}</td>
                        <td className="text-sm font-bold">{fmt(d.total_cash)}</td>
                        <td className="text-right font-bold text-blue-600">{fmt(d.deposit_amount)}</td>
                        <td className="text-sm font-semibold">{fmt(d.closing_balance)}</td>
                        <td className="text-xs">{d.bank_icon} {d.account_name || '-'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(d)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                            <button onClick={() => handleDelete(d.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
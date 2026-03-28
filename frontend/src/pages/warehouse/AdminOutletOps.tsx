// Import this in WarehousePage and render inside outlet detail view
// Usage: <AdminOutletOps outletId={outletDetail.outlet.id} banks={outletDetail.banks} onDone={() => loadDetail(outletDetail.outlet.id)} />

import { useState } from 'react';
import api from '../../services/api';

interface Props {
  outletId: number;
  outletName?: string;
  banks: any[];
  onDone: () => void;
}

export default function AdminOutletOps({ outletId, outletName, banks, onDone }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [opType, setOpType] = useState<'cash' | 'credit' | 'deposit' | 'bank'>('cash');
  const [saving, setSaving] = useState(false);

  const [cashForm, setCashForm] = useState<any>({ amount: '', type: 'set_opening', notes: '' });
  const [creditForm, setCreditForm] = useState<any>({ amount: '', type: 'assign_credit', customer_name: '', notes: '' });
  const [depositForm, setDepositForm] = useState<any>({ amount: '', bank_account_id: '', from_account_id: '', notes: '' });
  const [bankForm, setBankForm] = useState<any>({ account_name: '', account_type: 'bank', bank_name: '', account_number: '', branch: '', opening_balance: 0, icon: '🏦', color: '#2563eb' });

  const open = (type: 'cash' | 'credit' | 'deposit' | 'bank') => {
    setOpType(type);
    setCashForm({ amount: '', type: 'set_opening', notes: '' });
    setCreditForm({ amount: '', type: 'assign_credit', customer_name: '', notes: '' });
    setDepositForm({ amount: '', bank_account_id: banks.length ? String(banks.find((b: any) => b.account_type === 'bank')?.id || banks[0]?.id || '') : '', from_account_id: banks.length ? String(banks.find((b: any) => b.account_type === 'cash')?.id || '') : '', notes: '' });
    setBankForm({ account_name: '', account_type: 'bank', bank_name: '', account_number: '', branch: '', opening_balance: 0, icon: '🏦', color: '#2563eb' });
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (opType === 'cash') {
        if (!cashForm.amount) { alert('Amount required'); setSaving(false); return; }
        await api.post(`/outlet-ops/${outletId}/cash`, cashForm);
      } else if (opType === 'credit') {
        if (!creditForm.amount) { alert('Amount required'); setSaving(false); return; }
        await api.post(`/outlet-ops/${outletId}/credit`, creditForm);
      } else if (opType === 'deposit') {
        if (!depositForm.amount) { alert('Amount required'); setSaving(false); return; }
        await api.post(`/outlet-ops/${outletId}/deposit`, depositForm);
      } else if (opType === 'bank') {
        if (!bankForm.account_name) { alert('Account name required'); setSaving(false); return; }
        await api.post(`/outlet-ops/${outletId}/bank-account`, bankForm);
      }
      setShowModal(false); onDone();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  const cashAccounts = banks.filter((b: any) => b.account_type === 'cash');
  const bankAccounts = banks.filter((b: any) => b.account_type !== 'cash');

  return (
    <>
      {/* Action buttons */}
      <div className="power-card p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>🔧 Admin Operations</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => open('cash')} className="py-3 px-3 rounded-xl text-xs font-bold text-center transition-all hover:shadow-md"
            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
            💵 Cash Balance
          </button>
          <button onClick={() => open('credit')} className="py-3 px-3 rounded-xl text-xs font-bold text-center transition-all hover:shadow-md"
            style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }}>
            📝 Credit
          </button>
          <button onClick={() => open('deposit')} className="py-3 px-3 rounded-xl text-xs font-bold text-center transition-all hover:shadow-md"
            style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
            🏦 Bank Deposit
          </button>
          <button onClick={() => open('bank')} className="py-3 px-3 rounded-xl text-xs font-bold text-center transition-all hover:shadow-md"
            style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            ➕ Add Bank A/C
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>
                {opType === 'cash' ? '💵 Cash Balance' : opType === 'credit' ? '📝 Credit' : opType === 'deposit' ? '🏦 Bank Deposit' : '➕ Add Bank Account'}
                <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>— {outletName || `Outlet #${outletId}`}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">×</button>
            </div>

            <div className="p-6 space-y-4">
              {/* ── CASH ──────────────── */}
              {opType === 'cash' && (
                <>
                  <div>
                    <label className="power-label">Operation</label>
                    <select value={cashForm.type} onChange={e => setCashForm((f: any) => ({ ...f, type: e.target.value }))} className="power-input">
                      <option value="set_opening">Set Opening Balance</option>
                      <option value="add">Add Cash</option>
                      <option value="withdraw">Withdraw Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="power-label">Amount (৳) *</label>
                    <input type="number" value={cashForm.amount} onChange={e => setCashForm((f: any) => ({ ...f, amount: e.target.value }))} className="power-input text-lg font-bold" placeholder="0" min="0" />
                  </div>
                  {cashAccounts.length > 0 && (
                    <div className="text-xs p-2 rounded-lg" style={{ background: 'var(--body-bg)' }}>
                      Current Cash: <strong className="text-green-600">{fmt(cashAccounts[0]?.current_balance)}</strong>
                    </div>
                  )}
                  <div><label className="power-label">Notes</label><input value={cashForm.notes} onChange={e => setCashForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input" placeholder="Reason..." /></div>
                </>
              )}

              {/* ── CREDIT ────────────── */}
              {opType === 'credit' && (
                <>
                  <div>
                    <label className="power-label">Operation</label>
                    <select value={creditForm.type} onChange={e => setCreditForm((f: any) => ({ ...f, type: e.target.value }))} className="power-input">
                      <option value="assign_credit">Assign Credit (Expense)</option>
                      <option value="collect_credit">Collect Credit (Income)</option>
                    </select>
                  </div>
                  <div>
                    <label className="power-label">Amount (৳) *</label>
                    <input type="number" value={creditForm.amount} onChange={e => setCreditForm((f: any) => ({ ...f, amount: e.target.value }))} className="power-input text-lg font-bold" placeholder="0" min="0" />
                  </div>
                  <div><label className="power-label">Customer / Party Name</label><input value={creditForm.customer_name} onChange={e => setCreditForm((f: any) => ({ ...f, customer_name: e.target.value }))} className="power-input" placeholder="Customer name..." /></div>
                  <div><label className="power-label">Notes</label><input value={creditForm.notes} onChange={e => setCreditForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input" placeholder="Details..." /></div>
                </>
              )}

              {/* ── BANK DEPOSIT ───────── */}
              {opType === 'deposit' && (
                <>
                  <div>
                    <label className="power-label">Deposit Amount (৳) *</label>
                    <input type="number" value={depositForm.amount} onChange={e => setDepositForm((f: any) => ({ ...f, amount: e.target.value }))} className="power-input text-lg font-bold" placeholder="0" min="0" />
                  </div>
                  <div>
                    <label className="power-label">From (Cash Account)</label>
                    <select value={depositForm.from_account_id} onChange={e => setDepositForm((f: any) => ({ ...f, from_account_id: e.target.value }))} className="power-input">
                      <option value="">Select source</option>
                      {banks.filter((b: any) => b.account_type === 'cash').map((b: any) => (
                        <option key={b.id} value={b.id}>{b.icon} {b.account_name} ({fmt(b.current_balance)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="power-label">To (Bank Account)</label>
                    <select value={depositForm.bank_account_id} onChange={e => setDepositForm((f: any) => ({ ...f, bank_account_id: e.target.value }))} className="power-input">
                      <option value="">Select bank</option>
                      {banks.filter((b: any) => b.account_type !== 'cash').map((b: any) => (
                        <option key={b.id} value={b.id}>{b.icon} {b.account_name} ({fmt(b.current_balance)})</option>
                      ))}
                    </select>
                  </div>
                  <div><label className="power-label">Notes</label><input value={depositForm.notes} onChange={e => setDepositForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input" placeholder="Deposit note..." /></div>
                </>
              )}

              {/* ── ADD BANK ACCOUNT ───── */}
              {opType === 'bank' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="power-label">Account Name *</label><input value={bankForm.account_name} onChange={e => setBankForm((f: any) => ({ ...f, account_name: e.target.value }))} className="power-input" placeholder="DBBL, bKash..." /></div>
                    <div><label className="power-label">Type</label>
                      <select value={bankForm.account_type} onChange={e => setBankForm((f: any) => ({ ...f, account_type: e.target.value }))} className="power-input">
                        <option value="bank">🏦 Bank</option><option value="mobile_banking">📱 Mobile</option><option value="card">💳 Card</option><option value="cash">💵 Cash</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="power-label">Bank Name</label><input value={bankForm.bank_name} onChange={e => setBankForm((f: any) => ({ ...f, bank_name: e.target.value }))} className="power-input" /></div>
                    <div><label className="power-label">A/C Number</label><input value={bankForm.account_number} onChange={e => setBankForm((f: any) => ({ ...f, account_number: e.target.value }))} className="power-input" /></div>
                  </div>
                  <div><label className="power-label">Opening Balance (৳)</label><input type="number" value={bankForm.opening_balance} onChange={e => setBankForm((f: any) => ({ ...f, opening_balance: e.target.value }))} className="power-input" /></div>
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-power flex-1 justify-center"
                style={{ background: opType === 'cash' ? '#16a34a' : opType === 'credit' ? '#ea580c' : opType === 'deposit' ? '#2563eb' : '#7c3aed' }}>
                {saving ? 'Saving...' : opType === 'cash' ? '💵 Apply Cash' : opType === 'credit' ? '📝 Apply Credit' : opType === 'deposit' ? '🏦 Deposit' : '➕ Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

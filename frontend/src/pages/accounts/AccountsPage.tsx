import { useState, useEffect } from 'react';
import api from '../../services/api';

type Tab = 'accounts' | 'journal' | 'income' | 'trial' | 'expense';

const TYPE_COLORS: any = {
  asset: { bg: '#dbeafe', color: '#1e40af', label: 'Asset' },
  liability: { bg: '#fce7f3', color: '#9d174d', label: 'Liability' },
  equity: { bg: '#e0e7ff', color: '#3730a3', label: 'Equity' },
  income: { bg: '#dcfce7', color: '#166534', label: 'Income' },
  expense: { bg: '#fee2e2', color: '#991b1b', label: 'Expense' },
};

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [incomeData, setIncomeData] = useState<any>(null);
  const [trialData, setTrialData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Forms
  const [showAccForm, setShowAccForm] = useState(false);
  const [editAcc, setEditAcc] = useState<any>(null);
  const [accForm, setAccForm] = useState<any>({ code: '', name: '', type: 'expense', description: '', opening_balance: 0 });

  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalForm, setJournalForm] = useState<any>({ entry_date: new Date().toISOString().slice(0, 10), description: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }] });

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Ledger
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerData, setLedgerData] = useState<any>(null);

  // Journal detail
  const [showJournalDetail, setShowJournalDetail] = useState(false);
  const [journalDetail, setJournalDetail] = useState<any>(null);

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (tab === 'journal') loadJournals(); }, [tab]);
  useEffect(() => { if (tab === 'income') loadIncome(); }, [tab, startDate, endDate]);
  useEffect(() => { if (tab === 'trial') loadTrial(); }, [tab]);

  const loadAccounts = async () => {
    try { const r = await api.get('/accounts'); if (r.data.success) setAccounts(r.data.data || []); } catch {}
  };

  const loadJournals = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await api.get('/accounts/journals/list', { params });
      if (r.data.success) setJournals(r.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const loadIncome = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await api.get('/accounts/reports/income-statement', { params });
      if (r.data.success) setIncomeData(r.data.data);
    } catch {} finally { setLoading(false); }
  };

  const loadTrial = async () => {
    setLoading(true);
    try { const r = await api.get('/accounts/reports/trial-balance'); if (r.data.success) setTrialData(r.data.data); } catch {} finally { setLoading(false); }
  };

  const openAddAccount = () => { setEditAcc(null); setAccForm({ code: '', name: '', type: 'expense', description: '', opening_balance: 0 }); setShowAccForm(true); };
  const openEditAccount = (a: any) => { setEditAcc(a); setAccForm({ code: a.code, name: a.name, type: a.type, description: a.description || '', opening_balance: a.opening_balance || 0 }); setShowAccForm(true); };

  const saveAccount = async () => {
    try {
      if (editAcc) await api.put(`/accounts/${editAcc.id}`, accForm);
      else await api.post('/accounts', accForm);
      setShowAccForm(false); loadAccounts();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const deleteAccount = async (id: number) => {
    if (!confirm('Delete this account?')) return;
    try { await api.delete(`/accounts/${id}`); loadAccounts(); } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const openLedger = async (accId: number) => {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const r = await api.get(`/accounts/${accId}/ledger`, { params });
      if (r.data.success) { setLedgerData(r.data.data); setShowLedger(true); }
    } catch { alert('Failed to load ledger'); }
  };

  const viewJournal = async (id: number) => {
    try { const r = await api.get(`/accounts/journals/${id}`); if (r.data.success) { setJournalDetail(r.data.data); setShowJournalDetail(true); } } catch {}
  };

  const addJournalLine = () => {
    setJournalForm((f: any) => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }));
  };

  const removeJournalLine = (idx: number) => {
    setJournalForm((f: any) => ({ ...f, lines: f.lines.filter((_: any, i: number) => i !== idx) }));
  };

  const updateJournalLine = (idx: number, key: string, value: any) => {
    setJournalForm((f: any) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [key]: value };
      return { ...f, lines };
    });
  };

  const saveJournal = async () => {
    try {
      const r = await api.post('/accounts/journals', journalForm);
      if (r.data.success) { alert(`✅ Journal ${r.data.entry_number} created`); setShowJournalForm(false); loadJournals(); }
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const fmt = (n: any) => `৳${Math.abs(Number(n || 0)).toLocaleString()}`;

  const tabs = [
    { key: 'accounts' as Tab, label: '📋 Accounts', },
    { key: 'journal' as Tab, label: '📒 Journal Entries' },
    { key: 'income' as Tab, label: '📊 Income & Expense' },
    { key: 'trial' as Tab, label: '⚖️ Trial Balance' },
  ];

  const groupedAccounts = ['asset', 'liability', 'equity', 'income', 'expense'].map(type => ({
    type, ...TYPE_COLORS[type],
    accounts: accounts.filter(a => a.type === type),
    total: accounts.filter(a => a.type === type).reduce((s, a) => s + parseFloat(a.balance || 0), 0),
  }));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏦 Chart of Accounts</h1>
          <p className="page-subtitle">Manage accounts, track income & expenses, view financial reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="power-card p-1 flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all min-w-[100px] ${tab === t.key ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
            style={tab === t.key ? { background: 'var(--primary, #dc2626)' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter (for journal, income) */}
      {(tab === 'journal' || tab === 'income') && (
        <div className="power-card p-4 flex gap-3 flex-wrap items-end">
          <div>
            <label className="power-label">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="power-input" />
          </div>
          <div>
            <label className="power-label">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="power-input" />
          </div>
          <button onClick={tab === 'journal' ? loadJournals : loadIncome} className="btn-power text-sm">🔍 Filter</button>
          {tab === 'journal' && <button onClick={() => { setJournalForm({ entry_date: new Date().toISOString().slice(0, 10), description: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }] }); setShowJournalForm(true); }} className="btn-outline text-sm ml-auto">➕ Manual Entry</button>}
        </div>
      )}

      {/* ─── TAB: ACCOUNTS ──────────────────────────── */}
      {tab === 'accounts' && (
        <>
          <div className="flex justify-end"><button onClick={openAddAccount} className="btn-power">➕ Add Account</button></div>
          {groupedAccounts.map(g => (
            <div key={g.type} className="power-card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: g.bg + '40' }}>
                <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: g.color }}>{g.label}s</h3>
                <span className="font-bold text-sm" style={{ color: g.color }}>{fmt(g.total)}</span>
              </div>
              {g.accounts.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">No {g.label.toLowerCase()} accounts</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Account Name</th><th>Balance</th><th></th></tr></thead>
                  <tbody>
                    {g.accounts.map((a: any) => (
                      <tr key={a.id}>
                        <td className="font-mono text-xs font-bold" style={{ color: g.color }}>{a.code}</td>
                        <td>
                          <p className="font-semibold text-sm">{a.name}</p>
                          {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                        </td>
                        <td className="font-bold" style={{ color: parseFloat(a.balance) >= 0 ? g.color : '#dc2626' }}>{fmt(a.balance)}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openLedger(a.id)} className="btn-ghost py-1 px-2 text-xs">📒</button>
                            <button onClick={() => openEditAccount(a)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                            {!a.is_system && <button onClick={() => deleteAccount(a.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}

      {/* ─── TAB: JOURNAL ENTRIES ───────────────────── */}
      {tab === 'journal' && (
        <div className="power-card overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : journals.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No journal entries found</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Entry #</th><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {journals.map((j: any) => (
                  <tr key={j.id}>
                    <td className="font-mono text-xs font-bold" style={{ color: 'var(--primary)' }}>{j.entry_number}</td>
                    <td className="text-sm">{new Date(j.entry_date).toLocaleDateString('en-GB')}</td>
                    <td className="text-sm max-w-[250px] truncate">{j.description}</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${j.is_auto ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                        {j.reference_type || 'manual'}
                      </span>
                    </td>
                    <td className="font-bold text-sm">{fmt(j.total_amount)}</td>
                    <td><button onClick={() => viewJournal(j.id)} className="btn-ghost py-1 px-2 text-xs">👁️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── TAB: INCOME & EXPENSE ──────────────────── */}
      {tab === 'income' && incomeData && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="power-card p-5 text-center" style={{ borderLeft: '4px solid #16a34a' }}>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Income</p>
              <p className="text-2xl font-black text-green-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(incomeData.total_income)}</p>
            </div>
            <div className="power-card p-5 text-center" style={{ borderLeft: '4px solid #dc2626' }}>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Total Expenses</p>
              <p className="text-2xl font-black text-red-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(incomeData.total_expenses)}</p>
            </div>
            <div className="power-card p-5 text-center" style={{ borderLeft: `4px solid ${incomeData.net_profit >= 0 ? '#16a34a' : '#dc2626'}` }}>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Net {incomeData.net_profit >= 0 ? 'Profit' : 'Loss'}</p>
              <p className={`text-2xl font-black ${incomeData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: 'Barlow Condensed' }}>{fmt(incomeData.net_profit)}</p>
            </div>
          </div>

          {/* Income */}
          <div className="power-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-green-50"><h3 className="font-bold text-sm text-green-800 uppercase">📈 Income</h3></div>
            <table className="data-table">
              <thead><tr><th>Code</th><th>Account</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {incomeData.income.map((i: any) => (
                  <tr key={i.id}><td className="font-mono text-xs">{i.code}</td><td className="font-semibold text-sm">{i.name}</td><td className="text-right font-bold text-green-600">{fmt(i.amount)}</td></tr>
                ))}
                <tr className="bg-green-50 font-black"><td colSpan={2} className="text-right">Total Income</td><td className="text-right text-green-700">{fmt(incomeData.total_income)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Expenses */}
          <div className="power-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-red-50"><h3 className="font-bold text-sm text-red-800 uppercase">📉 Expenses</h3></div>
            <table className="data-table">
              <thead><tr><th>Code</th><th>Account</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {incomeData.expenses.map((e: any) => (
                  <tr key={e.id}><td className="font-mono text-xs">{e.code}</td><td className="font-semibold text-sm">{e.name}</td><td className="text-right font-bold text-red-600">{fmt(e.amount)}</td></tr>
                ))}
                <tr className="bg-red-50 font-black"><td colSpan={2} className="text-right">Total Expenses</td><td className="text-right text-red-700">{fmt(incomeData.total_expenses)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: TRIAL BALANCE ─────────────────────── */}
      {tab === 'trial' && trialData && (
        <div className="power-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50"><h3 className="font-bold text-sm text-gray-700 uppercase">⚖️ Trial Balance</h3></div>
          <table className="data-table">
            <thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
            <tbody>
              {trialData.accounts.map((a: any) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs font-bold">{a.code}</td>
                  <td className="font-semibold text-sm">{a.name}</td>
                  <td><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: TYPE_COLORS[a.type]?.bg, color: TYPE_COLORS[a.type]?.color }}>{a.type}</span></td>
                  <td className="text-right font-bold">{a.debit_balance > 0 ? fmt(a.debit_balance) : '-'}</td>
                  <td className="text-right font-bold">{a.credit_balance > 0 ? fmt(a.credit_balance) : '-'}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-black text-base">
                <td colSpan={3} className="text-right">TOTAL</td>
                <td className="text-right">{fmt(trialData.total_debits)}</td>
                <td className="text-right">{fmt(trialData.total_credits)}</td>
              </tr>
            </tbody>
          </table>
          {Math.abs(trialData.total_debits - trialData.total_credits) < 0.01 ? (
            <div className="p-3 text-center text-green-600 text-sm font-bold bg-green-50">✅ Balanced — Debits equal Credits</div>
          ) : (
            <div className="p-3 text-center text-red-600 text-sm font-bold bg-red-50">⚠️ Difference: {fmt(trialData.total_debits - trialData.total_credits)}</div>
          )}
        </div>
      )}

      {/* ─── MODAL: ADD/EDIT ACCOUNT ────────────────── */}
      {showAccForm && (
        <div className="modal-backdrop" onClick={() => setShowAccForm(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Barlow Condensed' }}>{editAcc ? '✏️ Edit Account' : '➕ New Account'}</h3>
              <button onClick={() => setShowAccForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="power-label">Account Code *</label><input value={accForm.code} onChange={e => setAccForm((f: any) => ({ ...f, code: e.target.value }))} className="power-input" placeholder="5020" /></div>
                <div><label className="power-label">Type *</label>
                  <select value={accForm.type} onChange={e => setAccForm((f: any) => ({ ...f, type: e.target.value }))} className="power-input">
                    <option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option>
                    <option value="income">Income</option><option value="expense">Expense</option>
                  </select>
                </div>
              </div>
              <div><label className="power-label">Account Name *</label><input value={accForm.name} onChange={e => setAccForm((f: any) => ({ ...f, name: e.target.value }))} className="power-input" placeholder="Transport Expense" /></div>
              <div><label className="power-label">Description</label><input value={accForm.description} onChange={e => setAccForm((f: any) => ({ ...f, description: e.target.value }))} className="power-input" /></div>
              <div><label className="power-label">Opening Balance (৳)</label><input type="number" value={accForm.opening_balance} onChange={e => setAccForm((f: any) => ({ ...f, opening_balance: e.target.value }))} className="power-input" /></div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={saveAccount} className="btn-power flex-1 justify-center">{editAcc ? '💾 Update' : '➕ Create'}</button>
              <button onClick={() => setShowAccForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: MANUAL JOURNAL ENTRY ────────────── */}
      {showJournalForm && (
        <div className="modal-backdrop" onClick={() => setShowJournalForm(false)}>
          <div className="modal-box" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Barlow Condensed' }}>📒 New Journal Entry</h3>
              <button onClick={() => setShowJournalForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="power-label">Date</label><input type="date" value={journalForm.entry_date} onChange={e => setJournalForm((f: any) => ({ ...f, entry_date: e.target.value }))} className="power-input" /></div>
                <div><label className="power-label">Description</label><input value={journalForm.description} onChange={e => setJournalForm((f: any) => ({ ...f, description: e.target.value }))} className="power-input" placeholder="Paid rent for March" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="power-label">Lines</label>
                  <button onClick={addJournalLine} className="text-xs font-bold px-2 py-1 rounded" style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}>+ Add Line</button>
                </div>
                <div className="space-y-2">
                  {journalForm.lines.map((line: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg">
                      <select value={line.account_id} onChange={e => updateJournalLine(idx, 'account_id', e.target.value)} className="power-input text-xs flex-1">
                        <option value="">Select Account</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                      <input type="number" value={line.debit} onChange={e => updateJournalLine(idx, 'debit', e.target.value)} className="power-input text-xs w-24" placeholder="Debit" />
                      <input type="number" value={line.credit} onChange={e => updateJournalLine(idx, 'credit', e.target.value)} className="power-input text-xs w-24" placeholder="Credit" />
                      {journalForm.lines.length > 2 && (
                        <button onClick={() => removeJournalLine(idx)} className="text-red-500 text-sm hover:bg-red-50 rounded p-1">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-sm font-bold px-2">
                  <span>Totals:</span>
                  <span className="text-green-600">Dr: ৳{journalForm.lines.reduce((s: number, l: any) => s + parseFloat(l.debit || 0), 0).toLocaleString()}</span>
                  <span className="text-blue-600">Cr: ৳{journalForm.lines.reduce((s: number, l: any) => s + parseFloat(l.credit || 0), 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={saveJournal} className="btn-power flex-1 justify-center">📒 Post Entry</button>
              <button onClick={() => setShowJournalForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: LEDGER VIEW ─────────────────────── */}
      {showLedger && ledgerData && (
        <div className="modal-backdrop" onClick={() => setShowLedger(false)}>
          <div className="modal-box" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-bold" style={{ fontFamily: 'Barlow Condensed' }}>📒 {ledgerData.account.code} — {ledgerData.account.name}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: TYPE_COLORS[ledgerData.account.type]?.bg, color: TYPE_COLORS[ledgerData.account.type]?.color }}>{ledgerData.account.type}</span>
              </div>
              <button onClick={() => setShowLedger(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 max-h-[65vh] overflow-y-auto">
              {ledgerData.ledger.length === 0 ? <div className="text-center text-gray-400 py-8">No transactions</div> : (
                <table className="data-table text-xs">
                  <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    {ledgerData.ledger.map((l: any, i: number) => (
                      <tr key={i}>
                        <td>{new Date(l.entry_date).toLocaleDateString('en-GB')}</td>
                        <td className="font-mono" style={{ color: 'var(--primary)' }}>{l.entry_number}</td>
                        <td className="max-w-[150px] truncate">{l.description || l.entry_description}</td>
                        <td className="text-right font-bold">{parseFloat(l.debit) > 0 ? fmt(l.debit) : '-'}</td>
                        <td className="text-right font-bold">{parseFloat(l.credit) > 0 ? fmt(l.credit) : '-'}</td>
                        <td className="text-right font-black">{fmt(l.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: JOURNAL DETAIL ──────────────────── */}
      {showJournalDetail && journalDetail && (
        <div className="modal-backdrop" onClick={() => setShowJournalDetail(false)}>
          <div className="modal-box max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Barlow Condensed' }}>📒 {journalDetail.entry_number}</h3>
              <button onClick={() => setShowJournalDetail(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Date:</span> <strong>{new Date(journalDetail.entry_date).toLocaleDateString('en-GB')}</strong></div>
                <div><span className="text-gray-500">Type:</span> <strong className="capitalize">{journalDetail.reference_type}</strong></div>
                <div className="col-span-2"><span className="text-gray-500">Description:</span> <strong>{journalDetail.description}</strong></div>
              </div>
              <table className="data-table text-sm">
                <thead><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {journalDetail.lines?.map((l: any) => (
                    <tr key={l.id}>
                      <td><span className="font-mono text-xs mr-1" style={{ color: 'var(--primary)' }}>{l.account_code}</span> {l.account_name}</td>
                      <td className="text-right font-bold">{parseFloat(l.debit) > 0 ? fmt(l.debit) : '-'}</td>
                      <td className="text-right font-bold">{parseFloat(l.credit) > 0 ? fmt(l.credit) : '-'}</td>
                    </tr>
                  ))}
                  <tr className="font-black bg-gray-50">
                    <td className="text-right">Total</td>
                    <td className="text-right">{fmt(journalDetail.lines?.reduce((s: number, l: any) => s + parseFloat(l.debit || 0), 0))}</td>
                    <td className="text-right">{fmt(journalDetail.lines?.reduce((s: number, l: any) => s + parseFloat(l.credit || 0), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

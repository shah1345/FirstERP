import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// ─── Constants ────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  { value: 'Sales Revenue', label: 'Sales Revenue', icon: '🛒' },
  { value: 'Service Income', label: 'Service Income', icon: '🔧' },
  { value: 'Payment Received', label: 'Payment Received', icon: '💰' },
  { value: 'Interest Earned', label: 'Interest Earned', icon: '🏦' },
  { value: 'Commission', label: 'Commission', icon: '📈' },
  { value: 'Refund Received', label: 'Refund Received', icon: '↩️' },
  { value: 'Loan Received', label: 'Loan Received', icon: '🤝' },
  { value: 'Other Income', label: 'Other Income', icon: '📋' },
];

const EXPENSE_CATEGORIES = [
  { value: 'Stock Purchase', label: 'Stock Purchase', icon: '📦' },
  { value: 'Vendor Payment', label: 'Vendor Payment', icon: '🚚' },
  { value: 'Salary & Wages', label: 'Salary & Wages', icon: '👥' },
  { value: 'Rent', label: 'Rent', icon: '🏠' },
  { value: 'Utilities (Electric/Water/Internet)', label: 'Utilities', icon: '💡' },
  { value: 'Transport & Delivery', label: 'Transport', icon: '🚚' },
  { value: 'Office Supplies', label: 'Office Supplies', icon: '📝' },
  { value: 'Repairs & Maintenance', label: 'Repairs', icon: '🔧' },
  { value: 'Marketing & Advertising', label: 'Marketing', icon: '📢' },
  { value: 'Bank Charges', label: 'Bank Charges', icon: '🏦' },
  { value: 'Food & Entertainment', label: 'Food & Entertainment', icon: '🍔' },
  { value: 'Insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'Tax & Duties', label: 'Tax & Duties', icon: '🏛️' },
  { value: 'Loan Repayment', label: 'Loan Repayment', icon: '💳' },
  { value: 'Miscellaneous', label: 'Miscellaneous', icon: '📌' },
];

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash', icon: '💵', color: '#16a34a' },
  { value: 'bank', label: 'Bank', icon: '🏦', color: '#1D6ABA' },
  { value: 'mobile_banking', label: 'bKash / Mobile', icon: '📱', color: '#E2136E' },
  { value: 'card', label: 'Card', icon: '💳', color: '#7c3aed' },
];

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'lifetime', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString()}`;
const getAccIcon = (type: string) => ACCOUNT_TYPES.find(t => t.value === type)?.icon || '💳';

// ─── Main Component ───────────────────────────────────────────

export default function FinancePage() {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [analytics, setAnalytics] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [fBank, setFBank] = useState('');

  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [editTx, setEditTx] = useState<any>(null);
  const [editBank, setEditBank] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  // Loan state
  const [loans, setLoans] = useState<any[]>([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState(false);
  const [loanDetail, setLoanDetail] = useState<any>(null);
  const [loanPayments, setLoanPayments] = useState<any[]>([]);
  const [showLoanPayModal, setShowLoanPayModal] = useState(false);
  const [loanFilter, setLoanFilter] = useState('all');
  const [loanForm, setLoanForm] = useState<any>({
    lender_name: '', loan_type: 'received', total_amount: '', interest_rate: '',
    start_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', bank_account_id: '',
  });
  const [loanPayForm, setLoanPayForm] = useState<any>({
    amount: '', bank_account_id: '', payment_method: 'cash', reference: '', notes: '',
  });

  // Forms
  const [txForm, setTxForm] = useState<any>({
    type: 'expense', category: '', amount: '', bank_account_id: '', to_bank_account_id: '',
    payment_method: 'cash', reference: '', description: '', party_name: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [bankForm, setBankForm] = useState<any>({
    account_name: '', account_type: 'bank', bank_name: '', account_number: '',
    branch: '', opening_balance: 0, icon: '🏦', color: '#2563eb', notes: '',
  });

  // ── Load data ─────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, bRes, cRes] = await Promise.all([
        api.get('/finance/analytics/summary'),
        api.get('/finance/bank-accounts'),
        api.get('/finance/categories'),
      ]);
      if (aRes.data.success) setAnalytics(aRes.data.data);
      if (bRes.data.success) setBankAccounts(bRes.data.data || []);
      if (cRes.data.success) setCategories(cRes.data.data || []);
      if (aRes.data.success) buildChart(aRes.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const params: any = {};
      if (filterType) params.type = filterType;
      if (search) params.search = search;
      if (fBank) params.bank_account_id = fBank;
      if (period === 'custom') {
        if (customFrom) params.start_date = customFrom;
        if (customTo) params.end_date = customTo;
      } else {
        const now = new Date();
        if (period === 'week') {
          const d = new Date(now); d.setDate(d.getDate() - d.getDay());
          params.start_date = d.toISOString().slice(0, 10);
        } else if (period === 'month') {
          params.start_date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        } else if (period === 'year') {
          params.start_date = `${now.getFullYear()}-01-01`;
        }
      }
      const r = await api.get('/finance', { params });
      if (r.data.success) setTransactions(r.data.data || []);
    } catch { }
  }, [filterType, search, fBank, period, customFrom, customTo]);

  const loadLoans = async () => {
    try {
      const res = await api.get('/finance/loans');
      if (res.data.success) setLoans(res.data.data || []);
    } catch (e) { console.error('Load loans:', e); }
  };

  const loadLoanDetail = async (id: number) => {
    try {
      const res = await api.get(`/finance/loans/${id}`);
      if (res.data.success) {
        setLoanDetail(res.data.data.loan);
        setLoanPayments(res.data.data.payments || []);
        setShowLoanDetail(true);
      }
    } catch { alert('Failed to load loan details'); }
  };

  const buildChart = (data: any) => {
    if (!data?.category_breakdown) return;
    const incCats = data.category_breakdown.filter((c: any) => c.type === 'income');
    const expCats = data.category_breakdown.filter((c: any) => c.type === 'expense');
    const allCats = [...new Set([...incCats.map((c: any) => c.category), ...expCats.map((c: any) => c.category)])];
    const chart = allCats.map(cat => ({
      label: cat.length > 15 ? cat.slice(0, 14) + '…' : cat,
      income: incCats.find((c: any) => c.category === cat)?.total || 0,
      expense: expCats.find((c: any) => c.category === cat)?.total || 0,
    }));
    setChartData(chart);
  };

  useEffect(() => { loadAll(); loadLoans(); }, [loadAll]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ── CRUD ──────────────────────────────────────────────────

  const openNewTx = (type: string = 'expense') => {
    setEditTx(null);
    setTxForm({ type, category: '', amount: '', bank_account_id: bankAccounts.find(a => a.is_default)?.id || '', to_bank_account_id: '', payment_method: 'cash', reference: '', description: '', party_name: '', transaction_date: new Date().toISOString().slice(0, 10) });
    setShowTxModal(true);
  };

  const openEditTx = (tx: any) => {
    setEditTx(tx);
    setTxForm({ type: tx.type, category: tx.category, amount: tx.amount, bank_account_id: tx.bank_account_id || '', to_bank_account_id: tx.to_bank_account_id || '', payment_method: tx.payment_method || 'cash', reference: tx.reference || '', description: tx.description || '', party_name: tx.party_name || '', transaction_date: tx.transaction_date?.slice(0, 10) });
    setShowTxModal(true);
  };

  const saveTx = async () => {
    if (txForm.type !== 'transfer' && !txForm.category) { alert('Category required'); return; }
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) { alert('Valid amount required'); return; }
    setSaving(true);
    try {
      if (editTx) await api.put(`/finance/${editTx.id}`, txForm);
      else await api.post('/finance', txForm);
      setShowTxModal(false);
      loadAll(); loadTransactions();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteTx = async (id: number) => {
    if (!confirm('Delete this transaction?')) return;
    try { await api.delete(`/finance/${id}`); loadAll(); loadTransactions(); } catch { }
  };

  const openNewBank = () => {
    setEditBank(null);
    setBankForm({ account_name: '', account_type: 'bank', bank_name: '', account_number: '', branch: '', opening_balance: 0, icon: '🏦', color: '#2563eb', notes: '' });
    setShowBankModal(true);
  };

  const openEditBank = (b: any) => {
    setEditBank(b);
    setBankForm({ ...b });
    setShowBankModal(true);
  };

  const saveBank = async () => {
    if (!bankForm.account_name) { alert('Account name required'); return; }
    setSaving(true);
    try {
      if (editBank) await api.put(`/finance/bank-accounts/${editBank.id}`, bankForm);
      else await api.post('/finance/bank-accounts', bankForm);
      setShowBankModal(false); loadAll();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteBank = async (id: number) => {
    if (!confirm('Delete this account?')) return;
    try { await api.delete(`/finance/bank-accounts/${id}`); loadAll(); } catch { }
  };

  const openStatement = async (id: number) => {
    try {
      const r = await api.get(`/finance/bank-accounts/${id}/statement`);
      if (r.data.success) { setStatementData(r.data.data); setShowStatement(true); }
    } catch { alert('Failed'); }
  };

  const addCategory = async () => {
    if (!newCatName) return;
    try { await api.post('/finance/categories', { name: newCatName, type: newCatType }); setShowAddCat(false); setNewCatName(''); loadAll(); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  // ── Loan CRUD ─────────────────────────────────────────────

  const openNewLoan = () => {
    setLoanForm({
      lender_name: '', loan_type: 'received', total_amount: '', interest_rate: '',
      start_date: new Date().toISOString().slice(0, 10), due_date: '', notes: '', bank_account_id: '',
    });
    setShowLoanModal(true);
  };

  const saveLoan = async () => {
    if (!loanForm.lender_name || !loanForm.total_amount) { alert('Lender name and amount required'); return; }
    setSaving(true);
    try {
      await api.post('/finance/loans', loanForm);
      setShowLoanModal(false);
      loadLoans(); loadAll();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openLoanPayment = (loan: any) => {
    setLoanDetail(loan);
    setLoanPayForm({ amount: String(loan.remaining || ''), bank_account_id: '', payment_method: 'cash', reference: '', notes: '' });
    setShowLoanPayModal(true);
  };

  const makeLoanPayment = async () => {
    if (!loanPayForm.amount || parseFloat(loanPayForm.amount) <= 0) { alert('Valid amount required'); return; }
    setSaving(true);
    try {
      await api.post(`/finance/loans/${loanDetail.id}/payments`, loanPayForm);
      setShowLoanPayModal(false);
      loadLoans(); loadAll();
      // Refresh detail if open
      if (showLoanDetail && loanDetail) loadLoanDetail(loanDetail.id);
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const markLoanCleared = async (id: number) => {
    if (!confirm('Mark this loan as cleared?')) return;
    try {
      await api.put(`/finance/loans/${id}`, { status: 'cleared' });
      loadLoans();
      if (showLoanDetail && loanDetail?.id === id) loadLoanDetail(id);
    } catch { alert('Failed'); }
  };

  // ── Computed ──────────────────────────────────────────────

  const s = analytics?.summary;
  const loanSummary = analytics?.loan_summary;
  const totalBalance = bankAccounts.reduce((sum, a) => sum + parseFloat(a.current_balance || 0), 0);
  const txIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const txExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const filteredLoans = loanFilter === 'all' ? loans : loans.filter(l => l.status === loanFilter);

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 10, fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.name === 'income' ? '#22c55e' : '#ef4444' }}>
            {p.name === 'income' ? '↑ Income' : '↓ Expense'}: {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="space-y-5" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ height: 32, background: 'var(--card-border)', borderRadius: 8, width: 200 }} className="animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="power-card animate-pulse" style={{ height: 110 }} />)}
      </div>
      <div className="power-card animate-pulse" style={{ height: 300 }} />
    </div>
  );

  return (
    <div className="space-y-6 pb-10" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">💰 Finance</h1>
          <p className="page-subtitle">Income, expenses, bank accounts & loans</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewBank} className="btn-outline text-xs py-2 px-3">+ Bank Account</button>
          <button onClick={openNewLoan} className="btn-outline text-xs py-2 px-3" style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>+ Loan</button>
          <button onClick={() => openNewTx('expense')} className="btn-power text-xs py-2 px-3">+ Transaction</button>
        </div>
      </div>

      {/* ── Period Selector ─────────────────────────────────── */}
      <div className="power-card p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Period:</span>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.value ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              style={period === p.value ? { background: 'var(--primary)' } : { background: 'var(--sidebar-hover-bg, #f3f4f6)' }}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="power-input py-1.5 text-xs w-36" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="power-input py-1.5 text-xs w-36" />
          </div>
        )}
      </div>

      {/* ── Summary Cards (Income row) ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Weekly Income', value: fmt(s?.weekly_income || 0), icon: '📈', bg: '#f0fdf4', color: '#16a34a' },
          { label: 'Monthly Income', value: fmt(s?.monthly_income || 0), icon: '💰', bg: '#eff6ff', color: '#2563eb' },
          { label: 'Yearly Income', value: fmt(s?.yearly_income || 0), icon: '🏆', bg: '#eef2ff', color: '#4f46e5' },
          { label: 'Lifetime Income', value: fmt(s?.lifetime_income || 0), icon: '🌍', bg: '#faf5ff', color: '#7c3aed' },
        ].map((c, i) => (
          <div key={i} className="stat-card flex items-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-xl md:text-2xl flex-shrink-0" style={{ background: c.bg }}>{c.icon}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
              <p className="text-lg md:text-2xl font-bold truncate" style={{ color: c.color, fontFamily: 'Barlow Condensed' }}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Summary Cards (Expense row) ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Weekly Expense', value: fmt(s?.weekly_expense || 0), icon: '📉', bg: '#fef2f2', color: '#dc2626', sub: `Net: ${fmt((s?.weekly_income || 0) - (s?.weekly_expense || 0))}` },
          { label: 'Monthly Expense', value: fmt(s?.monthly_expense || 0), icon: '💸', bg: '#fff7ed', color: '#ea580c', sub: `Net: ${fmt((s?.monthly_income || 0) - (s?.monthly_expense || 0))}` },
          { label: 'Yearly Expense', value: fmt(s?.yearly_expense || 0), icon: '📋', bg: '#fefce8', color: '#ca8a04', sub: `Net: ${fmt((s?.yearly_income || 0) - (s?.yearly_expense || 0))}` },
          { label: 'Total Bank Balance', value: fmt(totalBalance), icon: '🏦', bg: '#f0fdfa', color: '#0d9488', sub: `${bankAccounts.length} accounts` },
        ].map((c, i) => (
          <div key={i} className="stat-card flex items-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-xl md:text-2xl flex-shrink-0" style={{ background: c.bg }}>{c.icon}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
              <p className="text-lg md:text-2xl font-bold truncate" style={{ color: c.color, fontFamily: 'Barlow Condensed' }}>{c.value}</p>
              {c.sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Flow Chart ──────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="power-card p-5 md:p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Income vs Expense Flow</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Category breakdown this month</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border, #f0f0f0)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted, #9CA3AF)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted, #9CA3AF)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `৳${(v / 1000).toFixed(0)}k` : `৳${v}`} />
              <Tooltip content={customTooltip} />
              <Legend formatter={v => v === 'income' ? '↑ Income' : '↓ Expense'} />
              <Bar dataKey="income" name="income" fill="#22c55e" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bank Accounts ────────────────────────────────────── */}
      <div className="power-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>🏦 Bank Accounts & Wallets</h2>
          <button onClick={openNewBank} className="btn-outline text-xs py-1.5 px-3">+ Add Account</button>
        </div>
        {bankAccounts.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <p className="text-2xl mb-2">🏦</p>
            <p className="text-sm">No accounts yet. Add your bank accounts and wallets.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {bankAccounts.map(ac => (
              <div key={ac.id} className="rounded-2xl p-4 text-white relative overflow-hidden cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${ac.color}dd, ${ac.color}99)` }}
                onClick={() => openStatement(ac.id)}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{ac.icon || getAccIcon(ac.account_type)}</span>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); openEditBank(ac); }}
                      className="p-1 rounded-lg text-xs transition-all" style={{ background: 'rgba(255,255,255,0.2)' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteBank(ac.id); }}
                      className="p-1 rounded-lg text-xs transition-all" style={{ background: 'rgba(255,255,255,0.2)' }}>🗑️</button>
                  </div>
                </div>
                <p className="font-bold text-lg leading-tight">{ac.account_name}</p>
                {ac.account_number && <p style={{ color: 'rgba(255,255,255,0.7)' }} className="text-xs mt-0.5">{ac.account_number}</p>}
                <p className="text-2xl font-black mt-3" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(ac.current_balance)}</p>
                {ac.bank_name && <p style={{ color: 'rgba(255,255,255,0.6)' }} className="text-xs mt-1">{ac.bank_name} {ac.branch && `· ${ac.branch}`}</p>}
              </div>
            ))}
            <div className="rounded-2xl p-4 text-white flex flex-col justify-between" style={{ background: '#111827' }}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Balance</p>
              <p className="text-2xl font-black mt-auto" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(totalBalance)}</p>
              <p className="text-gray-400 text-xs">{bankAccounts.length} accounts</p>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── LOAN / CREDIT ACCOUNTS ───────────────────────────  */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="power-card p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>🤝 Loans & Credit</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Track borrowed money, repayments & outstanding balances</p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'cleared', label: 'Cleared' },
              ].map(f => (
                <button key={f.key} onClick={() => setLoanFilter(f.key)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${loanFilter === f.key ? 'text-white' : ''}`}
                  style={loanFilter === f.key ? { background: '#7c3aed' } : { color: 'var(--text-muted)' }}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={openNewLoan} className="btn-outline text-xs py-1.5 px-3" style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>+ Add Loan</button>
          </div>
        </div>

        {/* Loan summary cards */}
        {loanSummary && (loanSummary.total_loans > 0 || loans.length > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Loans', value: loans.length, icon: '📋', bg: '#f5f3ff', color: '#7c3aed' },
              { label: 'Active Loans', value: loans.filter(l => l.status === 'active').length, icon: '⏳', bg: '#fef3c7', color: '#d97706' },
              { label: 'Total Borrowed', value: fmt(loans.reduce((s, l) => s + parseFloat(l.total_amount), 0)), icon: '💰', bg: '#fef2f2', color: '#dc2626' },
              { label: 'Total Remaining', value: fmt(loans.reduce((s, l) => s + parseFloat(l.remaining || 0), 0)), icon: '⚠️', bg: '#fff7ed', color: '#ea580c' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ background: c.bg }}>
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                  <p className="text-lg font-black" style={{ color: c.color, fontFamily: 'Barlow Condensed' }}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loan list */}
        {filteredLoans.length === 0 ? (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            <p className="text-3xl mb-2">🤝</p>
            <p className="text-sm">{loanFilter === 'all' ? 'No loans yet. Add your first loan or credit.' : `No ${loanFilter} loans.`}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLoans.map(loan => {
              const paidPct = parseFloat(loan.total_amount) > 0
                ? Math.min(100, Math.round((parseFloat(loan.total_paid) / parseFloat(loan.total_amount)) * 100))
                : 0;
              const isCleared = loan.status === 'cleared';
              const isOverdue = loan.due_date && !isCleared && new Date(loan.due_date) < new Date();

              return (
                <div key={loan.id}
                  className={`rounded-xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${isCleared ? 'border-green-200 bg-green-50 opacity-75' : isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  onClick={() => loadLoanDetail(loan.id)}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{loan.loan_type === 'given' ? '📤' : '📥'}</span>
                        <h3 className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>{loan.lender_name}</h3>
                        {isCleared && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ CLEARED</span>}
                        {isOverdue && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ OVERDUE</span>}
                        {!isCleared && !isOverdue && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ ACTIVE</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                        <span>📅 {new Date(loan.start_date).toLocaleDateString('en-GB')}</span>
                        {loan.due_date && <span>⏰ Due: {new Date(loan.due_date).toLocaleDateString('en-GB')}</span>}
                        {parseFloat(loan.interest_rate) > 0 && <span>📊 {loan.interest_rate}% interest</span>}
                        <span className="capitalize">Type: {loan.loan_type}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
                      <p className="text-xl font-black" style={{ color: '#7c3aed', fontFamily: 'Barlow Condensed' }}>{fmt(loan.total_amount)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-green-600">Paid: {fmt(loan.total_paid)}</span>
                      <span className="font-semibold" style={{ color: loan.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                        Remaining: {fmt(loan.remaining)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                      <div className={`h-full rounded-full transition-all ${isCleared ? 'bg-green-500' : 'bg-purple-500'}`}
                        style={{ width: `${paidPct}%` }} />
                    </div>
                    <p className="text-xs text-right mt-0.5" style={{ color: 'var(--text-muted)' }}>{paidPct}% repaid</p>
                  </div>

                  {/* Action buttons */}
                  {!isCleared && (
                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openLoanPayment(loan)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90"
                        style={{ background: '#7c3aed' }}>
                        💸 Make Payment
                      </button>
                      <button onClick={() => markLoanCleared(loan.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: '#dcfce7', color: '#166534' }}>
                        ✅ Mark Cleared
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Transactions Table ───────────────────────────────── */}
      <div className="power-card overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>📋 Transactions</h2>
          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="power-input py-1.5 text-xs w-28">
              <option value="">All Types</option>
              <option value="income">📈 Income</option>
              <option value="expense">📉 Expense</option>
              <option value="transfer">🔄 Transfer</option>
            </select>
            <select value={fBank} onChange={e => setFBank(e.target.value)} className="power-input py-1.5 text-xs w-36">
              <option value="">All Accounts</option>
              {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.icon} {ba.account_name}</option>)}
            </select>
            <input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} className="power-input py-1.5 text-xs w-36" />
          </div>
        </div>

        {transactions.length > 0 && (
          <div className="px-4 py-2 flex gap-4 text-xs flex-wrap" style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--body-bg)' }}>
            <span className="font-bold text-green-600">↑ Income: {fmt(txIncome)}</span>
            <span className="font-bold text-red-600">↓ Expense: {fmt(txExpense)}</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Net: {fmt(txIncome - txExpense)}</span>
            <span style={{ color: 'var(--text-muted)' }}>{transactions.length} records</span>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm">No transactions found. Add your first income or expense.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Category</th><th>Account</th><th>Party / Note</th><th className="text-right">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.type === 'income' ? 'bg-green-100 text-green-700' : tx.type === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {tx.type === 'income' ? '↑' : tx.type === 'transfer' ? '↔' : '↓'} {tx.type}
                      </span>
                    </td>
                    <td className="text-sm font-medium">{tx.category}</td>
                    <td>
                      {tx.bank_name ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: tx.bank_icon ? 'var(--primary)' : '#6B7280' }}>
                          {tx.bank_icon || '💳'} {tx.bank_name}
                        </span>
                      ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                      {tx.type === 'transfer' && tx.to_bank_name && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}> → {tx.to_bank_name}</span>
                      )}
                    </td>
                    <td>
                      {tx.party_name && <p className="font-medium text-sm">{tx.party_name}</p>}
                      {tx.description && <p className="text-xs truncate max-w-[150px]" style={{ color: 'var(--text-muted)' }}>{tx.description}</p>}
                      {tx.reference && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ref: {tx.reference}</p>}
                    </td>
                    <td className={`text-right font-bold ${tx.type === 'income' ? 'text-green-600' : tx.type === 'transfer' ? 'text-blue-600' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-'}{fmt(tx.amount)}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEditTx(tx)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                        <button onClick={() => deleteTx(tx.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── MODALS ───────────────────────────────────────────  */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* ── Transaction Modal ─────────────────────────────────── */}
      {showTxModal && (
        <div className="modal-backdrop" onClick={() => setShowTxModal(false)}>
          <div className="modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>{editTx ? 'Edit Transaction' : 'New Transaction'}</h3>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                {[
                  { key: 'income', label: '↑ Income', active: '#22c55e' },
                  { key: 'expense', label: '↓ Expense', active: '#ef4444' },
                  { key: 'transfer', label: '↔ Transfer', active: '#3b82f6' },
                ].map(t => (
                  <button key={t.key} onClick={() => setTxForm((f: any) => ({ ...f, type: t.key, category: t.key === 'transfer' ? 'Account Transfer' : '' }))}
                    className={`flex-1 py-2.5 text-sm font-bold transition-all ${txForm.type === t.key ? 'text-white' : 'hover:bg-gray-50'}`}
                    style={txForm.type === t.key ? { background: t.active } : { color: 'var(--text-muted)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {txForm.type !== 'transfer' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="power-label mb-0">Category</label>
                      <button onClick={() => { setShowAddCat(true); setNewCatType(txForm.type); }} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>+ New</button>
                    </div>
                    <select value={txForm.category} onChange={e => setTxForm((f: any) => ({ ...f, category: e.target.value }))} className="power-input">
                      <option value="">Select</option>
                      {(txForm.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                      {categories.filter(c => c.type === txForm.type && !INCOME_CATEGORIES.find(ic => ic.value === c.name) && !EXPENSE_CATEGORIES.find(ec => ec.value === c.name)).map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="power-label">From Account</label>
                    <select value={txForm.bank_account_id} onChange={e => setTxForm((f: any) => ({ ...f, bank_account_id: e.target.value }))} className="power-input">
                      <option value="">Select</option>
                      {bankAccounts.map(ba => <option key={ba.id} value={ba.id}>{ba.icon} {ba.account_name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="power-label">Amount (৳)</label>
                  <input type="number" min="0" step="0.01" placeholder="0" value={txForm.amount} onChange={e => setTxForm((f: any) => ({ ...f, amount: e.target.value }))} className="power-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="power-label">Date</label>
                  <input type="date" value={txForm.transaction_date} onChange={e => setTxForm((f: any) => ({ ...f, transaction_date: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">{txForm.type === 'transfer' ? 'To Account' : 'Bank Account'}</label>
                  <select value={txForm.type === 'transfer' ? txForm.to_bank_account_id : txForm.bank_account_id}
                    onChange={e => setTxForm((f: any) => txForm.type === 'transfer' ? { ...f, to_bank_account_id: e.target.value } : { ...f, bank_account_id: e.target.value })}
                    className="power-input">
                    <option value="">Select account</option>
                    {bankAccounts.filter(ba => txForm.type !== 'transfer' || String(ba.id) !== String(txForm.bank_account_id)).map(ba => (
                      <option key={ba.id} value={ba.id}>{ba.icon || getAccIcon(ba.account_type)} {ba.account_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {txForm.type !== 'transfer' && (
                <>
                  <div><label className="power-label">Party / Description</label><input placeholder="Customer, supplier, staff name" value={txForm.party_name} onChange={e => setTxForm((f: any) => ({ ...f, party_name: e.target.value }))} className="power-input" /></div>
                  <div><label className="power-label">Reference (optional)</label><input placeholder="Invoice no / receipt ID" value={txForm.reference} onChange={e => setTxForm((f: any) => ({ ...f, reference: e.target.value }))} className="power-input" /></div>
                </>
              )}
              <div><label className="power-label">Note (optional)</label><textarea rows={2} placeholder="Any details…" value={txForm.description} onChange={e => setTxForm((f: any) => ({ ...f, description: e.target.value }))} className="power-input resize-none" /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowTxModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveTx} disabled={saving} className="btn-power flex-1 justify-center"
                style={{ background: txForm.type === 'income' ? '#22c55e' : txForm.type === 'transfer' ? '#3b82f6' : undefined }}>
                {saving ? 'Saving…' : editTx ? 'Update' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Account Modal ────────────────────────────────── */}
      {showBankModal && (
        <div className="modal-backdrop" onClick={() => setShowBankModal(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>{editBank ? 'Edit Account' : 'Add Account'}</h3>
              <button onClick={() => setShowBankModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="power-label">Account Type</label>
                  <select value={bankForm.account_type} onChange={e => { const t = ACCOUNT_TYPES.find(at => at.value === e.target.value); setBankForm((f: any) => ({ ...f, account_type: e.target.value, icon: t?.icon || '💳', color: t?.color || '#6B7280' })); }} className="power-input">
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div><label className="power-label">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={bankForm.color} onChange={e => setBankForm((f: any) => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer p-0.5" style={{ border: '1px solid var(--card-border)' }} />
                    <input value={bankForm.color} onChange={e => setBankForm((f: any) => ({ ...f, color: e.target.value }))} className="power-input text-xs" />
                  </div>
                </div>
              </div>
              <div><label className="power-label">Account Name *</label><input placeholder="Dutch-Bangla Bank, bKash Main" value={bankForm.account_name} onChange={e => setBankForm((f: any) => ({ ...f, account_name: e.target.value }))} className="power-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="power-label">Bank Name</label><input placeholder="DBBL, Sonali" value={bankForm.bank_name || ''} onChange={e => setBankForm((f: any) => ({ ...f, bank_name: e.target.value }))} className="power-input" /></div>
                <div><label className="power-label">Account Number</label><input placeholder="01XXXXXXXXX" value={bankForm.account_number || ''} onChange={e => setBankForm((f: any) => ({ ...f, account_number: e.target.value }))} className="power-input" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="power-label">Branch</label><input placeholder="Main Branch" value={bankForm.branch || ''} onChange={e => setBankForm((f: any) => ({ ...f, branch: e.target.value }))} className="power-input" /></div>
                <div><label className="power-label">Opening Balance (৳)</label><input type="number" value={bankForm.opening_balance || 0} onChange={e => setBankForm((f: any) => ({ ...f, opening_balance: e.target.value }))} className="power-input" /></div>
              </div>
              <div><label className="power-label">Notes</label><textarea rows={2} value={bankForm.notes || ''} onChange={e => setBankForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input resize-none" /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={bankForm.is_default || false} onChange={e => setBankForm((f: any) => ({ ...f, is_default: e.target.checked }))} style={{ accentColor: 'var(--primary)' }} /> Set as default account
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowBankModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveBank} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Saving…' : editBank ? 'Update' : 'Add Account'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Statement Modal ──────────────────────────────── */}
      {showStatement && statementData && (
        <div className="modal-backdrop" onClick={() => setShowStatement(false)}>
          <div className="modal-box" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: statementData.account.color + '20', color: statementData.account.color }}>
                  {statementData.account.icon || getAccIcon(statementData.account.account_type)}
                </div>
                <div>
                  <h3 className="font-bold text-base">{statementData.account.account_name}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{statementData.account.bank_name} {statementData.account.account_number && `· ${statementData.account.account_number}`}</p>
                </div>
              </div>
              <button onClick={() => setShowStatement(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-4 max-h-[65vh] overflow-y-auto">
              {statementData.transactions.length === 0 ? <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No transactions</p> : (
                <table className="data-table text-xs">
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="text-right">In</th><th className="text-right">Out</th></tr></thead>
                  <tbody>
                    {statementData.transactions.map((t: any) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">{new Date(t.transaction_date).toLocaleDateString('en-GB')}</td>
                        <td className="max-w-[180px] truncate">{t.party_name || t.description || '-'}</td>
                        <td>{t.category}</td>
                        <td className="text-right font-bold text-green-600">{t.direction === 'credit' ? fmt(t.amount) : '-'}</td>
                        <td className="text-right font-bold text-red-600">{t.direction === 'debit' ? fmt(t.amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Category Modal ────────────────────────────────── */}
      {showAddCat && (
        <div className="modal-backdrop" onClick={() => setShowAddCat(false)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>➕ New Category</h3>
              <button onClick={() => setShowAddCat(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="power-label">Name</label><input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="power-input" placeholder="Fuel, Bonus…" /></div>
              <div><label className="power-label">Type</label><select value={newCatType} onChange={e => setNewCatType(e.target.value as any)} className="power-input"><option value="income">📈 Income</option><option value="expense">📉 Expense</option></select></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowAddCat(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={addCategory} className="btn-power flex-1 justify-center">➕ Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Loan Modal ────────────────────────────────────── */}
      {showLoanModal && (
        <div className="modal-backdrop" onClick={() => setShowLoanModal(false)}>
          <div className="modal-box max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>🤝 Add New Loan</h3>
              <button onClick={() => setShowLoanModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="power-label">Loan Type</label>
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                  <button onClick={() => setLoanForm((f: any) => ({ ...f, loan_type: 'received' }))}
                    className={`flex-1 py-2.5 text-sm font-bold transition-all ${loanForm.loan_type === 'received' ? 'text-white' : ''}`}
                    style={loanForm.loan_type === 'received' ? { background: '#7c3aed' } : { color: 'var(--text-muted)' }}>
                    📥 Loan Received
                  </button>
                  <button onClick={() => setLoanForm((f: any) => ({ ...f, loan_type: 'given' }))}
                    className={`flex-1 py-2.5 text-sm font-bold transition-all ${loanForm.loan_type === 'given' ? 'text-white' : ''}`}
                    style={loanForm.loan_type === 'given' ? { background: '#ea580c' } : { color: 'var(--text-muted)' }}>
                    📤 Loan Given
                  </button>
                </div>
              </div>

              <div>
                <label className="power-label">{loanForm.loan_type === 'given' ? 'Borrower Name *' : 'Lender Name *'}</label>
                <input value={loanForm.lender_name} onChange={e => setLoanForm((f: any) => ({ ...f, lender_name: e.target.value }))}
                  className="power-input" placeholder={loanForm.loan_type === 'given' ? 'Who borrowed from you?' : 'Who lent you money?'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="power-label">Total Amount (৳) *</label>
                  <input type="number" value={loanForm.total_amount} onChange={e => setLoanForm((f: any) => ({ ...f, total_amount: e.target.value }))}
                    className="power-input" placeholder="0" min="0" />
                </div>
                <div>
                  <label className="power-label">Interest Rate (%)</label>
                  <input type="number" value={loanForm.interest_rate} onChange={e => setLoanForm((f: any) => ({ ...f, interest_rate: e.target.value }))}
                    className="power-input" placeholder="0" min="0" step="0.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="power-label">Start Date</label>
                  <input type="date" value={loanForm.start_date} onChange={e => setLoanForm((f: any) => ({ ...f, start_date: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Due Date (optional)</label>
                  <input type="date" value={loanForm.due_date} onChange={e => setLoanForm((f: any) => ({ ...f, due_date: e.target.value }))} className="power-input" />
                </div>
              </div>

              {loanForm.loan_type === 'received' && (
                <div>
                  <label className="power-label">Deposit Into Account</label>
                  <select value={loanForm.bank_account_id} onChange={e => setLoanForm((f: any) => ({ ...f, bank_account_id: e.target.value }))} className="power-input">
                    <option value="">💵 Cash (Others) — not tracked</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.icon} {a.account_name} — Balance: {fmt(a.current_balance)}</option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: loanForm.bank_account_id ? '#059669' : 'var(--text-muted)' }}>
                    {loanForm.bank_account_id ? '✅ Loan amount will be credited to this account' : 'Cash — will NOT be recorded in finance'}
                  </p>
                </div>
              )}

              <div>
                <label className="power-label">Notes (optional)</label>
                <textarea rows={2} value={loanForm.notes} onChange={e => setLoanForm((f: any) => ({ ...f, notes: e.target.value }))}
                  className="power-input resize-none" placeholder="Loan purpose, terms, etc." />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowLoanModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveLoan} disabled={saving} className="btn-power flex-1 justify-center" style={{ background: '#7c3aed' }}>
                {saving ? 'Saving…' : '🤝 Add Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loan Detail Modal ─────────────────────────────────── */}
      {showLoanDetail && loanDetail && (
        <div className="modal-backdrop" onClick={() => setShowLoanDetail(false)}>
          <div className="modal-box max-h-[90vh] overflow-y-auto" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h3 className="font-bold text-base">{loanDetail.loan_type === 'given' ? '📤' : '📥'} {loanDetail.lender_name}</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Loan {loanDetail.loan_type} · Started {new Date(loanDetail.start_date).toLocaleDateString('en-GB')}
                </p>
              </div>
              <button onClick={() => setShowLoanDetail(false)} className="text-gray-400 text-xl">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Loan summary */}
              <div className="rounded-xl p-4" style={{ background: loanDetail.status === 'cleared' ? '#f0fdf4' : '#f5f3ff', border: `2px solid ${loanDetail.status === 'cleared' ? '#bbf7d0' : '#ddd6fe'}` }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Amount</p>
                    <p className="text-xl font-black" style={{ color: '#7c3aed', fontFamily: 'Barlow Condensed' }}>{fmt(loanDetail.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Paid</p>
                    <p className="text-xl font-black text-green-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(loanDetail.total_paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Remaining</p>
                    <p className="text-xl font-black" style={{ color: loanDetail.remaining > 0 ? '#dc2626' : '#16a34a', fontFamily: 'Barlow Condensed' }}>{fmt(loanDetail.remaining)}</p>
                  </div>
                </div>
                {/* Progress */}
                <div className="mt-3">
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                    <div className={`h-full rounded-full ${loanDetail.status === 'cleared' ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${Math.min(100, Math.round((parseFloat(loanDetail.total_paid) / parseFloat(loanDetail.total_amount)) * 100))}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    <span>{Math.round((parseFloat(loanDetail.total_paid) / parseFloat(loanDetail.total_amount)) * 100)}% repaid</span>
                    <span className={`font-bold ${loanDetail.status === 'cleared' ? 'text-green-600' : 'text-amber-600'}`}>
                      {loanDetail.status === 'cleared' ? '✅ CLEARED' : '⏳ ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {loanDetail.due_date && (
                  <div className="rounded-lg p-2.5" style={{ background: 'var(--body-bg)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Due Date</p>
                    <p className="font-semibold">{new Date(loanDetail.due_date).toLocaleDateString('en-GB')}</p>
                  </div>
                )}
                {parseFloat(loanDetail.interest_rate) > 0 && (
                  <div className="rounded-lg p-2.5" style={{ background: 'var(--body-bg)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Interest Rate</p>
                    <p className="font-semibold">{loanDetail.interest_rate}%</p>
                  </div>
                )}
              </div>
              {loanDetail.notes && (
                <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--body-bg)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
                  <p>{loanDetail.notes}</p>
                </div>
              )}

              {/* Action buttons */}
              {loanDetail.status !== 'cleared' && (
                <div className="flex gap-2">
                  <button onClick={() => { setShowLoanDetail(false); openLoanPayment(loanDetail); }}
                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm" style={{ background: '#7c3aed' }}>
                    💸 Make Payment
                  </button>
                  <button onClick={() => markLoanCleared(loanDetail.id)}
                    className="py-2.5 px-4 rounded-xl font-bold text-sm" style={{ background: '#dcfce7', color: '#166534' }}>
                    ✅ Mark Cleared
                  </button>
                </div>
              )}

              {/* Payment History */}
              <div>
                <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>💳 Payment History</h4>
                {loanPayments.length === 0 ? (
                  <div className="text-center py-6 rounded-xl" style={{ background: 'var(--body-bg)', color: 'var(--text-muted)' }}>
                    <p className="text-xl mb-1">📭</p>
                    <p className="text-xs">No payments made yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loanPayments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl p-3"
                        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div>
                          <p className="font-bold text-green-700">{fmt(p.amount)}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(p.created_at).toLocaleDateString('en-GB')}
                            {p.bank_name && ` · ${p.bank_icon || '🏦'} ${p.bank_name}`}
                            {p.payment_method && ` · ${p.payment_method}`}
                          </p>
                          {p.reference && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ref: {p.reference}</p>}
                          {p.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.paid_by_name || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Loan Payment Modal ────────────────────────────────── */}
      {showLoanPayModal && loanDetail && (
        <div className="modal-backdrop" onClick={() => setShowLoanPayModal(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>💸 Loan Repayment</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {loanDetail.lender_name} · Remaining: <strong className="text-red-600">{fmt(loanDetail.remaining)}</strong>
                </p>
              </div>
              <button onClick={() => setShowLoanPayModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="power-label">Payment Amount (৳) *</label>
                <input type="number" value={loanPayForm.amount} onChange={e => setLoanPayForm((f: any) => ({ ...f, amount: e.target.value }))}
                  className="power-input" placeholder="0" min="0" />
                <div className="flex gap-2 mt-1.5">
                  <button type="button" onClick={() => setLoanPayForm((f: any) => ({ ...f, amount: String(loanDetail.remaining) }))}
                    className="text-xs px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 font-semibold">
                    Full ({fmt(loanDetail.remaining)})
                  </button>
                  <button type="button" onClick={() => setLoanPayForm((f: any) => ({ ...f, amount: String(Math.round(loanDetail.remaining / 2)) }))}
                    className="text-xs px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-semibold">
                    50% ({fmt(Math.round(loanDetail.remaining / 2))})
                  </button>
                </div>
              </div>

              <div>
                <label className="power-label">Pay From Account</label>
                <select value={loanPayForm.bank_account_id} onChange={e => setLoanPayForm((f: any) => ({ ...f, bank_account_id: e.target.value }))} className="power-input">
                  <option value="">💵 Cash (Others) — not tracked in finance</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.icon} {a.account_name} — Balance: {fmt(a.current_balance)}</option>
                  ))}
                </select>
                <p className="text-xs mt-1" style={{ color: loanPayForm.bank_account_id ? '#059669' : 'var(--text-muted)' }}>
                  {loanPayForm.bank_account_id ? '✅ Will deduct from account & record in finance' : 'Cash — will NOT be recorded in finance'}
                </p>
              </div>

              <div>
                <label className="power-label">Reference (optional)</label>
                <input value={loanPayForm.reference} onChange={e => setLoanPayForm((f: any) => ({ ...f, reference: e.target.value }))}
                  className="power-input" placeholder="Cheque no / txn ID" />
              </div>

              <div>
                <label className="power-label">Notes (optional)</label>
                <input value={loanPayForm.notes} onChange={e => setLoanPayForm((f: any) => ({ ...f, notes: e.target.value }))}
                  className="power-input" placeholder="Any notes" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowLoanPayModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={makeLoanPayment} disabled={saving} className="btn-power flex-1 justify-center" style={{ background: '#7c3aed' }}>
                {saving ? 'Processing…' : '💸 Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
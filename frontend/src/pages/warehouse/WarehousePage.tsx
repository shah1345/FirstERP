import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

type View = 'outlets' | 'detail' | 'pending' | 'transfers' | 'users';

export default function WarehousePage() {
  const [view, setView] = useState<View>('outlets');
  const [outlets, setOutlets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Outlet detail
  const [selectedOutlet, setSelectedOutlet] = useState<any>(null);
  const [outletDetail, setOutletDetail] = useState<any>(null);

  // Forms
  const [showOutletForm, setShowOutletForm] = useState(false);
  const [editOutlet, setEditOutlet] = useState<any>(null);
  const [outletForm, setOutletForm] = useState<any>({ name: '', code: '', address: '', phone: '', manager_name: '' });

  const [showUserForm, setShowUserForm] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState<any>({ user_id: '', role: 'staff' });

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [transferForm, setTransferForm] = useState<any>({ to_outlet_id: '', notes: '', items: [{ product_id: '', quantity: 1 }] });

  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // User management
  const [allUsersManage, setAllUsersManage] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showResetPw, setShowResetPw] = useState<any>(null);
  const [newPw, setNewPw] = useState('');
  const [createUserForm, setCreateUserForm] = useState<any>({ name: '', email: '', password: '', role: 'employee', outlet_id: '', outlet_role: 'staff' });

  // Load
  const loadOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, sRes] = await Promise.all([
        api.get('/outlets'),
        api.get('/outlets/dashboard/summary'),
      ]);
      if (oRes.data.success) setOutlets(oRes.data.data || []);
      if (sRes.data.success) setSummary(sRes.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  const loadDetail = async (outletId: number) => {
    try {
      const r = await api.get(`/outlets/${outletId}`);
      if (r.data.success) { setOutletDetail(r.data.data); setView('detail'); }
    } catch { alert('Failed to load'); }
  };

  const loadPending = async () => {
    try { const r = await api.get('/outlets/pending/list'); if (r.data.success) setPendingActions(r.data.data || []); } catch { }
  };

  const loadTransfers = async () => {
    try { const r = await api.get('/outlets/transfers/list'); if (r.data.success) setTransfers(r.data.data || []); } catch { }
  };

  const loadUsers = async () => {
    try { const r = await api.get('/auth/users'); if (r.data.success) setAllUsers(r.data.data || []); } catch {
      try { const r = await api.get('/auth/seed'); setAllUsers([]); } catch { }
    }
  };

  const loadProducts = async () => {
    try { const r = await api.get('/products'); if (r.data.success) setProducts(r.data.data || []); } catch { }
  };

  useEffect(() => { loadOutlets(); }, [loadOutlets]);
  useEffect(() => { if (view === 'pending') loadPending(); if (view === 'transfers') loadTransfers(); if (view === 'users') loadUsersManage(); }, [view]);

  // ── CRUD ──────────────────────────────────────────────────

  const openAddOutlet = () => { setEditOutlet(null); setOutletForm({ name: '', code: '', address: '', phone: '', manager_name: '' }); setShowOutletForm(true); };
  const openEditOutlet = (o: any) => { setEditOutlet(o); setOutletForm({ name: o.name, code: o.code, address: o.address || '', phone: o.phone || '', manager_name: o.manager_name || '' }); setShowOutletForm(true); };

  const saveOutlet = async () => {
    if (!outletForm.name || !outletForm.code) { alert('Name and code required'); return; }
    setSaving(true);
    try {
      if (editOutlet) await api.put(`/outlets/${editOutlet.id}`, outletForm);
      else await api.post('/outlets', outletForm);
      setShowOutletForm(false); loadOutlets();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteOutlet = async (id: number) => {
    if (!confirm('Deactivate this outlet?')) return;
    try { await api.delete(`/outlets/${id}`); loadOutlets(); } catch { }
  };

  const openAssignUser = (outlet: any) => {
    setSelectedOutlet(outlet);
    loadUsers();
    setUserForm({ user_id: '', role: 'staff' });
    setShowUserForm(true);
  };

  const assignUser = async () => {
    if (!userForm.user_id || !selectedOutlet) return;
    try {
      await api.post(`/outlets/${selectedOutlet.id}/users`, userForm);
      setShowUserForm(false);
      if (view === 'detail') loadDetail(selectedOutlet.id);
      loadOutlets();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const removeUser = async (outletId: number, userId: number) => {
    if (!confirm('Remove this user from outlet?')) return;
    try {
      await api.delete(`/outlets/${outletId}/users/${userId}`);
      if (outletDetail) loadDetail(outletId);
    } catch { }
  };

  const openTransfer = (toOutletId?: number) => {
    loadProducts();
    setTransferForm({ to_outlet_id: toOutletId || '', notes: '', items: [{ product_id: '', quantity: 1 }] });
    setShowTransferForm(true);
  };

  const addTransferItem = () => setTransferForm((f: any) => ({ ...f, items: [...f.items, { product_id: '', quantity: 1 }] }));
  const removeTransferItem = (idx: number) => setTransferForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));
  const updateTransferItem = (idx: number, key: string, val: any) => {
    setTransferForm((f: any) => { const items = [...f.items]; items[idx] = { ...items[idx], [key]: val }; return { ...f, items }; });
  };

  const submitTransfer = async () => {
    if (!transferForm.to_outlet_id || !transferForm.items.some((i: any) => i.product_id)) { alert('Destination and at least 1 product required'); return; }
    setSaving(true);
    try {
      await api.post('/outlets/transfers', { ...transferForm, from_outlet_id: null });
      setShowTransferForm(false); loadOutlets();
      if (outletDetail) loadDetail(outletDetail.outlet.id);
      alert('✅ Stock transferred');
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const reviewPending = async (id: number, action: string) => {
    const note = action === 'reject' ? prompt('Reason for rejection:') : '';
    try {
      await api.put(`/outlets/pending/${id}`, { action, review_note: note || '' });
      loadPending();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  // ── User management ─────────────────────────────────────
  const loadUsersManage = async () => {
    try { const r = await api.get('/auth/users'); if (r.data.success) setAllUsersManage(r.data.data || []); } catch { }
  };

  const openCreateUser = () => {
    setEditUser(null);
    setCreateUserForm({ name: '', email: '', password: '', role: 'employee', outlet_id: '', outlet_role: 'staff' });
    setShowCreateUser(true);
  };

  const openEditUser = (u: any) => {
    setEditUser(u);
    setCreateUserForm({ name: u.name, email: u.email, password: '', role: u.role, outlet_id: u.outlet_id || '', outlet_role: u.outlet_role || 'staff' });
    setShowCreateUser(true);
  };

  const saveUser = async () => {
    if (!createUserForm.name || !createUserForm.email) { alert('Name and email required'); return; }
    if (!editUser && !createUserForm.password) { alert('Password required for new user'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/auth/users/${editUser.id}`, createUserForm);
      } else {
        await api.post('/auth/users', createUserForm);
      }
      setShowCreateUser(false); loadUsersManage();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deactivateUser = async (id: number) => {
    if (!confirm('Deactivate this user? They will not be able to login.')) return;
    try { await api.delete(`/auth/users/${id}`); loadUsersManage(); } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const activateUser = async (id: number) => {
    try { await api.put(`/auth/users/${id}/activate`); loadUsersManage(); } catch { }
  };

  const resetPassword = async () => {
    if (!newPw || newPw.length < 4) { alert('Min 4 characters'); return; }
    try {
      await api.put(`/auth/users/${showResetPw.id}/password`, { new_password: newPw });
      alert('✅ Password reset'); setShowResetPw(null); setNewPw('');
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  if (loading) return (
    <div className="space-y-5">
      <div style={{ height: 32, width: 200, background: 'var(--card-border)', borderRadius: 8 }} className="animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="power-card animate-pulse" style={{ height: 180 }} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">🏭 Warehouse & Outlets</h1>
          <p className="page-subtitle">Manage outlets, stock transfers & approvals</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {view === 'detail' && <button onClick={() => { setView('outlets'); setOutletDetail(null); }} className="btn-ghost text-xs py-2 px-3">← Back to Outlets</button>}
          <button onClick={() => { setView('users'); loadUsersManage(); }}
            className={`btn-outline text-xs py-2 px-3 ${view === 'users' ? 'ring-2' : ''}`}
            style={view === 'users' ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}>
            👥 Users
          </button>
          <button onClick={() => { setView('pending'); loadPending(); }}
            className={`btn-outline text-xs py-2 px-3 relative ${view === 'pending' ? 'ring-2' : ''}`}
            style={view === 'pending' ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}>
            🔔 Pending {summary?.pending_actions > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center" style={{ background: 'var(--primary)' }}>{summary.pending_actions}</span>}
          </button>
          <button onClick={() => openTransfer()} className="btn-outline text-xs py-2 px-3">📦 Stock Transfer</button>
          <button onClick={openAddOutlet} className="btn-power text-xs py-2 px-3">+ New Outlet</button>
        </div>
      </div>

      {/* Summary */}
      {summary && view === 'outlets' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Outlets', value: summary.total_outlets, icon: '🏪', bg: '#eff6ff', color: '#2563eb' },
            { label: "Today's Sales", value: fmt(summary.today_total_sales), icon: '💰', bg: '#f0fdf4', color: '#16a34a' },
            { label: 'Total Stock', value: `${summary.total_stock_units} units`, icon: '📦', bg: '#faf5ff', color: '#7c3aed' },
            { label: 'Pending Actions', value: summary.pending_actions, icon: '🔔', bg: summary.pending_actions > 0 ? '#fef2f2' : '#f9fafb', color: summary.pending_actions > 0 ? '#dc2626' : '#6b7280' },
            { label: 'Pending Transfers', value: summary.pending_transfers, icon: '🚚', bg: '#fff7ed', color: '#ea580c' },
          ].map((c, i) => (
            <div key={i} className="stat-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: c.bg }}>{c.icon}</div>
              <div><p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p className="text-lg font-black" style={{ color: c.color, fontFamily: 'Barlow Condensed' }}>{c.value}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* ─── VIEW: OUTLETS GRID ────────────────────────── */}
      {view === 'outlets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {outlets.filter(o => o.code !== 'WAREHOUSE').map(o => (
            <div key={o.id} className="power-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelectedOutlet(o); loadDetail(o.id); }}>
              {/* Header gradient */}
              <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary, #1e3a5f))' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{o.name}</h3>
                      <span className="text-xs opacity-75">{o.code}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); openEditOutlet(o); }} className="p-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.2)' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); openAssignUser(o); }} className="p-1 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.2)' }}>👥</button>
                  </div>
                </div>
                <p className="text-2xl font-black" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(o.today_sales)}</p>
                <p className="text-xs opacity-70">Today's Sales · {o.today_invoices} invoices · Profit: {fmt(o.today_profit)}</p>
              </div>
              {/* Metrics */}
              <div className="p-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Cash</p>
                  <p className="font-bold text-xs text-green-600">{fmt(o.today_cash)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Credit</p>
                  <p className="font-bold text-xs text-red-600">{fmt(o.today_credit)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Bank</p>
                  <p className="font-bold text-xs text-blue-600">{fmt(o.bank_balance)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Stock Val</p>
                  <p className="font-bold text-xs text-purple-600">{fmt(o.stock_value)}</p>
                </div>
              </div>
              <div className="px-4 pb-3 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>📦 {o.stock_units} units · 💵 Opening: {fmt(o.opening_balance)}</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>Monthly: {fmt(o.monthly_sales)}</span>
              </div>
              {o.pending_requests > 0 && (
                <div className="px-4 pb-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🔔 {o.pending_requests} pending</span></div>
              )}
            </div>
          ))}
          {outlets.filter(o => o.code !== 'WAREHOUSE').length === 0 && (
            <div className="power-card p-10 text-center col-span-3" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">🏪</p>
              <p>No outlets yet. Click "New Outlet" to create one.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── VIEW: OUTLET DETAIL (FULL DASHBOARD) ──────── */}
      {view === 'detail' && outletDetail && (() => {
        const m = outletDetail.metrics || {};
        const t = m.today || {};
        const w = m.weekly || {};
        const mo = m.monthly || {};
        const y = m.yearly || {};
        const lt = m.lifetime || {};
        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="power-card p-5 flex flex-wrap items-center justify-between gap-4" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div>
                <h2 className="text-xl font-black" style={{ fontFamily: 'Barlow Condensed', color: 'var(--text-primary)' }}>🏪 {outletDetail.outlet.name}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{outletDetail.outlet.code} · {outletDetail.outlet.address || 'No address'} · 📞 {outletDetail.outlet.phone || '-'}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openTransfer(outletDetail.outlet.id)} className="btn-power text-xs py-2 px-3">📦 Send Stock</button>
                <button onClick={() => openAssignUser(outletDetail.outlet)} className="btn-outline text-xs py-2 px-3">👥 Assign User</button>
              </div>
            </div>

            {/* ── TODAY'S SUMMARY ROW ─────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Today's Sales", value: fmt(t.total), icon: '💰', bg: '#f0fdf4', color: '#16a34a' },
                { label: "Today's Profit", value: fmt(t.profit), icon: '📈', bg: '#eff6ff', color: '#2563eb' },
                { label: 'Cash Received', value: fmt(t.paid), icon: '💵', bg: '#f0fdf4', color: '#16a34a' },
                { label: 'Credit Sales', value: fmt(t.credit), icon: '📝', bg: '#fef2f2', color: '#dc2626' },
                { label: 'Opening Bal.', value: fmt(m.opening_balance), icon: '🔓', bg: '#fff7ed', color: '#ea580c' },
                { label: 'Cash Balance', value: fmt(m.cash_balance), icon: '💵', bg: '#f0fdf4', color: '#16a34a' },
                { label: 'Bank Deposit', value: fmt(m.bank_deposit), icon: '🏦', bg: '#eff6ff', color: '#2563eb' },
              ].map((c, i) => (
                <div key={i} className="stat-card p-3 text-center">
                  <span className="text-lg">{c.icon}</span>
                  <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                  <p className="text-base font-black" style={{ fontFamily: 'Barlow Condensed', color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* ── PERIOD COMPARISON (Weekly/Monthly/Yearly/Lifetime) */}
            <div className="power-card overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📊 Performance Summary</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-center">
                  <thead>
                    <tr><th></th><th>Sales</th><th>Profit</th><th>Cash</th><th>Credit</th><th>Invoices</th></tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Today', d: t },
                      { label: 'This Week', d: w },
                      { label: 'This Month', d: mo },
                      { label: 'This Year', d: y },
                      { label: 'Lifetime', d: lt },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td className="font-bold text-xs text-left">{row.label}</td>
                        <td className="font-bold" style={{ color: 'var(--primary)' }}>{fmt(row.d.total)}</td>
                        <td className="font-bold text-green-600">{fmt(row.d.profit)}</td>
                        <td className="text-green-600">{fmt(row.d.paid)}</td>
                        <td className="text-red-600">{fmt(row.d.credit)}</td>
                        <td>{row.d.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── STOCK + FINANCIAL ROW ───────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card p-4 text-center" style={{ borderLeft: '4px solid #7c3aed' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>📦 Stock Value</p>
                <p className="text-xl font-black text-purple-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(m.stock_value)}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.stock_units} units</p>
              </div>
              <div className="stat-card p-4 text-center" style={{ borderLeft: '4px solid #16a34a' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>💵 Total Cash</p>
                <p className="text-xl font-black text-green-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(m.cash_balance)}</p>
              </div>
              <div className="stat-card p-4 text-center" style={{ borderLeft: '4px solid #2563eb' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>🏦 Total in Bank</p>
                <p className="text-xl font-black text-blue-600" style={{ fontFamily: 'Barlow Condensed' }}>{fmt(m.bank_deposit)}</p>
              </div>
              <div className="stat-card p-4 text-center" style={{ borderLeft: '4px solid #ea580c' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>💰 Total Balance</p>
                <p className="text-xl font-black" style={{ fontFamily: 'Barlow Condensed', color: 'var(--primary)' }}>{fmt(m.total_balance)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left 2/3: Sales chart + Sales history + Stock */}
              <div className="lg:col-span-2 space-y-5">

                {/* Daily sales bar chart */}
                {outletDetail.dailySales?.length > 0 && (
                  <div className="power-card p-5">
                    <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>📊 Daily Sales & Profit (Last 7 Days)</h3>
                    <div className="flex gap-2 items-end" style={{ height: 140 }}>
                      {outletDetail.dailySales.map((d: any, i: number) => {
                        const max = Math.max(...outletDetail.dailySales.map((x: any) => parseFloat(x.total)));
                        const h = max > 0 ? (parseFloat(d.total) / max) * 100 : 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{fmt(d.total)}</span>
                            <span className="text-xs text-green-600">+{fmt(d.profit)}</span>
                            <div className="w-full rounded-t-lg" style={{ height: `${Math.max(h, 4)}%`, background: 'var(--primary)', opacity: 0.8 }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent sales */}
                <div className="power-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🧾 Recent Sales</h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{outletDetail.sales?.length || 0} records</span>
                  </div>
                  {(outletDetail.sales || []).length === 0 ? <p className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales</p> : (
                    <div className="overflow-x-auto" style={{ maxHeight: 350 }}>
                      <table className="data-table text-xs">
                        <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Due</th><th>Profit</th><th>Date</th></tr></thead>
                        <tbody>
                          {outletDetail.sales.map((s: any) => (
                            <tr key={s.id}>
                              <td className="font-mono font-bold" style={{ color: 'var(--primary)' }}>{s.invoice_number}</td>
                              <td>{s.customer_name}</td>
                              <td className="font-bold">{fmt(s.total_amount)}</td>
                              <td className="text-green-600">{fmt(s.paid_amount)}</td>
                              <td className="text-red-600">{parseFloat(s.due_amount) > 0 ? fmt(s.due_amount) : '-'}</td>
                              <td className="text-blue-600">{fmt(s.total_profit)}</td>
                              <td>{new Date(s.created_at).toLocaleDateString('en-GB')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Stock table */}
                <div className="power-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📦 Stock ({m.stock_units} units · Value: {fmt(m.stock_value)})</h3>
                  </div>
                  {(outletDetail.stock || []).length === 0 ? <p className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No stock</p> : (
                    <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
                      <table className="data-table text-xs">
                        <thead><tr><th>Product</th><th>Brand</th><th className="text-right">Stock</th><th className="text-right">Value</th></tr></thead>
                        <tbody>
                          {outletDetail.stock.map((s: any) => (
                            <tr key={s.id}>
                              <td className="font-semibold">{s.product_name}</td>
                              <td>{s.brand || '-'} {s.model || ''}</td>
                              <td className="text-right font-bold">{s.stock} {s.unit || 'pcs'}</td>
                              <td className="text-right text-purple-600 font-bold">{fmt(s.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Users */}
                <div className="power-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>👥 Users</h3>
                    <button onClick={() => openAssignUser(outletDetail.outlet)} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>+ Add</button>
                  </div>
                  <div className="divide-y">
                    {(outletDetail.users || []).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{u.name?.charAt(0)}</div>
                          <div><p className="text-sm font-semibold">{u.name}</p><p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{u.outlet_role}</p></div>
                        </div>
                        <button onClick={() => removeUser(outletDetail.outlet.id, u.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">Remove</button>
                      </div>
                    ))}
                    {(outletDetail.users || []).length === 0 && <p className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users</p>}
                  </div>
                </div>
              </div>

              {/* Right 1/3: Bank, Deposits, Transfers, Pending */}
              <div className="space-y-5">
                {/* Bank accounts */}
                <div className="power-card overflow-hidden">
                  <div className="px-4 py-3 bg-blue-50" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm text-blue-800">🏦 Bank Accounts</h3>
                  </div>
                  <div className="divide-y">
                    {(outletDetail.banks || []).map((b: any) => (
                      <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{b.icon}</span>
                          <div><p className="text-sm font-semibold">{b.account_name}</p>
                            {b.account_number && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.account_number}</p>}
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${parseFloat(b.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(b.current_balance)}</span>
                      </div>
                    ))}
                    {(outletDetail.banks || []).length === 0 && <p className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No bank accounts</p>}
                  </div>
                </div>

                {/* Deposit history */}
                {(outletDetail.depositHistory || []).length > 0 && (
                  <div className="power-card overflow-hidden">
                    <div className="px-4 py-3 bg-green-50" style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <h3 className="font-bold text-sm text-green-800">💰 Recent Deposits</h3>
                    </div>
                    <div className="divide-y">
                      {(outletDetail.depositHistory || []).slice(0, 10).map((d: any) => (
                        <div key={d.id} className="px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{new Date(d.deposit_date).toLocaleDateString('en-GB')}</span>
                            <span className="text-sm font-black text-blue-600">{fmt(d.deposit_amount)}</span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Open: {fmt(d.opening_balance)} → Close: {fmt(d.closing_balance)} · {d.bank_icon} {d.account_name || 'Cash'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transfers */}
                <div className="power-card overflow-hidden">
                  <div className="px-4 py-3 bg-orange-50" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm text-orange-800">🚚 Stock Transfers</h3>
                  </div>
                  <div className="divide-y">
                    {(outletDetail.transfers || []).slice(0, 10).map((t: any) => (
                      <div key={t.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--primary)' }}>{t.transfer_number}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === 'received' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.from_name || 'Warehouse'} → {t.to_name}</p>
                      </div>
                    ))}
                    {(outletDetail.transfers || []).length === 0 && <p className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No transfers</p>}
                  </div>
                </div>

                {/* Pending */}
                {(outletDetail.pending || []).length > 0 && (
                  <div className="power-card overflow-hidden">
                    <div className="px-4 py-3 bg-red-50" style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <h3 className="font-bold text-sm text-red-800">🔔 Pending Approvals</h3>
                    </div>
                    <div className="divide-y">
                      {outletDetail.pending.map((p: any) => (
                        <div key={p.id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold capitalize">{p.action_type.replace(/_/g, ' ')}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('en-GB')}</span>
                          </div>
                          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{p.reason || 'No reason'} — by {p.requested_by_name}</p>
                          <div className="flex gap-2">
                            <button onClick={() => reviewPending(p.id, 'approve')} className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700">✅ Approve</button>
                            <button onClick={() => reviewPending(p.id, 'reject')} className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700">❌ Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── VIEW: ALL PENDING ──────────────────────────── */}
      {view === 'pending' && (
        <div className="power-card overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>🔔 All Pending Approvals</h3>
          </div>
          {pendingActions.length === 0 ? <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No pending requests</p> : (
            <div className="divide-y">
              {pendingActions.map(p => (
                <div key={p.id} className="px-4 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{p.outlet_name} ({p.outlet_code})</span>
                      <span className="text-xs font-bold capitalize">{p.action_type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm">{p.reason || 'No reason provided'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>By {p.requested_by_name} · {new Date(p.created_at).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => reviewPending(p.id, 'approve')} className="btn-power text-xs py-1.5 px-3" style={{ background: '#16a34a' }}>✅ Approve</button>
                    <button onClick={() => reviewPending(p.id, 'reject')} className="btn-power text-xs py-1.5 px-3" style={{ background: '#dc2626' }}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── VIEW: ALL TRANSFERS ────────────────────────── */}
      {view === 'transfers' && (
        <div className="power-card overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>🚚 All Stock Transfers</h3>
            <button onClick={() => openTransfer()} className="btn-power text-xs py-1.5 px-3">+ New Transfer</button>
          </div>
          {transfers.length === 0 ? <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No transfers</p> : (
            <table className="data-table">
              <thead><tr><th>Transfer #</th><th>From</th><th>To</th><th>Items</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id}>
                    <td className="font-mono font-bold text-xs" style={{ color: 'var(--primary)' }}>{t.transfer_number}</td>
                    <td className="text-sm">{t.from_name || 'Warehouse'}</td>
                    <td className="text-sm font-semibold">{t.to_name}</td>
                    <td>{t.total_items || '-'}</td>
                    <td><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === 'received' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{t.status}</span></td>
                    <td className="text-xs">{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── VIEW: USERS MANAGEMENT ──────────────────── */}
      {view === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={openCreateUser} className="btn-power text-xs py-2 px-3">+ Create User</button></div>

          <div className="power-card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>👥 All Users ({allUsersManage.length})</h3>
            </div>
            {allUsersManage.length === 0 ? <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No users</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>User</th><th>Role</th><th>Outlet</th><th>Outlet Role</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {allUsersManage.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{u.name?.charAt(0)?.toUpperCase()}</div>
                            <div>
                              <p className="font-semibold text-sm">{u.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                        <td>
                          {u.outlet_name ? (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>🏪 {u.outlet_name} ({u.outlet_code})</span>
                          ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— Warehouse</span>}
                        </td>
                        <td className="text-sm capitalize">{u.outlet_role || '-'}</td>
                        <td>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status}</span>
                        </td>
                        <td>
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEditUser(u)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                            <button onClick={() => { setShowResetPw(u); setNewPw(''); }} className="btn-ghost py-1 px-2 text-xs">🔑</button>
                            {u.status === 'active' ? (
                              <button onClick={() => deactivateUser(u.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🚫</button>
                            ) : (
                              <button onClick={() => activateUser(u.id)} className="btn-ghost py-1 px-2 text-xs text-green-600">✅</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT USER ──────────────────── */}
      {showCreateUser && (
        <div className="modal-backdrop" onClick={() => setShowCreateUser(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>{editUser ? '✏️ Edit User' : '👤 Create User'}</h3>
              <button onClick={() => setShowCreateUser(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="power-label">Full Name *</label><input value={createUserForm.name} onChange={e => setCreateUserForm((f: any) => ({ ...f, name: e.target.value }))} className="power-input" placeholder="John Doe" /></div>
                <div><label className="power-label">Email *</label><input type="email" value={createUserForm.email} onChange={e => setCreateUserForm((f: any) => ({ ...f, email: e.target.value }))} className="power-input" placeholder="user@email.com" /></div>
              </div>
              {!editUser && (
                <div><label className="power-label">Password *</label><input type="text" value={createUserForm.password} onChange={e => setCreateUserForm((f: any) => ({ ...f, password: e.target.value }))} className="power-input" placeholder="Min 4 characters" /></div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">System Role</label>
                  <select value={createUserForm.role} onChange={e => setCreateUserForm((f: any) => ({ ...f, role: e.target.value }))} className="power-input">
                    <option value="admin">👑 Admin</option>
                    <option value="employee">👤 Employee</option>
                  </select>
                </div>
                <div>
                  <label className="power-label">Assign to Outlet</label>
                  <select value={createUserForm.outlet_id} onChange={e => setCreateUserForm((f: any) => ({ ...f, outlet_id: e.target.value }))} className="power-input">
                    <option value="">— Warehouse (No outlet)</option>
                    {outlets.filter(o => o.code !== 'WAREHOUSE').map(o => <option key={o.id} value={o.id}>🏪 {o.name} ({o.code})</option>)}
                  </select>
                </div>
              </div>
              {createUserForm.outlet_id && (
                <div>
                  <label className="power-label">Outlet Role</label>
                  <select value={createUserForm.outlet_role} onChange={e => setCreateUserForm((f: any) => ({ ...f, outlet_role: e.target.value }))} className="power-input">
                    <option value="manager">🏪 Manager</option>
                    <option value="cashier">💰 Cashier</option>
                    <option value="staff">👤 Staff</option>
                  </select>
                </div>
              )}
              {editUser && (
                <div>
                  <label className="power-label">Status</label>
                  <select value={createUserForm.status || 'active'} onChange={e => setCreateUserForm((f: any) => ({ ...f, status: e.target.value }))} className="power-input">
                    <option value="active">✅ Active</option>
                    <option value="inactive">🚫 Inactive</option>
                  </select>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreateUser(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveUser} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Saving…' : editUser ? '💾 Update User' : '👤 Create User'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: RESET PASSWORD ──────────────────────── */}
      {showResetPw && (
        <div className="modal-backdrop" onClick={() => setShowResetPw(null)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>🔑 Reset Password</h3>
              <button onClick={() => setShowResetPw(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--body-bg)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{showResetPw.name?.charAt(0)?.toUpperCase()}</div>
                <div>
                  <p className="font-bold text-sm">{showResetPw.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{showResetPw.email}</p>
                </div>
              </div>
              <div><label className="power-label">New Password</label><input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} className="power-input" placeholder="Enter new password (min 4 chars)" /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowResetPw(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={resetPassword} className="btn-power flex-1 justify-center">🔑 Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE/EDIT OUTLET ──────────────────── */}
      {showOutletForm && (
        <div className="modal-backdrop" onClick={() => setShowOutletForm(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>{editOutlet ? '✏️ Edit Outlet' : '🏪 New Outlet'}</h3>
              <button onClick={() => setShowOutletForm(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="power-label">Outlet Name *</label><input value={outletForm.name} onChange={e => setOutletForm((f: any) => ({ ...f, name: e.target.value }))} className="power-input" placeholder="Shop 01" /></div>
                <div><label className="power-label">Code *</label><input value={outletForm.code} onChange={e => setOutletForm((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))} className="power-input" placeholder="SHOP01" maxLength={20} /></div>
              </div>
              <div><label className="power-label">Address</label><input value={outletForm.address} onChange={e => setOutletForm((f: any) => ({ ...f, address: e.target.value }))} className="power-input" placeholder="Shop address" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="power-label">Phone</label><input value={outletForm.phone} onChange={e => setOutletForm((f: any) => ({ ...f, phone: e.target.value }))} className="power-input" placeholder="+880..." /></div>
                <div><label className="power-label">Manager</label><input value={outletForm.manager_name} onChange={e => setOutletForm((f: any) => ({ ...f, manager_name: e.target.value }))} className="power-input" placeholder="Manager name" /></div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowOutletForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveOutlet} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Saving…' : editOutlet ? '💾 Update' : '🏪 Create Outlet'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ASSIGN USER ─────────────────────────── */}
      {showUserForm && selectedOutlet && (
        <div className="modal-backdrop" onClick={() => setShowUserForm(false)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>👥 Assign User to {selectedOutlet.name}</h3>
              <button onClick={() => setShowUserForm(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="power-label">Select User</label>
                <select value={userForm.user_id} onChange={e => setUserForm((f: any) => ({ ...f, user_id: e.target.value }))} className="power-input">
                  <option value="">Choose user</option>
                  {allUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</option>)}
                </select>
              </div>
              <div><label className="power-label">Role at Outlet</label>
                <select value={userForm.role} onChange={e => setUserForm((f: any) => ({ ...f, role: e.target.value }))} className="power-input">
                  <option value="manager">Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowUserForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={assignUser} className="btn-power flex-1 justify-center">👥 Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: STOCK TRANSFER ──────────────────────── */}
      {showTransferForm && (
        <div className="modal-backdrop" onClick={() => setShowTransferForm(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>📦 Stock Transfer (Warehouse → Outlet)</h3>
              <button onClick={() => setShowTransferForm(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div><label className="power-label">Send To Outlet *</label>
                <select value={transferForm.to_outlet_id} onChange={e => setTransferForm((f: any) => ({ ...f, to_outlet_id: e.target.value }))} className="power-input">
                  <option value="">Select outlet</option>
                  {outlets.filter(o => o.code !== 'WAREHOUSE').map(o => <option key={o.id} value={o.id}>🏪 {o.name} ({o.code})</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="power-label mb-0">Products</label>
                  <button onClick={addTransferItem} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>+ Add Product</button>
                </div>
                <div className="space-y-2">
                  {transferForm.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center p-2 rounded-lg" style={{ background: 'var(--body-bg)' }}>
                      <select value={item.product_id} onChange={e => updateTransferItem(idx, 'product_id', e.target.value)} className="power-input text-xs flex-1">
                        <option value="">Select product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.total_stock} in stock)</option>)}
                      </select>
                      <input type="number" min="1" value={item.quantity} onChange={e => updateTransferItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="power-input text-xs w-20" />
                      {transferForm.items.length > 1 && <button onClick={() => removeTransferItem(idx)} className="text-red-500 text-sm">✕</button>}
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="power-label">Notes</label><textarea value={transferForm.notes} onChange={e => setTransferForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input resize-none" rows={2} placeholder="Transfer notes..." /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowTransferForm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submitTransfer} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Sending…' : '📦 Transfer Stock'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
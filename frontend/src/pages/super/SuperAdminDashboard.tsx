import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Tenant {
  id: number;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  plan: string;
  plan_start: string;
  plan_end: string;
  max_users: number;
  max_outlets: number;
  max_products: number;
  status: string;
  notes: string;
  created_at: string;
  total_users: number;
  total_products: number;
  total_sales: number;
  total_revenue: number;
  total_outlets: number;
  total_customers: number;
  total_rows: number;
  storage_estimate_mb: number;
  storage_limit_mb: number;
  monthly_price: number;
  setup_fee: number;
  per_outlet_fee: number;
  allowed_modules: string[];
}

interface GlobalStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_sales: number;
  total_revenue: number;
}

// Module definitions with labels and icons
const MODULE_LIST: { key: string; label: string; icon: string; group: 'main' | 'admin' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊', group: 'main' },
  { key: 'pos', label: 'POS Sales', icon: '🛒', group: 'main' },
  { key: 'products', label: 'Products', icon: '📋', group: 'main' },
  { key: 'stock', label: 'Stock In', icon: '📦', group: 'main' },
  { key: 'stock_adjust', label: 'Stock Adjust', icon: '⚙️', group: 'main' },
  { key: 'customers', label: 'Customers', icon: '👥', group: 'main' },
  { key: 'returns', label: 'Returns', icon: '↩️', group: 'main' },
  { key: 'replacements', label: 'Replacements', icon: '🔄', group: 'main' },
  { key: 'sales', label: 'Sales History', icon: '🧾', group: 'main' },
  { key: 'sales_history', label: 'Manage Sales', icon: '📜', group: 'main' },
  { key: 'collect_due', label: 'Collect Due', icon: '💰', group: 'main' },
  { key: 'finance', label: 'Finance', icon: '💰', group: 'main' },
  { key: 'bank_deposit', label: 'Bank Deposit', icon: '🏦', group: 'main' },
  { key: 'reports', label: 'Reports', icon: '📈', group: 'main' },
  { key: 'statement', label: 'Statements', icon: '📄', group: 'main' },
  { key: 'accounts', label: 'Accounts', icon: '🏦', group: 'admin' },
  { key: 'production', label: 'Production', icon: '🏭', group: 'admin' },
  { key: 'warehouse', label: 'Warehouse', icon: '🏭', group: 'admin' },
  { key: 'vendors', label: 'Vendors', icon: '🚚', group: 'admin' },
  { key: 'employees', label: 'Employees', icon: '👥', group: 'admin' },
  { key: 'attendance', label: 'Attendance', icon: '📅', group: 'admin' },
  { key: 'payroll', label: 'Payroll', icon: '💵', group: 'admin' },
  { key: 'config', label: 'Configuration', icon: '🎨', group: 'admin' },
  { key: 'logs', label: 'Activity Logs', icon: '📋', group: 'admin' },
];

const ALL_MODULE_KEYS = MODULE_LIST.map(m => m.key);

const PLAN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  trial: { bg: '#fef3c7', text: '#92400e', label: '🧪 Trial' },
  starter: { bg: '#dbeafe', text: '#1e40af', label: '🚀 Starter' },
  business: { bg: '#d1fae5', text: '#065f46', label: '💼 Business' },
  enterprise: { bg: '#ede9fe', text: '#5b21b6', label: '👑 Enterprise' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#166534' },
  suspended: { bg: '#fee2e2', text: '#991b1b' },
  trial: { bg: '#fef3c7', text: '#92400e' },
  expired: { bg: '#f3f4f6', text: '#6b7280' },
};

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ type: string; tenant: any } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', slug: '', owner_name: '', owner_email: '', owner_phone: '',
    plan: 'trial', max_users: 5, max_outlets: 1, max_products: 500, admin_password: 'admin123',
    monthly_price: 0, setup_fee: 0, per_outlet_fee: 0,
    allowed_modules: [...ALL_MODULE_KEYS],
  });

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/super/dashboard');
      if (res.data.success) {
        setGlobal(res.data.data.global);
        setTenants(res.data.data.tenants);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadTenantDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/super/tenants/${id}`);
      if (res.data.success) setSelectedTenant(res.data.data);
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const resetForm = () => setForm({
    name: '', slug: '', owner_name: '', owner_email: '', owner_phone: '',
    plan: 'trial', max_users: 5, max_outlets: 1, max_products: 500, admin_password: 'admin123',
    monthly_price: 0, setup_fee: 0, per_outlet_fee: 0,
    allowed_modules: [...ALL_MODULE_KEYS],
  });

  const createTenant = async () => {
    if (!form.name || !form.slug || !form.owner_email) { alert('Name, slug, and owner email are required'); return; }
    setActionLoading(true);
    try {
      const res = await api.post('/super/tenants', form);
      if (res.data.success) { setShowCreate(false); resetForm(); loadDashboard(); }
    } catch (err: any) { alert(err.response?.data?.message || 'Create failed'); }
    finally { setActionLoading(false); }
  };

  const updateTenantStatus = async (id: number, status: string) => {
    try {
      await api.put(`/super/tenants/${id}/status`, { status });
      loadDashboard();
      if (selectedTenant?.tenant?.id === id) loadTenantDetail(id);
    } catch (err: any) { alert(err.response?.data?.message || 'Update failed'); }
  };

  const updateModules = async (id: number, modules: string[]) => {
    try {
      await api.put(`/super/tenants/${id}/modules`, { allowed_modules: modules });
      loadDashboard();
      if (selectedTenant?.tenant?.id === id) loadTenantDetail(id);
    } catch (err: any) { alert(err.response?.data?.message || 'Update failed'); }
  };

  const resetTenantData = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/super/tenants/${id}/reset`);
      if (res.data.success) { alert(res.data.message); loadDashboard(); setShowConfirm(null); if (selectedTenant?.tenant?.id === id) loadTenantDetail(id); }
    } catch (err: any) { alert(err.response?.data?.message || 'Reset failed'); }
    finally { setActionLoading(false); }
  };

  const deleteTenant = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await api.delete(`/super/tenants/${id}`);
      if (res.data.success) { alert('Business deleted permanently'); setSelectedTenant(null); setShowConfirm(null); loadDashboard(); }
    } catch (err: any) { alert(err.response?.data?.message || 'Delete failed'); }
    finally { setActionLoading(false); }
  };

  const fmt = (n: number) => `৳${Number(n || 0).toLocaleString()}`;
  const storagePercent = (used: number, limit: number) => limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  const toggleModule = (key: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  };

  // Module checkbox grid component
  const ModuleCheckboxGrid = ({ selected, onChange }: { selected: string[]; onChange: (modules: string[]) => void }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">📦 Allowed Modules ({selected.length}/{ALL_MODULE_KEYS.length})</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange([...ALL_MODULE_KEYS])} className="text-xs text-blue-600 font-semibold hover:underline">Select All</button>
          <button type="button" onClick={() => onChange(['dashboard'])} className="text-xs text-red-500 font-semibold hover:underline">Minimal</button>
        </div>
      </div>
      <div className="mb-2">
        <p className="text-xs text-gray-400 font-semibold mb-1">Main Menu</p>
        <div className="grid grid-cols-3 gap-1">
          {MODULE_LIST.filter(m => m.group === 'main').map(m => (
            <label key={m.key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all border ${selected.includes(m.key) ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggleModule(m.key, selected, onChange)} className="w-3 h-3 accent-blue-600" />
              <span>{m.icon}</span>
              <span className="truncate">{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 font-semibold mb-1">Admin Modules</p>
        <div className="grid grid-cols-3 gap-1">
          {MODULE_LIST.filter(m => m.group === 'admin').map(m => (
            <label key={m.key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-all border ${selected.includes(m.key) ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
              <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggleModule(m.key, selected, onChange)} className="w-3 h-3 accent-purple-600" />
              <span>{m.icon}</span>
              <span className="truncate">{m.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-semibold">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── TENANT DETAIL VIEW ──────────────────────────
  if (selectedTenant) {
    const t = selectedTenant.tenant;
    const s = selectedTenant.stats;
    const plan = PLAN_COLORS[t.plan] || PLAN_COLORS.trial;
    const statusColor = STATUS_COLORS[t.status] || STATUS_COLORS.trial;
    const tenantModules: string[] = Array.isArray(t.allowed_modules) ? t.allowed_modules : ALL_MODULE_KEYS;

    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <button onClick={() => setSelectedTenant(null)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition">
          ← Back to All Businesses
        </button>

        {/* Tenant Header */}
        <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1e1b4b, #4338ca)' }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'Barlow Condensed' }}>{t.name}</h1>
              <p className="text-indigo-200 text-sm mt-1">/{t.slug} • {t.owner_email} • {t.owner_phone}</p>
              <div className="flex gap-2 mt-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: plan.bg, color: plan.text }}>{plan.label}</span>
                <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: statusColor.bg, color: statusColor.text }}>{t.status.toUpperCase()}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-indigo-200 text-xs">Revenue</p>
              <p className="text-3xl font-black">{fmt(s.total_revenue)}</p>
              {t.monthly_price > 0 && <p className="text-indigo-300 text-xs mt-1">{fmt(t.monthly_price)}/mo subscription</p>}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Users', value: s.total_users, max: t.max_users, icon: '👥' },
            { label: 'Products', value: s.total_products, max: t.max_products, icon: '📦' },
            { label: 'Sales', value: s.total_sales, icon: '🧾' },
            { label: 'Customers', value: s.total_customers, icon: '🤝' },
            { label: 'Outlets', value: s.total_outlets, max: t.max_outlets, icon: '🏪' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-2xl mb-1">{card.icon}</p>
              <p className="text-lg font-black text-gray-900">{card.value}{card.max ? <span className="text-xs text-gray-400">/{card.max}</span> : ''}</p>
              <p className="text-xs text-gray-500 font-semibold">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Module Permissions */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-gray-900 mb-3" style={{ fontFamily: 'Barlow Condensed' }}>📦 Module Permissions</h3>
          <ModuleCheckboxGrid selected={tenantModules} onChange={(modules) => updateModules(t.id, modules)} />
          <p className="text-xs text-gray-400 mt-2">Changes save automatically when you check/uncheck modules.</p>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-gray-900 mb-3" style={{ fontFamily: 'Barlow Condensed' }}>👥 Users ({selectedTenant.users?.length})</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-xs"><th className="text-left py-2">Name</th><th className="text-left">Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {(selectedTenant.users || []).map((u: any) => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="py-2 font-semibold">{u.name}</td>
                  <td className="text-gray-600">{u.email}</td>
                  <td className="text-center"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{u.role}</span></td>
                  <td className="text-center text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border-2 border-red-200 p-5">
          <h3 className="font-bold text-red-700 mb-4" style={{ fontFamily: 'Barlow Condensed' }}>⚠️ DANGER ZONE</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {t.status === 'active' ? (
              <button onClick={() => setShowConfirm({ type: 'suspend', tenant: t })}
                className="py-3 px-4 rounded-xl bg-orange-50 border-2 border-orange-200 text-orange-700 font-bold text-sm hover:bg-orange-100 transition">
                ⏸ Suspend Business
              </button>
            ) : (
              <button onClick={() => updateTenantStatus(t.id, 'active')}
                className="py-3 px-4 rounded-xl bg-green-50 border-2 border-green-200 text-green-700 font-bold text-sm hover:bg-green-100 transition">
                ▶ Activate Business
              </button>
            )}
            <button onClick={() => setShowConfirm({ type: 'reset', tenant: t })}
              className="py-3 px-4 rounded-xl bg-yellow-50 border-2 border-yellow-200 text-yellow-700 font-bold text-sm hover:bg-yellow-100 transition">
              🔄 Reset All Data
            </button>
            <button onClick={() => setShowConfirm({ type: 'delete', tenant: t })}
              className="py-3 px-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-700 font-bold text-sm hover:bg-red-100 transition">
              🗑 Delete Business
            </button>
          </div>
        </div>

        {/* Confirm Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <p className="text-4xl mb-2">{showConfirm.type === 'delete' ? '🗑' : showConfirm.type === 'reset' ? '🔄' : '⏸'}</p>
                <h3 className="text-lg font-bold text-gray-900">
                  {showConfirm.type === 'delete' ? 'Delete Business Permanently?' :
                   showConfirm.type === 'reset' ? 'Reset All Business Data?' : 'Suspend Business?'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  <strong>{showConfirm.tenant.name}</strong> — This action {showConfirm.type === 'delete' ? 'cannot be undone' : 'will clear all transactional data'}.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-2.5 rounded-xl border font-semibold">Cancel</button>
                <button disabled={actionLoading}
                  onClick={() => {
                    if (showConfirm.type === 'delete') deleteTenant(showConfirm.tenant.id);
                    else if (showConfirm.type === 'reset') resetTenantData(showConfirm.tenant.id);
                    else { updateTenantStatus(showConfirm.tenant.id, 'suspended'); setShowConfirm(null); }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50">
                  {actionLoading ? '⏳...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN DASHBOARD VIEW ─────────────────────────
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Barlow Condensed' }}>🛡️ SUPER ADMIN</h1>
          <p className="text-sm text-gray-500">Manage all businesses from one place</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition shadow-lg">
          + New Business
        </button>
      </div>

      {/* Global Stats */}
      {global && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Businesses', value: global.total_tenants, icon: '🏢', color: '#4338ca' },
            { label: 'Active', value: global.active_tenants, icon: '✅', color: '#059669' },
            { label: 'Total Users', value: global.total_users, icon: '👥', color: '#2563eb' },
            { label: 'Total Sales', value: global.total_sales.toLocaleString(), icon: '🧾', color: '#ea580c' },
            { label: 'Total Revenue', value: fmt(global.total_revenue), icon: '💰', color: '#7c3aed' },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl p-4 text-white shadow-lg" style={{ background: stat.color }}>
              <p className="text-2xl">{stat.icon}</p>
              <p className="text-xl font-black mt-1">{stat.value}</p>
              <p className="text-xs opacity-80 font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tenant Cards */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3" style={{ fontFamily: 'Barlow Condensed' }}>📋 ALL BUSINESSES ({tenants.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenants.map(t => {
            const plan = PLAN_COLORS[t.plan] || PLAN_COLORS.trial;
            const statusColor = STATUS_COLORS[t.status] || STATUS_COLORS.trial;
            const storePct = storagePercent(t.storage_estimate_mb, t.storage_limit_mb);
            const moduleCount = Array.isArray(t.allowed_modules) ? t.allowed_modules.length : ALL_MODULE_KEYS.length;

            return (
              <div key={t.id} onClick={() => loadTenantDetail(t.id)}
                className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:shadow-xl hover:border-indigo-300 transition-all group">

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-gray-900 truncate group-hover:text-indigo-600 transition">{t.name}</h3>
                    <p className="text-xs text-gray-400 truncate">{t.owner_email}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 ml-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: plan.bg, color: plan.text }}>{plan.label}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: statusColor.bg, color: statusColor.text }}>{t.status}</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-black text-gray-900">{t.total_users}</p>
                    <p className="text-xs text-gray-400">Users</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-black text-gray-900">{t.total_products}</p>
                    <p className="text-xs text-gray-400">Products</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-black text-gray-900">{t.total_sales}</p>
                    <p className="text-xs text-gray-400">Sales</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-black text-gray-900">{moduleCount}</p>
                    <p className="text-xs text-gray-400">Modules</p>
                  </div>
                </div>

                {/* Revenue & Pricing */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 font-semibold">Revenue</span>
                  <span className="text-sm font-black text-green-600">{fmt(t.total_revenue)}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-semibold">Subscription</span>
                  <span className="text-xs font-bold text-indigo-600">
                    {t.monthly_price > 0 ? `${fmt(t.monthly_price)}/mo` : 'Free'}
                    {t.per_outlet_fee > 0 ? ` + ${fmt(t.per_outlet_fee)}/outlet` : ''}
                  </span>
                </div>

                {/* Bandwidth Bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400 font-semibold">Bandwidth</span>
                    <span className="text-xs font-bold text-gray-500">{t.storage_estimate_mb} / {t.storage_limit_mb} MB</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${storePct}%`, background: storePct > 80 ? '#dc2626' : storePct > 50 ? '#f59e0b' : '#059669' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Created {new Date(t.created_at).toLocaleDateString('en-GB')}</span>
                  <span className="text-xs text-indigo-500 font-bold group-hover:text-indigo-700">View Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Business Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Barlow Condensed' }}>🏢 Create New Business</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Business Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="My Business" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">URL Slug *</label>
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder="my-business" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Owner Name</label>
                  <input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Owner Email *</label>
                  <input value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="admin@business.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Phone</label>
                  <input value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="+880 1700-000000" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Admin Password</label>
                  <input value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="admin123" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Plan</label>
                  <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                    <option value="trial">🧪 Trial</option>
                    <option value="starter">🚀 Starter</option>
                    <option value="business">💼 Business</option>
                    <option value="enterprise">👑 Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Max Users</label>
                  <input type="number" value={form.max_users} onChange={e => setForm({ ...form, max_users: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" min={1} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Max Outlets</label>
                  <input type="number" value={form.max_outlets} onChange={e => setForm({ ...form, max_outlets: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" min={1} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Max Products</label>
                  <input type="number" value={form.max_products} onChange={e => setForm({ ...form, max_products: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" min={10} />
                </div>
              </div>

              {/* Subscription Pricing */}
              <div className="pt-3 border-t">
                <p className="text-xs font-bold text-gray-700 mb-2">💰 Subscription Pricing</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Monthly Price (৳)</label>
                    <input type="number" value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg text-sm" min={0} step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Setup Fee (৳)</label>
                    <input type="number" value={form.setup_fee} onChange={e => setForm({ ...form, setup_fee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg text-sm" min={0} step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Per Outlet/mo (৳)</label>
                    <input type="number" value={form.per_outlet_fee} onChange={e => setForm({ ...form, per_outlet_fee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg text-sm" min={0} step="0.01" />
                  </div>
                </div>
              </div>

              {/* Module Selection */}
              <div className="pt-3 border-t">
                <ModuleCheckboxGrid
                  selected={form.allowed_modules}
                  onChange={(modules) => setForm({ ...form, allowed_modules: modules })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border font-semibold text-gray-500">Cancel</button>
              <button onClick={createTenant} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700 transition">
                {actionLoading ? '⏳ Creating...' : '🏢 Create Business'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../../services/api';

const ACTION_ICONS: Record<string, string> = {
  sale_created: '🛒', sale_deleted: '🗑️', stock_in: '📦', stock_adjust: '⚙️',
  deposit: '🏦', bank_deposit_admin: '🏦', cash_set_opening: '💵', cash_add: '💵', cash_withdraw: '💵',
  credit_assign_credit: '📝', credit_collect_credit: '💰', login: '🔑', logout: '🚪',
  user_created: '👤', user_updated: '✏️', user_deactivated: '🚫', outlet_created: '🏪',
  stock_request: '📦', pending_approved: '✅', pending_rejected: '❌', bank_account_created: '🏦',
  transfer_created: '🚚', payment_received: '💰',
};

const ACTION_COLORS: Record<string, string> = {
  sale_created: '#16a34a', sale_deleted: '#dc2626', stock_in: '#2563eb', deposit: '#7c3aed',
  cash_add: '#16a34a', cash_withdraw: '#dc2626', cash_set_opening: '#ea580c',
  credit_assign_credit: '#ea580c', credit_collect_credit: '#16a34a',
  bank_deposit_admin: '#7c3aed', login: '#6b7280', bank_account_created: '#2563eb',
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [logUsers, setLogUsers] = useState<any[]>([]);

  // Filters
  const [fUser, setFUser] = useState('');
  const [fAction, setFAction] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fSearch, setFSearch] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [lRes, sRes, aRes, uRes] = await Promise.all([
        api.get('/logs', { params: buildParams() }),
        api.get('/logs/summary'),
        api.get('/logs/actions'),
        api.get('/logs/users'),
      ]);
      if (lRes.data.success) setLogs(lRes.data.data || []);
      if (sRes.data.success) setSummary(sRes.data.data);
      if (aRes.data.success) setActionTypes(aRes.data.data || []);
      if (uRes.data.success) setLogUsers(uRes.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const buildParams = () => {
    const p: any = {};
    if (fUser) p.user_id = fUser;
    if (fAction) p.action = fAction;
    if (fStart) p.start_date = fStart;
    if (fEnd) p.end_date = fEnd;
    if (fSearch) p.search = fSearch;
    return p;
  };

  const applyFilter = async () => {
    setLoading(true);
    try {
      const r = await api.get('/logs', { params: buildParams() });
      if (r.data.success) setLogs(r.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const clearFilters = () => {
    setFUser(''); setFAction(''); setFStart(''); setFEnd(''); setFSearch('');
    loadAll();
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Activity Logs</h1>
          <p className="page-subtitle">Track all system actions across users and outlets</p>
        </div>
        {summary && (
          <div className="flex items-center gap-3">
            <div className="power-card px-4 py-2 text-center">
              <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Today</p>
              <p className="text-lg font-black" style={{ fontFamily: 'Barlow Condensed', color: 'var(--primary)' }}>{summary.today}</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top actions */}
          <div className="power-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>🔥 Top Actions (7 days)</h3>
            <div className="space-y-2">
              {(summary.actions || []).slice(0, 8).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ACTION_ICONS[a.action] || '📌'}</span>
                    <span className="text-xs font-medium">{a.action.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{a.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top users */}
          <div className="power-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>👥 Most Active Users</h3>
            <div className="space-y-2">
              {(summary.users || []).slice(0, 8).map((u: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{u.user_name?.charAt(0)}</div>
                    <span className="text-xs font-medium">{u.user_name}</span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{u.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top outlets */}
          <div className="power-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>🏪 Most Active Outlets</h3>
            <div className="space-y-2">
              {(summary.outlets || []).length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No outlet activity</p>}
              {(summary.outlets || []).slice(0, 8).map((o: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-medium">🏪 {o.outlet_name || `Outlet #${o.outlet_id}`}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{o.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="power-card p-4">
        <div className="flex gap-2 md:gap-3 flex-wrap items-end">
          <div>
            <label className="power-label">User</label>
            <select value={fUser} onChange={e => setFUser(e.target.value)} className="power-input py-1.5 text-xs w-36">
              <option value="">All Users</option>
              {logUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.user_name}</option>)}
            </select>
          </div>
          <div>
            <label className="power-label">Action</label>
            <select value={fAction} onChange={e => setFAction(e.target.value)} className="power-input py-1.5 text-xs w-40">
              <option value="">All Actions</option>
              {actionTypes.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="power-label">From</label>
            <input type="date" value={fStart} onChange={e => setFStart(e.target.value)} className="power-input py-1.5 text-xs" />
          </div>
          <div>
            <label className="power-label">To</label>
            <input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} className="power-input py-1.5 text-xs" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="power-label">Search</label>
            <input value={fSearch} onChange={e => setFSearch(e.target.value)} className="power-input py-1.5 text-xs" placeholder="🔍 Description, user..." />
          </div>
          <button onClick={applyFilter} className="btn-power text-xs py-1.5 px-3">🔍 Filter</button>
          <button onClick={clearFilters} className="btn-ghost text-xs py-1.5 px-3">Clear</button>
        </div>
      </div>

      {/* Logs list */}
      <div className="power-card overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📋 Activity ({logs.length})</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">No activity logs found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
                  style={{ background: (ACTION_COLORS[log.action] || '#6b7280') + '15', color: ACTION_COLORS[log.action] || '#6b7280' }}>
                  {ACTION_ICONS[log.action] || '📌'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: (ACTION_COLORS[log.action] || '#6b7280') + '15', color: ACTION_COLORS[log.action] || '#6b7280' }}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    {log.entity_type && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}</span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{log.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {log.user_name && <span>👤 {log.user_name}</span>}
                    {log.outlet_name && <span>🏪 {log.outlet_name}</span>}
                    <span>{new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {log.ip_address && <span className="font-mono">{log.ip_address}</span>}
                  </div>
                </div>

                {/* Time */}
                <div className="text-xs whitespace-nowrap flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(log.created_at).toLocaleDateString('en-GB')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

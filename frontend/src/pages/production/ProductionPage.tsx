import { useState, useEffect } from 'react';
import api from '../../services/api';
import { productsAPI } from '../../services/api';

type View = 'dashboard' | 'pipelines' | 'order_detail' | 'pipeline_edit';

export default function ProductionPage() {
  const [view, setView] = useState<View>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Order detail
  const [orderDetail, setOrderDetail] = useState<any>(null);
  // Pipeline edit
  const [pipelineDetail, setPipelineDetail] = useState<any>(null);
  const [pipelineForm, setPipelineForm] = useState<any>({ name: '', description: '', final_product_id: '', default_quantity: 1, stages: [] });
  // Modals
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showStageAction, setShowStageAction] = useState<any>(null); // {type:'start'|'complete'|'extend', stage}
  const [showComplete, setShowComplete] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [orderForm, setOrderForm] = useState<any>({ pipeline_id: '', quantity: '', notes: '' });
  const [stageForm, setStageForm] = useState<any>({ days: '', cost: '', quantity: '', notes: '', extra_days: '' });
  const [completeForm, setCompleteForm] = useState<any>({ sale_price: '', notes: '', additional_costs: [{ description: '', amount: '' }] });
  const [costForm, setCostForm] = useState<any>({ description: '', amount: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dRes, pRes, oRes, prRes] = await Promise.all([
        api.get('/production/dashboard'),
        api.get('/production/pipelines'),
        api.get('/production/orders'),
        productsAPI.getAll(),
      ]);
      if (dRes.data.success) setDashboard(dRes.data.data);
      if (pRes.data.success) setPipelines(pRes.data.data || []);
      if (oRes.data.success) setOrders(oRes.data.data || []);
      if (prRes.data.success) setProducts(prRes.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  const loadOrder = async (id: number) => {
    try { const r = await api.get(`/production/orders/${id}`); if (r.data.success) { setOrderDetail(r.data.data); setView('order_detail'); } }
    catch { alert('Failed'); }
  };

  const loadPipeline = async (id: number) => {
    try {
      const r = await api.get(`/production/pipelines/${id}`);
      if (r.data.success) {
        const p = r.data.data;
        setPipelineDetail(p);
        setPipelineForm({ name: p.name, description: p.description || '', final_product_id: p.final_product_id || '', default_quantity: p.default_quantity || 1, stages: p.stages || [] });
        setView('pipeline_edit');
      }
    } catch { alert('Failed'); }
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;

  // ── Pipeline CRUD ─────────────────────────────────────────
  const openNewPipeline = () => {
    setPipelineDetail(null);
    setPipelineForm({ name: '', description: '', final_product_id: '', default_quantity: 1, stages: [{ name: '', default_days: 1, default_cost: 0, default_quantity: '', output_product_id: '', output_quantity: '', description: '' }] });
    setView('pipeline_edit');
  };

  const addStage = () => setPipelineForm((f: any) => ({ ...f, stages: [...f.stages, { name: '', default_days: 1, default_cost: 0, default_quantity: '', output_product_id: '', output_quantity: '', description: '' }] }));
  const removeStage = (idx: number) => setPipelineForm((f: any) => ({ ...f, stages: f.stages.filter((_: any, i: number) => i !== idx) }));
  const updateStage = (idx: number, key: string, val: any) => setPipelineForm((f: any) => { const s = [...f.stages]; s[idx] = { ...s[idx], [key]: val }; return { ...f, stages: s }; });

  const savePipeline = async () => {
    if (!pipelineForm.name || !pipelineForm.stages.length) { alert('Name and at least 1 stage required'); return; }
    setSaving(true);
    try {
      if (pipelineDetail) await api.put(`/production/pipelines/${pipelineDetail.id}`, pipelineForm);
      else await api.post('/production/pipelines', pipelineForm);
      setView('pipelines'); loadAll();
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Order CRUD ────────────────────────────────────────────
  const createOrder = async () => {
    if (!orderForm.pipeline_id) { alert('Select a pipeline'); return; }
    setSaving(true);
    try {
      const r = await api.post('/production/orders', orderForm);
      if (r.data.success) { setShowNewOrder(false); loadAll(); loadOrder(r.data.id); }
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── Stage actions ─────────────────────────────────────────
  const startStage = async () => {
    if (!showStageAction) return;
    setSaving(true);
    try {
      await api.post(`/production/orders/${orderDetail.id}/stages/${showStageAction.stage.id}/start`, {
        days: stageForm.days || undefined, cost: stageForm.cost || undefined, quantity: stageForm.quantity || undefined,
      });
      setShowStageAction(null); loadOrder(orderDetail.id);
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const completeStage = async () => {
    if (!showStageAction) return;
    setSaving(true);
    try {
      const r = await api.post(`/production/orders/${orderDetail.id}/stages/${showStageAction.stage.id}/complete`, {
        actual_cost: stageForm.cost || undefined, actual_days: stageForm.days || undefined, notes: stageForm.notes || undefined,
      });
      setShowStageAction(null);
      if (r.data.success) {
        alert(r.data.message);
        if (r.data.all_done) setShowComplete(true);
      }
      loadOrder(orderDetail.id);
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const extendStage = async () => {
    if (!showStageAction || !stageForm.extra_days) return;
    try {
      await api.post(`/production/orders/${orderDetail.id}/stages/${showStageAction.stage.id}/extend`, { extra_days: stageForm.extra_days });
      setShowStageAction(null); loadOrder(orderDetail.id);
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const completeOrder = async () => {
    setSaving(true);
    try {
      const r = await api.post(`/production/orders/${orderDetail.id}/complete`, completeForm);
      if (r.data.success) { alert(r.data.message); setShowComplete(false); loadOrder(orderDetail.id); loadAll(); }
    } catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const addCost = async () => {
    if (!costForm.description || !costForm.amount) return;
    try { await api.post(`/production/orders/${orderDetail.id}/costs`, costForm); setCostForm({ description: '', amount: '' }); setShowAddCost(false); loadOrder(orderDetail.id); }
    catch (e: any) { alert(e.response?.data?.message || 'Failed'); }
  };

  const removeCost = async (costId: number) => {
    try { await api.delete(`/production/orders/${orderDetail.id}/costs/${costId}`); loadOrder(orderDetail.id); } catch {}
  };

  const STATUS_COLORS: any = { pending: { bg: '#fef3c7', color: '#92400e' }, in_progress: { bg: '#dbeafe', color: '#1e40af' }, completed: { bg: '#dcfce7', color: '#166534' }, cancelled: { bg: '#fee2e2', color: '#991b1b' }, skipped: { bg: '#f3f4f6', color: '#6b7280' } };
  const getStageProgress = (stages: any[]) => { const done = stages.filter(s => s.status === 'completed').length; return stages.length ? Math.round((done / stages.length) * 100) : 0; };

  if (loading) return <div className="space-y-5"><div className="power-card animate-pulse" style={{ height: 200 }} /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">🏭 Production</h1>
          <p className="page-subtitle">Manufacturing pipeline & order tracking</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {view !== 'dashboard' && <button onClick={() => { setView('dashboard'); loadAll(); }} className="btn-ghost text-xs py-2 px-3">← Dashboard</button>}
          <button onClick={() => setView('pipelines')} className={`btn-outline text-xs py-2 px-3 ${view === 'pipelines' ? 'ring-2' : ''}`}>📋 Pipelines</button>
          <button onClick={() => setShowNewOrder(true)} className="btn-power text-xs py-2 px-3">+ New Production</button>
        </div>
      </div>

      {/* ─── DASHBOARD ──────────────────────────────── */}
      {view === 'dashboard' && (
        <div className="space-y-5">
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Active', value: dashboard.active_orders, icon: '⚙️', bg: '#dbeafe', color: '#1e40af' },
                { label: 'Pending', value: dashboard.pending_orders, icon: '⏳', bg: '#fef3c7', color: '#92400e' },
                { label: 'Completed', value: dashboard.completed_orders, icon: '✅', bg: '#dcfce7', color: '#166534' },
                { label: 'Overdue Stages', value: dashboard.overdue_stages, icon: '⚠️', bg: dashboard.overdue_stages > 0 ? '#fef2f2' : '#f9fafb', color: dashboard.overdue_stages > 0 ? '#dc2626' : '#6b7280' },
                { label: 'Total Cost', value: fmt(dashboard.total_production_cost), icon: '💰', bg: '#faf5ff', color: '#7c3aed' },
              ].map((c, i) => (
                <div key={i} className="stat-card flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: c.bg }}>{c.icon}</div>
                  <div><p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                    <p className="text-lg font-black" style={{ fontFamily: 'Barlow Condensed', color: c.color }}>{c.value}</p></div>
                </div>
              ))}
            </div>
          )}

          {/* Orders list */}
          <div className="power-card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🏭 Production Orders</h3>
            </div>
            {orders.length === 0 ? <p className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No production orders yet</p> : (
              <div className="divide-y">
                {orders.map(o => (
                  <div key={o.id} className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => loadOrder(o.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.color }}>
                        {o.status === 'in_progress' ? `${o.current_stage}/${o.total_stages}` : o.status === 'completed' ? '✅' : '⏳'}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{o.order_number}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.pipeline_name} · {o.quantity} units · {o.final_product_name || 'No product'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[o.status]?.bg, color: STATUS_COLORS[o.status]?.color }}>{o.status.replace('_', ' ')}</span>
                      {o.active_stage_name && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>🔧 {o.active_stage_name}</p>}
                      {o.total_cost > 0 && <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{fmt(o.total_cost)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PIPELINES LIST ─────────────────────────── */}
      {view === 'pipelines' && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={openNewPipeline} className="btn-power text-xs py-2 px-3">+ New Pipeline</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map(p => (
              <div key={p.id} className="power-card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadPipeline(p.id)}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">🏭</span>
                  <div><p className="font-bold text-sm">{p.name}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.stage_count} stages · {p.order_count} orders</p></div>
                </div>
                {p.final_product_name && <p className="text-xs px-2 py-0.5 rounded-full inline-block" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>📦 {p.final_product_name}</p>}
              </div>
            ))}
            {pipelines.length === 0 && <div className="power-card p-8 text-center col-span-3" style={{ color: 'var(--text-muted)' }}><p className="text-3xl mb-2">🏭</p><p>No pipelines yet</p></div>}
          </div>
        </div>
      )}

      {/* ─── PIPELINE EDITOR ────────────────────────── */}
      {view === 'pipeline_edit' && (
        <div className="space-y-5 max-w-3xl mx-auto">
          <div className="power-card p-6">
            <h3 className="font-bold text-lg mb-4" style={{ fontFamily: 'Barlow Condensed' }}>{pipelineDetail ? '✏️ Edit Pipeline' : '🏭 New Pipeline'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div><label className="power-label">Pipeline Name *</label><input value={pipelineForm.name} onChange={e => setPipelineForm((f: any) => ({ ...f, name: e.target.value }))} className="power-input" placeholder="LPG ATG Device Production" /></div>
              <div><label className="power-label">Final Product</label>
                <select value={pipelineForm.final_product_id} onChange={e => setPipelineForm((f: any) => ({ ...f, final_product_id: e.target.value }))} className="power-input">
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                </select>
              </div>
              <div><label className="power-label">Default Quantity</label><input type="number" value={pipelineForm.default_quantity} onChange={e => setPipelineForm((f: any) => ({ ...f, default_quantity: e.target.value }))} className="power-input" min="1" /></div>
              <div><label className="power-label">Description</label><input value={pipelineForm.description} onChange={e => setPipelineForm((f: any) => ({ ...f, description: e.target.value }))} className="power-input" /></div>
            </div>

            {/* Stages */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>📋 Stages ({pipelineForm.stages.length})</h4>
              <button onClick={addStage} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>+ Add Stage</button>
            </div>

            <div className="space-y-3">
              {pipelineForm.stages.map((s: any, idx: number) => (
                <div key={idx} className="rounded-xl p-4 relative" style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-black w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--primary)' }}>{idx + 1}</span>
                    <input value={s.name} onChange={e => updateStage(idx, 'name', e.target.value)} className="power-input flex-1 text-sm font-bold" placeholder="Stage name (e.g. PCB Design)" />
                    <button onClick={() => removeStage(idx)} className="text-red-500 text-sm p-1">✕</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div><label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Days</label><input type="number" value={s.default_days} onChange={e => updateStage(idx, 'default_days', e.target.value)} className="power-input text-xs" min="1" /></div>
                    <div><label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Cost (৳)</label><input type="number" value={s.default_cost} onChange={e => updateStage(idx, 'default_cost', e.target.value)} className="power-input text-xs" min="0" /></div>
                    <div><label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Pcs</label><input type="number" value={s.default_quantity || ''} onChange={e => updateStage(idx, 'default_quantity', e.target.value)} className="power-input text-xs" placeholder="Same" /></div>
                    <div><label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Output Product</label>
                      <select value={s.output_product_id || ''} onChange={e => updateStage(idx, 'output_product_id', e.target.value)} className="power-input text-xs">
                        <option value="">None</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                      </select>
                    </div>
                  </div>
                  {s.output_product_id && (
                    <div className="mt-2"><label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Output Qty</label>
                      <input type="number" value={s.output_quantity || ''} onChange={e => updateStage(idx, 'output_quantity', e.target.value)} className="power-input text-xs w-24" min="1" /></div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setView('pipelines')} className="btn-ghost flex-1">Cancel</button>
              <button onClick={savePipeline} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Saving...' : '💾 Save Pipeline'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ORDER DETAIL ───────────────────────────── */}
      {view === 'order_detail' && orderDetail && (() => {
        const od = orderDetail;
        const progress = getStageProgress(od.stages || []);
        return (
        <div className="space-y-5 max-w-4xl mx-auto">
          {/* Header */}
          <div className="power-card p-5" style={{ borderLeft: `4px solid ${STATUS_COLORS[od.status]?.color || 'var(--primary)'}` }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black" style={{ fontFamily: 'Barlow Condensed' }}>{od.order_number}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{od.pipeline_name} · {od.quantity} units → {od.final_product_name || 'No product'}</p>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: STATUS_COLORS[od.status]?.bg, color: STATUS_COLORS[od.status]?.color }}>{od.status.replace('_', ' ')}</span>
                {od.status === 'in_progress' && progress === 100 && (
                  <button onClick={() => { setCompleteForm({ sale_price: od.final_sale_price || '', notes: '', additional_costs: [{ description: '', amount: '' }] }); setShowComplete(true); }} className="btn-power text-xs py-1.5 px-3">🏁 Complete Production</button>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                <span className="font-bold" style={{ color: 'var(--primary)' }}>{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--card-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : 'var(--primary)' }} />
              </div>
            </div>
          </div>

          {/* Cost summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Production Cost', value: fmt(od.total_production_cost), color: '#2563eb' },
              { label: 'Additional Cost', value: fmt(od.additional_cost), color: '#ea580c' },
              { label: 'Total Cost', value: fmt(od.total_cost), color: 'var(--primary)' },
              { label: 'Unit Cost', value: od.quantity > 0 ? fmt(od.total_cost / od.quantity) : fmt(0), color: '#7c3aed' },
            ].map((c, i) => (
              <div key={i} className="stat-card p-3 text-center">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p className="text-lg font-black" style={{ fontFamily: 'Barlow Condensed', color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Stages timeline */}
          <div className="power-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>📋 Production Stages</h3>
            <div className="space-y-3">
              {(od.stages || []).map((s: any, idx: number) => {
                const isOverdue = s.status === 'in_progress' && s.due_at && new Date(s.due_at) < new Date();
                return (
                  <div key={s.id} className="rounded-xl p-4 relative" style={{ background: s.status === 'completed' ? '#f0fdf4' : s.status === 'in_progress' ? (isOverdue ? '#fef2f2' : '#eff6ff') : 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black w-6 h-6 rounded-full flex items-center justify-center text-white"
                          style={{ background: s.status === 'completed' ? '#16a34a' : s.status === 'in_progress' ? '#2563eb' : '#9ca3af' }}>
                          {s.status === 'completed' ? '✓' : s.stage_order}
                        </span>
                        <span className="font-bold text-sm">{s.name}</span>
                        {s.output_product_name && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">→ {s.output_product_name} ×{s.output_quantity}</span>}
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[s.status]?.bg, color: STATUS_COLORS[s.status]?.color }}>
                        {s.status === 'in_progress' && isOverdue ? '⚠️ OVERDUE' : s.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span>📦 {s.quantity} pcs</span>
                      <span>📅 {s.status === 'completed' ? `${s.actual_days || s.estimated_days}d` : `${s.estimated_days}d est.`}</span>
                      <span>💰 {s.status === 'completed' ? fmt(s.actual_cost) : fmt(s.estimated_cost)}</span>
                      {s.started_at && <span>Started: {new Date(s.started_at).toLocaleDateString('en-GB')}</span>}
                      {s.due_at && s.status === 'in_progress' && <span className={isOverdue ? 'text-red-600 font-bold' : ''}>Due: {new Date(s.due_at).toLocaleDateString('en-GB')}</span>}
                      {s.completed_at && <span>Done: {new Date(s.completed_at).toLocaleDateString('en-GB')}</span>}
                    </div>

                    {/* Actions */}
                    {s.status === 'pending' && (idx === 0 || od.stages[idx - 1]?.status === 'completed') && od.status !== 'completed' && (
                      <button onClick={() => { setShowStageAction({ type: 'start', stage: s }); setStageForm({ days: s.estimated_days, cost: s.estimated_cost, quantity: s.quantity, notes: '', extra_days: '' }); }}
                        className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#2563eb' }}>▶ Start Stage</button>
                    )}
                    {s.status === 'in_progress' && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => { setShowStageAction({ type: 'complete', stage: s }); setStageForm({ days: '', cost: s.estimated_cost, quantity: s.quantity, notes: '', extra_days: '' }); }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: '#16a34a' }}>✅ Complete</button>
                        <button onClick={() => { setShowStageAction({ type: 'extend', stage: s }); setStageForm({ days: '', cost: '', quantity: '', notes: '', extra_days: '' }); }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700">⏰ Extend Time</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Costs */}
          <div className="power-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>💰 Additional Costs</h3>
              {od.status !== 'completed' && <button onClick={() => setShowAddCost(true)} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>+ Add Cost</button>}
            </div>
            {(od.additional_costs || []).length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No additional costs</p> : (
              <div className="divide-y">
                {od.additional_costs.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">{c.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{fmt(c.amount)}</span>
                      {od.status !== 'completed' && <button onClick={() => removeCost(c.id)} className="text-red-500 text-xs">✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ─── MODAL: NEW ORDER ───────────────────────── */}
      {showNewOrder && (
        <div className="modal-backdrop" onClick={() => setShowNewOrder(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>🏭 New Production Order</h3>
              <button onClick={() => setShowNewOrder(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="power-label">Pipeline *</label>
                <select value={orderForm.pipeline_id} onChange={e => setOrderForm((f: any) => ({ ...f, pipeline_id: e.target.value }))} className="power-input">
                  <option value="">Select pipeline</option>
                  {pipelines.map(p => <option key={p.id} value={p.id}>🏭 {p.name} ({p.stage_count} stages)</option>)}
                </select>
              </div>
              <div><label className="power-label">Quantity</label><input type="number" value={orderForm.quantity} onChange={e => setOrderForm((f: any) => ({ ...f, quantity: e.target.value }))} className="power-input" placeholder="Default from pipeline" min="1" /></div>
              <div><label className="power-label">Notes</label><textarea value={orderForm.notes} onChange={e => setOrderForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input resize-none" rows={2} /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowNewOrder(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={createOrder} disabled={saving} className="btn-power flex-1 justify-center">{saving ? 'Creating...' : '🏭 Start Production'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: STAGE ACTION ────────────────────── */}
      {showStageAction && (
        <div className="modal-backdrop" onClick={() => setShowStageAction(null)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>
                {showStageAction.type === 'start' ? '▶ Start' : showStageAction.type === 'complete' ? '✅ Complete' : '⏰ Extend'}: {showStageAction.stage.name}
              </h3>
              <button onClick={() => setShowStageAction(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {showStageAction.type === 'extend' ? (
                <div><label className="power-label">Extra Days Needed</label><input type="number" value={stageForm.extra_days} onChange={e => setStageForm((f: any) => ({ ...f, extra_days: e.target.value }))} className="power-input" min="1" placeholder="1" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="power-label">{showStageAction.type === 'complete' ? 'Actual Days' : 'Estimated Days'}</label><input type="number" value={stageForm.days} onChange={e => setStageForm((f: any) => ({ ...f, days: e.target.value }))} className="power-input" min="1" /></div>
                    <div><label className="power-label">{showStageAction.type === 'complete' ? 'Actual Cost (৳)' : 'Cost (৳)'}</label><input type="number" value={stageForm.cost} onChange={e => setStageForm((f: any) => ({ ...f, cost: e.target.value }))} className="power-input" min="0" /></div>
                  </div>
                  {showStageAction.type === 'start' && (
                    <div><label className="power-label">Quantity (pcs)</label><input type="number" value={stageForm.quantity} onChange={e => setStageForm((f: any) => ({ ...f, quantity: e.target.value }))} className="power-input" /></div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowStageAction(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={showStageAction.type === 'start' ? startStage : showStageAction.type === 'complete' ? completeStage : extendStage}
                disabled={saving} className="btn-power flex-1 justify-center"
                style={{ background: showStageAction.type === 'complete' ? '#16a34a' : showStageAction.type === 'extend' ? '#ea580c' : undefined }}>
                {saving ? 'Processing...' : showStageAction.type === 'start' ? '▶ Start' : showStageAction.type === 'complete' ? '✅ Complete' : '⏰ Extend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: COMPLETE ORDER (Stock-in form) ─── */}
      {showComplete && orderDetail && (
        <div className="modal-backdrop" onClick={() => setShowComplete(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem' }}>🏁 Complete Production — Stock In</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{orderDetail.order_number} · {orderDetail.quantity} units of {orderDetail.final_product_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
                <div className="flex justify-between"><span>Production Cost:</span><span className="font-bold">{fmt(orderDetail.total_production_cost)}</span></div>
                <div className="flex justify-between"><span>Additional Cost:</span><span className="font-bold">{fmt(orderDetail.additional_cost)}</span></div>
                <div className="flex justify-between border-t pt-1 font-black"><span>Total Cost:</span><span style={{ color: 'var(--primary)' }}>{fmt(parseFloat(orderDetail.total_production_cost) + parseFloat(orderDetail.additional_cost))}</span></div>
                <div className="flex justify-between"><span>Unit Cost (Purchase Price):</span><span className="font-bold text-blue-600">{fmt((parseFloat(orderDetail.total_production_cost) + parseFloat(orderDetail.additional_cost)) / (orderDetail.quantity || 1))}</span></div>
              </div>
              <div><label className="power-label">Sale Price (৳) per unit</label><input type="number" value={completeForm.sale_price} onChange={e => setCompleteForm((f: any) => ({ ...f, sale_price: e.target.value }))} className="power-input" placeholder="0" /></div>
              <div><label className="power-label">Notes</label><input value={completeForm.notes} onChange={e => setCompleteForm((f: any) => ({ ...f, notes: e.target.value }))} className="power-input" placeholder="Production notes..." /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowComplete(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={completeOrder} disabled={saving} className="btn-power flex-1 justify-center" style={{ background: '#16a34a' }}>
                {saving ? 'Processing...' : `✅ Complete & Add ${orderDetail.quantity} to Stock`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD COST ────────────────────────── */}
      {showAddCost && (
        <div className="modal-backdrop" onClick={() => setShowAddCost(false)}>
          <div className="modal-box max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed' }}>💰 Add Cost</h3>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="power-label">Description *</label><input value={costForm.description} onChange={e => setCostForm((f: any) => ({ ...f, description: e.target.value }))} className="power-input" placeholder="Shipping, testing..." /></div>
              <div><label className="power-label">Amount (৳) *</label><input type="number" value={costForm.amount} onChange={e => setCostForm((f: any) => ({ ...f, amount: e.target.value }))} className="power-input" min="0" /></div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowAddCost(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={addCost} className="btn-power flex-1 justify-center">💰 Add Cost</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

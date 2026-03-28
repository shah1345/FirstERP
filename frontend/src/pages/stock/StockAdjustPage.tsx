import { useState, useEffect } from 'react';
import { stockAPI } from '../../services/api';

export default function StockAdjustPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'remove' | 'set'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // FIFO modal
  const [showFIFO, setShowFIFO] = useState(false);
  const [fifoProduct, setFifoProduct] = useState<any>(null);
  const [fifoBatches, setFifoBatches] = useState<any[]>([]);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await stockAPI.getProductStock();
      if (res.data.success) {
        const d = res.data.data;
        setProducts(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAdjust = async (product: any) => {
    setAdjustProduct(product);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustReason('');
    setSelectedBatch(null);
    setBatches([]);
    try {
      const res = await stockAPI.getBatches(product.id);
      if (res.data.success) setBatches(res.data.data || []);
    } catch { }
    setShowAdjust(true);
  };

  const confirmAdjust = async () => {
    if (!selectedBatch || !adjustQty || !adjustReason.trim()) {
      alert('Please select batch, quantity and provide a reason');
      return;
    }
    setAdjusting(true);
    try {
      const res = await stockAPI.adjust({
        product_id: adjustProduct.id,
        batch_id: selectedBatch.id,
        adjustment_type: adjustType,
        quantity: parseInt(adjustQty),
        reason: adjustReason
      });
      if (res.data.success) {
        alert(`✅ ${res.data.message}`);
        setShowAdjust(false);
        loadProducts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Adjust failed');
    } finally {
      setAdjusting(false);
    }
  };

  const openHistory = async (product: any) => {
    setHistoryLoading(true);
    setHistoryData(null);
    setShowHistory(true);
    try {
      const res = await stockAPI.getHistory(product.id);
      if (res.data.success) setHistoryData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openFIFO = async (product: any) => {
    setFifoProduct(product);
    setFifoBatches([]);
    try {
      const res = await stockAPI.getBatches(product.id);
      if (res.data.success) setFifoBatches(res.data.data || []);
    } catch { }
    setShowFIFO(true);
  };

  const filtered = products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.model || '').toLowerCase().includes(q);
  });

  const getHistoryIcon = (type: string) => {
    const icons: any = { stock_in: '📦', sale: '🛒', return: '↩️', replaced_out: '🔄', replaced_in: '🔁', adjustment: '⚙️' };
    return icons[type] || '📌';
  };

  const getHistoryColor = (type: string) => {
    const colors: any = {
      stock_in: { bg: '#dcfce7', color: '#166534' },
      sale: { bg: '#dbeafe', color: '#1e40af' },
      return: { bg: '#fef3c7', color: '#92400e' },
      replaced_out: { bg: '#fce7f3', color: '#9d174d' },
      replaced_in: { bg: '#e0e7ff', color: '#3730a3' },
      adjustment: { bg: '#f3f4f6', color: '#374151' }
    };
    return colors[type] || { bg: '#f3f4f6', color: '#374151' };
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', fontFamily: 'Barlow Condensed, sans-serif' }}>
          ⚙️ Stock Management
        </h1>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="🔍 Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 400, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', marginBottom: 20 }}
      />

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No products found</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((p: any) => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111', margin: 0 }}>{p.product_name}</h3>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0 0' }}>{p.brand} {p.model}</p>
                </div>
                <div style={{
                  background: p.total_stock <= 0 ? '#fee2e2' : p.total_stock <= 5 ? '#fef3c7' : '#dcfce7',
                  color: p.total_stock <= 0 ? '#991b1b' : p.total_stock <= 5 ? '#92400e' : '#166534',
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700
                }}>
                  {p.total_stock} pcs
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', marginBottom: 12 }}>
                <span>{p.batch_count} batch(es)</span>
                <span>৳{Number(p.sale_price).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openFIFO(p)}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer' }}>
                  📊 FIFO
                </button>
                <button onClick={() => openHistory(p)}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, cursor: 'pointer' }}>
                  📜 History
                </button>
                <button onClick={() => openAdjust(p)}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, cursor: 'pointer' }}>
                  ⚙️ Adjust
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FIFO MODAL */}
      {showFIFO && fifoProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowFIFO(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>📊 FIFO Batches — {fifoProduct.product_name}</h3>
              <button onClick={() => setShowFIFO(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            {fifoBatches.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>No batches found</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Batch</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Purchase</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Sale</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Added</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Remaining</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Supplier</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {fifoBatches.map((b: any) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6', background: b.quantity_remaining <= 0 ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{b.batch_number}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>৳{Number(b.purchase_price).toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>৳{Number(b.sale_price || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{b.quantity_added}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: b.quantity_remaining <= 0 ? '#dc2626' : '#16a34a' }}>{b.quantity_remaining}</td>
                      <td style={{ padding: '8px', fontSize: '0.75rem' }}>{b.supplier_name || '-'}</td>
                      <td style={{ padding: '8px', fontSize: '0.75rem' }}>{new Date(b.created_at).toLocaleDateString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ADJUST MODAL */}
      {showAdjust && adjustProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowAdjust(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 4 }}>⚙️ Adjust Stock</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 20 }}>{adjustProduct.product_name} — {adjustProduct.brand} {adjustProduct.model}</p>

            {/* Select Batch */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Select Batch</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 180, overflow: 'auto' }}>
              {batches.map((b: any) => (
                <div key={b.id}
                  onClick={() => setSelectedBatch(b)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem',
                    border: selectedBatch?.id === b.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: selectedBatch?.id === b.id ? '#eff6ff' : '#fff'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{b.batch_number}</strong>
                    <span style={{ fontWeight: 700, color: b.quantity_remaining > 0 ? '#16a34a' : '#dc2626' }}>
                      {b.quantity_remaining} remaining
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>
                    Purchase: ৳{Number(b.purchase_price).toLocaleString()} • Added: {b.quantity_added} • {b.supplier_name || 'No supplier'}
                  </div>
                </div>
              ))}
              {batches.length === 0 && <p style={{ color: '#999', textAlign: 'center', padding: 10 }}>No batches found</p>}
            </div>

            {/* Adjustment Type */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>Adjustment Type</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['add', 'remove', 'set'] as const).map(t => (
                <button key={t} onClick={() => setAdjustType(t)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    border: adjustType === t ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: adjustType === t ? '#eff6ff' : '#fff',
                    color: adjustType === t ? '#2563eb' : '#666'
                  }}>
                  {t === 'add' ? '➕ Add' : t === 'remove' ? '➖ Remove' : '🔢 Set'}
                </button>
              ))}
            </div>

            {/* Quantity */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
              {adjustType === 'set' ? 'New Quantity' : 'Quantity'}
            </label>
            <input
              type="number"
              min="0"
              value={adjustQty}
              onChange={e => setAdjustQty(e.target.value)}
              placeholder={adjustType === 'set' ? 'Set exact quantity' : 'Enter quantity'}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', marginBottom: 16 }}
            />

            {/* Preview */}
            {selectedBatch && adjustQty && (
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>Result: </span>
                <strong>{selectedBatch.quantity_remaining}</strong>
                <span style={{ color: '#666' }}> → </span>
                <strong style={{ color: '#2563eb' }}>
                  {adjustType === 'add' ? selectedBatch.quantity_remaining + parseInt(adjustQty || '0')
                    : adjustType === 'remove' ? Math.max(0, selectedBatch.quantity_remaining - parseInt(adjustQty || '0'))
                      : parseInt(adjustQty || '0')}
                </strong>
              </div>
            )}

            {/* Reason */}
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
              Reason <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="e.g., Physical count mismatch, damaged units..."
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdjust(false)}
                style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmAdjust} disabled={adjusting || !selectedBatch || !adjustQty || !adjustReason.trim()}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: (!selectedBatch || !adjustQty || !adjustReason.trim()) ? 0.5 : 1 }}>
                {adjusting ? 'Adjusting...' : '✅ Confirm Adjust'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setShowHistory(false); setHistoryData(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {historyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading history...</div>
            ) : historyData ? (
              <>
                {/* Header */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>📜 {historyData.product.product_name}</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0 0' }}>{historyData.product.brand} {historyData.product.model}</p>
                    </div>
                    <button onClick={() => { setShowHistory(false); setHistoryData(null); }}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>✕</button>
                  </div>

                  {/* Summary cards */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Stock In', value: historyData.summary.total_stock_in, color: '#16a34a', icon: '📦' },
                      { label: 'Sold', value: historyData.summary.total_sold, color: '#2563eb', icon: '🛒' },
                      { label: 'Returned', value: historyData.summary.total_returned, color: '#ea580c', icon: '↩️' },
                      { label: 'Replaced', value: historyData.summary.total_replaced, color: '#9333ea', icon: '🔄' },
                      { label: 'Adjustments', value: historyData.summary.total_adjustments, color: '#64748b', icon: '⚙️' }
                    ].map(s => (
                      <div key={s.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem' }}>{s.icon}</div>
                        <div style={{ fontWeight: 700, color: s.color, fontSize: '1rem' }}>{s.value}</div>
                        <div style={{ color: '#666', fontSize: '0.7rem' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ padding: '16px 24px', overflow: 'auto', flex: 1 }}>
                  {historyData.history.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999', padding: 20 }}>No history found</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {historyData.history.map((item: any, idx: number) => {
                        const colors = getHistoryColor(item.type);
                        return (
                          <div key={idx} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 10, borderLeft: `3px solid ${colors.color}` }}>
                            <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getHistoryIcon(item.type)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <span style={{ background: colors.bg, color: colors.color, padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {item.type.replace('_', ' ')}
                                  </span>
                                  {item.batch_number && <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: 8 }}>Batch: {item.batch_number}</span>}
                                </div>
                                <span style={{ fontSize: '0.7rem', color: '#999', flexShrink: 0 }}>
                                  {new Date(item.date).toLocaleDateString('en-GB')} {new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                                {item.type === 'stock_in' && (
                                  <span>Added <strong>{item.quantity_added}</strong> units @ ৳{Number(item.purchase_price).toLocaleString()}{item.supplier_name ? ` from ${item.supplier_name}` : ''}</span>
                                )}
                                {item.type === 'sale' && (
                                  <span>Sold <strong>{item.quantity}</strong> units @ ৳{Number(item.unit_price).toLocaleString()} — <span style={{ color: '#2563eb' }}>{item.invoice_number}</span> {item.customer_name && `to ${item.customer_name}`}
                                    {item.profit > 0 && <span style={{ color: '#16a34a', marginLeft: 6 }}>Profit: ৳{Number(item.profit).toLocaleString()}</span>}
                                  </span>
                                )}
                                {item.type === 'return' && (
                                  <span>Returned <strong>{item.quantity}</strong> units — {item.return_number} {item.reason && `(${item.reason})`}</span>
                                )}
                                {(item.type === 'replaced_out' || item.type === 'replaced_in') && (
                                  <span>{item.type === 'replaced_out' ? 'Old unit returned' : 'New unit given'} — <strong>{item.quantity}</strong> units — {item.replacement_number}</span>
                                )}
                                {item.type === 'adjustment' && (
                                  <span>Adjusted by {item.adjusted_by || 'admin'}: {item.notes}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>No history data available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
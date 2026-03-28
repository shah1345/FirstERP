import { useState, useEffect } from 'react';
import { stockAPI, productsAPI } from '../../services/api';
import api from '../../services/api';

export default function StockPage() {
  const [products, setProducts]   = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [summary, setSummary]     = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    product_id: '', purchase_price: '', sale_price: '',
    quantity: '', vendor_id: '', supplier_name: '', paid_amount: '', paid_bank_account_id: '', batch_number: '', notes: ''
  });
  const [saving, setSaving]               = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [batches, setBatches]             = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Vendor list for dropdown
  const [vendors, setVendors] = useState<any[]>([]);
  // Bank accounts for payment
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { loadAll(); loadVendors(); loadAccounts(); }, []);

  const loadAll = async () => {
    try {
      const [prodRes, movRes, sumRes] = await Promise.all([
        productsAPI.getAll(),
        stockAPI.getMovements({ limit: 40 }),
        stockAPI.getSummary()
      ]);
      setProducts(prodRes.data.data || []);
      setMovements(movRes.data.data || []);
      setSummary(sumRes.data.data || {});
    } catch (e) { console.error(e); }
  };

  const loadVendors = async () => {
    try {
      const res = await api.get('/vendors/list/dropdown');
      if (res.data.success) setVendors(res.data.data || []);
    } catch (e) { console.error('Load vendors:', e); }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/finance/bank-accounts');
      if (res.data.success) setAccounts(res.data.data || []);
    } catch (e) { console.error('Load accounts:', e); }
  };

  const viewBatches = async (product: any) => {
    setSelectedProduct(product);
    setLoadingBatches(true);
    try {
      const res = await stockAPI.getBatches(product.id);
      setBatches(res.data.data || []);
    } finally { setLoadingBatches(false); }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => String(p.id) === productId);
    setForm(f => ({
      ...f,
      product_id: productId,
      sale_price: product ? String(product.sale_price) : ''
    }));
  };

  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find(v => String(v.id) === vendorId);
    setForm(f => ({
      ...f,
      vendor_id: vendorId,
      supplier_name: vendor ? `${vendor.name}${vendor.company ? ' (' + vendor.company + ')' : ''}` : ''
    }));
  };

  const handleStockIn = async () => {
    if (!form.product_id || !form.purchase_price || !form.quantity) {
      alert('Product, purchase price and quantity are required');
      return;
    }
    setSaving(true);
    try {
      await stockAPI.stockIn(form);
      setShowModal(false);
      setForm({ product_id:'', purchase_price:'', sale_price:'', quantity:'', vendor_id:'', supplier_name:'', paid_amount:'', paid_bank_account_id:'', batch_number:'', notes:'' });
      loadAll();
      if (selectedProduct && String(selectedProduct.id) === form.product_id) {
        viewBatches(selectedProduct);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error adding stock');
    } finally {
      setSaving(false);
    }
  };

  const selectedProductInfo = form.product_id ? products.find(p => String(p.id) === form.product_id) : null;
  const margin = selectedProductInfo && form.purchase_price && form.sale_price
    ? (((parseFloat(form.sale_price) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price)) * 100).toFixed(1)
    : null;

  // Purchase total calculation
  const purchaseTotal = form.purchase_price && form.quantity
    ? parseFloat(form.purchase_price) * parseInt(form.quantity)
    : 0;
  const paidAmount = parseFloat(form.paid_amount) || 0;
  const dueAmount = Math.max(0, purchaseTotal - paidAmount);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Management</h1>
          <p className="page-subtitle">FIFO inventory — First In, First Out · Per-batch pricing</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-power">📦 Stock In (New Batch)</button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Total Products',  value: summary.total_products || 0,                                     icon:'🔋' },
            { label:'Total Units',     value: Number(summary.total_units || 0).toLocaleString() + ' pcs',      icon:'📦' },
            { label:'Stock Value',     value: `৳${Number(summary.total_stock_value||0).toLocaleString()}`,     icon:'💰' },
            { label:'Out of Stock',    value: summary.out_of_stock || 0,                                        icon:'⚠️', alert: Number(summary.out_of_stock) > 0 },
          ].map((s,i) => (
            <div key={i} className={`stat-card ${s.alert ? 'border-red-300 bg-red-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.alert ? 'text-red-600' : 'text-gray-900'}`}
                    style={{ fontFamily:'Barlow Condensed, sans-serif' }}>{s.value}</p>
                </div>
                <span className="text-3xl opacity-50">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Products table */}
        <div className="lg:col-span-3 power-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
              PRODUCT STOCK LEVELS
            </h3>
            <span className="badge-gray">{products.length} products</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Default Sale Price</th>
                  <th>Stock</th>
                  <th>Batches</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className={selectedProduct?.id === p.id ? 'bg-red-50' : ''}>
                    <td>
                      <p className="font-semibold text-sm text-gray-900">{p.product_name}</p>
                      <p className="text-xs text-gray-400">{p.brand} · {p.voltage}/{p.capacity}</p>
                    </td>
                    <td className="font-bold text-gray-800">৳{Number(p.sale_price).toLocaleString()}</td>
                    <td>
                      <p className={`font-black text-sm ${Number(p.total_stock)>10?'text-green-600':Number(p.total_stock)>0?'text-yellow-600':'text-red-600'}`}>
                        {p.total_stock} pcs
                      </p>
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${Number(p.total_stock)>10?'bg-green-500':Number(p.total_stock)>0?'bg-yellow-500':'bg-red-500'}`}
                          style={{ width:`${Math.min(100,(Number(p.total_stock)/50)*100)}%` }} />
                      </div>
                    </td>
                    <td><span className="badge-blue">{p.batch_count || 0} batches</span></td>
                    <td>
                      <button onClick={() => viewBatches(p)} className={`btn-ghost py-1 px-2 text-xs ${selectedProduct?.id===p.id?'text-red-600 bg-red-50':''}`}>
                        {selectedProduct?.id===p.id ? '📊 Viewing' : 'View FIFO'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FIFO Batch Viewer */}
        <div className="lg:col-span-2 power-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
              {selectedProduct ? `📊 ${selectedProduct.product_name}` : 'FIFO BATCH VIEWER'}
            </h3>
            {selectedProduct && (
              <p className="text-xs text-gray-400 mt-0.5">
                Oldest batch sells first · Different batches may have different prices
              </p>
            )}
          </div>

          {!selectedProduct ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-300">
              <span className="text-4xl mb-2">📊</span>
              <p className="text-sm">Select a product to view its FIFO batches</p>
            </div>
          ) : loadingBatches ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-300">
              <span className="text-4xl mb-2">📦</span>
              <p className="text-sm">No batches yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-3 overflow-y-auto max-h-96">
              {batches.map((b, i) => {
                const isNext   = i === 0 && b.quantity_remaining > 0;
                const soldOut  = b.quantity_remaining === 0;
                const soldPct  = Math.round(((b.quantity_added - b.quantity_remaining) / b.quantity_added) * 100);
                return (
                  <div key={b.id} className={`relative border-2 rounded-xl p-3.5
                    ${isNext   ? 'border-red-500 bg-red-50' :
                      soldOut  ? 'border-gray-200 bg-gray-50 opacity-60' :
                                 'border-gray-200 bg-white'}`}>
                    {isNext && (
                      <span className="absolute -top-2.5 left-3 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                        ⚡ SELLING NOW (FIFO)
                      </span>
                    )}
                    {soldOut && (
                      <span className="absolute -top-2.5 left-3 text-xs bg-gray-500 text-white px-2 py-0.5 rounded-full font-bold">
                        ✓ SOLD OUT
                      </span>
                    )}

                    <div className="flex justify-between mt-1 mb-2">
                      <div>
                        <p className="text-xs font-bold text-gray-700 font-mono">{b.batch_number}</p>
                        <p className="text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString('en-BD')}</p>
                        {b.supplier_name && <p className="text-xs text-gray-500">🚚 {b.supplier_name}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-right mb-1">
                          <p className="text-xs text-gray-400">Purchase Price</p>
                          <p className="text-sm font-black text-gray-700">৳{Number(b.purchase_price).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            Sale Price {b.sale_price ? '(this batch)' : '(default)'}
                          </p>
                          <p className={`text-sm font-black ${b.sale_price ? 'text-red-600' : 'text-gray-500'}`}>
                            ৳{Number(b.sale_price || selectedProduct.sale_price).toLocaleString()}
                          </p>
                        </div>
                        {b.purchase_price > 0 && (
                          <p className="text-xs text-green-600 font-semibold mt-0.5">
                            Margin: {(((Number(b.sale_price || selectedProduct.sale_price) - Number(b.purchase_price)) / Number(b.purchase_price)) * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs mb-2">
                      <div><span className="text-gray-400">Added:</span> <span className="font-bold text-gray-700">{b.quantity_added}</span></div>
                      <div><span className="text-gray-400">Sold:</span>  <span className="font-bold text-red-600">{b.quantity_added - b.quantity_remaining}</span></div>
                      <div><span className="text-gray-400">Left:</span>  <span className={`font-bold ${b.quantity_remaining>0?'text-green-600':'text-red-500'}`}>{b.quantity_remaining}</span></div>
                    </div>

                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${soldOut?'bg-gray-400':isNext?'bg-red-500':'bg-yellow-500'}`}
                        style={{ width:`${soldPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>0%</span><span>{soldPct}% sold</span><span>100%</span>
                    </div>
                  </div>
                );
              })}

              {batches.filter(b => b.quantity_remaining > 0).length > 1 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                  <p className="font-bold text-amber-800 mb-1">⚠️ Multiple Active Batches — Different Prices</p>
                  {batches.filter(b => b.quantity_remaining > 0).map((b, i) => (
                    <div key={b.id} className="flex justify-between text-amber-700">
                      <span>Batch {i+1} ({b.quantity_remaining} pcs):</span>
                      <span className="font-bold">৳{Number(b.sale_price || selectedProduct.sale_price).toLocaleString()} / pc</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Movements */}
      <div className="power-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
            RECENT STOCK MOVEMENTS
          </h3>
          <span className="badge-gray">{movements.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Date & Time</th><th>Product</th><th>Type</th><th>Qty</th><th>By</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No movements recorded yet</td></tr>
              ) : movements.map(m => (
                <tr key={m.id}>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                  <td>
                    <p className="font-medium text-sm text-gray-900">{m.product_name}</p>
                    <p className="text-xs text-gray-400">{m.brand}</p>
                  </td>
                  <td>
                    <span className={`badge-${m.movement_type==='in'?'green':m.movement_type==='out'?'red':'yellow'}`}>
                      {m.movement_type==='in'?'↑ STOCK IN':m.movement_type==='out'?'↓ SOLD':'≈ ADJUST'}
                    </span>
                  </td>
                  <td className={`font-bold ${m.movement_type==='in'?'text-green-600':'text-red-600'}`}>
                    {m.movement_type==='in'?'+':'-'}{m.quantity}
                  </td>
                  <td className="text-sm text-gray-600">{m.created_by_name||'System'}</td>
                  <td className="text-sm text-gray-500 max-w-32 truncate">{m.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock In Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif' }}>
                📦 Add Stock Batch (FIFO)
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Product selector */}
              <div>
                <label className="power-label">Product *</label>
                <select value={form.product_id} onChange={e => handleProductChange(e.target.value)} className="power-input">
                  <option value="">Select a product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name} ({p.brand}) — Current stock: {p.total_stock}</option>
                  ))}
                </select>
              </div>

              {/* Pricing section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">Purchase Price (৳) * <span className="text-gray-400 normal-case font-normal">Cost price</span></label>
                  <input type="number" value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="power-input" placeholder="e.g. 3800" min="0" />
                  <p className="text-xs text-gray-400 mt-1">What you paid to supplier</p>
                </div>
                <div>
                  <label className="power-label">
                    Sale Price (৳) *
                    {selectedProductInfo && (
                      <span className="text-blue-500 normal-case font-normal ml-1">(default: ৳{Number(selectedProductInfo.sale_price).toLocaleString()})</span>
                    )}
                  </label>
                  <input type="number" value={form.sale_price}
                    onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))}
                    className="power-input" placeholder="e.g. 4500" min="0" />
                  <p className="text-xs text-gray-400 mt-1">Selling price for this batch</p>
                </div>
              </div>

              {/* Margin indicator */}
              {margin !== null && (
                <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2
                  ${parseFloat(margin) > 0 ? 'bg-green-50 border border-green-200 text-green-700' :
                    parseFloat(margin) === 0 ? 'bg-gray-50 border border-gray-200 text-gray-600' :
                    'bg-red-50 border border-red-200 text-red-700'}`}>
                  <span>{parseFloat(margin) > 0 ? '✅' : parseFloat(margin) === 0 ? '➡️' : '⚠️'}</span>
                  Profit Margin: <strong>{margin}%</strong>
                  {form.purchase_price && form.sale_price && (
                    <span className="ml-2 font-normal">
                      (৳{(parseFloat(form.sale_price) - parseFloat(form.purchase_price)).toFixed(0)} per unit)
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">Quantity *</label>
                  <input type="number" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="power-input" placeholder="0" min="1" />
                </div>
                <div>
                  <label className="power-label">Batch Number</label>
                  <input value={form.batch_number}
                    onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))}
                    className="power-input" placeholder="Auto-generated if empty" />
                </div>
              </div>

              {/* ─── VENDOR / SUPPLIER SECTION ─── */}
              <div className="border-t pt-4">
                <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">🚚 Vendor / Supplier</p>

                <div>
                  <label className="power-label">Select Vendor</label>
                  <select value={form.vendor_id} onChange={e => handleVendorChange(e.target.value)} className="power-input">
                    <option value="">— Select vendor (optional) —</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.company ? ` — ${v.company}` : ''}{v.phone ? ` (${v.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Select a vendor to track purchase dues.{' '}
                    <button type="button" onClick={() => window.open('/vendors', '_blank')} className="text-blue-500 hover:underline">
                      + Add new vendor
                    </button>
                  </p>
                </div>

                {/* Purchase Total + Paid + Due — only show when vendor selected + qty + price filled */}
                {form.vendor_id && purchaseTotal > 0 && (
                  <div className="mt-3 space-y-3">
                    {/* Total Bill */}
                    <div className="bg-gray-50 border rounded-lg p-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Total Purchase Bill</span>
                      <span className="text-lg font-black text-gray-900">৳{purchaseTotal.toLocaleString()}</span>
                    </div>

                    {/* Paid Amount */}
                    <div>
                      <label className="power-label">Paid Amount (৳)</label>
                      <input type="number" value={form.paid_amount}
                        onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
                        className="power-input" placeholder="0" min="0" max={purchaseTotal} />
                      {/* Quick pay buttons */}
                      <div className="flex gap-2 mt-1.5">
                        <button type="button" onClick={() => setForm(f => ({ ...f, paid_amount: String(purchaseTotal) }))}
                          className="text-xs px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 font-semibold hover:bg-green-100">
                          Full Pay (৳{purchaseTotal.toLocaleString()})
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, paid_amount: String(Math.round(purchaseTotal / 2)) }))}
                          className="text-xs px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100">
                          50% (৳{Math.round(purchaseTotal / 2).toLocaleString()})
                        </button>
                        <button type="button" onClick={() => setForm(f => ({ ...f, paid_amount: '0' }))}
                          className="text-xs px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-600 font-semibold hover:bg-gray-100">
                          Credit (৳0)
                        </button>
                      </div>
                    </div>

                    {/* Pay From Account — only show when paid_amount > 0 */}
                    {paidAmount > 0 && (
                      <div>
                        <label className="power-label">Pay From Account</label>
                        <select value={form.paid_bank_account_id}
                          onChange={e => setForm(f => ({ ...f, paid_bank_account_id: e.target.value }))}
                          className="power-input">
                          <option value="">💵 Cash (Others) — not tracked in finance</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.icon || '🏦'} {a.account_name} — Balance: ৳{Number(a.current_balance).toLocaleString()}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs mt-1" style={{ color: form.paid_bank_account_id ? '#059669' : '#9ca3af' }}>
                          {form.paid_bank_account_id
                            ? '✅ ৳' + paidAmount.toLocaleString() + ' will be deducted from this account & recorded in finance'
                            : 'Cash payment — will NOT be recorded in finance'}
                        </p>
                      </div>
                    )}

                    {/* Due Summary */}
                    <div className={`rounded-lg p-3 flex items-center justify-between border-2 ${dueAmount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <div>
                        <span className={`text-sm font-bold ${dueAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {dueAmount > 0 ? '⚠️ Due to Vendor' : '✅ Fully Paid'}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {dueAmount > 0 ? 'This amount will be added to vendor\'s due balance' : 'No outstanding balance'}
                        </p>
                      </div>
                      <span className={`text-xl font-black ${dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ৳{dueAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="power-label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="power-input resize-none" rows={2} placeholder="Any additional notes..." />
              </div>

              {/* FIFO note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-semibold mb-1">ℹ️ FIFO Rule Applied</p>
                <p>This batch will be added to the queue. Items from older batches (lower purchase price) sell first automatically.</p>
                {selectedProductInfo && Number(selectedProductInfo.batch_count) > 0 && (
                  <p className="mt-1">Existing batches: <strong>{selectedProductInfo.batch_count}</strong> · Current stock: <strong>{selectedProductInfo.total_stock} pcs</strong></p>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleStockIn} disabled={saving} className="btn-power flex-1 justify-center">
                {saving ? '⏳ Adding...' : '📦 Add to FIFO Queue'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

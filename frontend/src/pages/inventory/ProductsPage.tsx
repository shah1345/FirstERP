import { useState, useEffect } from 'react';
import { productsAPI } from '../../services/api';

const UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'ltr', label: 'Liter (ltr)' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'meter', label: 'Meter (m)' },
  { value: 'cm', label: 'Centimeter (cm)' },
  { value: 'inch', label: 'Inch (in)' },
  { value: 'ft', label: 'Feet (ft)' },
  { value: 'm2', label: 'Square Meter (m²)' },
  { value: 'm3', label: 'Cubic Meter (m³)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'roll', label: 'Roll' },
  { value: 'bag', label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'carton', label: 'Carton' },
  { value: 'sheet', label: 'Sheet' },
  { value: 'ton', label: 'Ton' },
  { value: 'A', label: 'Ampere (A)' },
  { value: 'V', label: 'Volt (V)' },
  { value: 'W', label: 'Watt (W)' },
  { value: 'Ah', label: 'Amp-hour (Ah)' },
  { value: 'mAh', label: 'Milliamp-hour (mAh)' },
  { value: 'custom', label: '✏️ Custom Unit...' },
];

const defaultForm: any = {
  product_name: '', brand: '', model: '', category: '', subcategory: '', sku: '',
  size: '', color: '', material: '', unit: 'pcs', custom_unit: '',
  voltage: '', capacity: '', warranty_months: '', sale_price: '', vat_percentage: '',
  barcode: '', description: '', has_serial_number: 0
};

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProducts(); loadCategories(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await productsAPI.getAll();
      setProducts(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadCategories = async () => {
    try {
      const res = await productsAPI.getAll();
      const cats = [...new Set((res.data.data || []).map((p: any) => p.category).filter(Boolean))];
      setCategories(cats as string[]);
    } catch {}
  };

  const openAdd = () => { setEditProduct(null); setForm({ ...defaultForm }); setShowModal(true); };
  const openEdit = (p: any) => {
    setEditProduct(p);
    const f: any = {};
    Object.keys(defaultForm).forEach(k => { f[k] = p[k] || defaultForm[k]; });
    // Check if unit is custom
    if (p.unit && !UNITS.find(u => u.value === p.unit && u.value !== 'custom')) {
      f.custom_unit = p.unit;
      f.unit = 'custom';
    }
    setForm(f);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.product_name || !form.sale_price) { alert('Product name and sale price are required'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.unit === 'custom') { payload.unit = payload.custom_unit || 'pcs'; }
      if (editProduct) { await productsAPI.update(editProduct.id, payload); }
      else { await productsAPI.create(payload); }
      setShowModal(false);
      loadProducts();
      loadCategories();
    } catch (err: any) { alert(err.response?.data?.message || 'Error saving'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await productsAPI.delete(id);
    loadProducts();
  };

  const setField = (key: string, value: any) =>
    setForm((f: typeof form) => ({ ...f, [key]: value }));

  
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || (p.product_name || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) || (p.category || '').toLowerCase().includes(q) ||
      (p.model || '').toLowerCase().includes(q);
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getUnitLabel = (unit: string) => {
    const found = UNITS.find(u => u.value === unit);
    return found ? unit : unit || 'pcs';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Products</h1>
          <p className="page-subtitle">{products.length} active products in catalog</p>
        </div>
        <button onClick={openAdd} className="btn-power">➕ Add Product</button>
      </div>

      {/* Search & Filters */}
      <div className="power-card p-4">
        <div className="flex gap-3 flex-wrap">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="power-input flex-1 min-w-[200px]" placeholder="🔍 Search name, brand, SKU, barcode, category..." />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="power-input w-48">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="power-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Brand / Model</th>
                <th>Category</th>
                <th>Size / Color</th>
                <th>Unit</th>
                <th>Stock</th>
                <th>Sale Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No products found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ background: 'var(--primary-light, #fee2e2)', color: 'var(--primary, #dc2626)' }}>
                        📦
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.product_name}</p>
                        <div className="flex gap-2 items-center">
                          {p.barcode && <span className="text-xs text-gray-400 font-mono">{p.barcode}</span>}
                          {p.sku && <span className="text-xs text-gray-400">SKU: {p.sku}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.brand || '-'}</p>
                    <p className="text-xs text-gray-400">{p.model || ''}</p>
                  </td>
                  <td>
                    {p.category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {p.category}
                      </span>
                    ) : <span className="text-gray-400">-</span>}
                    {p.subcategory && <p className="text-xs text-gray-400 mt-0.5">{p.subcategory}</p>}
                  </td>
                  <td>
                    <p className="text-sm text-gray-600">
                      {[p.size, p.color, p.material].filter(Boolean).join(' / ') || '-'}
                    </p>
                    {(p.voltage || p.capacity) && (
                      <p className="text-xs text-gray-400">{[p.voltage, p.capacity].filter(Boolean).join(' / ')}</p>
                    )}
                  </td>
                  <td><span className="text-sm text-gray-600">{getUnitLabel(p.unit)}</span></td>
                  <td>
                    <span className={`font-bold ${(p.total_stock || 0) > 10 ? 'text-green-600' : (p.total_stock || 0) > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {p.total_stock || 0} {getUnitLabel(p.unit)}
                    </span>
                  </td>
                  <td>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>৳{Number(p.sale_price).toLocaleString()}</span>
                    {p.vat_percentage > 0 && <span className="text-xs text-gray-400 ml-1">+{p.vat_percentage}%</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(p)} className="btn-ghost py-1 px-2 text-xs">✏️ Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="btn-ghost py-1 px-2 text-xs text-red-600 hover:bg-red-50">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: 'var(--text-primary)' }}>
                {editProduct ? '✏️ Edit Product' : '➕ Add New Product'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Basic Info */}
                <div className="col-span-2">
                  <label className="power-label">Product Name *</label>
                  <input value={form.product_name} onChange={e => setField('product_name', e.target.value)}
                    className="power-input" placeholder="e.g. Volta Car Battery, Nike T-Shirt, Rice 5kg..." />
                </div>

                <div>
                  <label className="power-label">Brand</label>
                  <input value={form.brand} onChange={e => setField('brand', e.target.value)}
                    className="power-input" placeholder="Nike, Volta, Samsung..." />
                </div>
                <div>
                  <label className="power-label">Model / Variant</label>
                  <input value={form.model} onChange={e => setField('model', e.target.value)}
                    className="power-input" placeholder="NS60, Air Max, Galaxy S24..." />
                </div>

                <div>
                  <label className="power-label">Category</label>
                  <input value={form.category} onChange={e => setField('category', e.target.value)}
                    className="power-input" placeholder="Battery, T-Shirt, Rice, Phone..." list="category-list" />
                  <datalist id="category-list">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="power-label">Sub-Category</label>
                  <input value={form.subcategory} onChange={e => setField('subcategory', e.target.value)}
                    className="power-input" placeholder="Car Battery, Polo, Basmati..." />
                </div>

                <div>
                  <label className="power-label">SKU</label>
                  <input value={form.sku} onChange={e => setField('sku', e.target.value)}
                    className="power-input" placeholder="SKU-001" />
                </div>
                <div>
                  <label className="power-label">Barcode</label>
                  <input value={form.barcode} onChange={e => setField('barcode', e.target.value)}
                    className="power-input" placeholder="Scan or enter barcode" />
                </div>

                {/* Physical Properties */}
                <div>
                  <label className="power-label">Size</label>
                  <input value={form.size} onChange={e => setField('size', e.target.value)}
                    className="power-input" placeholder="S, M, L, XL, 42, 10x10..." />
                </div>
                <div>
                  <label className="power-label">Color</label>
                  <input value={form.color} onChange={e => setField('color', e.target.value)}
                    className="power-input" placeholder="Red, Blue, Black..." />
                </div>
                <div>
                  <label className="power-label">Material</label>
                  <input value={form.material} onChange={e => setField('material', e.target.value)}
                    className="power-input" placeholder="Cotton, Leather, Steel..." />
                </div>

                {/* Unit Selection */}
                <div>
                  <label className="power-label">Unit of Measurement</label>
                  <select value={form.unit} onChange={e => setField('unit', e.target.value)} className="power-input">
                    {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>

                {form.unit === 'custom' && (
                  <div>
                    <label className="power-label">Custom Unit Name *</label>
                    <input value={form.custom_unit} onChange={e => setField('custom_unit', e.target.value)}
                      className="power-input" placeholder="e.g. barrel, sack, bundle..." />
                  </div>
                )}

                {/* Technical specs (optional — useful for battery, electronics etc.) */}
                <div>
                  <label className="power-label">Voltage (optional)</label>
                  <input value={form.voltage} onChange={e => setField('voltage', e.target.value)}
                    className="power-input" placeholder="12V, 220V..." />
                </div>
                <div>
                  <label className="power-label">Capacity (optional)</label>
                  <input value={form.capacity} onChange={e => setField('capacity', e.target.value)}
                    className="power-input" placeholder="45Ah, 5000mAh, 500ml..." />
                </div>

                {/* Pricing */}
                <div>
                  <label className="power-label">Sale Price (৳) *</label>
                  <input type="number" value={form.sale_price} onChange={e => setField('sale_price', e.target.value)}
                    className="power-input" placeholder="0" />
                </div>
                <div>
                  <label className="power-label">VAT %</label>
                  <input type="number" value={form.vat_percentage} onChange={e => setField('vat_percentage', e.target.value)}
                    className="power-input" placeholder="0" />
                </div>

                <div>
                  <label className="power-label">Warranty (months)</label>
                  <input type="number" value={form.warranty_months} onChange={e => setField('warranty_months', e.target.value)}
                    className="power-input" placeholder="0" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={form.has_serial_number === 1 || form.has_serial_number === true}
                      onChange={e => setField('has_serial_number', e.target.checked ? 1 : 0)}
                      className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                    Track Serial Numbers
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="power-label">Description</label>
                  <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                    className="power-input resize-none" rows={2} placeholder="Optional notes about this product..." />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={saving} className="btn-power flex-1 justify-center">
                {saving ? '⏳ Saving...' : editProduct ? '💾 Update Product' : '➕ Add Product'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

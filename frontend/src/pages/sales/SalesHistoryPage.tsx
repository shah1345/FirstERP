import { useState, useEffect, useRef } from 'react';
import { salesAPI, companyAPI } from '../../services/api';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSale, setDeleteSale] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    loadSales();
    loadCompany();
  }, [statusFilter, dateFilter]);

  const loadCompany = async () => {
    try {
      const res = await companyAPI.get();
      if (res.data.success) setCompany(res.data.data);
    } catch {}
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      const res = await salesAPI.getAll(params);
      if (res.data.success) setSales(res.data.data || []);
    } catch (err) {
      console.error('Load sales error:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewInvoice = async (id: number) => {
    try {
      const res = await salesAPI.getOne(id);
      if (res.data.success) {
        setInvoiceData(res.data.data);
        setShowInvoice(true);
      }
    } catch (err) {
      alert('Failed to load invoice');
    }
  };

  const openDeleteModal = (sale: any) => {
    setDeleteSale(sale);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteSale || !deleteReason.trim()) {
      alert('Please provide a reason for deletion');
      return;
    }
    setDeleting(true);
    try {
      const res = await salesAPI.delete(deleteSale.id, deleteReason);
      if (res.data.success) {
        setShowDeleteModal(false);
        setDeleteSale(null);
        loadSales();
        alert('✅ Sale deleted and stock restored successfully');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const printInvoice = () => {
    const printArea = document.getElementById('invoice-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Invoice</title>
      <style>body{font-family:Arial,sans-serif;margin:20px;color:#111}table{width:100%;border-collapse:collapse}th,td{padding:8px 6px;text-align:left;border-bottom:1px solid #eee}th{background:#f5f5f5;font-weight:700}.text-right{text-align:right}.text-center{text-align:center}</style>
    </head><body>${printArea.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.invoice_number || '').toLowerCase().includes(q) ||
           (s.customer_name || '').toLowerCase().includes(q) ||
           (s.customer_phone || '').includes(q);
  });

  const getStatusBadge = (status: string) => {
    const map: any = {
      active: { bg: '#dcfce7', color: '#166534', label: 'Active' },
      deleted: { bg: '#fee2e2', color: '#991b1b', label: 'Deleted' },
      returned: { bg: '#fef3c7', color: '#92400e', label: 'Returned' },
      partial_return: { bg: '#dbeafe', color: '#1e40af', label: 'Partial Return' },
    };
    const s = map[status] || map.active;
    return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', fontFamily: 'Barlow Condensed, sans-serif' }}>
          📋 Sales History
        </h1>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>{filtered.length} records</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search invoice, customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem' }}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', background: '#fff' }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="deleted">Deleted</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      {/* Sales Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No sales found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700 }}>Invoice</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700 }}>Customer</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Total</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Paid</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Due</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700 }}>Payment</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale: any) => (
                <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: sale.status === 'deleted' ? 0.5 : 1 }}>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#2563eb' }}>{sale.invoice_number}</td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 500 }}>{sale.customer_name || 'Walk-in'}</div>
                    {sale.customer_phone && <div style={{ fontSize: '0.75rem', color: '#999' }}>{sale.customer_phone}</div>}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>৳{Number(sale.total_amount).toLocaleString()}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a' }}>৳{Number(sale.paid_amount).toLocaleString()}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: Number(sale.due_amount) > 0 ? '#dc2626' : '#999', fontWeight: Number(sale.due_amount) > 0 ? 600 : 400 }}>
                    ৳{Number(sale.due_amount).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                      background: sale.payment_status === 'paid' ? '#dcfce7' : sale.payment_status === 'partial' ? '#fef3c7' : '#fee2e2',
                      color: sale.payment_status === 'paid' ? '#166534' : sale.payment_status === 'partial' ? '#92400e' : '#991b1b'
                    }}>
                      {sale.payment_status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{getStatusBadge(sale.status)}</td>
                  <td style={{ padding: '10px', fontSize: '0.8rem', color: '#666' }}>
                    {new Date(sale.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        onClick={() => viewInvoice(sale.id)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                      >
                        👁️ View
                      </button>
                      {sale.status === 'active' && (
                        <button
                          onClick={() => openDeleteModal(sale)}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && deleteSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚠️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Delete Sale?</h3>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>
                This will restore all stock from invoice <strong>{deleteSale.invoice_number}</strong>
              </p>
            </div>

            <div style={{ background: '#fef2f2', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#666' }}>Customer:</span>
                <strong>{deleteSale.customer_name || 'Walk-in'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#666' }}>Total:</span>
                <strong style={{ color: '#dc2626' }}>৳{Number(deleteSale.total_amount).toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Date:</span>
                <strong>{new Date(deleteSale.created_at).toLocaleDateString('en-GB')}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>
                Reason for deletion <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g., Customer cancelled order, wrong entry..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting || !deleteReason.trim()}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: deleteReason.trim() ? '#dc2626' : '#fca5a5', color: '#fff', cursor: deleteReason.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.9rem' }}>
                {deleting ? 'Deleting...' : '🗑️ Delete & Restock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE VIEW MODAL */}
      {showInvoice && invoiceData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowInvoice(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #eee' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Invoice #{invoiceData.invoice_number}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={printInvoice} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  🖨️ Print
                </button>
                <button onClick={() => setShowInvoice(false)} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
              </div>
            </div>
            <div id="invoice-print-area" style={{ padding: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{(invoiceData.company || company)?.shop_name || 'Battery Shop'}</h2>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0' }}>{(invoiceData.company || company)?.address}</p>
                <p style={{ fontSize: '0.8rem', color: '#666' }}>{(invoiceData.company || company)?.phone}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 16, padding: '10px', background: '#f9fafb', borderRadius: 8 }}>
                <div><strong>Invoice:</strong> {invoiceData.invoice_number}</div>
                <div><strong>Date:</strong> {new Date(invoiceData.created_at).toLocaleDateString('en-GB')}</div>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: 16 }}>
                <strong>Customer:</strong> {invoiceData.customer_name || 'Walk-in'} {invoiceData.customer_phone && `(${invoiceData.customer_phone})`}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px' }}>{i + 1}</td>
                      <td style={{ padding: '8px' }}>{item.product_name}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>৳{Number(item.unit_price).toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>৳{Number(item.total_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 220, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Subtotal:</span><strong>৳{Number(invoiceData.subtotal).toLocaleString()}</strong>
                  </div>
                  {Number(invoiceData.vat_amount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>VAT:</span><strong>৳{Number(invoiceData.vat_amount).toLocaleString()}</strong>
                    </div>
                  )}
                  {Number(invoiceData.discount_amount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#16a34a' }}>
                      <span>Discount:</span><strong>-৳{Number(invoiceData.discount_amount).toLocaleString()}</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #111', fontWeight: 700, fontSize: '1rem' }}>
                    <span>Total:</span><span>৳{Number(invoiceData.total_amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#16a34a' }}>
                    <span>Paid:</span><strong>৳{Number(invoiceData.paid_amount).toLocaleString()}</strong>
                  </div>
                  {Number(invoiceData.due_amount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#dc2626' }}>
                      <span>Due:</span><strong>৳{Number(invoiceData.due_amount).toLocaleString()}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

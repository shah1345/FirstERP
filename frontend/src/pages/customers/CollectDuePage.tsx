import { useState, useEffect, useRef } from 'react';
import { customersAPI, companyAPI } from '../../services/api';

export default function CollectDuePage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Customer detail
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [paying, setPaying] = useState(false);

  // Receipt
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Company
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    loadCustomers();
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const res = await companyAPI.get();
      if (res.data.success) setCompany(res.data.data);
    } catch {}
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersAPI.getCreditDues();
      if (res.data.success) setCustomers(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    setDetailLoading(true);
    try {
      const [salesRes, paymentsRes] = await Promise.all([
        customersAPI.getSales(customer.id, { status: 'due' }),
        customersAPI.getPayments(customer.id)
      ]);
      if (salesRes.data.success) setCustomerSales(salesRes.data.data || []);
      if (paymentsRes.data.success) setCustomerPayments(paymentsRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const goBack = () => {
    setSelectedCustomer(null);
    setCustomerSales([]);
    setCustomerPayments([]);
  };

  const submitPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    setPaying(true);
    try {
      const res = await customersAPI.addPayment(selectedCustomer.id, {
        payment_amount: parseFloat(payAmount),
        payment_method: payMethod,
        reference_number: payRef || null,
        notes: payNotes || null,
        payment_date: payDate
      });
      if (res.data.success) {
        // Load receipt
        const receiptRes = await customersAPI.getPaymentReceipt(selectedCustomer.id, res.data.payment_id);
        if (receiptRes.data.success) {
          setReceiptData(receiptRes.data.data);
          setShowReceipt(true);
        }
        setShowPayForm(false);
        setPayAmount('');
        setPayRef('');
        setPayNotes('');
        // Reload data
        loadCustomers();
        selectCustomer(selectedCustomer);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const viewPaymentReceipt = async (payment: any) => {
    try {
      const res = await customersAPI.getPaymentReceipt(selectedCustomer.id, payment.id);
      if (res.data.success) {
        setReceiptData(res.data.data);
        setShowReceipt(true);
      }
    } catch {
      alert('Failed to load receipt');
    }
  };

  const printReceipt = () => {
    const el = document.getElementById('payment-receipt-area');
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Payment Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 30px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; text-align: left; }
        .border-b { border-bottom: 1px solid #ddd; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .bold { font-weight: 700; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 4px 0; font-size: 13px; color: #555; }
        .receipt-box { border: 2px solid #333; padding: 20px; border-radius: 8px; }
        .divider { border-top: 2px dashed #ccc; margin: 20px 0; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 200);
  };

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.customer_name.toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  const totalDue = filtered.reduce((sum, c) => sum + parseFloat(c.current_due || 0), 0);

  // ─── CUSTOMER DETAIL VIEW ───────────────────────────────────
  if (selectedCustomer) {
    const totalSalesDue = customerSales.reduce((sum, s) => sum + parseFloat(s.due_amount || 0), 0);
    const totalPaid = customerPayments.reduce((sum, p) => sum + parseFloat(p.payment_amount || 0), 0);

    return (
      <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
        {/* Back button */}
        <button onClick={goBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginBottom: 20 }}>
          ← Back to Customers
        </button>

        {/* Customer Profile Card */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', borderRadius: 16, padding: 24, color: '#fff', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{selectedCustomer.customer_name}</h2>
              <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: '4px 0' }}>📞 {selectedCustomer.phone || 'N/A'} • 📍 {selectedCustomer.address || 'N/A'}</p>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem' }}>Credit Customer</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Total Due</div>
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>৳{totalSalesDue.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Total Purchases</div><div style={{ fontWeight: 700, fontSize: '1.1rem' }}>৳{Number(selectedCustomer.total_purchases || 0).toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Total Paid</div><div style={{ fontWeight: 700, fontSize: '1.1rem' }}>৳{totalPaid.toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Pending Invoices</div><div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{customerSales.length}</div></div>
          </div>
        </div>

        {/* Collect Payment Button */}
        <button onClick={() => { setShowPayForm(true); setPayAmount(''); }}
          style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginBottom: 24, letterSpacing: '0.5px' }}>
          💰 Collect Payment
        </button>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* LEFT: Unpaid Sales */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#333' }}>📋 Unpaid Invoices</h3>
            {detailLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Loading...</div>
            ) : customerSales.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#999', background: '#f9fafb', borderRadius: 10 }}>No unpaid invoices</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflow: 'auto' }}>
                {customerSales.map((sale: any) => (
                  <div key={sale.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.85rem' }}>{sale.invoice_number}</span>
                      <span style={{ fontSize: '0.75rem', color: '#999' }}>{new Date(sale.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    {sale.products && (
                      <p style={{ fontSize: '0.75rem', color: '#666', margin: '0 0 6px', lineHeight: 1.3 }}>{sale.products}</p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Total: <strong>৳{Number(sale.total_amount).toLocaleString()}</strong></span>
                      <span>Paid: <strong style={{ color: '#16a34a' }}>৳{Number(sale.paid_amount).toLocaleString()}</strong></span>
                      <span>Due: <strong style={{ color: '#dc2626' }}>৳{Number(sale.due_amount).toLocaleString()}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Payment History */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: '#333' }}>💳 Payment History</h3>
            {customerPayments.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#999', background: '#f9fafb', borderRadius: 10 }}>No payments yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 500, overflow: 'auto' }}>
                {customerPayments.map((p: any) => (
                  <div key={p.id} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#16a34a' }}>৳{Number(p.payment_amount).toLocaleString()}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                        {p.payment_method?.replace('_', ' ')} • {new Date(p.payment_date).toLocaleDateString('en-GB')}
                        {p.reference_number && ` • Ref: ${p.reference_number}`}
                      </div>
                      {p.received_by_name && <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>By: {p.received_by_name}</div>}
                    </div>
                    <button onClick={() => viewPaymentReceipt(p)}
                      style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 600, background: '#fff', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer' }}>
                      🧾 Receipt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT FORM MODAL */}
        {showPayForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
            onClick={() => setShowPayForm(false)}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 4 }}>💰 Collect Payment</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 20 }}>
                {selectedCustomer.customer_name} — Due: <strong style={{ color: '#dc2626' }}>৳{totalSalesDue.toLocaleString()}</strong>
              </p>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Amount</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="Enter payment amount"
                max={totalSalesDue}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}
                autoFocus
              />
              
              {/* Quick amount buttons */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[
                  { label: 'Full', value: totalSalesDue },
                  { label: '50%', value: Math.round(totalSalesDue / 2) },
                  { label: '25%', value: Math.round(totalSalesDue / 4) }
                ].map(q => (
                  <button key={q.label} onClick={() => setPayAmount(String(q.value))}
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb', cursor: 'pointer' }}>
                    {q.label} (৳{q.value.toLocaleString()})
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', marginBottom: 14, background: '#fff' }}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_banking">Mobile Banking</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Payment Date</label>
              <input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', marginBottom: 14 }}
              />

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Reference No. (optional)</label>
              <input
                type="text"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="Check/transfer reference"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.9rem', marginBottom: 14 }}
              />

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Notes (optional)</label>
              <textarea
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="Any notes..."
                rows={2}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', marginBottom: 16, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPayForm(false)}
                  style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={submitPayment} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
                  style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 10, background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', opacity: (!payAmount || parseFloat(payAmount) <= 0) ? 0.5 : 1 }}>
                  {paying ? 'Processing...' : `✅ Confirm ৳${payAmount ? Number(payAmount).toLocaleString() : '0'}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT RECEIPT MODAL (A4) */}
        {showReceipt && receiptData && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
            onClick={() => setShowReceipt(false)}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }}
              onClick={e => e.stopPropagation()}>
              {/* Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #eee' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>🧾 Payment Receipt</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={printReceipt} style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                    🖨️ Print A4
                  </button>
                  <button onClick={() => setShowReceipt(false)} style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {/* PRINTABLE RECEIPT */}
              <div id="payment-receipt-area" style={{ padding: 30 }}>
                <div className="receipt-box" style={{ border: '2px solid #333', padding: 24, borderRadius: 8 }}>
                  {/* Company Header */}
                  <div className="header" style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                      {receiptData.company?.shop_name || 'Battery Wholesale Shop'}
                    </h1>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#555' }}>{receiptData.company?.address}</p>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem', color: '#555' }}>📞 {receiptData.company?.phone} • ✉️ {receiptData.company?.email}</p>
                    {receiptData.company?.tin_certificate_id && (
                      <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#888' }}>TIN: {receiptData.company.tin_certificate_id}</p>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, borderTop: '2px solid #333', borderBottom: '2px solid #333', padding: '8px 0' }}>
                      PAYMENT RECEIPT
                    </h2>
                  </div>

                  {/* Receipt details */}
                  <table style={{ width: '100%', marginBottom: 20, fontSize: '0.9rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '6px 0', color: '#666', width: '40%' }}>Receipt No:</td>
                        <td style={{ padding: '6px 0', fontWeight: 700 }}>PAY-{String(receiptData.payment.id).padStart(5, '0')}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0', color: '#666' }}>Date:</td>
                        <td style={{ padding: '6px 0', fontWeight: 600 }}>{new Date(receiptData.payment.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 0', color: '#666' }}>Payment Method:</td>
                        <td style={{ padding: '6px 0', fontWeight: 600, textTransform: 'capitalize' }}>{receiptData.payment.payment_method?.replace('_', ' ')}</td>
                      </tr>
                      {receiptData.payment.reference_number && (
                        <tr>
                          <td style={{ padding: '6px 0', color: '#666' }}>Reference:</td>
                          <td style={{ padding: '6px 0', fontWeight: 600 }}>{receiptData.payment.reference_number}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div style={{ borderTop: '2px dashed #ccc', margin: '20px 0' }}></div>

                  {/* Customer Info */}
                  <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#333' }}>Customer Details</h4>
                  <table style={{ width: '100%', marginBottom: 20, fontSize: '0.9rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 0', color: '#666', width: '40%' }}>Name:</td>
                        <td style={{ padding: '4px 0', fontWeight: 700 }}>{receiptData.customer?.customer_name}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 0', color: '#666' }}>Phone:</td>
                        <td style={{ padding: '4px 0' }}>{receiptData.customer?.phone || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 0', color: '#666' }}>Address:</td>
                        <td style={{ padding: '4px 0' }}>{receiptData.customer?.address || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ borderTop: '2px dashed #ccc', margin: '20px 0' }}></div>

                  {/* Payment Amount (big) */}
                  <div style={{ textAlign: 'center', margin: '24px 0', padding: '20px', background: '#f0fdf4', borderRadius: 10, border: '2px solid #16a34a' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 4 }}>Amount Received</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#16a34a' }}>
                      ৳{Number(receiptData.payment.payment_amount).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
                      ({numberToWords(receiptData.payment.payment_amount)} Taka Only)
                    </div>
                  </div>

                  {/* Balance */}
                  <table style={{ width: '100%', fontSize: '0.9rem', marginBottom: 20 }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 0', color: '#666' }}>Previous Balance:</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>
                          ৳{(parseFloat(receiptData.current_due) + parseFloat(receiptData.payment.payment_amount)).toLocaleString()}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 0', color: '#16a34a', fontWeight: 600 }}>Payment Received:</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          - ৳{Number(receiptData.payment.payment_amount).toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px 0', fontWeight: 700, fontSize: '1rem' }}>Remaining Balance:</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, fontSize: '1.1rem', color: parseFloat(receiptData.current_due) > 0 ? '#dc2626' : '#16a34a' }}>
                          ৳{Number(receiptData.current_due).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {receiptData.payment.notes && (
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
                      <strong>Notes:</strong> {receiptData.payment.notes}
                    </div>
                  )}

                  <div style={{ borderTop: '2px dashed #ccc', margin: '20px 0' }}></div>

                  {/* Signature lines */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: '0.85rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #333', paddingTop: 8, width: 180 }}>Customer Signature</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #333', paddingTop: 8, width: 180 }}>
                        Received by: {receiptData.payment.received_by_name || 'Authorized'}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ textAlign: 'center', marginTop: 30, fontSize: '0.75rem', color: '#999' }}>
                    {receiptData.company?.invoice_footer || 'Thank you for your payment!'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN CUSTOMER LIST VIEW ────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', fontFamily: 'Barlow Condensed, sans-serif' }}>
          💰 Collect Due
        </h1>
        <div style={{ background: '#fef2f2', padding: '8px 16px', borderRadius: 10 }}>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>Total Receivable: </span>
          <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>৳{totalDue.toLocaleString()}</strong>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="🔍 Search customer name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 400, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: '0.9rem', marginBottom: 20 }}
      />

      {/* Customer Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', background: '#f9fafb', borderRadius: 12 }}>
          No credit customers with outstanding dues
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map((c: any) => (
            <div key={c.id}
              onClick={() => selectCustomer(c)}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(37,99,235,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111', margin: 0 }}>{c.customer_name}</h3>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '2px 0' }}>📞 {c.phone || 'N/A'}</p>
                </div>
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 12px', borderRadius: 10, fontWeight: 800, fontSize: '1rem' }}>
                  ৳{Number(c.current_due).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#999' }}>
                <span>Total Purchases: ৳{Number(c.total_purchases || 0).toLocaleString()}</span>
                <span>{c.pending_invoices} unpaid invoice(s)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: Convert number to words (basic)
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  num = Math.floor(num);
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(-num);
  
  let words = '';
  
  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (Math.floor(num / 100) > 0) {
    words += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num > 0) {
    if (num < 20) words += ones[num];
    else words += tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  }
  
  return words.trim();
}

import { useState, useEffect } from 'react';
import { salesAPI } from '../../services/api';

const STATUS_BADGE: Record<string,string> = { paid:'badge-green', partial:'badge-yellow', due:'badge-red' };
const PAY_ICON: Record<string,string>     = { cash:'💵', card:'💳', mobile_banking:'📱', credit:'📝' };

export default function SalesPage() {
  const [sales, setSales]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState({ start_date:'', end_date:'' });
  const [saleDetail, setSaleDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { loadSales(); }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const res = await salesAPI.getAll({ ...filter, limit: 200 });
      setSales(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const viewInvoice = async (sale: any) => {
    setLoadingDetail(true);
    try {
      const res = await salesAPI.getOne(sale.id);
      setSaleDetail(res.data.data);
    } catch { alert('Failed to load invoice'); }
    finally { setLoadingDetail(false); }
  };

  const printPOS = () => {
    document.body.classList.add('pos-print-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('pos-print-mode'), 100);
  };

  const printA4 = () => {
    document.body.classList.remove('pos-print-mode');
    window.print();
  };

  const totals = {
    sales:   sales.reduce((s,i) => s + Number(i.total_amount), 0),
    paid:    sales.reduce((s,i) => s + Number(i.paid_amount), 0),
    due:     sales.reduce((s,i) => s + Number(i.due_amount), 0),
    vat:     sales.reduce((s,i) => s + Number(i.vat_amount), 0),
  };

  return (
    <div className="space-y-5">
      {/* Invoice Modal */}
      {saleDetail && (
        <div className="modal-backdrop" onClick={() => setSaleDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[95vh]" onClick={e => e.stopPropagation()}>
            
            {/* Toolbar - 2 Print Buttons */}
            <div className="flex items-center justify-between px-6 py-4 border-b no-print">
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif' }}>
                Invoice #{saleDetail.invoice_number}
              </h3>
              <div className="flex gap-2">
                <button onClick={printPOS} className="btn-power text-sm py-1.5 px-3 bg-blue-600 hover:bg-blue-700">
                  POS
                </button>
                <button onClick={printA4} className="btn-power text-sm py-1.5 px-3">
                  Print
                </button>
                <button onClick={() => setSaleDetail(null)} className="btn-ghost py-1.5 px-3">✕</button>
              </div>
            </div>

            {/* PRINTABLE INVOICE - ONLY THIS AREA PRINTS */}
            <div className="invoice-print-area p-10">
              <div className="text-center mb-6">
                <h1 style={{ fontSize:'1.8rem', fontWeight:900, color:'#111', fontFamily:'Barlow Condensed, sans-serif', marginBottom:2 }}>
                  {saleDetail.company?.shop_name || 'Lata Battery Wholesale'}
                </h1>
                <p style={{ fontSize:'0.8rem', color:'#555' }}>{saleDetail.company?.address || 'Dhaka, Bangladesh'}</p>
                <p style={{ fontSize:'0.75rem', color:'#555' }}>
                  📞 {saleDetail.company?.phone || '+880 1700-000000'} | ✉ {saleDetail.company?.email || 'info@powercell.com'}
                </p>
                {saleDetail.company?.tin_certificate_id && (
                  <p style={{ fontSize:'0.75rem', color:'#555' }}>TIN: {saleDetail.company.tin_certificate_id}</p>
                )}
                <p style={{ color:'#dc2626', fontWeight:700, fontSize:'0.75rem', marginTop:2 }}>
                  VAT {saleDetail.company?.vat_percentage || 5.00}% Registered Dealer
                </p>
              </div>

              <hr style={{ borderTop:'1px solid #ccc', margin:'20px 0' }} />

              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20, fontSize:'0.85rem' }}>
                <div>
                  <p style={{ fontWeight:700, color:'#111', marginBottom:4 }}>INVOICE #{saleDetail.invoice_number}</p>
                  <p style={{ color:'#555', marginBottom:2 }}><strong>Bill To:</strong></p>
                  <p style={{ color:'#111', fontWeight:600 }}>{saleDetail.customer_name}</p>
                  {saleDetail.customer_phone && <p style={{ color:'#555', fontSize:'0.8rem' }}>{saleDetail.customer_phone}</p>}
                </div>
                <div style={{ textAlign:'right', color:'#555', fontSize:'0.8rem' }}>
                  <p><strong>Date:</strong> {new Date(saleDetail.created_at).toLocaleDateString('en-GB')}</p>
                  <p><strong>Time:</strong> {new Date(saleDetail.created_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })}</p>
                  <p style={{ marginTop:4 }}><strong>Payment:</strong> {PAY_ICON[saleDetail.payment_method]} {saleDetail.payment_method}</p>
                </div>
              </div>

              <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20, fontSize:'0.85rem' }}>
                <thead>
                  <tr style={{ background:'#f5f5f5', borderTop:'1px solid #ddd', borderBottom:'1px solid #ddd' }}>
                    <th style={{ padding:'8px 6px', textAlign:'left',   fontWeight:700, color:'#333' }}>#</th>
                    <th style={{ padding:'8px 6px', textAlign:'left',   fontWeight:700, color:'#333' }}>Item</th>
                    <th style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:'#333' }}>Qty</th>
                    <th style={{ padding:'8px 6px', textAlign:'right',  fontWeight:700, color:'#333' }}>Unit Price</th>
                    <th style={{ padding:'8px 6px', textAlign:'right',  fontWeight:700, color:'#333' }}>VAT</th>
                    <th style={{ padding:'8px 6px', textAlign:'right',  fontWeight:700, color:'#333' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleDetail.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom:'1px solid #eee' }}>
                      <td style={{ padding:'8px 6px', color:'#999' }}>{i+1}</td>
                      <td style={{ padding:'8px 6px' }}>
                        <strong style={{ color:'#111', display:'block' }}>{item.product_name}</strong>
                        {item.batch_number && (
                          <span style={{ fontSize:'0.75rem', color:'#999' }}>Batch: {item.batch_number}</span>
                        )}
                      </td>
                      <td style={{ padding:'8px 6px', textAlign:'center' }}>{item.quantity}</td>
                      <td style={{ padding:'8px 6px', textAlign:'right' }}>৳{Number(item.unit_price).toLocaleString()}</td>
                      <td style={{ padding:'8px 6px', textAlign:'right' }}>৳{Number(item.vat_amount || 0).toFixed(2)}</td>
                      <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:700 }}>
                        ৳{Number(item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:20 }}>
                <table style={{ width:260, fontSize:'0.85rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding:'4px 0', textAlign:'right', paddingRight:10 }}>Subtotal:</td>
                      <td style={{ padding:'4px 0', textAlign:'right', fontWeight:600 }}>৳{Number(saleDetail.subtotal).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ padding:'4px 0', textAlign:'right', paddingRight:10 }}>VAT ({saleDetail.company?.vat_percentage || 5}%):</td>
                      <td style={{ padding:'4px 0', textAlign:'right', fontWeight:600 }}>৳{Number(saleDetail.vat_amount).toFixed(2)}</td>
                    </tr>
                    {Number(saleDetail.discount_amount) > 0 && (
                      <tr>
                        <td style={{ padding:'4px 0', textAlign:'right', paddingRight:10, color:'#16a34a' }}>Discount:</td>
                        <td style={{ padding:'4px 0', textAlign:'right', fontWeight:600, color:'#16a34a' }}>-৳{Number(saleDetail.discount_amount).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop:'1px solid #333', fontWeight:900 }}>
                      <td style={{ padding:'8px 0 4px', textAlign:'right', paddingRight:10, fontSize:'1rem' }}>TOTAL:</td>
                      <td style={{ padding:'8px 0 4px', textAlign:'right', fontSize:'1rem', color:'#dc2626' }}>
                        ৳{Number(saleDetail.total_amount).toLocaleString()}
                      </td>
                    </tr>
                    <tr style={{ color:'#16a34a' }}>
                      <td style={{ padding:'4px 0', textAlign:'right', paddingRight:10, fontWeight:600 }}>Paid ({saleDetail.payment_method}):</td>
                      <td style={{ padding:'4px 0', textAlign:'right', fontWeight:700 }}>৳{Number(saleDetail.paid_amount).toLocaleString()}</td>
                    </tr>
                    {Number(saleDetail.due_amount) > 0 && (
                      <tr style={{ color:'#dc2626', fontWeight:700 }}>
                        <td style={{ padding:'4px 0', textAlign:'right', paddingRight:10 }}>DUE:</td>
                        <td style={{ padding:'4px 0', textAlign:'right' }}>৳{Number(saleDetail.due_amount).toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {saleDetail.company?.invoice_footer && (
                <p style={{ textAlign:'center', fontSize:'0.75rem', color:'#999', fontStyle:'italic', marginTop:30, borderTop:'1px solid #eee', paddingTop:10 }}>
                  {saleDetail.company.invoice_footer}
                </p>
              )}
              <p style={{ textAlign:'center', fontSize:'0.7rem', color:'#ccc', marginTop:6 }}>
                Powered by PowerCell POS
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Sales History</h1>
          <p className="page-subtitle">{sales.length} transactions · Click to view invoice</p>
        </div>
      </div>

      <div className="power-card p-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className="power-label">From Date</label>
          <input type="date" value={filter.start_date} onChange={e => setFilter(f=>({...f,start_date:e.target.value}))} className="power-input" />
        </div>
        <div>
          <label className="power-label">To Date</label>
          <input type="date" value={filter.end_date} onChange={e => setFilter(f=>({...f,end_date:e.target.value}))} className="power-input" />
        </div>
        <button onClick={loadSales} className="btn-power">🔍 Filter</button>
        <button onClick={() => { setFilter({start_date:'',end_date:''}); setTimeout(loadSales,50); }} className="btn-ghost">Reset</button>

        <div className="ml-auto grid grid-cols-4 gap-4 text-sm">
          {[
            { label:'Total Sales',    value:`৳${totals.sales.toLocaleString()}`,  color:'text-gray-900' },
            { label:'Collected',      value:`৳${totals.paid.toLocaleString()}`,   color:'text-green-700' },
            { label:'Due',            value:`৳${totals.due.toLocaleString()}`,    color:'text-red-600'   },
            { label:'VAT Collected',  value:`৳${totals.vat.toLocaleString()}`,    color:'text-blue-600'  },
          ].map((t,i) => (
            <div key={i} className="text-center bg-gray-50 rounded-lg px-4 py-2">
              <p className={`font-black text-base ${t.color}`}>{t.value}</p>
              <p className="text-xs text-gray-400">{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="power-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">🧾</div>
                  <p>No sales found</p>
                </td></tr>
              ) : sales.map(sale => (
                <tr key={sale.id} className="cursor-pointer" onClick={() => viewInvoice(sale)}>
                  <td><span className="font-mono text-sm font-bold text-gray-900">{sale.invoice_number}</span></td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(sale.created_at).toLocaleDateString('en-BD')}<br/>
                    {new Date(sale.created_at).toLocaleTimeString()}
                  </td>
                  <td>
                    <p className="text-sm font-medium text-gray-900">{sale.customer_name}</p>
                    {sale.customer_phone && <p className="text-xs text-gray-400">{sale.customer_phone}</p>}
                  </td>
                  <td className="text-sm">{PAY_ICON[sale.payment_method]} {sale.payment_method?.replace('_',' ')}</td>
                  <td className="font-bold text-gray-900">৳{Number(sale.total_amount).toLocaleString()}</td>
                  <td className="text-green-700 font-medium">৳{Number(sale.paid_amount).toLocaleString()}</td>
                  <td className={`font-medium ${Number(sale.due_amount)>0?'text-red-600':'text-gray-300'}`}>
                    {Number(sale.due_amount)>0 ? `৳${Number(sale.due_amount).toLocaleString()}` : '—'}
                  </td>
                  <td><span className={STATUS_BADGE[sale.payment_status]||'badge-gray'}>{sale.payment_status}</span></td>
                  <td className="text-sm text-gray-500">{sale.sold_by_name}</td>
                  <td>
                    <button className="btn-ghost py-1 px-2 text-xs" onClick={e => { e.stopPropagation(); viewInvoice(sale); }}>
                      {loadingDetail ? '⏳' : '🧾'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

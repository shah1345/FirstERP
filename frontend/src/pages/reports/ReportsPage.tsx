import { useState, useRef } from 'react';
import api from '../../services/api';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'range';

interface ReportSection {
  key: string;
  label: string;
  icon: string;
}

const ALL_SECTIONS: ReportSection[] = [
  { key: 'sales_summary', label: 'Sales Summary', icon: '📋' },
  { key: 'product_wise', label: 'Product-wise Sales', icon: '🔋' },
  { key: 'payment_breakdown', label: 'Cash / Credit Breakdown', icon: '💵' },
  { key: 'profit_loss', label: 'Profit / Loss Statement', icon: '📊' },
  { key: 'stock_report', label: 'Stock Report', icon: '📦' },
  { key: 'credit_parties', label: 'Credit Party Balance', icon: '💳' },
  { key: 'stock_in', label: 'Stock-In (Purchases)', icon: '🚚' },
  { key: 'payments_received', label: 'Payments Received', icon: '💰' },
];

export default function ReportsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekValue, setWeekValue] = useState('');
  const [monthValue, setMonthValue] = useState(new Date().toISOString().slice(0, 7));
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear()));
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [selectedSections, setSelectedSections] = useState<string[]>(ALL_SECTIONS.map(s => s.key));
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: string) => {
    setSelectedSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAllSections = () => setSelectedSections(ALL_SECTIONS.map(s => s.key));
  const clearAllSections = () => setSelectedSections([]);

  const generateReport = async () => {
    if (selectedSections.length === 0) {
      alert('Please select at least one report section');
      return;
    }
    setLoading(true);
    try {
      const params: any = { type: periodType };
      switch (periodType) {
        case 'daily': params.value = dailyDate; break;
        case 'weekly': params.value = weekValue || dailyDate; break;
        case 'monthly': params.value = monthValue; break;
        case 'yearly': params.value = yearValue; break;
        case 'range': params.start_date = rangeStart; params.end_date = rangeEnd; break;
      }
      const res = await api.get('/reports/statement', { params });
      if (res.data.success) setReportData(res.data.data);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const el = reportRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Report — ${reportData?.period?.label || ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; padding: 20px; font-size: 11px; line-height: 1.4; }
  h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 18px 0 8px; padding: 6px 10px; background: #f3f4f6; border-left: 3px solid #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #f9fafb; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
  th, td { padding: 6px 8px; border: 1px solid #e5e7eb; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .bold { font-weight: 700; }
  .total-row { background: #f9fafb; font-weight: 800; }
  .header-block { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 14px; margin-bottom: 14px; }
  .header-block p { font-size: 11px; color: #666; margin: 2px 0; }
  .summary-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .summary-card { flex: 1; min-width: 120px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .summary-card .label { font-size: 9px; color: #666; text-transform: uppercase; font-weight: 600; }
  .summary-card .value { font-size: 16px; font-weight: 800; margin-top: 2px; }
  .profit { color: #16a34a; }
  .loss { color: #dc2626; }
  .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #999; }
  @media print { body { padding: 10px; } @page { margin: 12mm; size: A4; } }
</style></head><body>${el.innerHTML}
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString()}`;
  const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%';
  const show = (key: string) => selectedSections.includes(key);

  const getPeriodLabel = () => {
    if (!reportData) return '';
    const p = reportData.period;
    switch (p.type) {
      case 'daily': return `Daily Report — ${p.label}`;
      case 'weekly': return `Weekly Report — ${p.label}`;
      case 'monthly': return `Monthly Report — ${p.label}`;
      case 'yearly': return `Yearly Report — ${p.label}`;
      case 'range': return `Report — ${p.label}`;
      default: return `Report — ${p.label}`;
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', fontFamily: 'Barlow Condensed, sans-serif' }}>📊 Report Generator</h1>
          <p style={{ fontSize: '0.8rem', color: '#999' }}>Generate comprehensive business statements</p>
        </div>
      </div>

      {/* ─── CONTROLS ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        {/* Period Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Report Period</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['daily', 'weekly', 'monthly', 'yearly', 'range'] as PeriodType[]).map(t => (
              <button key={t} onClick={() => setPeriodType(t)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  border: periodType === t ? '2px solid #dc2626' : '1px solid #e5e7eb',
                  background: periodType === t ? '#fef2f2' : '#fff',
                  color: periodType === t ? '#dc2626' : '#666'
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          {periodType === 'daily' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Select Date</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }} />
            </div>
          )}
          {periodType === 'weekly' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Select Week</label>
              <input type="week" value={weekValue} onChange={e => setWeekValue(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }} />
            </div>
          )}
          {periodType === 'monthly' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Select Month</label>
              <input type="month" value={monthValue} onChange={e => setMonthValue(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }} />
            </div>
          )}
          {periodType === 'yearly' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Select Year</label>
              <select value={yearValue} onChange={e => setYearValue(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', background: '#fff' }}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          {periodType === 'range' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>From</label>
                <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>To</label>
                <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }} />
              </div>
            </>
          )}
        </div>

        {/* Section Selection */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>Include Sections</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={selectAllSections} style={{ fontSize: '0.7rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Select All</button>
              <button onClick={clearAllSections} style={{ fontSize: '0.7rem', color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear All</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_SECTIONS.map(s => (
              <button key={s.key} onClick={() => toggleSection(s.key)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  border: selectedSections.includes(s.key) ? '2px solid #dc2626' : '1px solid #e5e7eb',
                  background: selectedSections.includes(s.key) ? '#fef2f2' : '#fff',
                  color: selectedSections.includes(s.key) ? '#dc2626' : '#888'
                }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate + Print */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={generateReport} disabled={loading}
            style={{ padding: '10px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Generating...' : '📊 Generate Report'}
          </button>
          {reportData && (
            <button onClick={handlePrint}
              style={{ padding: '10px 24px', background: '#fff', color: '#333', border: '1px solid #e5e7eb', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
              🖨️ Print A4
            </button>
          )}
        </div>
      </div>

      {/* ─── REPORT OUTPUT ──────────────────────────────────────── */}
      {reportData ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          <div ref={reportRef} style={{ padding: 30 }}>

            {/* Report Header */}
            <div className="header-block" style={{ textAlign: 'center', borderBottom: '2px solid #dc2626', paddingBottom: 16, marginBottom: 18 }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
                {reportData.company?.shop_name || 'Battery Wholesale Shop'}
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#666', margin: '3px 0' }}>{reportData.company?.address}</p>
              <p style={{ fontSize: '0.8rem', color: '#666' }}>📞 {reportData.company?.phone} • ✉️ {reportData.company?.email}</p>
              {reportData.company?.tin_certificate_id && (
                <p style={{ fontSize: '0.75rem', color: '#999' }}>TIN: {reportData.company.tin_certificate_id}</p>
              )}
              <div style={{ marginTop: 10, padding: '6px 0', borderTop: '1px solid #eee' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: '#dc2626', margin: 0 }}>
                  BUSINESS STATEMENT
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#444', marginTop: 4, fontWeight: 600 }}>{getPeriodLabel()}</p>
                <p style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Generated: {new Date(reportData.generated_at).toLocaleString('en-GB')}</p>
              </div>
            </div>

            {/* ── 1. SALES SUMMARY ──────────────────────────── */}
            {show('sales_summary') && (
              <>
                <SectionHeader icon="📋" title="Sales Summary" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Total Invoices', value: reportData.sales_summary.active_count, prefix: '' },
                    { label: 'Total Sales', value: reportData.sales_summary.total_sales, prefix: '৳' },
                    { label: 'Total Cost', value: reportData.sales_summary.total_cost, prefix: '৳' },
                    { label: 'Gross Profit', value: reportData.sales_summary.total_profit, prefix: '৳', color: parseFloat(reportData.sales_summary.total_profit) >= 0 ? '#16a34a' : '#dc2626' },
                    { label: 'VAT Collected', value: reportData.sales_summary.total_vat, prefix: '৳' },
                    { label: 'Total Due', value: reportData.sales_summary.total_due, prefix: '৳', color: '#dc2626' },
                  ].map((c, i) => (
                    <div key={i} style={{ flex: '1 1 140px', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: c.color || '#111', marginTop: 2 }}>
                        {c.prefix}{Number(c.value || 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                {reportData.sales_summary.deleted_count > 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: 10 }}>
                    ⚠️ {reportData.sales_summary.deleted_count} sale(s) were deleted during this period
                  </p>
                )}
              </>
            )}

            {/* ── 2. PRODUCT-WISE SALES ────────────────────── */}
            {show('product_wise') && reportData.product_wise?.length > 0 && (
              <>
                <SectionHeader icon="🔋" title="Product-wise Sales" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: 14 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Qty Sold</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Avg Cost</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Avg Sell</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.product_wise.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{p.product_name}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{p.qty_sold}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(p.avg_cost_price)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(p.avg_sell_price)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(p.total_revenue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(p.total_cost)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: parseFloat(p.total_profit) >= 0 ? '#16a34a' : '#dc2626' }}>
                          {fmt(p.total_profit)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                      <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>TOTAL</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{reportData.product_wise.reduce((s: number, p: any) => s + parseInt(p.qty_sold), 0)}</td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.product_wise.reduce((s: number, p: any) => s + parseFloat(p.total_revenue), 0))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.product_wise.reduce((s: number, p: any) => s + parseFloat(p.total_cost), 0))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a' }}>
                        {fmt(reportData.product_wise.reduce((s: number, p: any) => s + parseFloat(p.total_profit), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* ── 3. CASH / CREDIT BREAKDOWN ───────────────── */}
            {show('payment_breakdown') && reportData.payment_breakdown?.length > 0 && (
              <>
                <SectionHeader icon="💵" title="Payment Method Breakdown" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: 14 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Payment Method</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Invoices</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total Amount</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Received</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.payment_breakdown.map((p: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, textTransform: 'capitalize' }}>
                          {p.payment_method === 'cash' ? '💵' : p.payment_method === 'credit' ? '💳' : p.payment_method === 'card' ? '💳' : '📱'}{' '}
                          {(p.payment_method || '').replace('_', ' ')}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{p.count}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(p.amount)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a' }}>{fmt(p.paid)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: parseFloat(p.due) > 0 ? '#dc2626' : '#999' }}>{fmt(p.due)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                      <td style={tdStyle}>TOTAL</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{reportData.payment_breakdown.reduce((s: number, p: any) => s + parseInt(p.count), 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.payment_breakdown.reduce((s: number, p: any) => s + parseFloat(p.amount), 0))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a' }}>{fmt(reportData.payment_breakdown.reduce((s: number, p: any) => s + parseFloat(p.paid), 0))}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626' }}>{fmt(reportData.payment_breakdown.reduce((s: number, p: any) => s + parseFloat(p.due), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* ── 4. PROFIT / LOSS STATEMENT ───────────────── */}
            {show('profit_loss') && (
              <>
                <SectionHeader icon="📊" title="Profit / Loss Statement" />
                <table style={{ width: '100%', maxWidth: 500, borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: 14 }}>
                  <tbody>
                    {[
                      { label: 'Total Revenue (Sales)', value: reportData.profit_loss.total_revenue, bold: true },
                      { label: 'Less: Cost of Goods Sold', value: `-${fmt(reportData.profit_loss.total_cost)}`, raw: true, color: '#dc2626' },
                      { label: 'Gross Profit', value: reportData.profit_loss.gross_profit, bold: true, color: reportData.profit_loss.gross_profit >= 0 ? '#16a34a' : '#dc2626', border: true },
                      { label: 'VAT Collected', value: reportData.profit_loss.vat_collected },
                      { label: 'Less: Discounts Given', value: `-${fmt(reportData.profit_loss.discounts_given)}`, raw: true, color: '#dc2626' },
                      { label: 'Net Profit', value: reportData.profit_loss.net_profit, bold: true, color: reportData.profit_loss.net_profit >= 0 ? '#16a34a' : '#dc2626', border: true },
                      { label: 'Profit Margin', value: `${reportData.profit_loss.profit_margin}%`, raw: true, bold: true },
                    ].map((row, i) => (
                      <tr key={i} style={{ borderTop: row.border ? '2px solid #333' : '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px 10px', fontWeight: row.bold ? 700 : 400, color: '#333' }}>{row.label}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: row.bold ? 800 : 400, color: row.color || '#111', fontSize: row.bold ? '0.9rem' : '0.8rem' }}>
                          {row.raw ? row.value : fmt(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* ── 5. STOCK REPORT ──────────────────────────── */}
            {show('stock_report') && reportData.stock_report?.length > 0 && (
              <>
                <SectionHeader icon="📦" title="Current Stock Report" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Brand / Model</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Stock</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Cost Value</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Sale Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.stock_report.map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: parseInt(s.current_stock) <= 0 ? '#fef2f2' : 'transparent' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{s.product_name}</td>
                        <td style={{ ...tdStyle, color: '#666' }}>{s.brand} {s.model}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: parseInt(s.current_stock) <= 0 ? '#dc2626' : parseInt(s.current_stock) <= 5 ? '#ea580c' : '#16a34a' }}>
                          {s.current_stock}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(s.stock_value_cost)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(s.stock_value_sale)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>TOTAL</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{reportData.stock_totals.total_items}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.stock_totals.total_cost_value)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.stock_totals.total_sale_value)}</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600, marginBottom: 14 }}>
                  📈 Potential Profit in Stock: {fmt(reportData.stock_totals.potential_profit)}
                </p>
              </>
            )}

            {/* ── 6. CREDIT PARTY BALANCE ──────────────────── */}
            {show('credit_parties') && reportData.credit_parties?.length > 0 && (
              <>
                <SectionHeader icon="💳" title="Credit Party Balance" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Customer</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Phone</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total Purchase</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Paid</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.credit_parties.map((c: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{c.customer_name}</td>
                        <td style={{ ...tdStyle, color: '#666' }}>{c.phone || 'N/A'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(c.total_purchases)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a' }}>{fmt(c.total_payments)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(c.current_due)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'right' }}>{reportData.credit_totals.total_parties} PARTIES — TOTAL</td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#16a34a' }}>{fmt(reportData.credit_totals.total_collected)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626' }}>{fmt(reportData.credit_totals.total_receivable)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* ── 7. STOCK-IN (PURCHASES) ──────────────────── */}
            {show('stock_in') && reportData.stock_in?.length > 0 && (
              <>
                <SectionHeader icon="🚚" title="Stock-In (Purchases) During Period" />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: 14 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Qty Added</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total Investment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.stock_in.map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{s.product_name}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{s.qty_added}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(s.total_investment)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', fontWeight: 800 }}>
                      <td colSpan={2} style={{ ...tdStyle, textAlign: 'right' }}>TOTAL INVESTMENT</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{reportData.stock_in.reduce((s: number, r: any) => s + parseInt(r.qty_added), 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(reportData.stock_in_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* ── 8. PAYMENTS RECEIVED ─────────────────────── */}
            {show('payments_received') && (
              <>
                <SectionHeader icon="💰" title="Due Payments Received During Period" />
                <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: '0.85rem' }}>
                  <div style={{ border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 20px', background: '#f0fdf4' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Total Received</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{fmt(reportData.payments_received.total_received)}</div>
                  </div>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 20px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>No. of Payments</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111' }}>{reportData.payments_received.payment_count}</div>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: '0.65rem', color: '#bbb' }}>
              <p>This report was generated by {reportData.company?.shop_name || 'PowerCell'} POS System</p>
              <p>Period: {getPeriodLabel()} • Generated: {new Date(reportData.generated_at).toLocaleString('en-GB')}</p>
              {reportData.company?.invoice_footer && <p style={{ marginTop: 4 }}>{reportData.company.invoice_footer}</p>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333', marginBottom: 4 }}>No Report Generated</h3>
          <p style={{ color: '#999', fontSize: '0.85rem' }}>Select period type, date, and sections — then click Generate Report</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 style={{
      fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
      margin: '18px 0 8px', padding: '6px 10px', background: '#f3f4f6',
      borderLeft: '3px solid #dc2626', color: '#333'
    }}>
      {icon} {title}
    </h2>
  );
}

const thStyle: React.CSSProperties = {
  padding: '7px 8px', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase',
  letterSpacing: 0.3, border: '1px solid #e5e7eb', color: '#555'
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid #f3f4f6'
};

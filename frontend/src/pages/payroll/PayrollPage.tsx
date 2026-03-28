import { useState, useEffect } from 'react';
import { employeesAPI } from '../../services/api';

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadPayroll(); }, [month, year]);

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const res = await employeesAPI.getPayroll(month, year);
      setPayroll(res.data.data);
    } catch { }
    finally { setLoading(false); }
  };

  const generatePayroll = async () => {
    if (!confirm(`Generate payroll for ${monthName(month)} ${year}?`)) return;
    setGenerating(true);
    try {
      await employeesAPI.generatePayroll(month, year);
      loadPayroll();
    } catch (err: any) { alert(err.response?.data?.message || 'Error generating payroll'); }
    finally { setGenerating(false); }
  };

  const markPaid = async (id: number) => {
    await employeesAPI.markPayrollPaid(id);
    loadPayroll();
  };

  const monthName = (m: number) => new Date(2000, m - 1).toLocaleString('en', { month: 'long' });

  const totalPayable = payroll.reduce((s, p) => s + Number(p.net_salary), 0);
  const paidCount = payroll.filter(p => p.payment_status === 'paid').length;

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">Monthly salary generation & management</p>
        </div>
        <div className="flex gap-2">
          {payroll.length > 0 && (
            <button onClick={handlePrint} className="btn-outline">🖨️ Print Sheet</button>
          )}
          <button onClick={generatePayroll} disabled={generating} className="btn-power">
            {generating ? '⏳ Generating...' : '⚡ Generate Payroll'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="power-card p-5 flex items-end gap-5 flex-wrap">
        <div>
          <label className="power-label">Month</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="power-input">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="power-label">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="power-input">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {payroll.length > 0 && (
          <div className="ml-auto flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">৳{totalPayable.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Payable</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-green-600">{paidCount}</p>
              <p className="text-xs text-gray-500">Paid</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-orange-600">{payroll.length - paidCount}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        )}
      </div>

      {/* Payroll Table - printable */}
      <div className="power-card overflow-hidden">
        {/* Print Header */}
        <div className="hidden print:block p-6 text-center border-b">
          <h2 className="text-2xl font-black">Salary Sheet</h2>
          <p className="text-gray-600">{monthName(month)} {year}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Basic Salary</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Late Count</th>
                <th>Late Deduction</th>
                <th>Absence Deduction</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th className="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : payroll.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">💰</div>
                    <p className="font-medium">No payroll generated for {monthName(month)} {year}</p>
                    <p className="text-sm mt-1">Click "Generate Payroll" to calculate salaries</p>
                  </td>
                </tr>
              ) : payroll.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center text-red-700 text-xs font-black">
                        {p.employee_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{p.employee_name}</p>
                        <p className="text-xs text-gray-400">{p.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-medium">৳{Number(p.basic_salary).toLocaleString()}</td>
                  <td>
                    <span className="badge-green">{p.present_days}d</span>
                  </td>
                  <td>
                    {p.absent_days > 0 ? <span className="badge-red">{p.absent_days}d</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td>
                    {p.late_count > 0 ? <span className="badge-yellow">{p.late_count}×</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="text-yellow-700">
                    {Number(p.late_deduction) > 0 ? `-৳${Number(p.late_deduction).toLocaleString()}` : '-'}
                  </td>
                  <td className="text-red-600">
                    {Number(p.absence_deduction) > 0 ? `-৳${Number(p.absence_deduction).toLocaleString()}` : '-'}
                  </td>
                  <td>
                    <span className="text-lg font-black text-gray-900">৳{Number(p.net_salary).toLocaleString()}</span>
                  </td>
                  <td>
                    <span className={p.payment_status === 'paid' ? 'badge-green' : 'badge-yellow'}>
                      {p.payment_status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="no-print">
                    {p.payment_status !== 'paid' && (
                      <button onClick={() => markPaid(p.id)} className="btn-power py-1 px-3 text-xs">
                        💰 Mark Paid
                      </button>
                    )}
                    {p.payment_status === 'paid' && (
                      <span className="text-xs text-gray-400">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'Paid'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {payroll.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-black">
                  <td colSpan={7} className="px-4 py-3 text-right text-gray-700">TOTAL PAYABLE:</td>
                  <td colSpan={2} className="px-4 py-3 text-xl text-red-600">৳{totalPayable.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

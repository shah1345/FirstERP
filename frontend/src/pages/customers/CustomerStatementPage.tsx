import { useState, useEffect } from 'react';
import { customersAPI } from '../../services/api';

export default function CustomerStatementPage() {
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [statement, setStatement] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const res = await customersAPI.getAll({ type: 'credit' });
            setCustomers(res.data.data || []);
        } catch (error) {
            console.error('Failed to load customers');
        }
    };

    const loadStatement = async () => {
        if (!selectedCustomer) return;
        setLoading(true);
        try {
            const res = await customersAPI.getStatement(selectedCustomer.id, dateRange);
            setStatement(res.data.data);
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.message || 'Failed to load statement'));
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-5">
            {/* Header - Hide on print */}
            <div className="page-header no-print">
                <div>
                    <h1 className="page-title">Customer Statement</h1>
                    <p className="page-subtitle">Detailed account ledger with running balance</p>
                </div>
            </div>

            {/* Filters - Hide on print */}
            <div className="power-card p-6 no-print">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="power-label">Select Customer *</label>
                        <select
                            value={selectedCustomer?.id || ''}
                            onChange={(e) => {
                                const customer = customers.find(c => c.id === Number(e.target.value));
                                setSelectedCustomer(customer);
                                setStatement(null);
                            }}
                            className="power-input"
                        >
                            <option value="">-- Select Customer --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.customer_name} {c.current_balance > 0 && `(Due: ৳${Number(c.current_balance).toLocaleString()})`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="power-label">From Date</label>
                        <input
                            type="date"
                            value={dateRange.start_date}
                            onChange={(e) => setDateRange(d => ({ ...d, start_date: e.target.value }))}
                            className="power-input"
                        />
                    </div>
                    <div>
                        <label className="power-label">To Date</label>
                        <input
                            type="date"
                            value={dateRange.end_date}
                            onChange={(e) => setDateRange(d => ({ ...d, end_date: e.target.value }))}
                            className="power-input"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button onClick={loadStatement} disabled={!selectedCustomer || loading} className="btn-power">
                        {loading ? 'Loading...' : '📊 Generate Statement'}
                    </button>
                    {statement && (
                        <button onClick={handlePrint} className="btn-outline">
                            🖨️ Print Statement
                        </button>
                    )}
                </div>
            </div>

            {/* Statement Display */}
            {statement && (
                <div className="power-card p-8 print-area">
                    {/* Header */}
                    <div className="text-center mb-8 pb-6 border-b-2 border-gray-300">
                        <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                            CUSTOMER STATEMENT
                        </h1>
                        <div className="text-sm text-gray-600">
                            {statement.customer.customer_name}
                        </div>
                        {statement.customer.phone && (
                            <div className="text-sm text-gray-600">Phone: {statement.customer.phone}</div>
                        )}
                        {statement.customer.address && (
                            <div className="text-sm text-gray-600">{statement.customer.address}</div>
                        )}
                        <div className="text-sm text-gray-600 mt-2">
                            Statement Period: {new Date(dateRange.start_date).toLocaleDateString('en-GB')} to {new Date(dateRange.end_date).toLocaleDateString('en-GB')}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Opening Balance</div>
                            <div className="text-lg font-bold text-gray-900">৳{statement.summary.opening_balance.toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Total Purchases</div>
                            <div className="text-lg font-bold text-red-600">৳{statement.summary.total_purchases.toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Total Payments</div>
                            <div className="text-lg font-bold text-green-600">৳{statement.summary.total_payments.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #d1d5db', borderBottom: '2px solid #d1d5db' }}>
                                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
                                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Type</th>
                                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Details</th>
                                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Debit</th>
                                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Credit</th>
                                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statement.transactions.map((txn: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '8px' }}>{new Date(txn.date).toLocaleDateString('en-GB')}</td>
                                    <td style={{ padding: '8px' }}>
                                        {txn.type === 'sale' && <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>SALE</span>}
                                        {txn.type === 'payment' && <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>PAYMENT</span>}
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        {txn.type === 'sale' && (
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>Invoice: {txn.invoice}</div>
                                                {txn.products && txn.products.map((p: any, i: number) => (
                                                    <div key={i} style={{ fontSize: '11px', color: '#6b7280' }}>
                                                        {p.product_name} × {p.quantity} @ ৳{Number(p.unit_price).toLocaleString()}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {txn.type === 'payment' && (
                                            <div>
                                                <div>{txn.payment_method}</div>
                                                {txn.reference && <div style={{ fontSize: '11px', color: '#6b7280' }}>Ref: {txn.reference}</div>}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: '#991b1b', fontWeight: '500' }}>
                                        {txn.debit > 0 ? `৳${txn.debit.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: '#065f46', fontWeight: '500' }}>
                                        {txn.credit > 0 ? `৳${txn.credit.toLocaleString()}` : '—'}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: txn.balance > 0 ? '#991b1b' : txn.balance < 0 ? '#065f46' : '#000' }}>
                                        ৳{txn.balance.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Closing Balance */}
                    <div className="border-t-2 border-gray-300 pt-4">
                        <div className="flex justify-between items-center">
                            <div className="text-lg font-bold">CLOSING BALANCE:</div>
                            <div className={`text-2xl font-black ${statement.summary.closing_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ৳{statement.summary.closing_balance.toLocaleString()}
                            </div>
                        </div>
                        {statement.summary.closing_balance > 0 && (
                            <div className="text-right text-sm text-gray-500 mt-1">Amount Due</div>
                        )}
                        {statement.summary.closing_balance < 0 && (
                            <div className="text-right text-sm text-gray-500 mt-1">Credit Balance</div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-gray-300">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="border-t border-gray-400 pt-2 mt-8 text-center">
                                    <div className="text-sm text-gray-600">Customer Signature</div>
                                </div>
                            </div>
                            <div>
                                <div className="border-t border-gray-400 pt-2 mt-8 text-center">
                                    <div className="text-sm text-gray-600">Authorized Signature</div>
                                </div>
                            </div>
                        </div>
                        <div className="text-center text-xs text-gray-400 mt-6">
                            Generated on {new Date().toLocaleDateString('en-GB')} | Powered by PowerCell POS
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!statement && !loading && (
                <div className="power-card p-12 text-center no-print">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-gray-500 mb-2">No statement generated yet</p>
                    <p className="text-sm text-gray-400">Select a customer and date range to generate statement</p>
                </div>
            )}

            {/* Print Styles */}
            <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            padding: 20mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
        </div>
    );
}
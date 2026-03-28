import { useState } from 'react';
import { returnsAPI } from '../../services/api';

export default function ReturnsPage() {
    const [searchSerial, setSearchSerial] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searching, setSearching] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [returnItems, setReturnItems] = useState<any[]>([]);
    const [refundMethod, setRefundMethod] = useState('cash');
    const [reason, setReason] = useState('');

    const handleSearch = async () => {
        if (!searchSerial.trim()) return;
        setSearching(true);
        try {
            const res = await returnsAPI.searchProduct(searchSerial.trim());
            setSearchResult(res.data.data);
            if (res.data.data.eligible_for_return) {
                setReturnItems([{
                    sale_item_id: res.data.data.sale?.id,
                    serial_number: searchSerial.trim(),
                    quantity: 1,
                    reason: '',
                    condition_note: ''
                }]);
            }
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.message || 'Product not found'));
            setSearchResult(null);
        } finally {
            setSearching(false);
        }
    };

    const handleReturn = async () => {
        if (!searchResult || returnItems.length === 0) return;

        if (!confirm('Process this return? Stock will be restored to original batch.')) return;

        setProcessing(true);
        try {
            await returnsAPI.create({
                sale_id: searchResult.sale.id,
                items: returnItems,
                refund_method: refundMethod,
                reason: reason
            });
            alert('✅ Return processed successfully! Stock has been restored.');
            setSearchResult(null);
            setSearchSerial('');
            setReturnItems([]);
            setReason('');
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.message || 'Failed to process return'));
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Product Returns</h1>
                    <p className="page-subtitle">Search by serial number to process returns</p>
                </div>
            </div>

            {/* Search Section */}
            <div className="power-card p-6">
                <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    🔍 SEARCH PRODUCT
                </h2>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={searchSerial}
                        onChange={(e) => setSearchSerial(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter Serial Number (e.g., SN-12345678)"
                        className="power-input flex-1"
                    />
                    <button onClick={handleSearch} disabled={searching} className="btn-power px-8">
                        {searching ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {/* Search Result */}
            {searchResult && (
                <div className="power-card p-6">
                    <div className="flex items-start justify-between mb-6">
                        <h2 className="text-lg font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                            📦 PRODUCT DETAILS
                        </h2>
                        <button onClick={() => setSearchResult(null)} className="btn-ghost text-sm">✕ Close</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Product Info */}
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4 border">
                                <div className="text-xs text-gray-500 mb-1">Product</div>
                                <div className="text-lg font-bold text-gray-900">{searchResult.product.name}</div>
                                <div className="text-sm text-gray-600">{searchResult.product.brand} - {searchResult.product.model}</div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border">
                                <div className="text-xs text-gray-500 mb-1">Serial Number</div>
                                <div className="text-sm font-mono font-bold text-gray-900">{searchResult.serial_number}</div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border">
                                <div className="text-xs text-gray-500 mb-1">Batch</div>
                                <div className="text-sm font-medium text-gray-900">{searchResult.batch.batch_number}</div>
                                <div className="text-xs text-gray-500 mt-1">Purchase Cost: ৳{Number(searchResult.batch.purchase_price).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Sale & Warranty Info */}
                        <div className="space-y-4">
                            {searchResult.sale && (
                                <>
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                        <div className="text-xs text-blue-600 mb-1">Sale Information</div>
                                        <div className="text-sm font-bold text-gray-900">Invoice: {searchResult.sale.invoice_number}</div>
                                        <div className="text-xs text-gray-600 mt-1">
                                            Date: {new Date(searchResult.sale.sale_date).toLocaleDateString('en-GB')}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            Customer: {searchResult.sale.customer_name}
                                        </div>
                                        <div className="text-sm font-bold text-gray-900 mt-2">
                                            Sale Price: ৳{Number(searchResult.sale.sale_price).toLocaleString()}
                                        </div>
                                    </div>

                                    {searchResult.warranty && (
                                        <div className={`rounded-lg p-4 border ${searchResult.warranty.status === 'valid'
                                                ? 'bg-green-50 border-green-200'
                                                : 'bg-red-50 border-red-200'
                                            }`}>
                                            <div className={`text-xs mb-1 ${searchResult.warranty.status === 'valid' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                Warranty Status
                                            </div>
                                            <div className={`text-lg font-bold ${searchResult.warranty.status === 'valid' ? 'text-green-700' : 'text-red-700'
                                                }`}>
                                                {searchResult.warranty.status === 'valid' ? '✅ VALID' : '❌ EXPIRED'}
                                            </div>
                                            <div className="text-xs text-gray-600 mt-1">
                                                Period: {searchResult.warranty.months} months
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                Expires: {new Date(searchResult.warranty.end_date).toLocaleDateString('en-GB')}
                                            </div>
                                            {searchResult.warranty.status === 'valid' && (
                                                <div className="text-xs text-gray-600">
                                                    {searchResult.warranty.days_remaining} days remaining
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Eligibility */}
                            <div className={`rounded-lg p-4 border ${searchResult.eligible_for_return
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                }`}>
                                <div className="text-sm font-bold">
                                    {searchResult.eligible_for_return ? '✅ Eligible for Return' : '❌ Cannot Be Returned'}
                                </div>
                                {!searchResult.eligible_for_return && (
                                    <div className="text-xs text-gray-600 mt-1">
                                        {searchResult.status === 'in_stock' && 'Item not sold yet'}
                                        {searchResult.status === 'returned' && 'Already returned'}
                                        {searchResult.status === 'replaced' && 'Already replaced'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Return Form */}
                    {searchResult.eligible_for_return && (
                        <div className="mt-6 pt-6 border-t">
                            <h3 className="text-md font-bold mb-4">Process Return</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="power-label">Refund Method *</label>
                                        <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="power-input">
                                            <option value="cash">Cash</option>
                                            <option value="card">Card</option>
                                            <option value="mobile_banking">Mobile Banking</option>
                                            <option value="credit_adjustment">Credit Adjustment</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="power-label">Return Amount</label>
                                        <input type="text" value={`৳${Number(searchResult.sale.sale_price).toLocaleString()}`} disabled className="power-input bg-gray-100" />
                                    </div>
                                </div>

                                <div>
                                    <label className="power-label">Return Reason *</label>
                                    <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                                        placeholder="e.g., Defective, Wrong product, Customer request" className="power-input" />
                                </div>

                                <div>
                                    <label className="power-label">Condition Notes</label>
                                    <textarea value={returnItems[0]?.condition_note || ''}
                                        onChange={(e) => setReturnItems([{ ...returnItems[0], condition_note: e.target.value }])}
                                        placeholder="Describe the condition of the returned item..." className="power-input" rows={3} />
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Return Process:</div>
                                    <ul className="text-xs text-yellow-700 space-y-1">
                                        <li>• Stock will be restored to original batch: <strong>{searchResult.batch.batch_number}</strong></li>
                                        <li>• Profit will be adjusted automatically</li>
                                        <li>• Customer balance will be updated if credit sale</li>
                                        <li>• Refund amount: <strong>৳{Number(searchResult.sale.sale_price).toLocaleString()}</strong></li>
                                    </ul>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setSearchResult(null)} className="btn-ghost">Cancel</button>
                                    <button onClick={handleReturn} disabled={processing || !reason} className="btn-power">
                                        {processing ? 'Processing...' : '✅ Process Return'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Info Section */}
            {!searchResult && (
                <div className="power-card p-6 bg-blue-50 border-blue-200">
                    <h3 className="text-md font-bold mb-3 text-blue-900">ℹ️ How to Process Returns</h3>
                    <div className="space-y-2 text-sm text-blue-800">
                        <p><strong>Step 1:</strong> Enter the serial number of the product to return</p>
                        <p><strong>Step 2:</strong> System will show product details, sale info, and warranty status</p>
                        <p><strong>Step 3:</strong> If eligible, fill in return reason and condition</p>
                        <p><strong>Step 4:</strong> Process return - stock will automatically restore to original FIFO batch</p>
                        <p className="pt-2 border-t border-blue-200 mt-3">
                            <strong>Note:</strong> Returns can only be processed for sold items with valid warranties or within return policy period.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
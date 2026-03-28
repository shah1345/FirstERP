import { useState, useEffect } from 'react';
import { returnsAPI, replacementsAPI, productsAPI } from '../../services/api';

export default function ReplacementsPage() {
    const [searchSerial, setSearchSerial] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searching, setSearching] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [replacementProductId, setReplacementProductId] = useState<number | null>(null);
    const [replacementSerial, setReplacementSerial] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const res = await productsAPI.getAll();
            setProducts(res.data.data || []);
        } catch (error) {
            console.error('Failed to load products');
        }
    };

    const handleSearch = async () => {
        if (!searchSerial.trim()) return;
        setSearching(true);
        try {
            const res = await returnsAPI.searchProduct(searchSerial.trim());
            setSearchResult(res.data.data);
            if (res.data.data.eligible_for_replacement) {
                setReplacementProductId(res.data.data.product.id);
            }
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.message || 'Product not found'));
            setSearchResult(null);
        } finally {
            setSearching(false);
        }
    };

    const handleReplacement = async () => {
        if (!searchResult || !replacementProductId) return;

        if (!confirm('Process this replacement? Old product will be returned and new product will be issued from FIFO batch.')) return;

        setProcessing(true);
        try {
            await replacementsAPI.create({
                returned_serial: searchSerial.trim(),
                replacement_product_id: replacementProductId,
                replacement_serial: replacementSerial || undefined,
                reason: reason
            });
            alert('✅ Replacement processed successfully! Warranty has been reset.');
            setSearchResult(null);
            setSearchSerial('');
            setReplacementProductId(null);
            setReplacementSerial('');
            setReason('');
        } catch (error: any) {
            alert('Error: ' + (error.response?.data?.message || 'Failed to process replacement'));
        } finally {
            setProcessing(false);
        }
    };

    const selectedProduct = products.find(p => p.id === replacementProductId);

    return (
        <div className="space-y-5">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Product Replacements</h1>
                    <p className="page-subtitle">Warranty-based product replacements</p>
                </div>
            </div>

            {/* Search Section */}
            <div className="power-card p-6">
                <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                    🔍 SEARCH DEFECTIVE PRODUCT
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
                            🔄 REPLACEMENT DETAILS
                        </h2>
                        <button onClick={() => setSearchResult(null)} className="btn-ghost text-sm">✕ Close</button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Returned Product */}
                        <div className="space-y-4">
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                                <div className="text-xs text-red-600 font-bold mb-2">❌ RETURNED PRODUCT</div>
                                <div className="text-lg font-bold text-gray-900">{searchResult.product.name}</div>
                                <div className="text-sm text-gray-600 mb-3">{searchResult.product.brand} - {searchResult.product.model}</div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Serial:</span>
                                        <span className="font-mono font-bold">{searchResult.serial_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Batch:</span>
                                        <span className="font-medium">{searchResult.batch.batch_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Invoice:</span>
                                        <span className="font-medium">{searchResult.sale?.invoice_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Sale Date:</span>
                                        <span>{new Date(searchResult.sale?.sale_date).toLocaleDateString('en-GB')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Warranty Status */}
                            {searchResult.warranty && (
                                <div className={`rounded-lg p-4 border-2 ${searchResult.warranty.status === 'valid'
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-red-50 border-red-200'
                                    }`}>
                                    <div className="text-xs font-bold mb-2">WARRANTY STATUS</div>
                                    <div className={`text-2xl font-black mb-2 ${searchResult.warranty.status === 'valid' ? 'text-green-700' : 'text-red-700'
                                        }`}>
                                        {searchResult.warranty.status === 'valid' ? '✅ VALID' : '❌ EXPIRED'}
                                    </div>
                                    <div className="text-xs space-y-1">
                                        <div>Period: {searchResult.warranty.months} months</div>
                                        <div>Expires: {new Date(searchResult.warranty.end_date).toLocaleDateString('en-GB')}</div>
                                        {searchResult.warranty.status === 'valid' && (
                                            <div className="text-green-700 font-bold">{searchResult.warranty.days_remaining} days remaining</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Eligibility */}
                            <div className={`rounded-lg p-4 border-2 ${searchResult.eligible_for_replacement
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                }`}>
                                <div className="text-sm font-bold">
                                    {searchResult.eligible_for_replacement ? '✅ Eligible for Replacement' : '❌ Cannot Be Replaced'}
                                </div>
                                {!searchResult.eligible_for_replacement && (
                                    <div className="text-xs text-gray-600 mt-1">
                                        {searchResult.warranty?.status === 'expired' && 'Warranty has expired'}
                                        {searchResult.status === 'in_stock' && 'Item not sold yet'}
                                        {searchResult.status === 'returned' && 'Already returned'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Replacement Product */}
                        <div className="space-y-4">
                            {searchResult.eligible_for_replacement && (
                                <>
                                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                        <div className="text-xs text-green-600 font-bold mb-2">✅ REPLACEMENT PRODUCT</div>

                                        <div>
                                            <label className="power-label">Select Product *</label>
                                            <select
                                                value={replacementProductId || ''}
                                                onChange={(e) => setReplacementProductId(Number(e.target.value))}
                                                className="power-input"
                                            >
                                                <option value="">-- Select Product --</option>
                                                {products.filter(p => Number(p.total_stock) > 0).map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.product_name} - {p.brand} ({p.total_stock} in stock)
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">
                                                ℹ️ System will use FIFO to select the oldest batch
                                            </p>
                                        </div>

                                        {selectedProduct && (
                                            <div className="mt-4 p-3 bg-white rounded border space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Product:</span>
                                                    <span className="font-bold">{selectedProduct.product_name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Brand:</span>
                                                    <span>{selectedProduct.brand}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Available Stock:</span>
                                                    <span className="font-bold text-green-600">{selectedProduct.total_stock} units</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Sale Price:</span>
                                                    <span>৳{Number(selectedProduct.sale_price).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Warranty:</span>
                                                    <span>{selectedProduct.warranty_months} months</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="power-label">Replacement Serial Number (Optional)</label>
                                        <input
                                            type="text"
                                            value={replacementSerial}
                                            onChange={(e) => setReplacementSerial(e.target.value)}
                                            placeholder="SN-87654321"
                                            className="power-input"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Leave blank to auto-assign</p>
                                    </div>

                                    <div>
                                        <label className="power-label">Replacement Reason *</label>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="e.g., Battery not holding charge, Physical damage, Manufacturing defect..."
                                            className="power-input"
                                            rows={3}
                                        />
                                    </div>

                                    {/* Process Info */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="text-sm font-semibold text-blue-800 mb-2">🔄 Replacement Process:</div>
                                        <ul className="text-xs text-blue-700 space-y-1">
                                            <li>• Returned product restocked to batch: <strong>{searchResult.batch.batch_number}</strong></li>
                                            <li>• Replacement issued using FIFO (oldest batch first)</li>
                                            <li>• Warranty will reset from today's date</li>
                                            <li>• Profit recalculated with new batch cost</li>
                                            <li>• Sale record updated with replacement details</li>
                                        </ul>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4">
                                        <button onClick={() => setSearchResult(null)} className="btn-ghost">Cancel</button>
                                        <button
                                            onClick={handleReplacement}
                                            disabled={processing || !replacementProductId || !reason}
                                            className="btn-power"
                                        >
                                            {processing ? 'Processing...' : '🔄 Process Replacement'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Section */}
            {!searchResult && (
                <div className="power-card p-6 bg-purple-50 border-purple-200">
                    <h3 className="text-md font-bold mb-3 text-purple-900">ℹ️ How to Process Replacements</h3>
                    <div className="space-y-2 text-sm text-purple-800">
                        <p><strong>Step 1:</strong> Enter the serial number of the defective product</p>
                        <p><strong>Step 2:</strong> System will verify warranty status and eligibility</p>
                        <p><strong>Step 3:</strong> Select replacement product (same model or different)</p>
                        <p><strong>Step 4:</strong> System uses FIFO to pick oldest available batch</p>
                        <p><strong>Step 5:</strong> Warranty resets from replacement date</p>
                        <p className="pt-2 border-t border-purple-200 mt-3">
                            <strong>Note:</strong> Replacements are only allowed for products with valid warranties. The old product returns to its original batch and the new product is deducted using FIFO.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
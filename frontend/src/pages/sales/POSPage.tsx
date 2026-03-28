import { useState, useEffect, useRef, useCallback } from 'react';
import { productsAPI, salesAPI, companyAPI, customersAPI } from '../../services/api';
import { saveOfflineSale } from '../../offline/sync';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import JsBarcode from 'jsbarcode';

// Barcode component for serial numbers
function SerialBarcode({ value, width = 1.5, height = 40 }: { value: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: 'CODE128',
          width,
          height,
          displayValue: true,
          fontSize: 16,
          fontOptions: 'bold',
          font: 'monospace',
          textMargin: 4,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
    }
  }, [value, width, height]);
  
  return <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />;
}

interface CartItem {
  product_id: number;
  product_name: string;
  brand: string;
  model: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  vat_percentage: number;
  total_stock: number;
  serial_numbers?: string[]; // selected serial numbers for this cart item
  available_serials?: SerialNumber[]; // available serials to pick from
}

interface Customer {
  id: number;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  customer_type: string;
  credit_limit: number;
  current_balance: number;
}

interface SerialNumber {
  id: number;
  product_id: number;
  batch_id: number;
  serial_number: string;
  status: string;
}

export default function POSPage() {
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [discountStr, setDiscountStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Customer search states
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchField, setCustomerSearchField] = useState<'name' | 'phone' | null>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price editing states
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editPriceStr, setEditPriceStr] = useState('');
  const editPriceRef = useRef<HTMLInputElement>(null);

  // Serial number modal states
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [serialModalProductId, setSerialModalProductId] = useState<number | null>(null);
  const [availableSerials, setAvailableSerials] = useState<SerialNumber[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [serialSearch, setSerialSearch] = useState('');

  useEffect(() => {
    loadProducts();
    companyAPI.get().then(r => setCompany(r.data.data)).catch(() => { });
    searchRef.current?.focus();
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProducts = async () => {
    try {
      const res = await productsAPI.getAll();
      setProducts(res.data.data || []);
    } catch { console.error('Failed to load products'); }
  };

  // Customer search with debounce
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      return;
    }
    try {
      const res = await customersAPI.search(query);
      const results = res.data.data || res.data || [];
      setCustomerSuggestions(results);
      setShowCustomerDropdown(results.length > 0);
    } catch {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
    }
  };

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    setCustomerId(null); // reset selected customer
    setCustomerSearchField('name');
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    customerSearchTimer.current = setTimeout(() => searchCustomers(value), 300);
  };

  const handleCustomerPhoneChange = (value: string) => {
    setCustomerPhone(value);
    setCustomerId(null);
    setCustomerSearchField('phone');
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    customerSearchTimer.current = setTimeout(() => searchCustomers(value), 300);
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.customer_name);
    setCustomerPhone(customer.phone || '');
    setCustomerId(customer.id);
    setShowCustomerDropdown(false);
    setCustomerSuggestions([]);
  };

  // Serial number functions
  const loadSerialNumbers = async (productId: number) => {
    try {
      const res = await productsAPI.getSerialNumbers(productId);
      const serials = (res.data.data || res.data || []).filter(
        (s: SerialNumber) => s.status === 'in_stock' || s.status === 'available'
      );
      return serials;
    } catch {
      console.error('Failed to load serial numbers');
      return [];
    }
  };

  const openSerialModal = async (productId: number) => {
    setSerialModalProductId(productId);
    setSerialSearch('');
    const serials = await loadSerialNumbers(productId);
    setAvailableSerials(serials);

    // Pre-select already chosen serials for this cart item
    const cartItem = cart.find(i => i.product_id === productId);
    setSelectedSerials(cartItem?.serial_numbers || []);
    setShowSerialModal(true);
  };

  const toggleSerial = (serialNumber: string) => {
    setSelectedSerials(prev => {
      if (prev.includes(serialNumber)) {
        return prev.filter(s => s !== serialNumber);
      }
      // Limit selection to cart item quantity
      const cartItem = cart.find(i => i.product_id === serialModalProductId);
      if (cartItem && prev.length >= cartItem.quantity) return prev;
      return [...prev, serialNumber];
    });
  };

  const confirmSerials = () => {
    if (serialModalProductId === null) return;
    setCart(prev => prev.map(item =>
      item.product_id === serialModalProductId
        ? { ...item, serial_numbers: selectedSerials }
        : item
    ));
    setShowSerialModal(false);
    setSerialModalProductId(null);
  };

  // Price editing functions
  const startEditPrice = (productId: number, currentPrice: number) => {
    setEditingPriceId(productId);
    setEditPriceStr(currentPrice.toString());
    setTimeout(() => editPriceRef.current?.select(), 50);
  };

  const confirmEditPrice = (productId: number) => {
    const newPrice = parseFloat(editPriceStr);
    if (!isNaN(newPrice) && newPrice >= 0) {
      setCart(prev => prev.map(item =>
        item.product_id === productId
          ? { ...item, unit_price: newPrice }
          : item
      ));
    }
    setEditingPriceId(null);
    setEditPriceStr('');
  };

  const cancelEditPrice = () => {
    setEditingPriceId(null);
    setEditPriceStr('');
  };

  const filtered = products.filter(p =>
    !search ||
    p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = async (product: any) => {
    if (Number(product.total_stock) <= 0) return;

    // Load available serials for this product
    let serials: SerialNumber[] = [];
    if (isOnline) {
      try {
        serials = await loadSerialNumbers(product.id);
      } catch { }
    }

    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) {
        if (ex.quantity >= Number(product.total_stock)) return prev;
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.product_name,
        brand: product.brand || '',
        model: product.model || '',
        quantity: 1,
        unit_price: Number(product.sale_price),
        original_price: Number(product.sale_price),
        vat_percentage: Number(product.vat_percentage) || 0,
        total_stock: Number(product.total_stock),
        serial_numbers: [],
        available_serials: serials,
      }];
    });
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) { setCart(p => p.filter(i => i.product_id !== id)); return; }
    setCart(p => p.map(i => {
      if (i.product_id !== id) return i;
      if (qty > i.total_stock) return i;
      // Trim serial numbers if quantity reduced
      const trimmedSerials = i.serial_numbers && i.serial_numbers.length > qty
        ? i.serial_numbers.slice(0, qty)
        : i.serial_numbers;
      return { ...i, quantity: qty, serial_numbers: trimmedSerials };
    }));
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const vatTotal = cart.reduce((s, i) => s + (i.unit_price * i.quantity * i.vat_percentage / 100), 0);
  const discountAmt = Math.max(0, parseFloat(discountStr) || 0);
  const total = Math.max(0, subtotal + vatTotal - discountAmt);
  const paidAmount = paidAmountStr !== '' ? Math.max(0, parseFloat(paidAmountStr) || 0) : total;
  const due = Math.max(0, total - paidAmount);
  const change = Math.max(0, paidAmount - total);

  const handleSale = async () => {
    if (!cart.length) return;
    setLoading(true);

    const saleData = {
      customer_id: customerId,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      items: cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        brand: item.brand,
        model: item.model,
        quantity: item.quantity,
        unit_price: item.unit_price,
        original_price: item.original_price,
        price_edited: item.unit_price !== item.original_price,
        vat_percentage: item.vat_percentage,
        serial_numbers: item.serial_numbers || [],
      })),
      payment_method: paymentMethod,
      paid_amount: paidAmount,
      discount_amount: discountAmt,
    };

    try {
      let invoiceNumber: string;
      let saleId: number | undefined;

      if (isOnline) {
        const res = await salesAPI.create(saleData);
        invoiceNumber = res.data.invoice_number;
        saleId = res.data.sale_id;

        if (!saleId) {
          return;
        }
        const detailRes = await salesAPI.getOne(saleId);
        const savedSale = detailRes.data.data;

        setInvoiceData({
          invoice_number: invoiceNumber,
          sale_id: saleId,
          customer_name: savedSale.customer_name,
          customer_phone: savedSale.customer_phone,
          items: savedSale.items,
          payment_method: savedSale.payment_method,
          subtotal: Number(savedSale.subtotal),
          vat_total: Number(savedSale.vat_amount),
          discount: Number(savedSale.discount_amount),
          total: Number(savedSale.total_amount),
          paid: Number(savedSale.paid_amount),
          due: Number(savedSale.due_amount),
          change: change,
          date: savedSale.created_at,
          company: savedSale.company,
        });
      } else {
        const localId = await saveOfflineSale(saleData);
        invoiceNumber = `OFF-${localId}`;

        setInvoiceData({
          invoice_number: invoiceNumber,
          customer_name: saleData.customer_name,
          customer_phone: saleData.customer_phone,
          items: cart.map(i => ({ ...i, batch_number: 'OFFLINE' })),
          payment_method: paymentMethod,
          subtotal, vat_total: vatTotal, discount: discountAmt, total, paid: paidAmount, due, change,
          offline: true,
          date: new Date().toISOString(),
          company,
        });
      }

      setShowInvoice(true);
      setCart([]);
      setPaidAmountStr('');
      setDiscountStr('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerId(null);
      setPaymentMethod('cash');
      loadProducts();
    } catch (err: any) {
      alert('❌ ' + (err.response?.data?.message || 'Sale failed'));
    } finally {
      setLoading(false);
    }
  };

  // Print functions
  const printPOS = () => {
    document.body.classList.add('pos-print-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('pos-print-mode'), 100);
  };

  const printA4 = () => {
    document.body.classList.remove('pos-print-mode');
    window.print();
  };

  const payIcons: Record<string, string> = { cash: '💵', card: '💳', mobile_banking: '📱', credit: '📝' };

  const filteredSerials = availableSerials.filter(s =>
    !serialSearch || s.serial_number.toLowerCase().includes(serialSearch.toLowerCase())
  );

  return (
    <>
      {/* SERIAL NUMBER MODAL */}
      {showSerialModal && (
        <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={() => setShowSerialModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                  🔢 Select Serial Numbers
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedSerials.length} / {cart.find(i => i.product_id === serialModalProductId)?.quantity || 0} selected
                </p>
              </div>
              <button onClick={() => setShowSerialModal(false)} className="btn-ghost py-1.5 px-3 text-sm">✕</button>
            </div>

            <div className="px-4 py-3 border-b">
              <input
                type="text"
                value={serialSearch}
                onChange={e => setSerialSearch(e.target.value)}
                className="power-input text-sm py-2"
                placeholder="🔍 Search serial number..."
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
              {filteredSerials.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 text-gray-300">
                  <p className="text-sm">No serial numbers available</p>
                </div>
              ) : filteredSerials.map(serial => (
                <label key={serial.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${selectedSerials.includes(serial.serial_number)
                    ? 'bg-red-50 border-red-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                  <input
                    type="checkbox"
                    checked={selectedSerials.includes(serial.serial_number)}
                    onChange={() => toggleSerial(serial.serial_number)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{serial.serial_number}</p>
                    <p className="text-xs text-gray-400">Batch #{serial.batch_id}</p>
                  </div>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {serial.status}
                  </span>
                </label>
              ))}
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <button onClick={() => setShowSerialModal(false)} className="btn-ghost flex-1 py-2 text-sm">
                Cancel
              </button>
              <button onClick={confirmSerials} className="btn-power flex-1 justify-center py-2 text-sm">
                ✅ Confirm ({selectedSerials.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {showInvoice && invoiceData && (
        <div className="modal-backdrop" onClick={() => setShowInvoice(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Toolbar - 2 Print Buttons */}
            <div className="flex items-center justify-between px-6 py-4 border-b no-print">
              <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                ✅ Sale Complete — #{invoiceData.invoice_number}
              </h3>
              <div className="flex gap-2">
                <button onClick={printPOS} className="btn-power text-sm py-1.5 px-3 bg-blue-600 hover:bg-blue-700">
                  POS
                </button>
                <button onClick={printA4} className="btn-power text-sm py-1.5 px-3">
                  Print
                </button>
                <button onClick={() => setShowInvoice(false)} className="btn-ghost py-1.5 px-3">✕</button>
              </div>
            </div>

            {/* PRINTABLE INVOICE AREA - ONLY THIS PRINTS */}
            <div className="invoice-print-area p-10">
              {/* Company Header */}
              <div className="text-center mb-6">
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: 2 }}>
                  {(invoiceData.company || company)?.shop_name || 'Lata Battery Wholesale'}
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#555' }}>{(invoiceData.company || company)?.address || 'Dhaka, Bangladesh'}</p>
                <p style={{ fontSize: '0.75rem', color: '#555' }}>
                  📞 {(invoiceData.company || company)?.phone || '+880 1700-000000'} | ✉ {(invoiceData.company || company)?.email || 'info@powercell.com'}
                </p>
                {(invoiceData.company || company)?.tin_certificate_id && (
                  <p style={{ fontSize: '0.75rem', color: '#555' }}>TIN: {(invoiceData.company || company).tin_certificate_id}</p>
                )}
                <p style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem', marginTop: 2 }}>
                  VAT {(invoiceData.company || company)?.vat_percentage || 5.00}% Registered Dealer
                </p>
              </div>

              <hr style={{ borderTop: '1px solid #ccc', margin: '20px 0' }} />

              {/* Invoice Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: '0.85rem' }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#111', marginBottom: 4 }}>
                    INVOICE #{invoiceData.invoice_number}
                  </p>
                  <p style={{ color: '#555', marginBottom: 2 }}><strong>Bill To:</strong></p>
                  <p style={{ color: '#111', fontWeight: 600 }}>{invoiceData.customer_name}</p>
                  {invoiceData.customer_phone && <p style={{ color: '#555', fontSize: '0.8rem' }}>{invoiceData.customer_phone}</p>}
                </div>
                <div style={{ textAlign: 'right', color: '#555', fontSize: '0.8rem' }}>
                  <p><strong>Date:</strong> {new Date(invoiceData.date).toLocaleDateString('en-GB')}</p>
                  <p><strong>Time:</strong> {new Date(invoiceData.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                  <p style={{ marginTop: 4 }}>
                    <strong>Payment:</strong> {payIcons[invoiceData.payment_method]} {invoiceData.payment_method}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#333' }}>#</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#333' }}>Item</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#333' }}>Qty</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#333' }}>Unit Price</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#333' }}>VAT</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#333' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items?.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 6px', color: '#999' }}>{i + 1}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <strong style={{ color: '#111', display: 'block' }}>{item.product_name}</strong>
                        {item.batch_number && (
                          <span style={{ fontSize: '0.75rem', color: '#999' }}>Batch: {item.batch_number}</span>
                        )}
                        {item.serial_numbers && item.serial_numbers.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {item.serial_numbers.map((sn: string, idx: number) => (
                              <div key={idx} style={{ display: 'inline-block', marginRight: 8, marginBottom: 4 }}>
                                <SerialBarcode value={sn} width={1.5} height={40} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>৳{Number(item.unit_price).toLocaleString()}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>৳{Number(item.vat_amount || 0).toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>
                        ৳{Number(item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <table style={{ width: 260, fontSize: '0.85rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '4px 0', textAlign: 'right', paddingRight: 10 }}>Subtotal:</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>৳{invoiceData.subtotal.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', textAlign: 'right', paddingRight: 10 }}>VAT ({(invoiceData.company || company)?.vat_percentage || 5}%):</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600 }}>৳{invoiceData.vat_total.toFixed(2)}</td>
                    </tr>
                    {invoiceData.discount > 0 && (
                      <tr>
                        <td style={{ padding: '4px 0', textAlign: 'right', paddingRight: 10, color: '#16a34a' }}>Discount:</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>-৳{invoiceData.discount.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '1px solid #333', fontWeight: 900 }}>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right', paddingRight: 10, fontSize: '1rem' }}>TOTAL:</td>
                      <td style={{ padding: '8px 0 4px', textAlign: 'right', fontSize: '1rem', color: '#dc2626' }}>
                        ৳{invoiceData.total.toLocaleString()}
                      </td>
                    </tr>
                    <tr style={{ color: '#16a34a' }}>
                      <td style={{ padding: '4px 0', textAlign: 'right', paddingRight: 10, fontWeight: 600 }}>Paid ({invoiceData.payment_method}):</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700 }}>৳{invoiceData.paid.toLocaleString()}</td>
                    </tr>
                    {invoiceData.due > 0 && (
                      <tr style={{ color: '#dc2626', fontWeight: 700 }}>
                        <td style={{ padding: '4px 0', textAlign: 'right', paddingRight: 10 }}>DUE:</td>
                        <td style={{ padding: '4px 0', textAlign: 'right' }}>৳{invoiceData.due.toLocaleString()}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              {(invoiceData.company || company)?.invoice_footer && (
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#999', fontStyle: 'italic', marginTop: 30, borderTop: '1px solid #eee', paddingTop: 10 }}>
                  {(invoiceData.company || company).invoice_footer}
                </p>
              )}
              <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#ccc', marginTop: 6 }}>
                Powered by PowerCell POS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* POS MAIN LAYOUT */}
      <div className="flex h-[calc(100vh-112px)] gap-5 -m-6 p-6">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-4 flex gap-3">
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              className="power-input flex-1" placeholder="🔍 Search product name, brand, barcode..." />
            {!isOnline && (
              <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-semibold px-3 rounded-lg border border-orange-200">
                📴 Offline
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
              {filtered.map(product => (
                <div key={product.id} onClick={() => addToCart(product)}
                  className={`pos-product-card ${Number(product.total_stock) <= 0 ? 'out-of-stock' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">🔋</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(product.total_stock) > 10 ? 'badge-green' : Number(product.total_stock) > 0 ? 'badge-yellow' : 'badge-red'
                      }`}>
                      {Number(product.total_stock) > 0 ? `${product.total_stock} pcs` : 'Out'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-snug mb-0.5">{product.product_name}</p>
                  <p className="text-xs text-gray-400 mb-2">{product.brand} {product.model && `· ${product.model}`}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-red-600">৳{Number(product.sale_price).toLocaleString()}</p>
                    {Number(product.vat_percentage) > 0 && (
                      <span className="text-xs text-gray-400">+{product.vat_percentage}% VAT</span>
                    )}
                  </div>
                  {Number(product.batch_count) > 1 && (
                    <p className="text-xs text-blue-500 mt-1 font-semibold">⚡ {product.batch_count} batches</p>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-3 flex flex-col items-center justify-center h-48 text-gray-300">
                  <span className="text-5xl mb-2">🔋</span>
                  <p>No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 xl:w-96 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.1rem' }}>
              🛒 CART ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-red-200 hover:text-white text-xs font-medium">
                Clear All
              </button>
            )}
          </div>

          {/* Customer fields with autocomplete */}
          <div className="p-3 border-b bg-gray-50 space-y-2 relative" ref={customerDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={e => handleCustomerNameChange(e.target.value)}
                onFocus={() => { if (customerSuggestions.length > 0 && customerSearchField === 'name') setShowCustomerDropdown(true); }}
                className="power-input text-xs py-2"
                placeholder="👤 Customer Name (optional)"
                autoComplete="off"
              />
              {customerId && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded">
                  ID: {customerId}
                </span>
              )}
            </div>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => handleCustomerPhoneChange(e.target.value)}
              onFocus={() => { if (customerSuggestions.length > 0 && customerSearchField === 'phone') setShowCustomerDropdown(true); }}
              className="power-input text-xs py-2"
              placeholder="📞 Phone"
              autoComplete="off"
            />

            {/* Customer suggestions dropdown */}
            {showCustomerDropdown && customerSuggestions.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50 max-h-48 overflow-y-auto">
                {customerSuggestions.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{customer.customer_name}</p>
                        <p className="text-xs text-gray-400">
                          {customer.phone && `📞 ${customer.phone}`}
                          {customer.customer_type && ` · ${customer.customer_type}`}
                        </p>
                      </div>
                      <span className="text-xs text-gray-300 font-mono">#{customer.id}</span>
                    </div>
                    {customer.current_balance > 0 && (
                      <p className="text-xs text-red-500 font-medium mt-0.5">
                        Due: ৳{Number(customer.current_balance).toLocaleString()}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                <span className="text-4xl mb-2">🛒</span>
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product_id} className="bg-gray-50 rounded-lg p-2.5 border">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.brand}</p>
                    {/* Price display / inline edit */}
                    {editingPriceId === item.product_id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-500">৳</span>
                        <input
                          ref={editPriceRef}
                          type="number"
                          value={editPriceStr}
                          onChange={e => setEditPriceStr(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEditPrice(item.product_id);
                            if (e.key === 'Escape') cancelEditPrice();
                          }}
                          className="w-20 text-xs font-bold border border-red-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-400"
                          min="0"
                          step="any"
                          autoFocus
                        />
                        <button onClick={() => confirmEditPrice(item.product_id)}
                          className="w-5 h-5 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs">✓</button>
                        <button onClick={cancelEditPrice}
                          className="w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs font-black text-red-600">
                          ৳{item.unit_price.toLocaleString()} × {item.quantity} = ৳{(item.unit_price * item.quantity).toLocaleString()}
                        </p>
                        <button
                          onClick={() => startEditPrice(item.product_id, item.unit_price)}
                          className="text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors"
                          title="Change price"
                        >✏️</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-red-100 rounded font-bold text-sm">−</button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-red-100 rounded font-bold text-sm">+</button>
                  </div>
                  <button onClick={() => setCart(p => p.filter(i => i.product_id !== item.product_id))}
                    className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                </div>
                {/* Serial number button */}
                {(item.available_serials && item.available_serials.length > 0) && (
                  <button
                    onClick={() => openSerialModal(item.product_id)}
                    className={`mt-1.5 w-full text-xs py-1 px-2 rounded border transition-colors ${item.serial_numbers && item.serial_numbers.length > 0
                      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                      : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                      }`}
                  >
                    🔢 {item.serial_numbers && item.serial_numbers.length > 0
                      ? `${item.serial_numbers.length} Serial(s) Selected`
                      : 'Select Serial Numbers'}
                  </button>
                )}
                {/* Show selected serial numbers */}
                {item.serial_numbers && item.serial_numbers.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.serial_numbers.map(sn => (
                      <span key={sn} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">
                        {sn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="border-t p-3 space-y-3 bg-gray-50">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="power-label text-xs">Discount (৳)</label>
                  <input type="number" value={discountStr} onChange={e => setDiscountStr(e.target.value)}
                    className="power-input text-sm py-2" placeholder="0" min="0" />
                </div>
                <div className="flex-1">
                  <label className="power-label text-xs">Payment</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="power-input text-sm py-2">
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="mobile_banking">📱 Mobile</option>
                    <option value="credit">📝 Credit</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 space-y-1 text-sm border">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>৳{subtotal.toFixed(2)}</span>
                </div>
                {vatTotal > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>VAT</span><span>৳{vatTotal.toFixed(2)}</span>
                  </div>
                )}
                {discountAmt > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Discount</span><span>-৳{discountAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-base pt-1 border-t mt-1">
                  <span className="text-gray-800">TOTAL</span>
                  <span className="text-red-600">৳{total.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="power-label text-xs">Received Amount (৳)</label>
                <input type="number" value={paidAmountStr} onChange={e => setPaidAmountStr(e.target.value)}
                  onFocus={() => { if (!paidAmountStr) setPaidAmountStr(total.toFixed(2)); }}
                  className="power-input text-sm py-2 font-bold" placeholder={`৳${total.toFixed(2)}`} min="0" />
                <div className="flex justify-between text-xs mt-1.5">
                  <span className={`font-bold ${due > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {due > 0 ? `Due: ৳${due.toFixed(2)}` : '✅ Fully Paid'}
                  </span>
                  {change > 0 && <span className="text-blue-600 font-bold">Change: ৳{change.toFixed(2)}</span>}
                </div>
              </div>

              <button onClick={handleSale} disabled={loading || cart.length === 0}
                className="btn-power w-full justify-center py-3 text-base disabled:opacity-50">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
                ) : (
                  <>⚡ Complete Sale — ৳{total.toFixed(2)}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

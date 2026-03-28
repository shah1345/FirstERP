import { useState, useEffect } from 'react';
import { customersAPI } from '../../services/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [filter, setFilter] = useState({ search: '', type: '', has_balance: false });
  const [formData, setFormData] = useState({
    customer_name: '', phone: '', email: '', address: '',
    customer_type: 'cash', credit_limit: '0', notes: ''
  });
  const [paymentData, setPaymentData] = useState({
    payment_amount: '', payment_method: 'cash', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: ''
  });

  useEffect(() => { loadCustomers(); }, [filter]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersAPI.getAll(filter);
      setCustomers(res.data.data || []);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        await customersAPI.update(selectedCustomer.id, formData);
      } else {
        await customersAPI.create(formData);
      }
      setShowModal(false);
      setSelectedCustomer(null);
      setFormData({ customer_name: '', phone: '', email: '', address: '', customer_type: 'cash', credit_limit: '0', notes: '' });
      loadCustomers();
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.message || 'Failed to save customer'));
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await customersAPI.addPayment(selectedCustomer.id, paymentData);
      setShowPaymentModal(false);
      setPaymentData({ payment_amount: '', payment_method: 'cash', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
      loadCustomers();
      alert('✅ Payment recorded successfully!');
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.message || 'Failed to record payment'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await customersAPI.delete(id);
      loadCustomers();
    } catch (error: any) {
      alert('Error: ' + (error.response?.data?.message || 'Cannot delete customer'));
    }
  };

  const editCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      customer_name: customer.customer_name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      customer_type: customer.customer_type,
      credit_limit: customer.credit_limit.toString(),
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const openPaymentModal = (customer: any) => {
    setSelectedCustomer(customer);
    setShowPaymentModal(true);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} customers</p>
        </div>
        <button onClick={() => { setSelectedCustomer(null); setShowModal(true); }} className="btn-power">
          ➕ Add Customer
        </button>
      </div>

      <div className="power-card p-4">
        <div className="flex gap-3 flex-wrap">
          <input type="text" placeholder="🔍 Search by name or phone..." value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} className="power-input flex-1" />
          <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} className="power-input w-40">
            <option value="">All Types</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border cursor-pointer">
            <input type="checkbox" checked={filter.has_balance}
              onChange={e => setFilter(f => ({ ...f, has_balance: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm font-medium">Has Balance</span>
          </label>
        </div>
      </div>

      <div className="power-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Credit Limit</th>
                <th>Total Purchases</th>
                <th>Total Paid</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">👥</div>
                  <p>No customers found</p>
                </td></tr>
              ) : customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold text-gray-900">{c.customer_name}</div>
                    {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                  </td>
                  <td><span className={c.customer_type === 'credit' ? 'badge-blue' : 'badge-gray'}>{c.customer_type}</span></td>
                  <td className="text-sm">{c.phone || '—'}</td>
                  <td className="text-sm">৳{Number(c.credit_limit).toLocaleString()}</td>
                  <td className="text-sm font-medium">৳{Number(c.total_purchases).toLocaleString()}</td>
                  <td className="text-sm text-green-600">৳{Number(c.total_paid).toLocaleString()}</td>
                  <td className={`text-sm font-bold ${Number(c.current_balance) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {Number(c.current_balance) > 0 ? `৳${Number(c.current_balance).toLocaleString()}` : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {c.customer_type === 'credit' && Number(c.current_balance) > 0 && (
                        <button onClick={() => openPaymentModal(c)} className="btn-ghost py-1 px-2 text-xs bg-green-50 text-green-700">💵</button>
                      )}
                      <button onClick={() => editCustomer(c)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                      {c.id !== 1 && <button onClick={() => handleDelete(c.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{selectedCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">Customer Name *</label>
                  <input type="text" required value={formData.customer_name}
                    onChange={e => setFormData(f => ({ ...f, customer_name: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Phone</label>
                  <input type="tel" value={formData.phone}
                    onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Email</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Type *</label>
                  <select value={formData.customer_type}
                    onChange={e => setFormData(f => ({ ...f, customer_type: e.target.value }))} className="power-input">
                    <option value="cash">Cash Customer</option>
                    <option value="credit">Credit Customer</option>
                  </select>
                </div>
              </div>
              {formData.customer_type === 'credit' && (
                <div>
                  <label className="power-label">Credit Limit (৳)</label>
                  <input type="number" value={formData.credit_limit}
                    onChange={e => setFormData(f => ({ ...f, credit_limit: e.target.value }))} className="power-input" />
                </div>
              )}
              <div>
                <label className="power-label">Address</label>
                <textarea value={formData.address}
                  onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} className="power-input" rows={2} />
              </div>
              <div>
                <label className="power-label">Notes</label>
                <textarea value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} className="power-input" rows={2} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-power">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Record Payment - {selectedCustomer.customer_name}</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-600">Current Balance</div>
              <div className="text-2xl font-black text-red-600">৳{Number(selectedCustomer.current_balance).toLocaleString()}</div>
            </div>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="power-label">Payment Amount (৳) *</label>
                <input type="number" required step="0.01" value={paymentData.payment_amount}
                  onChange={e => setPaymentData(f => ({ ...f, payment_amount: e.target.value }))} className="power-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">Payment Method *</label>
                  <select value={paymentData.payment_method}
                    onChange={e => setPaymentData(f => ({ ...f, payment_method: e.target.value }))} className="power-input">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_banking">Mobile Banking</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="power-label">Date *</label>
                  <input type="date" required value={paymentData.payment_date}
                    onChange={e => setPaymentData(f => ({ ...f, payment_date: e.target.value }))} className="power-input" />
                </div>
              </div>
              <div>
                <label className="power-label">Reference Number</label>
                <input type="text" value={paymentData.reference_number}
                  onChange={e => setPaymentData(f => ({ ...f, reference_number: e.target.value }))} className="power-input" placeholder="Check/Transaction ID" />
              </div>
              <div>
                <label className="power-label">Notes</label>
                <textarea value={paymentData.notes}
                  onChange={e => setPaymentData(f => ({ ...f, notes: e.target.value }))} className="power-input" rows={2} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-power">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { employeesAPI } from '../../services/api';

const defaultForm = { name: '', phone: '', email: '', role: '', department: '', basic_salary: '', join_date: '', address: '' };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const res = await employeesAPI.getAll();
    setEmployees(res.data.data);
  };

  const openAdd = () => { setEditEmp(null); setForm({ ...defaultForm }); setShowModal(true); };
  const openEdit = (e: any) => {
    setEditEmp(e);
    setForm({ name: e.name, phone: e.phone || '', email: e.email || '', role: e.role || '',
      department: e.department || '', basic_salary: e.basic_salary || '', join_date: e.join_date?.slice(0,10) || '', address: e.address || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      editEmp ? await employeesAPI.update(editEmp.id, form) : await employeesAPI.create(form);
      setShowModal(false);
      load();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove employee?')) return;
    await employeesAPI.delete(id);
    load();
  };

  const totalPayroll = employees.reduce((s, e) => s + Number(e.basic_salary), 0);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{employees.length} active employees · Monthly payroll: ৳{totalPayroll.toLocaleString()}</p>
        </div>
        <button onClick={openAdd} className="btn-power">👤 Add Employee</button>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="power-card p-5 energy-glow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-700 text-xl font-black flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{emp.name}</p>
                  <p className="text-xs text-gray-500">{emp.role} · {emp.department}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📞 {emp.phone}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(emp)} className="btn-ghost py-1 px-2 text-xs">✏️</button>
                <button onClick={() => handleDelete(emp.id)} className="btn-ghost py-1 px-2 text-xs text-red-600">🗑️</button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Monthly Salary</p>
                <p className="font-black text-gray-900">৳{Number(emp.basic_salary).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Join Date</p>
                <p className="font-medium text-gray-700">{emp.join_date ? new Date(emp.join_date).toLocaleDateString() : '-'}</p>
              </div>
            </div>
          </div>
        ))}

        {employees.length === 0 && (
          <div className="col-span-3 power-card p-12 text-center text-gray-400">
            <div className="text-5xl mb-3">👥</div>
            <p className="font-medium">No employees yet</p>
            <p className="text-sm mt-1">Add your first employee to get started</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                {editEmp ? 'Edit Employee' : 'Add Employee'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="power-label">Full Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="power-input" placeholder="Employee name" />
              </div>
              <div>
                <label className="power-label">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="power-input" placeholder="+880..." />
              </div>
              <div>
                <label className="power-label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="power-input" />
              </div>
              <div>
                <label className="power-label">Role / Designation</label>
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="power-input" placeholder="Sales Executive..." />
              </div>
              <div>
                <label className="power-label">Department</label>
                <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="power-input" placeholder="Sales, Admin..." />
              </div>
              <div>
                <label className="power-label">Basic Salary (৳)</label>
                <input type="number" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} className="power-input" placeholder="0" />
              </div>
              <div>
                <label className="power-label">Join Date</label>
                <input type="date" value={form.join_date} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} className="power-input" />
              </div>
              <div className="col-span-2">
                <label className="power-label">Address</label>
                <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="power-input resize-none" rows={2} />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={handleSave} disabled={saving} className="btn-power flex-1 justify-center">
                {saving ? 'Saving...' : editEmp ? '💾 Update' : '👤 Add Employee'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { employeesAPI } from '../../services/api';

const STATUS_COLORS: Record<string, string> = {
  present: 'badge-green',
  late: 'badge-yellow',
  absent: 'badge-red',
  half_day: 'badge-blue',
  holiday: 'badge-gray',
  weekend: 'badge-gray',
};

export default function AttendancePage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rules, setRules] = useState<any>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesForm, setRulesForm] = useState<any>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [attendForms, setAttendForms] = useState<Record<number, any>>({});

  useEffect(() => { loadAll(); }, [date]);

  const loadAll = async () => {
    const [empRes, attRes, ruleRes] = await Promise.all([
      employeesAPI.getAll(),
      employeesAPI.getAttendance({ date }),
      employeesAPI.getRules()
    ]);
    setEmployees(empRes.data.data);
    setAttendance(attRes.data.data);
    setRules(ruleRes.data.data);
    setRulesForm(ruleRes.data.data || {});

    // Build attend forms from existing data
    const forms: Record<number, any> = {};
    empRes.data.data.forEach((emp: any) => {
      const existing = attRes.data.data.find((a: any) => a.employee_id === emp.id);
      forms[emp.id] = existing ? {
        status: existing.status,
        check_in: existing.check_in || '',
        check_out: existing.check_out || '',
        notes: existing.notes || ''
      } : { status: 'present', check_in: '', check_out: '', notes: '' };
    });
    setAttendForms(forms);
  };

  const markAttendance = async (employeeId: number) => {
    setSaving(s => ({ ...s, [employeeId]: true }));
    try {
      await employeesAPI.markAttendance({ employee_id: employeeId, date, ...attendForms[employeeId] });
      loadAll();
    } catch (err: any) { alert('Error: ' + err.response?.data?.message); }
    finally { setSaving(s => ({ ...s, [employeeId]: false })); }
  };

  const markAllPresent = async () => {
    for (const emp of employees) {
      if (!attendForms[emp.id]?.status || attendForms[emp.id]?.status === 'present') {
        await employeesAPI.markAttendance({
          employee_id: emp.id, date, status: 'present',
          check_in: rules?.work_start_time?.slice(0, 5) || '09:00', check_out: '', notes: ''
        });
      }
    }
    loadAll();
  };

  const saveRules = async () => {
    try {
      await employeesAPI.updateRules(rulesForm);
      setShowRulesModal(false);
      loadAll();
    } catch (err: any) { alert('Error saving rules'); }
  };

  const presentCount = attendance.filter(a => ['present', 'late'].includes(a.status)).length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Daily attendance tracking & management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRulesModal(true)} className="btn-outline">⚙️ Rules</button>
          <button onClick={markAllPresent} className="btn-power">✅ Mark All Present</button>
        </div>
      </div>

      {/* Date Selector & Summary */}
      <div className="power-card p-5">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <label className="power-label">Attendance Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="power-input" />
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-black text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-yellow-500">{lateCount}</p>
              <p className="text-xs text-gray-500">Late</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-red-600">{absentCount}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-700">{employees.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
          {rules && (
            <div className="ml-auto text-xs text-gray-500 bg-gray-50 rounded-lg px-4 py-2">
              <p>Work Start: <strong>{rules.work_start_time}</strong></p>
              <p>Late After: <strong>+{rules.late_threshold_minutes} min</strong></p>
              <p>Late Rule: <strong>{rules.lates_per_deduction} lates = {rules.deduction_days_per_penalty} day deduction</strong></p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="power-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const form = attendForms[emp.id] || { status: 'present', check_in: '', check_out: '', notes: '' };
                const existing = attendance.find(a => a.employee_id === emp.id);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-700 font-bold text-sm">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        value={form.status}
                        onChange={e => setAttendForms(f => ({ ...f, [emp.id]: { ...form, status: e.target.value } }))}
                        className="power-input py-1.5 text-sm w-32"
                      >
                        <option value="present">✅ Present</option>
                        <option value="late">⏰ Late</option>
                        <option value="absent">❌ Absent</option>
                        <option value="half_day">🌤 Half Day</option>
                        <option value="holiday">🏖 Holiday</option>
                        <option value="weekend">📅 Weekend</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        value={form.check_in}
                        onChange={e => setAttendForms(f => ({ ...f, [emp.id]: { ...form, check_in: e.target.value } }))}
                        className="power-input py-1.5 text-sm w-28"
                        disabled={form.status === 'absent' || form.status === 'holiday' || form.status === 'weekend'}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={form.check_out}
                        onChange={e => setAttendForms(f => ({ ...f, [emp.id]: { ...form, check_out: e.target.value } }))}
                        className="power-input py-1.5 text-sm w-28"
                        disabled={form.status === 'absent' || form.status === 'holiday' || form.status === 'weekend'}
                      />
                    </td>
                    <td>
                      <input
                        value={form.notes}
                        onChange={e => setAttendForms(f => ({ ...f, [emp.id]: { ...form, notes: e.target.value } }))}
                        className="power-input py-1.5 text-sm w-32"
                        placeholder="Notes..."
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => markAttendance(emp.id)}
                        disabled={saving[emp.id]}
                        className="btn-power py-1.5 px-3 text-xs"
                      >
                        {saving[emp.id] ? '...' : existing ? '🔄 Update' : '💾 Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rules Modal */}
      {showRulesModal && (
        <div className="modal-backdrop" onClick={() => setShowRulesModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                ⚙️ Attendance Rules
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="power-label">Work Start Time</label>
                  <input type="time" value={rulesForm.work_start_time || '09:00'} onChange={e => setRulesForm((f: any) => ({ ...f, work_start_time: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Late Threshold (minutes)</label>
                  <input type="number" value={rulesForm.late_threshold_minutes || 15} onChange={e => setRulesForm((f: any) => ({ ...f, late_threshold_minutes: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Break Duration (minutes)</label>
                  <input type="number" value={rulesForm.break_duration_minutes || 60} onChange={e => setRulesForm((f: any) => ({ ...f, break_duration_minutes: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Work Days Per Week</label>
                  <input type="number" value={rulesForm.work_days_per_week || 6} onChange={e => setRulesForm((f: any) => ({ ...f, work_days_per_week: e.target.value }))} className="power-input" />
                </div>
                <div>
                  <label className="power-label">Lates Per Deduction</label>
                  <input type="number" value={rulesForm.lates_per_deduction || 3} onChange={e => setRulesForm((f: any) => ({ ...f, lates_per_deduction: e.target.value }))} className="power-input" />
                  <p className="text-xs text-gray-400 mt-1">e.g. 3 = 3 lates trigger deduction</p>
                </div>
                <div>
                  <label className="power-label">Deduction Days Per Penalty</label>
                  <input type="number" step="0.5" value={rulesForm.deduction_days_per_penalty || 1} onChange={e => setRulesForm((f: any) => ({ ...f, deduction_days_per_penalty: e.target.value }))} className="power-input" />
                  <p className="text-xs text-gray-400 mt-1">Days deducted from salary</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p className="font-semibold mb-1">Current Rule Example:</p>
                <p>If employee is late {rulesForm.lates_per_deduction || 3} times → {rulesForm.deduction_days_per_penalty || 1} day salary deducted</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={saveRules} className="btn-power flex-1 justify-center">💾 Save Rules</button>
              <button onClick={() => setShowRulesModal(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

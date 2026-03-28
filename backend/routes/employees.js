const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ==================== EMPLOYEES ====================

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [employees] = await pool.query('SELECT * FROM employees WHERE status = "active" ORDER BY name');
    res.json({ success: true, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, role, department, basic_salary, join_date, address, user_id } = req.body;
    const [result] = await pool.query(
      `INSERT INTO employees (name, phone, email, role, department, basic_salary, join_date, address, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, role, department, basic_salary || 0, join_date, address, user_id || null]
    );
    res.json({ success: true, message: 'Employee added', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, phone, email, role, department, basic_salary, join_date, address } = req.body;
    await pool.query(
      `UPDATE employees SET name=?, phone=?, email=?, role=?, department=?, basic_salary=?, join_date=?, address=? WHERE id=?`,
      [name, phone, email, role, department, basic_salary, join_date, address, req.params.id]
    );
    res.json({ success: true, message: 'Employee updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE employees SET status = "inactive" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Employee removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ATTENDANCE ====================

router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const { date, employee_id, month, year } = req.query;
    let query = `SELECT a.*, e.name as employee_name, e.role FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE 1=1`;
    const params = [];
    if (date) { query += ' AND a.date = ?'; params.push(date); }
    if (employee_id) { query += ' AND a.employee_id = ?'; params.push(employee_id); }
    if (month && year) { query += ' AND MONTH(a.date) = ? AND YEAR(a.date) = ?'; params.push(month, year); }
    query += ' ORDER BY a.date DESC, e.name';
    const [attendance] = await pool.query(query, params);
    res.json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/attendance', authenticateToken, async (req, res) => {
  try {
    const { employee_id, date, check_in, check_out, break_start, break_end, status, notes } = req.body;

    // Get rules to calculate late
    const [rules] = await pool.query('SELECT * FROM attendance_rules LIMIT 1');
    const rule = rules[0];
    let late_minutes = 0;

    if (check_in && rule) {
      const [rH, rM] = rule.work_start_time.split(':').map(Number);
      const [cH, cM] = check_in.split(':').map(Number);
      const ruleMinutes = rH * 60 + rM + rule.late_threshold_minutes;
      const checkInMinutes = cH * 60 + cM;
      if (checkInMinutes > ruleMinutes) {
        late_minutes = checkInMinutes - (rH * 60 + rM);
      }
    }

    await pool.query(
      `INSERT INTO attendance (employee_id, date, check_in, check_out, break_start, break_end, status, late_minutes, notes, marked_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out), break_start=VALUES(break_start),
       break_end=VALUES(break_end), status=VALUES(status), late_minutes=VALUES(late_minutes), notes=VALUES(notes)`,
      [employee_id, date, check_in, check_out, break_start, break_end, status || 'present', late_minutes, notes, req.user.id]
    );
    res.json({ success: true, message: 'Attendance marked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ATTENDANCE RULES ====================

router.get('/attendance-rules', authenticateToken, async (req, res) => {
  try {
    const [rules] = await pool.query('SELECT * FROM attendance_rules LIMIT 1');
    res.json({ success: true, data: rules[0] || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/attendance-rules', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { work_start_time, late_threshold_minutes, break_duration_minutes, work_days_per_week, lates_per_deduction, deduction_days_per_penalty } = req.body;
    const [existing] = await pool.query('SELECT id FROM attendance_rules LIMIT 1');
    if (existing.length) {
      await pool.query(
        `UPDATE attendance_rules SET work_start_time=?, late_threshold_minutes=?, break_duration_minutes=?, work_days_per_week=?, lates_per_deduction=?, deduction_days_per_penalty=? WHERE id=?`,
        [work_start_time, late_threshold_minutes, break_duration_minutes, work_days_per_week, lates_per_deduction, deduction_days_per_penalty, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance_rules (work_start_time, late_threshold_minutes, break_duration_minutes, work_days_per_week, lates_per_deduction, deduction_days_per_penalty) VALUES (?, ?, ?, ?, ?, ?)`,
        [work_start_time, late_threshold_minutes, break_duration_minutes, work_days_per_week, lates_per_deduction, deduction_days_per_penalty]
      );
    }
    res.json({ success: true, message: 'Rules updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PAYROLL ====================

router.get('/payroll', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    const [payroll] = await pool.query(
      `SELECT p.*, e.name as employee_name, e.role FROM payroll p JOIN employees e ON e.id = p.employee_id WHERE p.month=? AND p.year=? ORDER BY e.name`,
      [month, year]
    );
    res.json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payroll/generate', authenticateToken, requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { month, year } = req.body;

    const [employees] = await conn.query('SELECT * FROM employees WHERE status = "active"');
    const [rules] = await conn.query('SELECT * FROM attendance_rules LIMIT 1');
    const rule = rules[0];

    const daysInMonth = new Date(year, month, 0).getDate();
    const results = [];

    for (const emp of employees) {
      const [attendance] = await conn.query(
        `SELECT status, late_minutes FROM attendance WHERE employee_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
        [emp.id, month, year]
      );

      const present_days = attendance.filter(a => ['present', 'late'].includes(a.status)).length;
      const absent_days = attendance.filter(a => a.status === 'absent').length;
      const late_count = attendance.filter(a => a.status === 'late').length;
      const late_deduction_days = rule ? Math.floor(late_count / rule.lates_per_deduction) * rule.deduction_days_per_penalty : 0;
      const daily_salary = emp.basic_salary / (rule?.work_days_per_week * 4 || 26);
      const absence_deduction = absent_days * daily_salary;
      const late_deduction = late_deduction_days * daily_salary;
      const net_salary = Math.max(0, emp.basic_salary - absence_deduction - late_deduction);

      await conn.query(
        `INSERT INTO payroll (employee_id, month, year, basic_salary, total_days, present_days, absent_days, late_count, late_deduction_days, absence_deduction, late_deduction, net_salary, generated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE present_days=VALUES(present_days), absent_days=VALUES(absent_days), late_count=VALUES(late_count),
         late_deduction_days=VALUES(late_deduction_days), absence_deduction=VALUES(absence_deduction), late_deduction=VALUES(late_deduction), net_salary=VALUES(net_salary)`,
        [emp.id, month, year, emp.basic_salary, daysInMonth, present_days, absent_days, late_count, late_deduction_days, absence_deduction, late_deduction, net_salary, req.user.id]
      );
      results.push({ employee: emp.name, net_salary });
    }

    await conn.commit();
    res.json({ success: true, message: 'Payroll generated', data: results });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

router.put('/payroll/:id/pay', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE payroll SET payment_status = "paid", payment_date = CURDATE() WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'Marked as paid' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

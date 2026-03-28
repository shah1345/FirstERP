const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ══════════════════════════════════════════════════════════
// BANK ACCOUNTS
// ══════════════════════════════════════════════════════════

// GET all bank accounts with live balance
router.get('/bank-accounts', authenticateToken, async (req, res) => {
  try {
    const [accounts] = await pool.query('SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC, account_name');

    for (const acc of accounts) {
      const [bal] = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type='income' AND bank_account_id=? THEN amount ELSE 0 END), 0) as total_in,
          COALESCE(SUM(CASE WHEN type='expense' AND bank_account_id=? THEN amount ELSE 0 END), 0) as total_out,
          COALESCE(SUM(CASE WHEN type='transfer' AND bank_account_id=? THEN amount ELSE 0 END), 0) as transfer_out,
          COALESCE(SUM(CASE WHEN type='transfer' AND to_bank_account_id=? THEN amount ELSE 0 END), 0) as transfer_in
        FROM transactions
      `, [acc.id, acc.id, acc.id, acc.id]);
      acc.current_balance = parseFloat(acc.opening_balance) + parseFloat(bal[0].total_in) - parseFloat(bal[0].total_out) - parseFloat(bal[0].transfer_out) + parseFloat(bal[0].transfer_in);
      await pool.query('UPDATE bank_accounts SET current_balance = ? WHERE id = ?', [acc.current_balance, acc.id]);
    }

    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create bank account
router.post('/bank-accounts', authenticateToken, async (req, res) => {
  try {
    const { account_name, account_type, bank_name, account_number, branch, opening_balance, icon, color, notes } = req.body;
    if (!account_name) return res.status(400).json({ success: false, message: 'Account name required' });
    const ob = parseFloat(opening_balance) || 0;
    const [result] = await pool.query(
      'INSERT INTO bank_accounts (account_name, account_type, bank_name, account_number, branch, opening_balance, current_balance, icon, color, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [account_name, account_type || 'bank', bank_name, account_number, branch, ob, ob, icon || '🏦', color || '#2563eb', notes]
    );
    res.json({ success: true, message: 'Bank account created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update bank account
router.put('/bank-accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { account_name, account_type, bank_name, account_number, branch, opening_balance, icon, color, notes, is_default } = req.body;
    if (is_default) { await pool.query('UPDATE bank_accounts SET is_default = 0'); }
    await pool.query(
      'UPDATE bank_accounts SET account_name=?, account_type=?, bank_name=?, account_number=?, branch=?, opening_balance=?, icon=?, color=?, notes=?, is_default=? WHERE id=?',
      [account_name, account_type, bank_name, account_number, branch, opening_balance || 0, icon, color, notes, is_default ? 1 : 0, req.params.id]
    );
    res.json({ success: true, message: 'Account updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE bank account
router.delete('/bank-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const [used] = await pool.query('SELECT COUNT(*) as cnt FROM transactions WHERE bank_account_id = ? OR to_bank_account_id = ?', [req.params.id, req.params.id]);
    if (used[0].cnt > 0) {
      await pool.query('UPDATE bank_accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
      return res.json({ success: true, message: 'Account deactivated (has transactions)' });
    }
    await pool.query('DELETE FROM bank_accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET bank account statement
router.get('/bank-accounts/:id/statement', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const [acc] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
    if (!acc.length) return res.status(404).json({ success: false, message: 'Not found' });

    let query = `
      SELECT t.*, u.name as created_by_name,
        CASE 
          WHEN t.type='income' AND t.bank_account_id=? THEN 'credit'
          WHEN t.type='transfer' AND t.to_bank_account_id=? THEN 'credit'
          ELSE 'debit'
        END as direction
      FROM transactions t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE (t.bank_account_id = ? OR t.to_bank_account_id = ?)
    `;
    const params = [req.params.id, req.params.id, req.params.id, req.params.id];
    if (start_date) { query += ' AND t.transaction_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND t.transaction_date <= ?'; params.push(end_date); }
    query += ' ORDER BY t.transaction_date DESC, t.id DESC';
    const [txns] = await pool.query(query, params);
    res.json({ success: true, data: { account: acc[0], transactions: txns } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// LOAN / CREDIT ACCOUNTS
// ══════════════════════════════════════════════════════════

// GET all loans
router.get('/loans', authenticateToken, async (req, res) => {
  try {
    const [loans] = await pool.query(`
      SELECT l.*, 
        (SELECT COALESCE(SUM(amount), 0) FROM loan_payments WHERE loan_id = l.id) as total_paid
      FROM loans l
      ORDER BY l.status ASC, l.created_at DESC
    `);

    const result = loans.map(l => ({
      ...l,
      total_paid: parseFloat(l.total_paid) || 0,
      remaining: Math.max(0, parseFloat(l.total_amount) - (parseFloat(l.total_paid) || 0)),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET loan detail with payments
router.get('/loans/:id', authenticateToken, async (req, res) => {
  try {
    const [loans] = await pool.query('SELECT * FROM loans WHERE id = ?', [req.params.id]);
    if (!loans.length) return res.status(404).json({ success: false, message: 'Loan not found' });

    const [payments] = await pool.query(`
      SELECT lp.*, u.name as paid_by_name, ba.account_name as bank_name, ba.icon as bank_icon
      FROM loan_payments lp
      LEFT JOIN users u ON u.id = lp.paid_by
      LEFT JOIN bank_accounts ba ON ba.id = lp.bank_account_id
      WHERE lp.loan_id = ?
      ORDER BY lp.created_at DESC
    `, [req.params.id]);

    const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

    res.json({
      success: true,
      data: {
        loan: {
          ...loans[0],
          total_paid: totalPaid,
          remaining: Math.max(0, parseFloat(loans[0].total_amount) - totalPaid),
        },
        payments,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create loan
router.post('/loans', authenticateToken, async (req, res) => {
  try {
    const { lender_name, loan_type, total_amount, interest_rate, start_date, due_date, notes, bank_account_id } = req.body;
    if (!lender_name || !total_amount) {
      return res.status(400).json({ success: false, message: 'Lender name and amount required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO loans (lender_name, loan_type, total_amount, interest_rate, start_date, due_date, notes, status, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [lender_name, loan_type || 'received', parseFloat(total_amount), parseFloat(interest_rate) || 0,
         start_date || new Date().toISOString().slice(0, 10), due_date || null, notes || null,
         req.user.id, req.user.tenant_id]
      );

      // If loan received and bank_account_id provided, credit the account
      if (loan_type !== 'given' && bank_account_id) {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?',
          [parseFloat(total_amount), bank_account_id]);

        try {
          await conn.query(
            `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, is_auto, created_by, tenant_id)
             VALUES ('income', 'Loan Received', ?, ?, 'bank_transfer', ?, ?, CURDATE(), 1, ?, ?)`,
            [parseFloat(total_amount), bank_account_id, `Loan received from ${lender_name}`, lender_name, req.user.id, req.user.tenant_id]
          );
        } catch (e) { console.log('Loan transaction skipped:', e.message); }
      }

      await conn.commit();
      res.json({ success: true, message: 'Loan created', id: result.insertId });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST make loan payment
router.post('/loans/:id/payments', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const loanId = req.params.id;
    const { amount, bank_account_id, payment_method, reference, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    const [loans] = await conn.query('SELECT * FROM loans WHERE id = ?', [loanId]);
    if (!loans.length) return res.status(404).json({ success: false, message: 'Loan not found' });

    const loan = loans[0];
    const amt = parseFloat(amount);

    // Check bank balance if paying from account
    if (bank_account_id) {
      const [acc] = await conn.query('SELECT current_balance FROM bank_accounts WHERE id = ?', [bank_account_id]);
      if (acc.length && parseFloat(acc[0].current_balance) < amt) {
        return res.status(400).json({
          success: false,
          message: `Insufficient balance. Account has ৳${Number(acc[0].current_balance).toLocaleString()} but trying to pay ৳${amt.toLocaleString()}`
        });
      }
    }

    // Record loan payment
    await conn.query(
      `INSERT INTO loan_payments (loan_id, amount, bank_account_id, payment_method, reference, notes, paid_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, amt, bank_account_id || null, payment_method || 'cash', reference || null, notes || null, req.user.id, req.user.tenant_id]
    );

    // Deduct from bank account if selected
    if (bank_account_id) {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, bank_account_id]);

      try {
        await conn.query(
          `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, is_auto, created_by, tenant_id)
           VALUES ('expense', 'Loan Repayment', ?, ?, ?, ?, ?, CURDATE(), 1, ?, ?)`,
          [amt, bank_account_id, payment_method || 'cash', `Loan repayment to ${loan.lender_name}`, loan.lender_name, req.user.id, req.user.tenant_id]
        );
      } catch (e) { console.log('Loan payment transaction skipped:', e.message); }
    }

    // Check if loan is fully paid
    const [totalPaidResult] = await conn.query('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = ?', [loanId]);
    const totalPaid = parseFloat(totalPaidResult[0].total);
    if (totalPaid >= parseFloat(loan.total_amount)) {
      await conn.query('UPDATE loans SET status = "cleared" WHERE id = ?', [loanId]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Loan payment recorded' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// PUT update loan status
router.put('/loans/:id', authenticateToken, async (req, res) => {
  try {
    const { status, notes, lender_name, due_date } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (lender_name) { updates.push('lender_name = ?'); params.push(lender_name); }
    if (due_date) { updates.push('due_date = ?'); params.push(due_date); }
    if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    params.push(req.params.id);
    await pool.query(`UPDATE loans SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Loan updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM transaction_categories WHERE is_active = 1';
    const params = [];
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY type, name';
    const [cats] = await pool.query(query, params);
    res.json({ success: true, data: cats });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, type, icon } = req.body;
    if (!name || !type) return res.status(400).json({ success: false, message: 'Name and type required' });
    await pool.query('INSERT INTO transaction_categories (name, type, icon) VALUES (?, ?, ?)', [name, type, icon || '📌']);
    res.json({ success: true, message: 'Category added' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Category already exists' });
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// TRANSACTIONS (with negative balance prevention)
// ══════════════════════════════════════════════════════════

// GET transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, category, start_date, end_date, payment_method, search, bank_account_id, limit } = req.query;
    let query = `
      SELECT t.*, u.name as created_by_name,
        ba.account_name as bank_name, ba.icon as bank_icon,
        ba2.account_name as to_bank_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
      LEFT JOIN bank_accounts ba2 ON ba2.id = t.to_bank_account_id
      WHERE 1=1
    `;
    const params = [];
    if (type) { query += ' AND t.type = ?'; params.push(type); }
    if (category) { query += ' AND t.category = ?'; params.push(category); }
    if (start_date) { query += ' AND t.transaction_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND t.transaction_date <= ?'; params.push(end_date); }
    if (payment_method) { query += ' AND t.payment_method = ?'; params.push(payment_method); }
    if (bank_account_id) { query += ' AND (t.bank_account_id = ? OR t.to_bank_account_id = ?)'; params.push(bank_account_id, bank_account_id); }
    if (search) {
      query += ' AND (t.description LIKE ? OR t.party_name LIKE ? OR t.reference LIKE ? OR t.category LIKE ?)';
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    query += ' ORDER BY t.transaction_date DESC, t.id DESC LIMIT ?';
    params.push(parseInt(limit) || 500);
    const [transactions] = await pool.query(query, params);
    res.json({ success: true, data: transactions });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST add transaction (with balance check)
router.post('/', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { type, category, amount, bank_account_id, to_bank_account_id, payment_method, reference, description, party_name, transaction_date } = req.body;

    if (!type || !amount) return res.status(400).json({ success: false, message: 'Type and amount required' });
    if (type !== 'transfer' && !category) return res.status(400).json({ success: false, message: 'Category required' });
    if (parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });
    if (type === 'transfer' && (!bank_account_id || !to_bank_account_id)) return res.status(400).json({ success: false, message: 'Both accounts required for transfer' });
    if (type === 'transfer' && bank_account_id === to_bank_account_id) return res.status(400).json({ success: false, message: 'Cannot transfer to same account' });

    const amt = parseFloat(amount);
    const txDate = transaction_date || new Date().toISOString().slice(0, 10);

    // ─── NEGATIVE BALANCE CHECK ───
    if ((type === 'expense' || type === 'transfer') && bank_account_id) {
      const [acc] = await conn.query('SELECT current_balance, account_name FROM bank_accounts WHERE id = ?', [bank_account_id]);
      if (acc.length) {
        const currentBal = parseFloat(acc[0].current_balance);
        if (currentBal < amt) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient balance in "${acc[0].account_name}". Available: ৳${currentBal.toLocaleString()}, Required: ৳${amt.toLocaleString()}`
          });
        }
      }
    }

    const [result] = await conn.query(`
      INSERT INTO transactions (type, category, amount, bank_account_id, to_bank_account_id, payment_method, reference, description, party_name, transaction_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [type, type === 'transfer' ? 'Account Transfer' : category, amt, bank_account_id || null, to_bank_account_id || null, payment_method || 'cash', reference, description, party_name, txDate, req.user.id]);

    // Update bank account balances
    if (bank_account_id) {
      if (type === 'income') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, bank_account_id]);
      } else if (type === 'expense') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, bank_account_id]);
      } else if (type === 'transfer') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, bank_account_id]);
        if (to_bank_account_id) {
          await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, to_bank_account_id]);
        }
      }
    }

    await conn.commit();
    res.json({ success: true, message: `${type} recorded`, id: result.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// PUT update transaction (with balance check)
router.put('/:id', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Reverse old balance
    const [old] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (old.length && old[0].bank_account_id) {
      if (old[0].type === 'income') await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [parseFloat(old[0].amount), old[0].bank_account_id]);
      else if (old[0].type === 'expense') await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [parseFloat(old[0].amount), old[0].bank_account_id]);
      else if (old[0].type === 'transfer') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [parseFloat(old[0].amount), old[0].bank_account_id]);
        if (old[0].to_bank_account_id) await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [parseFloat(old[0].amount), old[0].to_bank_account_id]);
      }
    }

    const { type, category, amount, bank_account_id, to_bank_account_id, payment_method, reference, description, party_name, transaction_date } = req.body;
    const amt = parseFloat(amount);

    // ─── NEGATIVE BALANCE CHECK (after reversing old) ───
    if ((type === 'expense' || type === 'transfer') && bank_account_id) {
      const [acc] = await conn.query('SELECT current_balance, account_name FROM bank_accounts WHERE id = ?', [bank_account_id]);
      if (acc.length && parseFloat(acc[0].current_balance) < amt) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in "${acc[0].account_name}". Available: ৳${parseFloat(acc[0].current_balance).toLocaleString()}, Required: ৳${amt.toLocaleString()}`
        });
      }
    }

    await conn.query(`UPDATE transactions SET type=?, category=?, amount=?, bank_account_id=?, to_bank_account_id=?, payment_method=?, reference=?, description=?, party_name=?, transaction_date=? WHERE id=?`,
      [type, category, amt, bank_account_id || null, to_bank_account_id || null, payment_method, reference, description, party_name, transaction_date, req.params.id]);

    // Apply new balance
    if (bank_account_id) {
      if (type === 'income') await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, bank_account_id]);
      else if (type === 'expense') await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, bank_account_id]);
      else if (type === 'transfer') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, bank_account_id]);
        if (to_bank_account_id) await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, to_bank_account_id]);
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Transaction updated' });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// DELETE transaction
router.delete('/:id', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tx] = await conn.query('SELECT * FROM transactions WHERE id = ?', [req.params.id]);
    if (tx.length && tx[0].bank_account_id) {
      if (tx[0].type === 'income') await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [parseFloat(tx[0].amount), tx[0].bank_account_id]);
      else if (tx[0].type === 'expense') await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [parseFloat(tx[0].amount), tx[0].bank_account_id]);
      else if (tx[0].type === 'transfer') {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [parseFloat(tx[0].amount), tx[0].bank_account_id]);
        if (tx[0].to_bank_account_id) await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [parseFloat(tx[0].amount), tx[0].to_bank_account_id]);
      }
    }
    if (tx.length && tx[0].journal_entry_id) {
      try { await conn.query("UPDATE journal_entries SET status = 'voided' WHERE id = ?", [tx[0].journal_entry_id]); } catch {}
    }
    await conn.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════

router.get('/analytics/summary', authenticateToken, async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' AND DATE(transaction_date)=CURDATE() THEN amount ELSE 0 END), 0) as today_income,
        COALESCE(SUM(CASE WHEN type='expense' AND DATE(transaction_date)=CURDATE() THEN amount ELSE 0 END), 0) as today_expense,
        COALESCE(SUM(CASE WHEN type='income' AND YEARWEEK(transaction_date,1)=YEARWEEK(NOW(),1) THEN amount ELSE 0 END), 0) as weekly_income,
        COALESCE(SUM(CASE WHEN type='expense' AND YEARWEEK(transaction_date,1)=YEARWEEK(NOW(),1) THEN amount ELSE 0 END), 0) as weekly_expense,
        COALESCE(SUM(CASE WHEN type='income' AND MONTH(transaction_date)=MONTH(NOW()) AND YEAR(transaction_date)=YEAR(NOW()) THEN amount ELSE 0 END), 0) as monthly_income,
        COALESCE(SUM(CASE WHEN type='expense' AND MONTH(transaction_date)=MONTH(NOW()) AND YEAR(transaction_date)=YEAR(NOW()) THEN amount ELSE 0 END), 0) as monthly_expense,
        COALESCE(SUM(CASE WHEN type='income' AND YEAR(transaction_date)=YEAR(NOW()) THEN amount ELSE 0 END), 0) as yearly_income,
        COALESCE(SUM(CASE WHEN type='expense' AND YEAR(transaction_date)=YEAR(NOW()) THEN amount ELSE 0 END), 0) as yearly_expense,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as lifetime_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as lifetime_expense
      FROM transactions
    `);

    const [catBreakdown] = await pool.query(`
      SELECT type, category, SUM(amount) as total, COUNT(*) as count
      FROM transactions WHERE MONTH(transaction_date)=MONTH(NOW()) AND YEAR(transaction_date)=YEAR(NOW())
      GROUP BY type, category ORDER BY total DESC
    `);

    const [recent] = await pool.query(`
      SELECT t.*, u.name as created_by_name, ba.account_name as bank_name, ba.icon as bank_icon
      FROM transactions t LEFT JOIN users u ON u.id = t.created_by LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
      ORDER BY t.transaction_date DESC, t.id DESC LIMIT 10
    `);

    const [accounts] = await pool.query('SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY is_default DESC');

    // Loan summary
    let loanSummary = { total_loans: 0, active_loans: 0, total_amount: 0, total_paid: 0, total_remaining: 0 };
    try {
      const [loanData] = await pool.query(`
        SELECT COUNT(*) as total_loans,
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_loans,
          COALESCE(SUM(total_amount), 0) as total_amount
        FROM loans
      `);
      const [loanPaid] = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments');
      loanSummary = {
        total_loans: loanData[0].total_loans,
        active_loans: loanData[0].active_loans,
        total_amount: parseFloat(loanData[0].total_amount),
        total_paid: parseFloat(loanPaid[0].total),
        total_remaining: Math.max(0, parseFloat(loanData[0].total_amount) - parseFloat(loanPaid[0].total)),
      };
    } catch (e) { /* loans table might not exist yet */ }

    res.json({ success: true, data: { summary: data[0], category_breakdown: catBreakdown, recent, bank_accounts: accounts, loan_summary: loanSummary } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

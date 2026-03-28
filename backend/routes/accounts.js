const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ── ACCOUNTS CRUD ──────────────────────────────────────────

// GET all accounts (tree structure)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, active_only } = req.query;
    let query = 'SELECT * FROM accounts WHERE 1=1';
    const params = [];
    if (type) { query += ' AND type = ?'; params.push(type); }
    if (active_only !== 'false') { query += ' AND is_active = 1'; }
    query += ' ORDER BY code ASC';
    const [accounts] = await pool.query(query, params);

    // Calculate current balance for each account
    for (const acc of accounts) {
      const [bal] = await pool.query(`
        SELECT 
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry_id
        WHERE jl.account_id = ? AND je.status = 'posted'
      `, [acc.id]);
      const d = parseFloat(bal[0].total_debit);
      const c = parseFloat(bal[0].total_credit);
      // Assets & Expenses: debit increases, credit decreases
      // Liabilities, Equity, Income: credit increases, debit decreases
      if (['asset', 'expense'].includes(acc.type)) {
        acc.balance = parseFloat(acc.opening_balance) + d - c;
      } else {
        acc.balance = parseFloat(acc.opening_balance) + c - d;
      }
    }

    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single account with ledger
router.get('/:id/ledger', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const [accounts] = await pool.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!accounts.length) return res.status(404).json({ success: false, message: 'Account not found' });

    let query = `
      SELECT jl.*, je.entry_number, je.entry_date, je.description as entry_description,
             je.reference_type, je.reference_id, je.status
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = ? AND je.status = 'posted'
    `;
    const params = [req.params.id];
    if (start_date) { query += ' AND je.entry_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND je.entry_date <= ?'; params.push(end_date); }
    query += ' ORDER BY je.entry_date ASC, je.id ASC';

    const [lines] = await pool.query(query, params);

    // Running balance
    let runningBalance = parseFloat(accounts[0].opening_balance);
    const isDebitNormal = ['asset', 'expense'].includes(accounts[0].type);
    const ledger = lines.map(line => {
      if (isDebitNormal) {
        runningBalance += parseFloat(line.debit) - parseFloat(line.credit);
      } else {
        runningBalance += parseFloat(line.credit) - parseFloat(line.debit);
      }
      return { ...line, running_balance: runningBalance };
    });

    res.json({ success: true, data: { account: accounts[0], ledger } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create account
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { code, name, type, parent_id, description, opening_balance } = req.body;
    if (!code || !name || !type) return res.status(400).json({ success: false, message: 'Code, name, type required' });

    const [existing] = await pool.query('SELECT id FROM accounts WHERE code = ?', [code]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Account code already exists' });

    const [result] = await pool.query(
      'INSERT INTO accounts (code, name, type, parent_id, description, opening_balance) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, type, parent_id || null, description, opening_balance || 0]
    );
    res.json({ success: true, message: 'Account created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update account
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { code, name, type, parent_id, description, opening_balance, is_active } = req.body;
    const [acc] = await pool.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!acc.length) return res.status(404).json({ success: false, message: 'Account not found' });
    if (acc[0].is_system && is_active === 0) return res.status(400).json({ success: false, message: 'Cannot deactivate system account' });

    await pool.query(
      'UPDATE accounts SET code=?, name=?, type=?, parent_id=?, description=?, opening_balance=?, is_active=? WHERE id=?',
      [code, name, type, parent_id || null, description, opening_balance || 0, is_active !== undefined ? is_active : 1, req.params.id]
    );
    res.json({ success: true, message: 'Account updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE account
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [acc] = await pool.query('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!acc.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (acc[0].is_system) return res.status(400).json({ success: false, message: 'Cannot delete system account' });

    const [used] = await pool.query('SELECT COUNT(*) as cnt FROM journal_lines WHERE account_id = ?', [req.params.id]);
    if (used[0].cnt > 0) {
      await pool.query('UPDATE accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
      return res.json({ success: true, message: 'Account deactivated (has transactions)' });
    }
    await pool.query('DELETE FROM accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── JOURNAL ENTRIES ────────────────────────────────────────

// GET all journal entries
router.get('/journals/list', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, reference_type, status, limit } = req.query;
    let query = `
      SELECT je.*, u.name as created_by_name,
        (SELECT GROUP_CONCAT(CONCAT(a.code, ' - ', a.name) SEPARATOR ', ') 
         FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id 
         WHERE jl.journal_entry_id = je.id AND jl.debit > 0) as debit_accounts,
        (SELECT GROUP_CONCAT(CONCAT(a.code, ' - ', a.name) SEPARATOR ', ') 
         FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id 
         WHERE jl.journal_entry_id = je.id AND jl.credit > 0) as credit_accounts
      FROM journal_entries je
      LEFT JOIN users u ON u.id = je.created_by
      WHERE 1=1
    `;
    const params = [];
    if (start_date) { query += ' AND je.entry_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND je.entry_date <= ?'; params.push(end_date); }
    if (reference_type) { query += ' AND je.reference_type = ?'; params.push(reference_type); }
    if (status) { query += ' AND je.status = ?'; params.push(status); }
    query += ' ORDER BY je.entry_date DESC, je.id DESC LIMIT ?';
    params.push(parseInt(limit) || 200);

    const [entries] = await pool.query(query, params);
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single journal entry with lines
router.get('/journals/:id', authenticateToken, async (req, res) => {
  try {
    const [entries] = await pool.query('SELECT je.*, u.name as created_by_name FROM journal_entries je LEFT JOIN users u ON u.id = je.created_by WHERE je.id = ?', [req.params.id]);
    if (!entries.length) return res.status(404).json({ success: false, message: 'Not found' });
    const [lines] = await pool.query(`
      SELECT jl.*, a.code as account_code, a.name as account_name, a.type as account_type
      FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
      WHERE jl.journal_entry_id = ?
      ORDER BY jl.debit DESC, jl.id
    `, [req.params.id]);
    res.json({ success: true, data: { ...entries[0], lines } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create manual journal entry
router.post('/journals', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { entry_date, description, lines } = req.body;

    if (!lines || lines.length < 2) return res.status(400).json({ success: false, message: 'At least 2 lines required' });

    // Validate debit = credit
    const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: `Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)})` });
    }

    const entryNumber = `JV-${Date.now().toString().slice(-8)}`;
    const [result] = await conn.query(`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, total_amount, is_auto, status, created_by)
      VALUES (?, ?, ?, 'manual', ?, 0, 'posted', ?)
    `, [entryNumber, entry_date || new Date().toISOString().slice(0, 10), description, totalDebit, req.user.id]);

    const journalId = result.insertId;
    for (const line of lines) {
      if ((parseFloat(line.debit) || 0) === 0 && (parseFloat(line.credit) || 0) === 0) continue;
      await conn.query(
        'INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
        [journalId, line.account_id, line.description || null, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Journal entry created', id: journalId, entry_number: entryNumber });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// POST void a journal entry
router.put('/journals/:id/void', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE journal_entries SET status = 'voided' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Journal entry voided' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── AUTO-POST: Record a sale in COA ────────────────────────
router.post('/post-sale', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { sale_id, invoice_number, total_amount, paid_amount, due_amount, discount_amount, vat_amount, total_purchase_cost, payment_method } = req.body;

    const entryNumber = `SALE-${invoice_number || Date.now()}`;

    // Check if already posted
    const [existing] = await conn.query("SELECT id FROM journal_entries WHERE reference_type = 'sale' AND reference_id = ?", [sale_id]);
    if (existing.length) { await conn.rollback(); return res.json({ success: true, message: 'Already posted' }); }

    // Determine cash account
    let cashAccountCode = '1001'; // Cash in Hand
    if (payment_method === 'card') cashAccountCode = '1002';
    else if (payment_method === 'mobile_banking') cashAccountCode = '1003';

    const [cashAcc] = await conn.query('SELECT id FROM accounts WHERE code = ?', [cashAccountCode]);
    const [arAcc] = await conn.query("SELECT id FROM accounts WHERE code = '1010'"); // Accounts Receivable
    const [salesAcc] = await conn.query("SELECT id FROM accounts WHERE code = '4001'"); // Sales Revenue
    const [cogsAcc] = await conn.query("SELECT id FROM accounts WHERE code = '5001'"); // COGS
    const [invAcc] = await conn.query("SELECT id FROM accounts WHERE code = '1020'"); // Inventory
    const [vatAcc] = await conn.query("SELECT id FROM accounts WHERE code = '2010'"); // VAT Payable
    const [discAcc] = await conn.query("SELECT id FROM accounts WHERE code = '5018'"); // Discount Given

    if (!cashAcc.length || !salesAcc.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'System accounts missing. Run COA migration first.' });
    }

    // Create journal entry
    const [je] = await conn.query(`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, total_amount, is_auto, status, created_by)
      VALUES (?, CURDATE(), ?, 'sale', ?, ?, 1, 'posted', ?)
    `, [entryNumber, `Sale ${invoice_number}`, sale_id, parseFloat(total_amount), req.user.id]);

    const jeId = je.insertId;

    // DEBIT: Cash (paid amount)
    if (parseFloat(paid_amount) > 0) {
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jeId, cashAcc[0].id, `Cash received - ${invoice_number}`, parseFloat(paid_amount)]);
    }

    // DEBIT: Accounts Receivable (due amount)
    if (parseFloat(due_amount) > 0 && arAcc.length) {
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jeId, arAcc[0].id, `Credit sale - ${invoice_number}`, parseFloat(due_amount)]);
    }

    // DEBIT: Discount Given
    if (parseFloat(discount_amount) > 0 && discAcc.length) {
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jeId, discAcc[0].id, `Discount - ${invoice_number}`, parseFloat(discount_amount)]);
    }

    // CREDIT: Sales Revenue
    const salesAmount = parseFloat(total_amount) + parseFloat(discount_amount || 0) - parseFloat(vat_amount || 0);
    await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
      [jeId, salesAcc[0].id, `Revenue - ${invoice_number}`, salesAmount > 0 ? salesAmount : parseFloat(total_amount)]);

    // CREDIT: VAT Payable
    if (parseFloat(vat_amount) > 0 && vatAcc.length) {
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jeId, vatAcc[0].id, `VAT collected - ${invoice_number}`, parseFloat(vat_amount)]);
    }

    // COGS Entry: Debit COGS, Credit Inventory
    if (parseFloat(total_purchase_cost) > 0 && cogsAcc.length && invAcc.length) {
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
        [jeId, cogsAcc[0].id, `COGS - ${invoice_number}`, parseFloat(total_purchase_cost)]);
      await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
        [jeId, invAcc[0].id, `Inventory out - ${invoice_number}`, parseFloat(total_purchase_cost)]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Sale posted to COA', journal_id: jeId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ── AUTO-POST: Record a customer payment ───────────────────
router.post('/post-payment', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { payment_id, customer_name, payment_amount, payment_method } = req.body;

    const entryNumber = `PAY-${payment_id}-${Date.now().toString().slice(-6)}`;

    let cashCode = '1001';
    if (payment_method === 'card') cashCode = '1002';
    else if (payment_method === 'mobile_banking') cashCode = '1003';
    else if (payment_method === 'bank_transfer') cashCode = '1002';

    const [cashAcc] = await conn.query('SELECT id FROM accounts WHERE code = ?', [cashCode]);
    const [arAcc] = await conn.query("SELECT id FROM accounts WHERE code = '1010'");

    if (!cashAcc.length || !arAcc.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'System accounts missing' });
    }

    const [je] = await conn.query(`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, total_amount, is_auto, status, created_by)
      VALUES (?, CURDATE(), ?, 'payment', ?, ?, 1, 'posted', ?)
    `, [entryNumber, `Payment from ${customer_name}`, payment_id, parseFloat(payment_amount), req.user.id]);

    // Debit Cash, Credit AR
    await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
      [je.insertId, cashAcc[0].id, `Payment received - ${customer_name}`, parseFloat(payment_amount)]);
    await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
      [je.insertId, arAcc[0].id, `AR reduced - ${customer_name}`, parseFloat(payment_amount)]);

    await conn.commit();
    res.json({ success: true, message: 'Payment posted to COA' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ── AUTO-POST: Record stock purchase ───────────────────────
router.post('/post-purchase', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { batch_id, product_name, quantity, purchase_price, supplier_name } = req.body;
    const totalCost = parseFloat(purchase_price) * parseInt(quantity);
    const entryNumber = `PUR-${batch_id}-${Date.now().toString().slice(-6)}`;

    const [invAcc] = await conn.query("SELECT id FROM accounts WHERE code = '1020'");
    const [cashAcc] = await conn.query("SELECT id FROM accounts WHERE code = '1001'");

    if (!invAcc.length || !cashAcc.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Accounts missing' }); }

    const [je] = await conn.query(`
      INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, total_amount, is_auto, status, created_by)
      VALUES (?, CURDATE(), ?, 'purchase', ?, ?, 1, 'posted', ?)
    `, [entryNumber, `Stock purchase: ${product_name} x${quantity} from ${supplier_name || 'supplier'}`, batch_id, totalCost, req.user.id]);

    // Debit Inventory, Credit Cash
    await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
      [je.insertId, invAcc[0].id, `Inventory in - ${product_name}`, totalCost]);
    await conn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
      [je.insertId, cashAcc[0].id, `Paid for stock - ${product_name}`, totalCost]);

    await conn.commit();
    res.json({ success: true, message: 'Purchase posted to COA' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ── FINANCIAL REPORTS ──────────────────────────────────────

// Trial Balance
router.get('/reports/trial-balance', authenticateToken, async (req, res) => {
  try {
    const { as_of_date } = req.query;
    let dateFilter = '';
    const params = [];
    if (as_of_date) { dateFilter = 'AND je.entry_date <= ?'; params.push(as_of_date); }

    const [accounts] = await pool.query(`
      SELECT a.id, a.code, a.name, a.type, a.opening_balance,
        COALESCE(SUM(jl.debit), 0) as total_debit,
        COALESCE(SUM(jl.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' ${dateFilter}
      WHERE a.is_active = 1
      GROUP BY a.id
      ORDER BY a.code
    `, params);

    const trialBalance = accounts.map(a => {
      const d = parseFloat(a.total_debit);
      const c = parseFloat(a.total_credit);
      const opening = parseFloat(a.opening_balance);
      let balance;
      if (['asset', 'expense'].includes(a.type)) {
        balance = opening + d - c;
      } else {
        balance = opening + c - d;
      }
      return {
        ...a, balance,
        debit_balance: balance > 0 && ['asset', 'expense'].includes(a.type) ? balance : (balance < 0 && ['liability', 'equity', 'income'].includes(a.type) ? Math.abs(balance) : 0),
        credit_balance: balance > 0 && ['liability', 'equity', 'income'].includes(a.type) ? balance : (balance < 0 && ['asset', 'expense'].includes(a.type) ? Math.abs(balance) : 0),
      };
    }).filter(a => a.balance !== 0 || a.total_debit > 0 || a.total_credit > 0);

    const totalDebits = trialBalance.reduce((s, a) => s + a.debit_balance, 0);
    const totalCredits = trialBalance.reduce((s, a) => s + a.credit_balance, 0);

    res.json({ success: true, data: { accounts: trialBalance, total_debits: totalDebits, total_credits: totalCredits } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Income Statement (Profit & Loss)
router.get('/reports/income-statement', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '';
    const params = [];
    if (start_date) { dateFilter += ' AND je.entry_date >= ?'; params.push(start_date); }
    if (end_date) { dateFilter += ' AND je.entry_date <= ?'; params.push(end_date); }

    const [income] = await pool.query(`
      SELECT a.id, a.code, a.name, 
        COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' ${dateFilter}
      WHERE a.type = 'income' AND a.is_active = 1
      GROUP BY a.id ORDER BY a.code
    `, params);

    const [expenses] = await pool.query(`
      SELECT a.id, a.code, a.name, 
        COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as amount
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' ${dateFilter}
      WHERE a.type = 'expense' AND a.is_active = 1
      GROUP BY a.id ORDER BY a.code
    `, params);

    const totalIncome = income.reduce((s, i) => s + parseFloat(i.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);

    res.json({
      success: true,
      data: {
        income: income.filter(i => parseFloat(i.amount) !== 0),
        expenses: expenses.filter(e => parseFloat(e.amount) !== 0),
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_profit: totalIncome - totalExpenses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Balance Sheet
router.get('/reports/balance-sheet', authenticateToken, async (req, res) => {
  try {
    const { as_of_date } = req.query;
    let dateFilter = '';
    const params = [];
    if (as_of_date) { dateFilter = 'AND je.entry_date <= ?'; params.push(as_of_date); }

    const getByType = async (type) => {
      const [rows] = await pool.query(`
        SELECT a.id, a.code, a.name, a.opening_balance,
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN journal_lines jl ON jl.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' ${dateFilter}
        WHERE a.type = ? AND a.is_active = 1
        GROUP BY a.id ORDER BY a.code
      `, [type, ...params]);

      return rows.map(a => {
        const d = parseFloat(a.total_debit), c = parseFloat(a.total_credit), o = parseFloat(a.opening_balance);
        const balance = ['asset', 'expense'].includes(type) ? o + d - c : o + c - d;
        return { ...a, balance };
      }).filter(a => a.balance !== 0);
    };

    const assets = await getByType('asset');
    const liabilities = await getByType('liability');
    const equity = await getByType('equity');

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    res.json({
      success: true,
      data: { assets, liabilities, equity, total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

let outletScope;
try { outletScope = require('../middleware/outletScope').outletScope; }
catch (e) { outletScope = (req, res, next) => { req.getOutletId = () => null; req.isOutletUser = false; req.isWarehouseAdmin = true; req.canDelete = () => ({ allowed: true }); next(); }; }

const router = express.Router();
router.use(authenticateToken, outletScope);

// Helper: get effective outlet ID (outlet user = their outlet, admin = query param)
function getEffectiveOutlet(req) {
  if (req.isOutletUser) return req.outletId;
  // Admin can pass ?outlet_id=X
  if (req.query.outlet_id) return parseInt(req.query.outlet_id);
  if (req.body && req.body.outlet_id) return parseInt(req.body.outlet_id);
  return null;
}

// GET /api/deposits/outlets — admin gets list of all outlets (for dropdown)
router.get('/outlets', async (req, res) => {
  try {
    const [outlets] = await pool.query("SELECT id, name, code FROM outlets WHERE status = 'active' ORDER BY name");
    res.json({ success: true, data: outlets });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/deposits/today
router.get('/today', async (req, res) => {
  try {
    const oid = getEffectiveOutlet(req);

    // If admin with no outlet selected — show summary of all outlets
    if (!oid && !req.isOutletUser) {
      const [outlets] = await pool.query("SELECT id, name, code FROM outlets WHERE status = 'active' ORDER BY name");
      const outletSummaries = [];
      for (const o of outlets) {
        const [cashSales] = await pool.query(
          "SELECT COALESCE(SUM(paid_amount),0) as total FROM sales WHERE outlet_id = ? AND DATE(created_at) = CURDATE() AND status = 'active' AND payment_method = 'cash'", [o.id]
        );
        const [deposited] = await pool.query(
          "SELECT COALESCE(SUM(deposit_amount),0) as total FROM bank_deposits WHERE outlet_id = ? AND deposit_date = CURDATE()", [o.id]
        );
        const [banks] = await pool.query(
          "SELECT * FROM bank_accounts WHERE outlet_id = ?", [o.id]
        );
        const cashBalance = banks.filter(b => b.account_type === 'cash').reduce((s, b) => s + parseFloat(b.current_balance), 0);
        outletSummaries.push({
          ...o,
          today_cash_sales: parseFloat(cashSales[0].total),
          today_deposited: parseFloat(deposited[0].total),
          cash_balance: cashBalance,
          bank_count: banks.filter(b => b.account_type !== 'cash').length,
        });
      }

      // All deposits history
      const [history] = await pool.query(`
        SELECT bd.*, ba.account_name, ba.icon as bank_icon, u.name as deposited_by_name, o.name as outlet_name, o.code as outlet_code
        FROM bank_deposits bd
        LEFT JOIN bank_accounts ba ON ba.id = bd.bank_account_id
        LEFT JOIN users u ON u.id = bd.created_by
        LEFT JOIN outlets o ON o.id = bd.outlet_id
        ORDER BY bd.deposit_date DESC, bd.id DESC LIMIT 50
      `);

      // All bank accounts
      const [allBanks] = await pool.query("SELECT ba.*, o.name as outlet_name FROM bank_accounts ba LEFT JOIN outlets o ON o.id = ba.outlet_id ORDER BY ba.outlet_id IS NULL DESC, ba.account_name");

      return res.json({
        success: true,
        data: {
          is_admin_view: true,
          outlets: outletSummaries,
          history,
          banks: allBanks,
          // Totals
          opening_balance: 0,
          today_cash_sales: outletSummaries.reduce((s, o) => s + o.today_cash_sales, 0),
          today_total_sales: 0,
          today_paid: 0,
          today_credit: 0,
          today_invoices: 0,
          today_expenses: 0,
          total_cash_in_hand: outletSummaries.reduce((s, o) => s + o.cash_balance, 0),
          already_deposited: outletSummaries.reduce((s, o) => s + o.today_deposited, 0),
          remaining_cash: 0,
        }
      });
    }

    if (!oid) return res.status(400).json({ success: false, message: 'Please select an outlet' });

    // Get outlet name and check if it's the main warehouse
    const [outletInfo] = await pool.query('SELECT name, code FROM outlets WHERE id = ?', [oid]);
    const outletName = outletInfo.length ? outletInfo[0].name : `Outlet #${oid}`;
    const isWarehouse = outletInfo.length && outletInfo[0].code === 'WAREHOUSE';
    // Include NULL outlet_id sales for warehouse (admin sales before outlet system)
    const outletFilter = isWarehouse ? '(outlet_id = ? OR outlet_id IS NULL)' : 'outlet_id = ?';

    // Yesterday's closing = today's opening
    const depositFilter = isWarehouse ? '(outlet_id = ? OR outlet_id IS NULL)' : 'outlet_id = ?';
    const [lastDeposit] = await pool.query(
      `SELECT closing_balance FROM bank_deposits WHERE ${depositFilter} AND deposit_date < CURDATE() ORDER BY deposit_date DESC, id DESC LIMIT 1`, [oid]
    );
    const openingBalance = lastDeposit.length ? parseFloat(lastDeposit[0].closing_balance) : 0;

    // Today's cash sales (include NULL outlet_id for backward compatibility)
    const [cashSales] = await pool.query(
      `SELECT COALESCE(SUM(paid_amount), 0) as total FROM sales WHERE ${outletFilter} AND DATE(created_at) = CURDATE() AND status = 'active' AND payment_method = 'cash'`, [oid]
    );
    const todayCashSales = parseFloat(cashSales[0].total);

    // Today's total sales
    const [allSales] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(due_amount), 0) as credit, COUNT(*) as count
       FROM sales WHERE ${outletFilter} AND DATE(created_at) = CURDATE() AND status = 'active'`, [oid]
    );

    // Today's expenses
    const [expenses] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE ${outletFilter} AND type = 'expense' AND DATE(transaction_date) = CURDATE()`, [oid]
    );
    const todayExpenses = parseFloat(expenses[0].total);

    // Today's deposits already made
    const [deposited] = await pool.query(
      `SELECT COALESCE(SUM(deposit_amount), 0) as total FROM bank_deposits WHERE ${depositFilter} AND deposit_date = CURDATE()`, [oid]
    );
    const alreadyDeposited = parseFloat(deposited[0].total);

    const totalCashInHand = openingBalance + todayCashSales - todayExpenses;
    const remainingCash = totalCashInHand - alreadyDeposited;

    // Deposit history
    const depositHistoryFilter = isWarehouse ? '(bd.outlet_id = ? OR bd.outlet_id IS NULL)' : 'bd.outlet_id = ?';
    const [history] = await pool.query(`
      SELECT bd.*, ba.account_name, ba.icon as bank_icon, u.name as deposited_by_name
      FROM bank_deposits bd
      LEFT JOIN bank_accounts ba ON ba.id = bd.bank_account_id
      LEFT JOIN users u ON u.id = bd.created_by
      WHERE ${depositHistoryFilter}
      ORDER BY bd.deposit_date DESC, bd.id DESC LIMIT 30
    `, [oid]);

    // Bank accounts — admin sees ALL accounts, outlet user sees only their outlet
    let banks;
    if (!req.isOutletUser) {
      // Admin: show ALL bank accounts (no outlet filter at all)
      const [bankRows] = await pool.query(
        `SELECT ba.*, o.name as outlet_name, o.code as outlet_code
         FROM bank_accounts ba 
         LEFT JOIN outlets o ON o.id = ba.outlet_id
         ORDER BY ba.outlet_id IS NULL DESC, ba.account_name`
      );
      banks = bankRows;
    } else {
      const [bankRows] = await pool.query(
        'SELECT * FROM bank_accounts WHERE outlet_id = ?', [oid]
      );
      banks = bankRows;
    }

    res.json({
      success: true,
      data: {
        is_admin_view: false,
        outlet_id: oid,
        outlet_name: outletName,
        opening_balance: openingBalance,
        today_cash_sales: todayCashSales,
        today_total_sales: parseFloat(allSales[0].total),
        today_paid: parseFloat(allSales[0].paid),
        today_credit: parseFloat(allSales[0].credit),
        today_invoices: allSales[0].count,
        today_expenses: todayExpenses,
        total_cash_in_hand: totalCashInHand,
        already_deposited: alreadyDeposited,
        remaining_cash: remainingCash,
        history,
        banks,
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST /api/deposits
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const oid = getEffectiveOutlet(req);
    if (!oid) return res.status(400).json({ success: false, message: 'Outlet required. Pass outlet_id.' });

    const { deposit_amount, bank_account_id, opening_balance, total_cash, notes } = req.body;
    if (!deposit_amount || parseFloat(deposit_amount) <= 0) return res.status(400).json({ success: false, message: 'Deposit amount required' });

    const amt = parseFloat(deposit_amount);
    const openBal = parseFloat(opening_balance) || 0;
    const totalCash = parseFloat(total_cash) || 0;
    const closingBalance = totalCash - amt;

    const [result] = await conn.query(
      `INSERT INTO bank_deposits (outlet_id, deposit_date, opening_balance, cash_sales, total_cash, deposit_amount, closing_balance, bank_account_id, notes, created_by)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [oid, openBal, totalCash - openBal, totalCash, amt, closingBalance, bank_account_id || null, notes, req.user.id]
    );

    if (bank_account_id) {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, bank_account_id]);
    }

    // Record as transaction
    try {
      const [outletInfo] = await conn.query('SELECT name FROM outlets WHERE id = ?', [oid]);
      await conn.query(
        `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, outlet_id, is_auto, created_by)
         VALUES ('income', 'Bank Deposit', ?, ?, 'cash', ?, 'Outlet Deposit', CURDATE(), ?, 1, ?)`,
        [amt, bank_account_id, `Daily deposit from ${outletInfo.length ? outletInfo[0].name : 'outlet'}: ${notes || ''}`, oid, req.user.id]
      );
    } catch (e) { console.log('Transaction record skipped:', e.message); }

    await conn.commit();
    res.json({ success: true, message: `৳${amt.toLocaleString()} deposited`, id: result.insertId, closing_balance: closingBalance });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// PUT /api/deposits/:id
router.put('/:id', async (req, res) => {
  try {
    const [dep] = await pool.query('SELECT * FROM bank_deposits WHERE id = ?', [req.params.id]);
    if (!dep.length) return res.status(404).json({ success: false, message: 'Not found' });

    const check = req.canDelete(dep[0].created_at);
    if (!check.allowed) return res.status(403).json({ success: false, message: check.reason });

    const { deposit_amount, opening_balance, total_cash, notes, bank_account_id } = req.body;
    const oldAmt = parseFloat(dep[0].deposit_amount);
    const newAmt = parseFloat(deposit_amount);
    const closingBalance = parseFloat(total_cash) - newAmt;

    if (dep[0].bank_account_id) {
      await pool.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [oldAmt, dep[0].bank_account_id]);
    }
    if (bank_account_id) {
      await pool.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [newAmt, bank_account_id]);
    }

    await pool.query(
      'UPDATE bank_deposits SET opening_balance=?, cash_sales=?, total_cash=?, deposit_amount=?, closing_balance=?, bank_account_id=?, notes=? WHERE id=?',
      [opening_balance, parseFloat(total_cash) - parseFloat(opening_balance), total_cash, newAmt, closingBalance, bank_account_id, notes, req.params.id]
    );
    res.json({ success: true, message: 'Deposit updated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// DELETE /api/deposits/:id
router.delete('/:id', async (req, res) => {
  try {
    const [dep] = await pool.query('SELECT * FROM bank_deposits WHERE id = ?', [req.params.id]);
    if (!dep.length) return res.status(404).json({ success: false, message: 'Not found' });

    const check = req.canDelete(dep[0].created_at);
    if (!check.allowed) {
      if (req.isOutletUser && req.outletId) {
        try {
          await pool.query(
            `INSERT INTO pending_actions (outlet_id, requested_by, action_type, entity_type, entity_id, reason, entity_data) VALUES (?, ?, 'delete_transaction', 'bank_deposit', ?, 'Delete deposit request', ?)`,
            [req.outletId, req.user.id, req.params.id, JSON.stringify(dep[0])]
          );
        } catch (e) { }
      }
      return res.status(202).json({ success: true, message: check.reason });
    }

    if (dep[0].bank_account_id) {
      await pool.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [parseFloat(dep[0].deposit_amount), dep[0].bank_account_id]);
    }
    await pool.query('DELETE FROM bank_deposits WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Deposit deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
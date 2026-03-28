const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const router = express.Router();

router.use(authenticateToken, requireAdmin);

// ══════════════════════════════════════════════════════════
// ADD OPENING CASH / ADJUST CASH BALANCE
// ══════════════════════════════════════════════════════════

router.post('/:outletId/cash', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const outletId = req.params.outletId;
    const { amount, type, notes } = req.body;
    // type: 'set_opening', 'add', 'withdraw'

    if (!amount || parseFloat(amount) < 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const amt = parseFloat(amount);

    const [outlet] = await conn.query('SELECT * FROM outlets WHERE id = ?', [outletId]);
    if (!outlet.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Outlet not found' }); }

    // Get or create cash account for outlet
    let [cashAcc] = await conn.query("SELECT * FROM bank_accounts WHERE outlet_id = ? AND account_type = 'cash' AND is_active = 1 LIMIT 1", [outletId]);
    if (!cashAcc.length) {
      const [newAcc] = await conn.query(
        "INSERT INTO bank_accounts (account_name, account_type, icon, color, is_default, outlet_id, opening_balance, current_balance) VALUES (?, 'cash', '💵', '#16a34a', 1, ?, ?, ?)",
        [`${outlet[0].code} - Cash`, outletId, amt, amt]
      );
      cashAcc = [{ id: newAcc.insertId, current_balance: 0 }];
    }

    const accId = cashAcc[0].id;

    if (type === 'set_opening') {
      await conn.query('UPDATE bank_accounts SET opening_balance = ?, current_balance = ? WHERE id = ?', [amt, amt, accId]);
    } else if (type === 'add') {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, accId]);
    } else if (type === 'withdraw') {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [amt, accId]);
    }

    // Record transaction
    await conn.query(
      `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, outlet_id, is_auto, created_by)
       VALUES (?, ?, ?, ?, 'cash', ?, 'Admin', CURDATE(), ?, 1, ?)`,
      [type === 'withdraw' ? 'expense' : 'income',
       type === 'set_opening' ? 'Opening Balance' : type === 'add' ? 'Cash Added by Admin' : 'Cash Withdrawn by Admin',
       amt, accId, notes || `Admin ${type}: ৳${amt.toLocaleString()}`, outletId, req.user.id]
    );

    await logActivity(req, `cash_${type}`, 'bank_account', accId, `Admin ${type} ৳${amt.toLocaleString()} cash to ${outlet[0].name}`, { outlet_id: outletId, amount: amt, type });

    await conn.commit();
    res.json({ success: true, message: `Cash ${type}: ৳${amt.toLocaleString()} applied to ${outlet[0].name}` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// ADD/SET CREDIT BALANCE FOR OUTLET
// ══════════════════════════════════════════════════════════

router.post('/:outletId/credit', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const outletId = req.params.outletId;
    const { amount, type, customer_name, notes } = req.body;
    // type: 'assign_credit', 'collect_credit'

    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const amt = parseFloat(amount);

    const [outlet] = await conn.query('SELECT * FROM outlets WHERE id = ?', [outletId]);
    if (!outlet.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Outlet not found' }); }

    // Record as transaction
    const txType = type === 'collect_credit' ? 'income' : 'expense';
    const category = type === 'collect_credit' ? 'Credit Collected' : 'Credit Assigned';

    await conn.query(
      `INSERT INTO transactions (type, category, amount, payment_method, description, party_name, transaction_date, outlet_id, is_auto, created_by)
       VALUES (?, ?, ?, 'credit', ?, ?, CURDATE(), ?, 1, ?)`,
      [txType, category, amt, notes || `Admin ${type}: ৳${amt.toLocaleString()}`, customer_name || 'Admin Credit', outletId, req.user.id]
    );

    // If collecting credit, add to cash account
    if (type === 'collect_credit') {
      const [cashAcc] = await conn.query("SELECT id FROM bank_accounts WHERE outlet_id = ? AND account_type = 'cash' AND is_active = 1 LIMIT 1", [outletId]);
      if (cashAcc.length) {
        await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, cashAcc[0].id]);
      }
    }

    await logActivity(req, `credit_${type}`, 'transaction', null, `Admin ${type}: ৳${amt.toLocaleString()} for ${outlet[0].name}`, { outlet_id: outletId, amount: amt, type });

    await conn.commit();
    res.json({ success: true, message: `Credit ${type}: ৳${amt.toLocaleString()} for ${outlet[0].name}` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// BANK DEPOSIT (Admin deposits on behalf of outlet)
// ══════════════════════════════════════════════════════════

router.post('/:outletId/deposit', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const outletId = req.params.outletId;
    const { amount, bank_account_id, from_account_id, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    const amt = parseFloat(amount);

    const [outlet] = await conn.query('SELECT * FROM outlets WHERE id = ?', [outletId]);
    if (!outlet.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Outlet not found' }); }

    // Deduct from source (cash account)
    if (from_account_id) {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ? AND outlet_id = ?', [amt, from_account_id, outletId]);
    }

    // Add to bank account
    if (bank_account_id) {
      await conn.query('UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?', [amt, bank_account_id]);
    }

    // Create deposit record
    const [lastDep] = await conn.query(
      'SELECT closing_balance FROM bank_deposits WHERE outlet_id = ? ORDER BY deposit_date DESC, id DESC LIMIT 1', [outletId]
    );
    const openBal = lastDep.length ? parseFloat(lastDep[0].closing_balance) : 0;

    await conn.query(
      `INSERT INTO bank_deposits (outlet_id, deposit_date, opening_balance, cash_sales, total_cash, deposit_amount, closing_balance, bank_account_id, notes, created_by)
       VALUES (?, CURDATE(), ?, 0, ?, ?, ?, ?, ?, ?)`,
      [outletId, openBal, openBal, amt, openBal - amt, bank_account_id, notes || 'Admin deposit', req.user.id]
    );

    // Transaction record
    await conn.query(
      `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, outlet_id, is_auto, created_by)
       VALUES ('income', 'Bank Deposit', ?, ?, 'bank_transfer', ?, 'Admin Deposit', CURDATE(), ?, 1, ?)`,
      [amt, bank_account_id, notes || `Admin bank deposit: ৳${amt.toLocaleString()}`, outletId, req.user.id]
    );

    await logActivity(req, 'bank_deposit_admin', 'bank_deposit', null, `Admin deposited ৳${amt.toLocaleString()} to bank for ${outlet[0].name}`, { outlet_id: outletId, amount: amt, bank_account_id });

    await conn.commit();
    res.json({ success: true, message: `৳${amt.toLocaleString()} deposited to bank for ${outlet[0].name}` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// CREATE BANK ACCOUNT FOR OUTLET
// ══════════════════════════════════════════════════════════

router.post('/:outletId/bank-account', async (req, res) => {
  try {
    const { account_name, account_type, bank_name, account_number, branch, opening_balance, icon, color } = req.body;
    if (!account_name) return res.status(400).json({ success: false, message: 'Account name required' });
    const ob = parseFloat(opening_balance) || 0;
    const [result] = await pool.query(
      'INSERT INTO bank_accounts (account_name, account_type, bank_name, account_number, branch, opening_balance, current_balance, icon, color, outlet_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [account_name, account_type || 'bank', bank_name, account_number, branch, ob, ob, icon || '🏦', color || '#2563eb', req.params.outletId]
    );

    await logActivity(req, 'bank_account_created', 'bank_account', result.insertId, `Created bank account "${account_name}" for outlet #${req.params.outletId}`, { outlet_id: req.params.outletId });

    res.json({ success: true, message: 'Bank account created', id: result.insertId });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { outletScope } = require('../middleware/outletScope');
const router = express.Router();

// Apply outlet middleware to all routes
router.use(authenticateToken, outletScope);

// ══════════════════════════════════════════════════════════
// OUTLETS CRUD (Admin only)
// ══════════════════════════════════════════════════════════

// GET all outlets with live metrics
router.get('/', async (req, res) => {
  try {
    const [outlets] = await pool.query("SELECT * FROM outlets WHERE status = 'active' ORDER BY id");

    for (const o of outlets) {
      // Today's sales + profit
      const [sales] = await pool.query(
        "SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(paid_amount),0) as cash, COALESCE(SUM(due_amount),0) as credit, COALESCE(SUM(total_profit),0) as profit, COALESCE(SUM(total_purchase_cost),0) as cost FROM sales WHERE outlet_id = ? AND DATE(created_at) = CURDATE() AND status = 'active'",
        [o.id]
      );
      o.today_sales = parseFloat(sales[0].total);
      o.today_invoices = sales[0].count;
      o.today_cash = parseFloat(sales[0].cash);
      o.today_credit = parseFloat(sales[0].credit);
      o.today_profit = parseFloat(sales[0].profit);

      // Stock value
      const [stock] = await pool.query(
        "SELECT COALESCE(SUM(quantity_remaining),0) as units, COALESCE(SUM(quantity_remaining * purchase_price),0) as value FROM stock_batches WHERE outlet_id = ? AND quantity_remaining > 0",
        [o.id]
      );
      o.stock_units = parseInt(stock[0].units);
      o.stock_value = parseFloat(stock[0].value);

      // Bank balance (total + cash separately)
      const [bank] = await pool.query(
        "SELECT COALESCE(SUM(current_balance),0) as total FROM bank_accounts WHERE outlet_id = ? AND is_active = 1",
        [o.id]
      );
      o.bank_balance = parseFloat(bank[0].total);

      const [cashAcc] = await pool.query(
        "SELECT COALESCE(SUM(current_balance),0) as total FROM bank_accounts WHERE outlet_id = ? AND account_type = 'cash' AND is_active = 1",
        [o.id]
      );
      o.cash_balance = parseFloat(cashAcc[0].total);

      // Opening balance (last deposit closing)
      const [lastDep] = await pool.query(
        "SELECT closing_balance FROM bank_deposits WHERE outlet_id = ? ORDER BY deposit_date DESC, id DESC LIMIT 1",
        [o.id]
      );
      o.opening_balance = lastDep.length ? parseFloat(lastDep[0].closing_balance) : parseFloat(cashAcc[0].total);

      // Monthly sales + profit
      const [monthly] = await pool.query(
        "SELECT COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(total_profit),0) as profit FROM sales WHERE outlet_id = ? AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND status = 'active'",
        [o.id]
      );
      o.monthly_sales = parseFloat(monthly[0].total);
      o.monthly_profit = parseFloat(monthly[0].profit);

      // Users
      const [users] = await pool.query(
        "SELECT COUNT(*) as count FROM outlet_users WHERE outlet_id = ? AND is_active = 1",
        [o.id]
      );
      o.user_count = users[0].count;

      // Pending requests
      const [pending] = await pool.query(
        "SELECT COUNT(*) as count FROM pending_actions WHERE outlet_id = ? AND status = 'pending'",
        [o.id]
      );
      o.pending_requests = pending[0].count;
    }

    res.json({ success: true, data: outlets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single outlet detail — FULL DASHBOARD DATA
router.get('/:id', async (req, res) => {
  try {
    const [outlets] = await pool.query('SELECT * FROM outlets WHERE id = ?', [req.params.id]);
    if (!outlets.length) return res.status(404).json({ success: false, message: 'Not found' });
    const outlet = outlets[0];
    const oid = req.params.id;

    // ── SALES METRICS ──────────────────────────────────────
    const [todaySales] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(paid_amount),0) as paid,
        COALESCE(SUM(due_amount),0) as credit, COALESCE(SUM(total_profit),0) as profit,
        COALESCE(SUM(total_purchase_cost),0) as cost
       FROM sales WHERE outlet_id = ? AND DATE(created_at) = CURDATE() AND status = 'active'`, [oid]
    );
    const [weeklySales] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(total_profit),0) as profit, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as credit, COUNT(*) as count
       FROM sales WHERE outlet_id = ? AND YEARWEEK(created_at,1)=YEARWEEK(NOW(),1) AND status = 'active'`, [oid]
    );
    const [monthlySales] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(total_profit),0) as profit, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as credit, COUNT(*) as count
       FROM sales WHERE outlet_id = ? AND MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW()) AND status = 'active'`, [oid]
    );
    const [yearlySales] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(total_profit),0) as profit, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as credit, COUNT(*) as count
       FROM sales WHERE outlet_id = ? AND YEAR(created_at)=YEAR(NOW()) AND status = 'active'`, [oid]
    );
    const [lifetimeSales] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(total_profit),0) as profit, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as credit, COUNT(*) as count
       FROM sales WHERE outlet_id = ? AND status = 'active'`, [oid]
    );

    // ── CASH / BANK / OPENING ──────────────────────────────
    const [banks] = await pool.query(
      "SELECT * FROM bank_accounts WHERE outlet_id = ? AND is_active = 1", [oid]
    );
    const cashBalance = banks.filter(b => b.account_type === 'cash').reduce((s, b) => s + parseFloat(b.current_balance), 0);
    const bankDeposit = banks.filter(b => b.account_type !== 'cash').reduce((s, b) => s + parseFloat(b.current_balance), 0);
    const totalBalance = banks.reduce((s, b) => s + parseFloat(b.current_balance), 0);

    const [lastDep] = await pool.query(
      "SELECT closing_balance FROM bank_deposits WHERE outlet_id = ? ORDER BY deposit_date DESC, id DESC LIMIT 1", [oid]
    );
    const openingBalance = lastDep.length ? parseFloat(lastDep[0].closing_balance) : cashBalance;

    // Today's deposits
    const [todayDeposits] = await pool.query(
      "SELECT COALESCE(SUM(deposit_amount),0) as total FROM bank_deposits WHERE outlet_id = ? AND deposit_date = CURDATE()", [oid]
    );

    // Today's expenses
    const [todayExpenses] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE outlet_id = ? AND type = 'expense' AND DATE(transaction_date) = CURDATE()", [oid]
    );

    // ── STOCK ──────────────────────────────────────────────
    const [stockSummary] = await pool.query(
      "SELECT COALESCE(SUM(quantity_remaining),0) as units, COALESCE(SUM(quantity_remaining * purchase_price),0) as value FROM stock_batches WHERE outlet_id = ? AND quantity_remaining > 0", [oid]
    );
    const [stock] = await pool.query(`
      SELECT p.id, p.product_name, p.brand, p.model, p.unit,
        COALESCE(SUM(sb.quantity_remaining),0) as stock,
        COALESCE(SUM(sb.quantity_remaining * sb.purchase_price),0) as value
      FROM products p
      LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.outlet_id = ? AND sb.quantity_remaining > 0
      WHERE p.is_active = 1
      GROUP BY p.id HAVING stock > 0
      ORDER BY p.product_name
    `, [oid]);

    // ── RECENT SALES ───────────────────────────────────────
    const [sales] = await pool.query(
      "SELECT id, invoice_number, total_amount, paid_amount, due_amount, total_profit, payment_method, payment_status, customer_name, created_at FROM sales WHERE outlet_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 50", [oid]
    );

    // Daily sales (last 7 days)
    const [dailySales] = await pool.query(
      "SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_amount) as total, SUM(total_profit) as profit FROM sales WHERE outlet_id = ? AND status = 'active' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY date", [oid]
    );

    // ── USERS, PENDING, TRANSFERS ──────────────────────────
    const [users] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, ou.role as outlet_role, ou.is_active
      FROM outlet_users ou JOIN users u ON u.id = ou.user_id WHERE ou.outlet_id = ?
    `, [oid]);
    const [pending] = await pool.query(`
      SELECT pa.*, u.name as requested_by_name FROM pending_actions pa
      LEFT JOIN users u ON u.id = pa.requested_by
      WHERE pa.outlet_id = ? AND pa.status = 'pending' ORDER BY pa.created_at DESC
    `, [oid]);
    const [transfers] = await pool.query(`
      SELECT st.*, fo.name as from_name, too.name as to_name, u.name as created_by_name
      FROM stock_transfers st
      LEFT JOIN outlets fo ON fo.id = st.from_outlet_id
      LEFT JOIN outlets too ON too.id = st.to_outlet_id
      LEFT JOIN users u ON u.id = st.created_by
      WHERE st.to_outlet_id = ? OR st.from_outlet_id = ?
      ORDER BY st.created_at DESC LIMIT 20
    `, [oid, oid]);

    // ── DEPOSIT HISTORY ────────────────────────────────────
    const [depositHistory] = await pool.query(`
      SELECT bd.*, ba.account_name, ba.icon as bank_icon, u.name as deposited_by_name
      FROM bank_deposits bd LEFT JOIN bank_accounts ba ON ba.id = bd.bank_account_id
      LEFT JOIN users u ON u.id = bd.created_by
      WHERE bd.outlet_id = ? ORDER BY bd.deposit_date DESC, bd.id DESC LIMIT 20
    `, [oid]);

    res.json({
      success: true,
      data: {
        outlet,
        metrics: {
          today: { ...todaySales[0], deposits: parseFloat(todayDeposits[0].total), expenses: parseFloat(todayExpenses[0].total) },
          weekly: weeklySales[0],
          monthly: monthlySales[0],
          yearly: yearlySales[0],
          lifetime: lifetimeSales[0],
          opening_balance: openingBalance,
          cash_balance: cashBalance,
          bank_deposit: bankDeposit,
          total_balance: totalBalance,
          stock_units: parseInt(stockSummary[0].units),
          stock_value: parseFloat(stockSummary[0].value),
        },
        sales, dailySales, stock, banks, users, pending, transfers, depositHistory,
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST create outlet
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, code, address, phone, manager_name } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'Name and code required' });

    const [existing] = await pool.query('SELECT id FROM outlets WHERE code = ?', [code]);
    if (existing.length) return res.status(400).json({ success: false, message: 'Outlet code already exists' });

    const [result] = await pool.query(
      'INSERT INTO outlets (name, code, address, phone, manager_name) VALUES (?, ?, ?, ?, ?)',
      [name, code.toUpperCase(), address, phone, manager_name]
    );

    // Create default bank accounts for outlet
    const outletId = result.insertId;
    await pool.query(
      "INSERT INTO bank_accounts (account_name, account_type, icon, color, is_default, outlet_id, opening_balance, current_balance) VALUES (?, 'cash', '💵', '#16a34a', 1, ?, 0, 0)",
      [`${code} - Cash`, outletId]
    );

    res.json({ success: true, message: 'Outlet created', id: outletId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update outlet
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, code, address, phone, manager_name, status } = req.body;
    await pool.query(
      'UPDATE outlets SET name=?, code=?, address=?, phone=?, manager_name=?, status=? WHERE id=?',
      [name, code, address, phone, manager_name, status || 'active', req.params.id]
    );
    res.json({ success: true, message: 'Outlet updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE outlet
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE outlets SET status = 'inactive' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Outlet deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// OUTLET USERS
// ══════════════════════════════════════════════════════════

// POST assign user to outlet
router.post('/:id/users', requireAdmin, async (req, res) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'User ID required' });

    // Remove from other outlets
    await pool.query('DELETE FROM outlet_users WHERE user_id = ?', [user_id]);

    await pool.query(
      'INSERT INTO outlet_users (user_id, outlet_id, role) VALUES (?, ?, ?)',
      [user_id, req.params.id, role || 'staff']
    );
    await pool.query('UPDATE users SET outlet_id = ? WHERE id = ?', [req.params.id, user_id]);

    res.json({ success: true, message: 'User assigned to outlet' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE remove user from outlet
router.delete('/:id/users/:userId', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM outlet_users WHERE outlet_id = ? AND user_id = ?', [req.params.id, req.params.userId]);
    await pool.query('UPDATE users SET outlet_id = NULL WHERE id = ?', [req.params.userId]);
    res.json({ success: true, message: 'User removed from outlet' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// STOCK TRANSFERS (Warehouse → Outlet)
// ══════════════════════════════════════════════════════════

// POST create stock transfer
router.post('/transfers', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { from_outlet_id, to_outlet_id, items, notes } = req.body;
    if (!to_outlet_id || !items || !items.length) return res.status(400).json({ success: false, message: 'Destination and items required' });

    const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;
    const [result] = await conn.query(
      'INSERT INTO stock_transfers (transfer_number, from_outlet_id, to_outlet_id, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [transferNumber, from_outlet_id || null, to_outlet_id, req.isWarehouseAdmin ? 'approved' : 'pending', notes, req.user.id]
    );

    const transferId = result.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_transfer_items (transfer_id, product_id, quantity, batch_id, notes) VALUES (?, ?, ?, ?, ?)',
        [transferId, item.product_id, item.quantity, item.batch_id || null, item.notes || null]
      );
    }

    // If admin, auto-process the transfer
    if (req.isWarehouseAdmin) {
      for (const item of items) {
        // Deduct from source
        if (from_outlet_id) {
          const [batches] = await conn.query(
            'SELECT id, quantity_remaining FROM stock_batches WHERE product_id = ? AND outlet_id = ? AND quantity_remaining > 0 ORDER BY created_at ASC',
            [item.product_id, from_outlet_id]
          );
          let remaining = item.quantity;
          for (const b of batches) {
            if (remaining <= 0) break;
            const deduct = Math.min(b.quantity_remaining, remaining);
            await conn.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?', [deduct, b.id]);
            remaining -= deduct;
          }
        }

        // Add to destination
        const [srcBatch] = await conn.query(
          'SELECT purchase_price, sale_price FROM stock_batches WHERE product_id = ? AND quantity_remaining > 0 ORDER BY created_at DESC LIMIT 1',
          [item.product_id]
        );
        const pp = srcBatch.length ? srcBatch[0].purchase_price : 0;
        const sp = srcBatch.length ? srcBatch[0].sale_price : 0;

        await conn.query(
          'INSERT INTO stock_batches (product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining, outlet_id, supplier_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [item.product_id, `TRF-${transferNumber}`, pp, sp, item.quantity, item.quantity, to_outlet_id, 'Warehouse Transfer', notes]
        );
      }

      await conn.query('UPDATE stock_transfers SET status = "received", received_at = NOW(), approved_by = ?, approved_at = NOW() WHERE id = ?',
        [req.user.id, transferId]);
    }

    await conn.commit();
    res.json({ success: true, message: `Transfer ${transferNumber} created`, id: transferId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// GET transfers list
router.get('/transfers/list', async (req, res) => {
  try {
    const { outlet_id, status } = req.query;
    let query = `
      SELECT st.*, fo.name as from_name, too.name as to_name, u.name as created_by_name,
        (SELECT SUM(quantity) FROM stock_transfer_items WHERE transfer_id = st.id) as total_items
      FROM stock_transfers st
      LEFT JOIN outlets fo ON fo.id = st.from_outlet_id
      LEFT JOIN outlets too ON too.id = st.to_outlet_id
      LEFT JOIN users u ON u.id = st.created_by
      WHERE 1=1
    `;
    const params = [];
    if (outlet_id) { query += ' AND (st.from_outlet_id = ? OR st.to_outlet_id = ?)'; params.push(outlet_id, outlet_id); }
    if (status) { query += ' AND st.status = ?'; params.push(status); }
    query += ' ORDER BY st.created_at DESC LIMIT 100';
    const [transfers] = await pool.query(query, params);
    res.json({ success: true, data: transfers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════
// PENDING ACTIONS (Delete requests from outlet users)
// ══════════════════════════════════════════════════════════

// POST create pending action (outlet user requests delete)
router.post('/pending', async (req, res) => {
  try {
    const { action_type, entity_type, entity_id, reason } = req.body;
    const outletId = req.outletId || null;
    if (!outletId) return res.status(400).json({ success: false, message: 'Only outlet users can create pending actions' });

    // Snapshot entity data
    let entityData = null;
    try {
      if (entity_type === 'sale') {
        const [rows] = await pool.query('SELECT * FROM sales WHERE id = ?', [entity_id]);
        entityData = JSON.stringify(rows[0] || {});
      } else if (entity_type === 'transaction') {
        const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [entity_id]);
        entityData = JSON.stringify(rows[0] || {});
      }
    } catch { }

    await pool.query(
      'INSERT INTO pending_actions (outlet_id, requested_by, action_type, entity_type, entity_id, reason, entity_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [outletId, req.user.id, action_type, entity_type, entity_id, reason, entityData]
    );
    res.json({ success: true, message: 'Delete request submitted to admin' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all pending actions (admin)
router.get('/pending/list', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT pa.*, u.name as requested_by_name, o.name as outlet_name, o.code as outlet_code
      FROM pending_actions pa
      LEFT JOIN users u ON u.id = pa.requested_by
      LEFT JOIN outlets o ON o.id = pa.outlet_id
      WHERE pa.status = 'pending'
      ORDER BY pa.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT approve/reject pending action
router.put('/pending/:id', requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { action, review_note } = req.body; // action = 'approve' or 'reject'

    const [pa] = await conn.query('SELECT * FROM pending_actions WHERE id = ? AND status = "pending"', [req.params.id]);
    if (!pa.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found or already processed' }); }

    const pending = pa[0];

    if (action === 'approve') {
      // Execute the actual action
      if (pending.action_type === 'delete_sale') {
        await conn.query("UPDATE sales SET status = 'deleted', deleted_at = NOW(), deleted_by = ? WHERE id = ?", [req.user.id, pending.entity_id]);
        // Restore stock
        const [items] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ? AND status = "active"', [pending.entity_id]);
        for (const item of items) {
          await conn.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining + ? WHERE id = ?', [item.quantity, item.batch_id]);
        }
      } else if (pending.action_type === 'delete_transaction') {
        await conn.query('DELETE FROM transactions WHERE id = ?', [pending.entity_id]);

      } else if (pending.action_type === 'update_stock') {
        // ── STOCK REQUEST APPROVAL: Add stock to outlet ──
        try {
          const stockData = JSON.parse(pending.entity_data);
          const { product_id, quantity, purchase_price, sale_price, supplier_name, batch_number, notes, outlet_id } = stockData;

          // Create stock batch in the outlet
          const [batchResult] = await conn.query(`
            INSERT INTO stock_batches (product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining, supplier_name, notes, outlet_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [product_id, batch_number || `BATCH-${Date.now()}`, purchase_price, sale_price || null, quantity, quantity, supplier_name || 'Approved Stock Request', notes, outlet_id]);

          const batchId = batchResult.insertId;

          // Stock movement
          await conn.query(`
            INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, reference_id, reference_type, notes, created_by)
            VALUES (?, ?, 'in', ?, ?, 'stock_request_approved', ?, ?)
          `, [product_id, batchId, quantity, batchId, `Stock request approved by admin. ${notes || ''}`, req.user.id]);

          // Auto-generate serial numbers if needed
          const [productInfo] = await conn.query('SELECT has_serial_number FROM products WHERE id = ?', [product_id]);
          if (productInfo.length > 0 && productInfo[0].has_serial_number === 1) {
            const batchNum = batch_number || `BATCH-${batchId}`;
            for (let i = 1; i <= quantity; i++) {
              const serialNumber = `SN-${batchNum}-${String(i).padStart(3, '0')}`;
              await conn.query(
                "INSERT INTO serial_numbers (product_id, batch_id, serial_number, status, created_at) VALUES (?, ?, ?, 'in_stock', NOW())",
                [product_id, batchId, serialNumber]
              );
            }
          }

          // Update related stock_transfer to received
          await conn.query(
            "UPDATE stock_transfers SET status = 'received', approved_by = ?, approved_at = NOW(), received_at = NOW() WHERE to_outlet_id = ? AND status = 'pending' AND created_by = ?",
            [req.user.id, outlet_id, pending.requested_by]
          );
        } catch (stockErr) {
          console.error('Stock request approval error:', stockErr.message);
          throw stockErr;
        }
      }
    }

    await conn.query(
      "UPDATE pending_actions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_note = ? WHERE id = ?",
      [action === 'approve' ? 'approved' : 'rejected', req.user.id, review_note, req.params.id]
    );

    await conn.commit();
    res.json({ success: true, message: `Request ${action}d` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// WAREHOUSE DASHBOARD (Admin overview)
// ══════════════════════════════════════════════════════════

router.get('/dashboard/summary', async (req, res) => {
  try {
    // All outlets summary
    const [outlets] = await pool.query("SELECT COUNT(*) as total FROM outlets WHERE status = 'active'");
    const [todaySales] = await pool.query("SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE DATE(created_at) = CURDATE() AND status = 'active'");
    const [pendingCount] = await pool.query("SELECT COUNT(*) as total FROM pending_actions WHERE status = 'pending'");
    const [pendingTransfers] = await pool.query("SELECT COUNT(*) as total FROM stock_transfers WHERE status = 'pending'");
    const [totalStock] = await pool.query("SELECT COALESCE(SUM(quantity_remaining),0) as units FROM stock_batches WHERE quantity_remaining > 0");

    res.json({
      success: true,
      data: {
        total_outlets: outlets[0].total,
        today_total_sales: parseFloat(todaySales[0].total),
        pending_actions: pendingCount[0].total,
        pending_transfers: pendingTransfers[0].total,
        total_stock_units: parseInt(totalStock[0].units),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
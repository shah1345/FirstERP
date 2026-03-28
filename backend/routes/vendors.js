const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// ─── GET /api/vendors — list all vendors ─────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    let query = `SELECT v.*, 
      (SELECT COUNT(*) FROM stock_batches sb WHERE sb.vendor_id = v.id) as total_purchases,
      (SELECT COALESCE(SUM(sb.purchase_total), 0) FROM stock_batches sb WHERE sb.vendor_id = v.id) as calc_total_purchase,
      (SELECT COALESCE(SUM(vp.amount), 0) FROM vendor_payments vp WHERE vp.vendor_id = v.id) + 
      (SELECT COALESCE(SUM(sb2.purchase_paid), 0) FROM stock_batches sb2 WHERE sb2.vendor_id = v.id) as calc_total_paid
      FROM vendors v WHERE 1=1`;

    const params = [];

    if (tenantId) {
      query += ' AND v.tenant_id = ?';
      params.push(tenantId);
    }

    if (req.query.status) {
      query += ' AND v.status = ?';
      params.push(req.query.status);
    }

    if (req.query.search) {
      const s = `%${req.query.search}%`;
      query += ' AND (v.name LIKE ? OR v.phone LIKE ? OR v.company LIKE ?)';
      params.push(s, s, s);
    }

    query += ' ORDER BY v.name ASC';

    const [vendors] = await pool.query(query, params);

    const result = vendors.map(v => {
      const totalPurchase = parseFloat(v.calc_total_purchase) || 0;
      const totalPaid = parseFloat(v.calc_total_paid) || 0;

      return {
        ...v,
        total_purchase: totalPurchase,
        total_paid: totalPaid,
        total_due: Math.max(0, totalPurchase - totalPaid),
      };
    });

    res.json({ success: true, data: result });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/vendors/accounts/list — FIXED ───────────────────
router.get('/accounts/list', async (req, res) => {
  try {
    const [accounts] = await pool.query(
      "SELECT id, account_name, account_type, current_balance, icon FROM bank_accounts ORDER BY account_type, account_name ASC"
    );

    res.json({ success: true, data: accounts });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/vendors/list/dropdown ───────────────────────────
router.get('/list/dropdown', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    let query = 'SELECT id, name, phone, company FROM vendors WHERE status = "active"';
    const params = [];

    if (tenantId) {
      query += ' AND tenant_id = ?';
      params.push(tenantId);
    }

    query += ' ORDER BY name ASC';

    const [vendors] = await pool.query(query, params);

    res.json({ success: true, data: vendors });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/vendors/:id — vendor detail + history ──────────
router.get('/:id', async (req, res) => {
  try {
    const [vendors] = await pool.query(
      'SELECT * FROM vendors WHERE id = ?',
      [req.params.id]
    );

    if (!vendors.length) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    const vendor = vendors[0];

    const [purchases] = await pool.query(`
      SELECT sb.id, sb.batch_number, sb.product_id, p.product_name, 
             sb.quantity_added, sb.purchase_price, sb.purchase_total, 
             sb.purchase_paid, sb.purchase_due, sb.created_at
      FROM stock_batches sb
      JOIN products p ON p.id = sb.product_id
      WHERE sb.vendor_id = ?
      ORDER BY sb.created_at DESC
    `, [vendor.id]);

    const [payments] = await pool.query(`
      SELECT vp.*, u.name as paid_by_name
      FROM vendor_payments vp
      LEFT JOIN users u ON u.id = vp.paid_by
      WHERE vp.vendor_id = ?
      ORDER BY vp.created_at DESC
    `, [vendor.id]);

    const totalPurchase = purchases.reduce((sum, p) => sum + parseFloat(p.purchase_total || 0), 0);
    const totalPaidAtPurchase = purchases.reduce((sum, p) => sum + parseFloat(p.purchase_paid || 0), 0);
    const totalPaidViaPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const totalPaid = totalPaidAtPurchase + totalPaidViaPayments;

    res.json({
      success: true,
      data: {
        vendor: {
          ...vendor,
          total_purchase: totalPurchase,
          total_paid: totalPaid,
          total_due: Math.max(0, totalPurchase - totalPaid),
        },
        purchases,
        payments,
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/vendors/:id/payments — FIXED + SAFE ───────────
router.post('/:id/payments', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const vendorId = req.params.id;
    const { amount, payment_method, reference_number, notes, bank_account_id } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be > 0' });
    }

    const [vendorInfo] = await conn.query(
      'SELECT name FROM vendors WHERE id = ?',
      [vendorId]
    );

    const vendorName = vendorInfo.length ? vendorInfo[0].name : 'Vendor';

    const [countResult] = await conn.query(
      'SELECT COUNT(*) as c FROM vendor_payments WHERE vendor_id = ?',
      [vendorId]
    );

    const receiptNum = `VP-${vendorId}-${String(countResult[0].c + 1).padStart(4, '0')}`;
    const tenantId = req.user.tenant_id;

    await conn.query(
      `INSERT INTO vendor_payments 
      (vendor_id, amount, payment_method, reference_number, receipt_number, notes, paid_by, bank_account_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, amount, payment_method || 'cash', reference_number || null, receiptNum, notes || null, req.user.id, bank_account_id || null, tenantId]
    );

    // ✅ Balance check
    if (bank_account_id) {
      const [acc] = await conn.query(
        'SELECT current_balance, account_name FROM bank_accounts WHERE id = ?',
        [bank_account_id]
      );

      if (acc.length && parseFloat(acc[0].current_balance) < amount) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in ${acc[0].account_name}`
        });
      }

      await conn.query(
        'UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?',
        [amount, bank_account_id]
      );
    }

    await conn.commit();

    res.json({ success: true, message: 'Payment recorded', receipt_number: receiptNum });

  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
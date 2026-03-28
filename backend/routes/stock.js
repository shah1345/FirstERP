const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ── GET /stock/summary ─────────────────────────────────────
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const t = req.tenantWhere('p');
    const [result] = await pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(sb.quantity_remaining), 0) as total_units,
        COALESCE(SUM(sb.quantity_remaining * sb.purchase_price), 0) as total_stock_value
      FROM products p
      LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.quantity_remaining > 0
      WHERE p.is_active = 1 ${t.sql}
    `, [...t.params]);

    const t2 = req.tenantWhere('p');
    const [oos] = await pool.query(`
      SELECT COUNT(*) as cnt FROM (
        SELECT p.id, COALESCE(SUM(sb.quantity_remaining), 0) as stock
        FROM products p
        LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.quantity_remaining > 0
        WHERE p.is_active = 1 ${t2.sql}
        GROUP BY p.id
        HAVING stock = 0
      ) as oos_products
    `, [...t2.params]);

    res.json({
      success: true, data: {
        total_products: result[0].total_products || 0,
        total_units: String(result[0].total_units || 0),
        total_stock_value: String(parseFloat(result[0].total_stock_value || 0).toFixed(2)),
        out_of_stock: oos[0].cnt || 0,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /stock/low-stock ───────────────────────────────────
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const t = req.tenantWhere('p');
    const [products] = await pool.query(`
      SELECT p.id, p.product_name, p.brand, p.model,
        COALESCE(SUM(sb.quantity_remaining), 0) as total_stock
      FROM products p
      LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.quantity_remaining > 0
      WHERE p.is_active = 1 ${t.sql}
      GROUP BY p.id
      HAVING total_stock <= ?
      ORDER BY total_stock ASC
    `, [...t.params, threshold]);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /stock/batches/:productId ──────────────────────────
router.get('/batches/:productId', authenticateToken, async (req, res) => {
  try {
    const t = req.tenantWhere('sb');
    const [batches] = await pool.query(`
      SELECT sb.*, 
        (SELECT COUNT(*) FROM serial_numbers sn WHERE sn.batch_id = sb.id AND sn.status = 'in_stock') as available_serials
      FROM stock_batches sb
      WHERE sb.product_id = ? ${t.sql}
      ORDER BY sb.created_at ASC
    `, [req.params.productId, ...t.params]);
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /stock/movements ───────────────────────────────────
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const { product_id, limit } = req.query;
    const t = req.tenantWhere('p');
    let query = `
      SELECT sm.*, p.product_name, sb.batch_number, u.name as created_by_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN stock_batches sb ON sb.id = sm.batch_id
      LEFT JOIN users u ON u.id = sm.created_by
      WHERE 1=1 ${t.sql}
    `;
    const params = [...t.params];

    if (product_id) {
      query += ' AND sm.product_id = ?';
      params.push(product_id);
    }

    query += ' ORDER BY sm.created_at DESC LIMIT ?';
    params.push(parseInt(limit) || 100);

    const [movements] = await pool.query(query, params);
    res.json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /stock/in ─────────────────────────────────────────
router.post('/in', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, quantity, purchase_price, sale_price, supplier_name, batch_number, notes, vendor_id, paid_amount, paid_bank_account_id } = req.body;
    const tenantId = req.getTenantId();

    if (!product_id || !quantity || !purchase_price) {
      return res.status(400).json({ success: false, message: 'product_id, quantity, purchase_price required' });
    }

    const purchaseTotal = parseFloat(purchase_price) * parseInt(quantity);
    const purchasePaid = parseFloat(paid_amount) || 0;
    const purchaseDue = Math.max(0, purchaseTotal - purchasePaid);

    const [prodInfo] = await conn.query('SELECT product_name FROM products WHERE id = ?', [product_id]);
    const productName = prodInfo.length ? prodInfo[0].product_name : 'Product';

    let vendorName = supplier_name || 'Supplier';
    if (vendor_id) {
      const [vInfo] = await conn.query('SELECT name FROM vendors WHERE id = ?', [vendor_id]);
      if (vInfo.length) vendorName = vInfo[0].name;
    }

    // ── INSERT with tenant_id ──
    const [batchResult] = await conn.query(`
      INSERT INTO stock_batches (product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining, supplier_name, notes, vendor_id, purchase_total, purchase_paid, purchase_due, paid_bank_account_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [product_id, batch_number || `BATCH-${Date.now()}`, purchase_price, sale_price || null, quantity, quantity, supplier_name, notes, vendor_id || null, purchaseTotal, purchasePaid, purchaseDue, paid_bank_account_id || null, tenantId]);

    const batchId = batchResult.insertId;

    await conn.query(`
      INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, reference_id, reference_type, notes, created_by, tenant_id)
      VALUES (?, ?, 'in', ?, ?, 'stock_in', ?, ?, ?)
    `, [product_id, batchId, quantity, batchId, notes, req.user.id, tenantId]);

    const [productInfo] = await conn.query('SELECT has_serial_number FROM products WHERE id = ?', [product_id]);
    if (productInfo.length > 0 && productInfo[0].has_serial_number === 1) {
      const batchNum = batch_number || `BATCH-${batchId}`;
      for (let i = 1; i <= quantity; i++) {
        const serialNumber = `SN-${batchNum}-${String(i).padStart(3, '0')}`;
        await conn.query(`
          INSERT INTO serial_numbers (product_id, batch_id, serial_number, status, created_at, tenant_id)
          VALUES (?, ?, ?, 'in_stock', NOW(), ?)
        `, [product_id, batchId, serialNumber, tenantId]);
      }
    }

    if (purchasePaid > 0 && paid_bank_account_id) {
      const [accCheck] = await conn.query('SELECT current_balance, account_name FROM bank_accounts WHERE id = ?', [paid_bank_account_id]);
      if (accCheck.length && parseFloat(accCheck[0].current_balance) < purchasePaid) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient balance in "${accCheck[0].account_name}". Available: ৳${Number(accCheck[0].current_balance).toLocaleString()}, Required: ৳${purchasePaid.toLocaleString()}`
        });
      }

      await conn.query('UPDATE bank_accounts SET current_balance = current_balance - ? WHERE id = ?', [purchasePaid, paid_bank_account_id]);

      try {
        await conn.query(
          `INSERT INTO transactions (type, category, amount, bank_account_id, payment_method, description, party_name, transaction_date, outlet_id, is_auto, created_by, tenant_id)
           VALUES ('expense', 'Stock Purchase', ?, ?, 'cash', ?, ?, CURDATE(), NULL, 1, ?, ?)`,
          [purchasePaid, paid_bank_account_id, `Stock purchase: ${productName} (${quantity} pcs × ৳${purchase_price}) from ${vendorName}`, vendorName, req.user.id, tenantId]
        );
      } catch (e) { console.log('Transaction record skipped:', e.message); }
    }

    if (vendor_id) {
      await conn.query(`
        UPDATE vendors SET 
          total_purchase = (SELECT COALESCE(SUM(purchase_total), 0) FROM stock_batches WHERE vendor_id = ?),
          total_paid = (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments WHERE vendor_id = ?) + 
                       (SELECT COALESCE(SUM(purchase_paid), 0) FROM stock_batches WHERE vendor_id = ?),
          total_due = GREATEST(0, 
            (SELECT COALESCE(SUM(purchase_total), 0) FROM stock_batches WHERE vendor_id = ?) - 
            (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments WHERE vendor_id = ?) -
            (SELECT COALESCE(SUM(purchase_paid), 0) FROM stock_batches WHERE vendor_id = ?)
          )
        WHERE id = ?
      `, [vendor_id, vendor_id, vendor_id, vendor_id, vendor_id, vendor_id, vendor_id]);
    }

    await conn.commit();
    res.json({ success: true, message: 'Stock added', batch_id: batchId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ── POST /stock/adjust ─────────────────────────────────────
router.post('/adjust', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, batch_id, adjustment_type, quantity, reason } = req.body;

    if (!product_id || !batch_id || !adjustment_type || !quantity) {
      return res.status(400).json({ success: false, message: 'product_id, batch_id, adjustment_type, quantity required' });
    }

    const [batches] = await conn.query('SELECT * FROM stock_batches WHERE id = ?', [batch_id]);
    if (!batches.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const batch = batches[0];
    let newQty;

    if (adjustment_type === 'add') {
      newQty = batch.quantity_remaining + parseInt(quantity);
    } else if (adjustment_type === 'remove') {
      if (parseInt(quantity) > batch.quantity_remaining) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Cannot remove ${quantity}. Only ${batch.quantity_remaining} available.` });
      }
      newQty = batch.quantity_remaining - parseInt(quantity);
    } else if (adjustment_type === 'set') {
      newQty = parseInt(quantity);
    } else {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'adjustment_type must be: add, remove, or set' });
    }

    await conn.query('UPDATE stock_batches SET quantity_remaining = ? WHERE id = ?', [newQty, batch_id]);

    const movementQty = adjustment_type === 'set'
      ? newQty - batch.quantity_remaining
      : (adjustment_type === 'add' ? parseInt(quantity) : -parseInt(quantity));

    await conn.query(`
      INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, reference_type, notes, created_by, tenant_id)
      VALUES (?, ?, 'adjustment', ?, 'stock_adjust', ?, ?, ?)
    `, [product_id, batch_id, Math.abs(movementQty),
      `${adjustment_type}: ${batch.quantity_remaining} → ${newQty}. Reason: ${reason || 'N/A'}`,
      req.user.id, req.getTenantId()]);

    try {
      await conn.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, reason, tenant_id)
        VALUES (?, 'stock_adjust', 'stock_batch', ?, ?, ?, ?, ?)
      `, [req.user.id, batch_id,
      JSON.stringify({ quantity_remaining: batch.quantity_remaining }),
      JSON.stringify({ quantity_remaining: newQty }),
      reason || 'Stock adjustment', req.getTenantId()]);
    } catch (e) { /* audit_logs might not have tenant_id */ }

    await conn.commit();
    res.json({
      success: true,
      message: `Stock adjusted: ${batch.quantity_remaining} → ${newQty}`,
      old_quantity: batch.quantity_remaining,
      new_quantity: newQty
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ── GET /stock/history/:productId ──────────────────────────
router.get('/history/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = req.params.productId;
    const t = req.tenantWhere();

    const [products] = await pool.query(`SELECT * FROM products WHERE id = ? ${t.sql}`, [productId, ...t.params]);
    if (!products.length) return res.status(404).json({ success: false, message: 'Product not found' });

    const [stockIns] = await pool.query(`
      SELECT sb.id, sb.batch_number, sb.purchase_price, sb.sale_price, 
             sb.quantity_added, sb.quantity_remaining, sb.supplier_name, sb.created_at, 'stock_in' as type
      FROM stock_batches sb WHERE sb.product_id = ? ${req.tenantWhere('sb').sql}
      ORDER BY sb.created_at DESC
    `, [productId, ...req.tenantWhere('sb').params]);

    const [sales] = await pool.query(`
      SELECT si.id, si.quantity, si.unit_price, si.purchase_price, si.total_price, si.profit,
             s.invoice_number, s.customer_name, s.created_at, s.status as sale_status, sb.batch_number, 'sale' as type
      FROM sale_items si JOIN sales s ON s.id = si.sale_id LEFT JOIN stock_batches sb ON sb.id = si.batch_id
      WHERE si.product_id = ? AND s.status != 'deleted' ${req.tenantWhere('s').sql}
      ORDER BY s.created_at DESC
    `, [productId, ...req.tenantWhere('s').params]);

    const [returns] = await pool.query(`
      SELECT ri.id, ri.quantity, ri.return_price, ri.purchase_price, ri.reason,
             r.return_number, r.created_at, r.status as return_status, sb.batch_number, 'return' as type
      FROM return_items ri JOIN \`returns\` r ON r.id = ri.return_id LEFT JOIN stock_batches sb ON sb.id = ri.batch_id
      WHERE ri.product_id = ? ${req.tenantWhere('r').sql}
      ORDER BY r.created_at DESC
    `, [productId, ...req.tenantWhere('r').params]);

    const [replacementsOut] = await pool.query(`
      SELECT rp.id, rp.replacement_quantity as quantity, rp.reason, rp.replacement_number, rp.created_at, rp.status as repl_status,
             sb.batch_number, 'replaced_out' as type
      FROM replacements rp LEFT JOIN stock_batches sb ON sb.id = rp.returned_batch_id
      WHERE rp.returned_product_id = ? ${req.tenantWhere('rp').sql}
      ORDER BY rp.created_at DESC
    `, [productId, ...req.tenantWhere('rp').params]);

    const [replacementsIn] = await pool.query(`
      SELECT rp.id, rp.replacement_quantity as quantity, rp.reason, rp.replacement_number, rp.created_at, rp.status as repl_status,
             sb.batch_number, 'replaced_in' as type
      FROM replacements rp LEFT JOIN stock_batches sb ON sb.id = rp.replacement_batch_id
      WHERE rp.replacement_product_id = ? ${req.tenantWhere('rp').sql}
      ORDER BY rp.created_at DESC
    `, [productId, ...req.tenantWhere('rp').params]);

    const [adjustments] = await pool.query(`
      SELECT sm.id, sm.quantity, sm.notes, sm.created_at, u.name as adjusted_by, sb.batch_number, 'adjustment' as type
      FROM stock_movements sm LEFT JOIN stock_batches sb ON sb.id = sm.batch_id LEFT JOIN users u ON u.id = sm.created_by
      WHERE sm.product_id = ? AND sm.movement_type = 'adjustment' ${req.tenantWhere('sm').sql}
      ORDER BY sm.created_at DESC
    `, [productId, ...req.tenantWhere('sm').params]);

    const allHistory = [
      ...stockIns.map(s => ({ ...s, date: s.created_at })),
      ...sales.map(s => ({ ...s, date: s.created_at })),
      ...returns.map(r => ({ ...r, date: r.created_at })),
      ...replacementsOut.map(r => ({ ...r, date: r.created_at })),
      ...replacementsIn.map(r => ({ ...r, date: r.created_at })),
      ...adjustments.map(a => ({ ...a, date: a.created_at }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        product: products[0],
        history: allHistory,
        summary: {
          total_stock_in: stockIns.reduce((sum, s) => sum + s.quantity_added, 0),
          total_sold: sales.filter(s => s.sale_status === 'active').reduce((sum, s) => sum + s.quantity, 0),
          total_returned: returns.reduce((sum, r) => sum + r.quantity, 0),
          total_replaced: replacementsOut.reduce((sum, r) => sum + r.quantity, 0),
          total_adjustments: adjustments.length,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
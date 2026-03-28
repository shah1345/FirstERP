const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Generate replacement number
function generateReplacementNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `REP-${y}${m}${d}-${rand}`;
}

// FIFO deduction for replacement
async function deductFIFO(conn, productId, quantity) {
  const [batches] = await conn.query(`
    SELECT sb.*, p.sale_price as product_default_sale_price 
    FROM stock_batches sb 
    JOIN products p ON p.id = sb.product_id
    WHERE sb.product_id = ? AND sb.quantity_remaining > 0 
    ORDER BY sb.created_at ASC
  `, [productId]);
  
  let remaining = quantity;
  const deductions = [];
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.quantity_remaining, remaining);
    
    await conn.query(
      'UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?',
      [deduct, batch.id]
    );
    
    deductions.push({
      batch_id:       batch.id,
      batch_number:   batch.batch_number,
      deducted:       deduct,
      purchase_price: batch.purchase_price,
      sale_price:     batch.sale_price || batch.product_default_sale_price
    });
    
    remaining -= deduct;
  }
  
  if (remaining > 0) throw new Error(`Insufficient stock. Short by ${remaining} units.`);
  return deductions;
}

// POST create replacement
router.post('/create', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { 
      returned_serial, 
      replacement_product_id, 
      replacement_serial,
      reason,
      price_adjustment 
    } = req.body;

    if (!returned_serial) {
      return res.status(400).json({ success: false, message: 'Returned serial number required' });
    }

    // Get returned item details
    const [returnedSerial] = await conn.query(`
      SELECT sn.*, p.product_name, p.warranty_months,
             si.sale_id, si.id as sale_item_id, si.batch_id as original_batch_id,
             si.unit_price, si.purchase_price, si.profit
      FROM serial_numbers sn
      JOIN products p ON p.id = sn.product_id
      LEFT JOIN sale_items si ON si.id = sn.sale_item_id
      WHERE sn.serial_number = ?
    `, [returned_serial]);

    if (!returnedSerial.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Returned serial not found' });
    }

    const returned = returnedSerial[0];

    if (returned.status !== 'sold') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Only sold items can be replaced' });
    }

    // Check warranty
    if (returned.warranty_end_date && new Date(returned.warranty_end_date) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Warranty expired' });
    }

    // Determine replacement product (same model or manual selection)
    const replacementProductId = replacement_product_id || returned.product_id;

    // Get replacement product details
    const [replacementProduct] = await conn.query(
      'SELECT * FROM products WHERE id = ?',
      [replacementProductId]
    );

    if (!replacementProduct.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Replacement product not found' });
    }

    // Check if replacement available in stock
    const [stockCheck] = await conn.query(`
      SELECT SUM(quantity_remaining) as available
      FROM stock_batches
      WHERE product_id = ?
    `, [replacementProductId]);

    if (!stockCheck[0].available || stockCheck[0].available < 1) {
      await conn.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `Replacement product ${replacementProduct[0].product_name} out of stock` 
      });
    }

    const replacement_number = generateReplacementNumber();

    // Step 1: Return old item to original batch (FIFO reversal)
    await conn.query(`
      UPDATE stock_batches
      SET quantity_remaining = quantity_remaining + 1,
          quantity_returned = quantity_returned + 1
      WHERE id = ?
    `, [returned.original_batch_id]);

    // Create stock movement for return
    await conn.query(`
      INSERT INTO stock_movements 
      (product_id, batch_id, movement_type, quantity, reference_type, created_by)
      VALUES (?, ?, 'return', 1, 'replacement', ?)
    `, [returned.product_id, returned.original_batch_id, req.user.id]);

    // Update returned serial status
    await conn.query(`
      UPDATE serial_numbers
      SET status = 'replaced'
      WHERE serial_number = ?
    `, [returned_serial]);

    // Step 2: Deduct replacement item using FIFO
    const replacementBatches = await deductFIFO(conn, replacementProductId, 1);
    const replacementBatch = replacementBatches[0];

    // Create stock movement for replacement
    await conn.query(`
      INSERT INTO stock_movements 
      (product_id, batch_id, movement_type, quantity, reference_type, created_by)
      VALUES (?, ?, 'out', 1, 'replacement', ?)
    `, [replacementProductId, replacementBatch.batch_id, req.user.id]);

    // Get or create replacement serial number
    let replacementSerialId = null;
    if (replacement_serial) {
      const [serialCheck] = await conn.query(
        'SELECT id FROM serial_numbers WHERE serial_number = ?',
        [replacement_serial]
      );
      
      if (serialCheck.length) {
        replacementSerialId = serialCheck[0].id;
        
        // Update serial
        const warrantyStartDate = new Date();
        const warrantyEndDate = new Date();
        warrantyEndDate.setMonth(warrantyEndDate.getMonth() + replacementProduct[0].warranty_months);
        
        await conn.query(`
          UPDATE serial_numbers
          SET status = 'sold',
              sale_id = ?,
              sale_item_id = ?,
              batch_id = ?,
              warranty_start_date = ?,
              warranty_end_date = ?
          WHERE id = ?
        `, [returned.sale_id, returned.sale_item_id, replacementBatch.batch_id, 
            warrantyStartDate, warrantyEndDate, replacementSerialId]);
      }
    }

    // Step 3: Create replacement record
    const warrantyResetDate = new Date();
    const [replacementResult] = await conn.query(`
      INSERT INTO replacements (
        replacement_number, sale_id, customer_id,
        returned_sale_item_id, returned_product_id, returned_batch_id, 
        returned_serial_id, replacement_product_id, replacement_batch_id,
        replacement_serial_id, replacement_quantity, price_adjustment,
        reason, warranty_reset_date, processed_by, status
      ) VALUES (?, ?, 
                (SELECT customer_id FROM sales WHERE id = ?),
                ?, ?, ?, 
                (SELECT id FROM serial_numbers WHERE serial_number = ?),
                ?, ?, ?, 1, ?, ?, ?, ?, 'completed')
    `, [
      replacement_number, returned.sale_id, returned.sale_id,
      returned.sale_item_id, returned.product_id, returned.original_batch_id,
      returned_serial, replacementProductId, replacementBatch.batch_id,
      replacementSerialId, price_adjustment || 0,
      reason, warrantyResetDate, req.user.id
    ]);

    const replacement_id = replacementResult.insertId;

    // Step 4: Update sale_item with new batch and recalculate profit
    const newProfit = parseFloat(returned.unit_price) - parseFloat(replacementBatch.purchase_price);
    
    await conn.query(`
      UPDATE sale_items
      SET batch_id = ?,
          purchase_price = ?,
          profit = ?,
          status = 'replaced',
          replacement_id = ?
      WHERE id = ?
    `, [replacementBatch.batch_id, replacementBatch.purchase_price, newProfit, replacement_id, returned.sale_item_id]);

    // Step 5: Recalculate sale total profit
    const [saleProfitUpdate] = await conn.query(`
      SELECT COALESCE(SUM(profit), 0) as new_total_profit,
             COALESCE(SUM(purchase_price * quantity), 0) as new_total_cost
      FROM sale_items
      WHERE sale_id = ?
    `, [returned.sale_id]);

    await conn.query(`
      UPDATE sales
      SET total_profit = ?,
          total_purchase_cost = ?
      WHERE id = ?
    `, [saleProfitUpdate[0].new_total_profit, saleProfitUpdate[0].new_total_cost, returned.sale_id]);

    // Log audit
    await conn.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data, reason)
      VALUES (?, 'replace_product', 'replacement', ?, ?, ?)
    `, [req.user.id, replacement_id, JSON.stringify({
      replacement_number,
      returned_serial,
      replacement_product: replacementProduct[0].product_name,
      replacement_serial
    }), reason]);

    await conn.commit();
    res.json({ 
      success: true, 
      message: 'Replacement processed successfully',
      replacement_id,
      replacement_number,
      warranty_reset_date: warrantyResetDate
    });
  } catch (error) {
    await conn.rollback();
    console.error('Replacement error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// GET all replacements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT r.*, s.invoice_number, c.customer_name,
             p1.product_name as returned_product,
             p2.product_name as replacement_product,
             u.name as processed_by_name
      FROM replacements r
      JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = r.customer_id
      JOIN products p1 ON p1.id = r.returned_product_id
      JOIN products p2 ON p2.id = r.replacement_product_id
      LEFT JOIN users u ON u.id = r.processed_by
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ' AND DATE(r.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(r.created_at) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY r.created_at DESC LIMIT 100';

    const [replacements] = await pool.query(query, params);
    res.json({ success: true, data: replacements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single replacement details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [replacements] = await pool.query(`
      SELECT r.*, s.invoice_number, c.customer_name,
             p1.product_name as returned_product, p1.brand as returned_brand,
             p2.product_name as replacement_product, p2.brand as replacement_brand,
             sn1.serial_number as returned_serial,
             sn2.serial_number as replacement_serial,
             sb1.batch_number as returned_batch,
             sb2.batch_number as replacement_batch
      FROM replacements r
      JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = r.customer_id
      JOIN products p1 ON p1.id = r.returned_product_id
      JOIN products p2 ON p2.id = r.replacement_product_id
      LEFT JOIN serial_numbers sn1 ON sn1.id = r.returned_serial_id
      LEFT JOIN serial_numbers sn2 ON sn2.id = r.replacement_serial_id
      LEFT JOIN stock_batches sb1 ON sb1.id = r.returned_batch_id
      LEFT JOIN stock_batches sb2 ON sb2.id = r.replacement_batch_id
      WHERE r.id = ?
    `, [req.params.id]);

    if (!replacements.length) {
      return res.status(404).json({ success: false, message: 'Replacement not found' });
    }

    res.json({ success: true, data: replacements[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

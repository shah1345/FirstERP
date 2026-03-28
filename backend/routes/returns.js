const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Search product by serial number
router.get('/search', authenticateToken, async(req, res) => {
    try {
        const { serial } = req.query;

        if (!serial) {
            return res.status(400).json({ success: false, message: 'Serial number required' });
        }

        const [serials] = await pool.query(`
      SELECT sn.*, p.product_name, p.brand, p.model, p.warranty_months,
             sb.batch_number, sb.purchase_price,
             si.unit_price as sale_price, si.sale_id,
             s.invoice_number, s.created_at as sale_date, s.customer_name
      FROM serial_numbers sn
      JOIN products p ON p.id = sn.product_id
      JOIN stock_batches sb ON sb.id = sn.batch_id
      LEFT JOIN sale_items si ON si.id = sn.sale_item_id
      LEFT JOIN sales s ON s.id = sn.sale_id
      WHERE sn.serial_number = ?
    `, [serial]);

        if (!serials.length) {
            return res.status(404).json({ success: false, message: 'Serial number not found' });
        }

        const item = serials[0];

        // Calculate warranty
        let warranty = null;
        if (item.warranty_start_date) {
            const warrantyEnd = new Date(item.warranty_start_date);
            warrantyEnd.setMonth(warrantyEnd.getMonth() + item.warranty_months);

            const daysRemaining = Math.ceil((warrantyEnd - new Date()) / (1000 * 60 * 60 * 24));

            warranty = {
                start_date: item.warranty_start_date,
                end_date: warrantyEnd,
                months: item.warranty_months,
                status: daysRemaining > 0 ? 'valid' : 'expired',
                days_remaining: Math.max(0, daysRemaining)
            };
        }

        res.json({
            success: true,
            data: {
                serial_number: item.serial_number,
                status: item.status,
                product: {
                    id: item.product_id,
                    name: item.product_name,
                    brand: item.brand,
                    model: item.model
                },
                sale: item.sale_id ? {
                    id: item.sale_id,
                    invoice_number: item.invoice_number,
                    sale_date: item.sale_date,
                    sale_price: item.sale_price,
                    customer_name: item.customer_name
                } : null,
                batch: {
                    id: item.batch_id,
                    batch_number: item.batch_number,
                    purchase_price: item.purchase_price
                },
                warranty,
                eligible_for_return: item.status === 'sold' && (!warranty || warranty.status === 'valid'),
                eligible_for_replacement: item.status === 'sold' && warranty && warranty.status === 'valid'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Generate return number
function generateReturnNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `RET-${y}${m}${d}-${rand}`;
}

// POST create return
router.post('/create', authenticateToken, async(req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { sale_id, items, refund_method, reason } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No items to return' });
        }

        // Get sale details
        const [sales] = await conn.query('SELECT * FROM sales WHERE id = ?', [sale_id]);
        if (!sales.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }
        const sale = sales[0];

        let total_return_amount = 0;
        const return_number = generateReturnNumber();

        // Create return record
        const [returnResult] = await conn.query(`
      INSERT INTO returns (return_number, sale_id, customer_id, return_type, 
                           total_return_amount, refund_amount, refund_method, reason, processed_by)
      VALUES (?, ?, ?, 'partial', 0, 0, ?, ?, ?)
    `, [return_number, sale_id, sale.customer_id, refund_method || 'cash', reason, req.user.id]);

        const return_id = returnResult.insertId;

        // Process each return item
        for (const item of items) {
            // Get sale item details
            const [saleItems] = await conn.query(`
        SELECT si.*, p.product_name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.id = ? AND si.sale_id = ?
      `, [item.sale_item_id, sale_id]);

            if (!saleItems.length) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: 'Sale item not found' });
            }

            const saleItem = saleItems[0];
            const return_qty = parseInt(item.quantity || 1);

            if (return_qty > saleItem.quantity) {
                await conn.rollback();
                return res.status(400).json({ success: false, message: 'Return quantity exceeds sold quantity' });
            }

            const return_amount = parseFloat(saleItem.unit_price) * return_qty;
            total_return_amount += return_amount;

            // Restore stock to ORIGINAL batch (FIFO reversal)
            await conn.query(`
        UPDATE stock_batches
        SET quantity_remaining = quantity_remaining + ?,
            quantity_returned = quantity_returned + ?
        WHERE id = ?
      `, [return_qty, return_qty, saleItem.batch_id]);

            // Create stock movement
            await conn.query(`
        INSERT INTO stock_movements 
        (product_id, batch_id, movement_type, quantity, reference_id, reference_type, created_by)
        VALUES (?, ?, 'return', ?, ?, 'return', ?)
      `, [saleItem.product_id, saleItem.batch_id, return_qty, return_id, req.user.id]);

            // Update serial number if applicable
            if (item.serial_number) {
                await conn.query(`
          UPDATE serial_numbers
          SET status = 'returned', sale_id = NULL, sale_item_id = NULL
          WHERE serial_number = ?
        `, [item.serial_number]);
            }

            // Create return item record
            await conn.query(`
        INSERT INTO return_items 
        (return_id, sale_item_id, product_id, batch_id, serial_number_id, 
         quantity, return_price, purchase_price, reason, condition_note)
        VALUES (?, ?, ?, ?, 
                (SELECT id FROM serial_numbers WHERE serial_number = ? LIMIT 1),
                ?, ?, ?, ?, ?)
      `, [return_id, item.sale_item_id, saleItem.product_id, saleItem.batch_id,
                item.serial_number, return_qty, saleItem.unit_price, saleItem.purchase_price,
                item.reason, item.condition_note
            ]);

            // Update sale item status
            const newStatus = return_qty >= saleItem.quantity ? 'returned' : 'active';
            await conn.query(`
        UPDATE sale_items
        SET status = ?, return_id = ?
        WHERE id = ?
      `, [newStatus, return_id, item.sale_item_id]);
        }

        // Update return total
        await conn.query(`
      UPDATE returns
      SET total_return_amount = ?, refund_amount = ?, status = 'completed'
      WHERE id = ?
    `, [total_return_amount, total_return_amount, return_id]);

        // Update sale
        const [remainingItems] = await conn.query(`
      SELECT COUNT(*) as count
      FROM sale_items
      WHERE sale_id = ? AND status = 'active'
    `, [sale_id]);

        const new_total = parseFloat(sale.total_amount) - total_return_amount;
        const new_profit = parseFloat(sale.total_profit) - total_return_amount + (items.reduce((sum, i) => {
            const si = items.find(x => x.sale_item_id === i.sale_item_id);
            return sum + (parseFloat((si && si.purchase_price) || 0) * parseInt(i.quantity || 1));
        }, 0));

        await conn.query(`
      UPDATE sales
      SET total_amount = ?,
          total_profit = ?,
          status = CASE 
            WHEN ? = 0 THEN 'returned'
            ELSE 'partial_return'
          END
      WHERE id = ?
    `, [new_total, new_profit, remainingItems[0].count, sale_id]);

        // Adjust customer balance if credit customer
        if (sale.customer_id && sale.payment_method === 'credit') {
            await conn.query(`
        UPDATE customers
        SET current_balance = current_balance - ?
        WHERE id = ?
      `, [total_return_amount, sale.customer_id]);
        }

        // Log audit
        await conn.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data, reason)
      VALUES (?, 'return_product', 'return', ?, ?, ?)
    `, [req.user.id, return_id, JSON.stringify({ return_number, items }), reason]);

        await conn.commit();
        res.json({
            success: true,
            message: 'Return processed successfully',
            return_id,
            return_number,
            refund_amount: total_return_amount
        });
    } catch (error) {
        await conn.rollback();
        console.error('Return error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        conn.release();
    }
});

// GET all returns
router.get('/', authenticateToken, async(req, res) => {
    try {
        const { start_date, end_date, customer_id } = req.query;

        let query = `
      SELECT r.*, s.invoice_number, c.customer_name, u.name as processed_by_name
      FROM returns r
      JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = r.customer_id
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
        if (customer_id) {
            query += ' AND r.customer_id = ?';
            params.push(customer_id);
        }

        query += ' ORDER BY r.created_at DESC LIMIT 100';

        const [returns] = await pool.query(query, params);
        res.json({ success: true, data: returns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single return with items
router.get('/:id', authenticateToken, async(req, res) => {
    try {
        const [returns] = await pool.query(`
      SELECT r.*, s.invoice_number, c.customer_name
      FROM returns r
      JOIN sales s ON s.id = r.sale_id
      LEFT JOIN customers c ON c.id = r.customer_id
      WHERE r.id = ?
    `, [req.params.id]);

        if (!returns.length) {
            return res.status(404).json({ success: false, message: 'Return not found' });
        }

        const [items] = await pool.query(`
      SELECT ri.*, p.product_name, sb.batch_number
      FROM return_items ri
      JOIN products p ON p.id = ri.product_id
      JOIN stock_batches sb ON sb.id = ri.batch_id
      WHERE ri.return_id = ?
    `, [req.params.id]);

        res.json({ success: true, data: {...returns[0], items } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
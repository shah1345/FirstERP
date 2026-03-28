const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Safe outlet scope — works even if middleware file missing
let outletScope;
try { outletScope = require('../middleware/outletScope').outletScope; }
catch (e) { outletScope = (req, res, next) => { req.getOutletId = () => null; req.outletWhere = () => ({ sql: '', params: [] }); req.canDelete = () => ({ allowed: true }); req.isOutletUser = false; req.isWarehouseAdmin = true; req.outletId = null; next(); }; }

// Safe activity logger
let logActivity;
try { logActivity = require('../utils/activityLogger').logActivity; }
catch (e) { logActivity = async () => { }; }

const router = express.Router();

function generateInvoiceNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `INV-${y}${m}${d}-${rand}`;
}

// FIFO deduction – outlet-aware (NO req/logActivity here — those belong in the route)
async function deductFIFO(conn, productId, quantity, saleId, outletId) {
    let batchQuery = `SELECT sb.*, p.sale_price as product_default_sale_price 
     FROM stock_batches sb 
     JOIN products p ON p.id = sb.product_id
     WHERE sb.product_id = ? AND sb.quantity_remaining > 0`;
    const params = [productId];

    if (outletId) {
        batchQuery += ' AND sb.outlet_id = ?';
        params.push(outletId);
    }
    batchQuery += ' ORDER BY sb.created_at ASC';

    const [batches] = await conn.query(batchQuery, params);

    let remaining = quantity;
    const deductions = [];

    for (const batch of batches) {
        if (remaining <= 0) break;
        const deduct = Math.min(batch.quantity_remaining, remaining);

        await conn.query(
            'UPDATE stock_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?', [deduct, batch.id]
        );

        await conn.query(
            `INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, reference_id, reference_type, created_by)
       VALUES (?, ?, 'out', ?, ?, 'sale', NULL)`, [productId, batch.id, deduct, saleId]
        );

        deductions.push({
            batch_id: batch.id,
            batch_number: batch.batch_number,
            deducted: deduct,
            purchase_price: batch.purchase_price,
            sale_price: batch.sale_price || batch.product_default_sale_price
        });

        remaining -= deduct;
    }

    if (remaining > 0) throw new Error(`Insufficient stock. Short by ${remaining} units.`);
    return deductions;
}

// ── SPECIFIC ROUTES FIRST ─────────────────────────────────────────────────────

// GET /sales/analytics/summary
router.get('/analytics/summary', authenticateToken, outletScope, async (req, res) => {
    try {
        const ow = req.outletWhere('s');
        const [data] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(s.created_at) = CURDATE() THEN s.total_amount ELSE 0 END), 0) AS today_sales,
        COALESCE(SUM(CASE WHEN YEARWEEK(s.created_at,1)=YEARWEEK(NOW(),1) THEN s.total_amount ELSE 0 END), 0) AS week_sales,
        COALESCE(SUM(CASE WHEN MONTH(s.created_at)=MONTH(NOW()) AND YEAR(s.created_at)=YEAR(NOW()) THEN s.total_amount ELSE 0 END), 0) AS month_sales,
        COALESCE(SUM(CASE WHEN YEAR(s.created_at)=YEAR(NOW()) THEN s.total_amount ELSE 0 END), 0) AS year_sales,
        COALESCE(SUM(CASE WHEN DATE(s.created_at)=CURDATE() THEN s.vat_amount ELSE 0 END), 0) AS today_vat,
        COALESCE(SUM(CASE WHEN DATE(s.created_at)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) THEN s.total_amount ELSE 0 END), 0) AS yesterday_sales,
        COALESCE(SUM(CASE WHEN YEARWEEK(s.created_at,1)=YEARWEEK(DATE_SUB(NOW(),INTERVAL 1 WEEK),1) THEN s.total_amount ELSE 0 END), 0) AS last_week_sales,
        COALESCE(SUM(CASE WHEN MONTH(s.created_at)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND YEAR(s.created_at)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) THEN s.total_amount ELSE 0 END), 0) AS last_month_sales,
        COUNT(CASE WHEN DATE(s.created_at)=CURDATE() THEN 1 END) AS today_invoices,
        COUNT(*) AS total_invoices
      FROM sales s WHERE s.status = 'active' ${ow.sql}
    `, ow.params);
        const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(s.created_at,'%Y-%m') AS month, SUM(s.total_amount) AS total, COUNT(*) AS count
      FROM sales s WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND s.status = 'active' ${ow.sql}
      GROUP BY month ORDER BY month
    `, ow.params);
        const [topProducts] = await pool.query(`
      SELECT si.product_name, SUM(si.quantity) AS qty, SUM(si.total_price) AS revenue
      FROM sale_items si JOIN sales s ON s.id=si.sale_id
      WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND s.status = 'active' ${ow.sql}
      GROUP BY si.product_id, si.product_name ORDER BY revenue DESC LIMIT 10
    `, ow.params);
        res.json({ success: true, data: { summary: data[0], monthly, topProducts } });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /sales/reports/daily
router.get('/reports/daily', authenticateToken, outletScope, async (req, res) => {
    try {
        const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
        const ow = req.outletWhere('s');
        const [summary] = await pool.query(`
      SELECT COUNT(*) AS total_invoices,
             COALESCE(SUM(s.total_amount),0) AS total_sales,
             COALESCE(SUM(s.vat_amount),0)   AS total_vat,
             COALESCE(SUM(s.paid_amount),0)  AS total_paid,
             COALESCE(SUM(s.due_amount),0)   AS total_due
      FROM sales s WHERE DATE(s.created_at)=? AND s.status = 'active' ${ow.sql}
    `, [reportDate, ...ow.params]);
        const [items] = await pool.query(`
      SELECT si.product_name, SUM(si.quantity) AS qty, SUM(si.total_price) AS total
      FROM sale_items si JOIN sales s ON s.id=si.sale_id
      WHERE DATE(s.created_at)=? AND s.status = 'active' ${ow.sql} GROUP BY si.product_id, si.product_name ORDER BY total DESC
    `, [reportDate, ...ow.params]);
        res.json({ success: true, data: { date: reportDate, summary: summary[0], items } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /sales (list)
router.get('/', authenticateToken, outletScope, async (req, res) => {
    try {
        const { date, start_date, end_date, limit = 100, offset = 0 } = req.query;
        const ow = req.outletWhere('s');
        let query = `SELECT s.*, u.name AS sold_by_name FROM sales s LEFT JOIN users u ON u.id=s.sold_by WHERE s.status != 'deleted' ${ow.sql}`;
        const params = [...ow.params];
        if (date) { query += ' AND DATE(s.created_at)=?'; params.push(date); }
        if (start_date) { query += ' AND DATE(s.created_at)>=?'; params.push(start_date); }
        if (end_date) { query += ' AND DATE(s.created_at)<=?'; params.push(end_date); }
        query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        const [sales] = await pool.query(query, params);
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /sales (create)
router.post('/', authenticateToken, outletScope, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { customer_name, customer_phone, customer_id, items, payment_method, paid_amount, discount_amount, notes } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items in cart' });

        // Determine outlet
        let outletId = null;
        if (req.isOutletUser) {
            outletId = req.outletId;
        } else if (req.body.outlet_id) {
            outletId = req.body.outlet_id;
        } else {
            // Admin with no outlet specified — auto-assign to WAREHOUSE outlet
            try {
                const [whOutlet] = await conn.query("SELECT id FROM outlets WHERE code = 'WAREHOUSE' AND status = 'active' LIMIT 1");
                if (whOutlet.length) outletId = whOutlet[0].id;
                else {
                    // No WAREHOUSE outlet — use the first active outlet
                    const [anyOutlet] = await conn.query("SELECT id FROM outlets WHERE status = 'active' ORDER BY id ASC LIMIT 1");
                    if (anyOutlet.length) outletId = anyOutlet[0].id;
                }
            } catch (e) { /* No outlets table yet, leave null */ }
        }

        // Validate serial numbers
        for (const item of items) {
            if (item.serial_numbers && item.serial_numbers.length > 0) {
                for (const sn of item.serial_numbers) {
                    const [snCheck] = await conn.query(
                        `SELECT id, status FROM serial_numbers WHERE serial_number = ? AND product_id = ?`, [sn, item.product_id]
                    );
                    if (!snCheck.length) throw new Error(`Serial number "${sn}" not found for product "${item.product_name}"`);
                    if (snCheck[0].status !== 'in_stock') throw new Error(`Serial number "${sn}" is not available (status: ${snCheck[0].status})`);
                }
            }
        }

        let subtotal = 0, vat_amount = 0, total_purchase_cost = 0;
        for (const item of items) {
            const line = parseFloat(item.unit_price) * parseInt(item.quantity);
            subtotal += line;
            vat_amount += (line * (parseFloat(item.vat_percentage) || 0)) / 100;
        }
        const discAmt = parseFloat(discount_amount) || 0;
        const total = subtotal + vat_amount - discAmt;
        const paid = parseFloat(paid_amount) >= 0 ? parseFloat(paid_amount) : total;
        const due = Math.max(0, total - paid);

        const invoiceNumber = generateInvoiceNumber();

        const [saleResult] = await conn.query(
            `INSERT INTO sales (invoice_number,customer_id,customer_name,customer_phone,subtotal,vat_amount,discount_amount,total_amount,paid_amount,due_amount,payment_method,payment_status,total_purchase_cost,total_profit,notes,sold_by,status,outlet_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,'active',?)`,
            [invoiceNumber, customer_id || null, customer_name || 'Walk-in Customer', customer_phone || null,
                subtotal, vat_amount, discAmt, total, paid, due,
                payment_method || 'cash', due > 0 ? (paid > 0 ? 'partial' : 'due') : 'paid', notes || null, req.user.id, outletId
            ]
        );
        const saleId = saleResult.insertId;

        let serialCounter = 0;

        for (const item of items) {
            const [productInfo] = await conn.query(
                'SELECT has_serial_number, warranty_months FROM products WHERE id = ?', [item.product_id]
            );
            const hasSerial = productInfo.length > 0 && productInfo[0].has_serial_number === 1;
            const warrantyMonths = (productInfo.length > 0 && productInfo[0].warranty_months) || 12;

            const deductions = await deductFIFO(conn, item.product_id, parseInt(item.quantity), saleId, outletId);

            const batchGroups = {};
            for (const d of deductions) {
                const key = `${d.batch_id}_${d.sale_price}`;
                if (!batchGroups[key]) {
                    batchGroups[key] = { batch_id: d.batch_id, batch_number: d.batch_number, sale_price: d.sale_price, purchase_price: d.purchase_price, quantity: 0 };
                }
                batchGroups[key].quantity += d.deducted;
            }

            for (const bg of Object.values(batchGroups)) {
                const unitPrice = item.unit_price || bg.sale_price;
                const originalPrice = bg.sale_price;
                const priceEdited = item.price_edited ? 1 : 0;
                const lineTotal = parseFloat(unitPrice) * bg.quantity;
                const itemVat = (lineTotal * (parseFloat(item.vat_percentage) || 0)) / 100;
                const lineCost = parseFloat(bg.purchase_price) * bg.quantity;
                const lineProfit = lineTotal - lineCost;
                total_purchase_cost += lineCost;

                const [saleItemResult] = await conn.query(
                    `INSERT INTO sale_items 
             (sale_id, product_id, batch_id, product_name, quantity, original_price, unit_price, price_edited, edited_by, purchase_price, vat_percentage, vat_amount, discount_amount, total_price, profit, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`,
                    [saleId, item.product_id, bg.batch_id,
                        `${item.product_name} [${bg.batch_number}]`,
                        bg.quantity, originalPrice, unitPrice, priceEdited,
                        priceEdited ? req.user.id : null, bg.purchase_price,
                        parseFloat(item.vat_percentage) || 0, itemVat, 0,
                        lineTotal + itemVat, lineProfit
                    ]
                );
                const saleItemId = saleItemResult.insertId;

                // Serial number handling
                if (hasSerial) {
                    const manualSerials = item.serial_numbers && item.serial_numbers.length > 0;
                    let firstSerialId = null;

                    if (manualSerials) {
                        const [batchSerials] = await conn.query(
                            `SELECT id, serial_number FROM serial_numbers 
               WHERE product_id = ? AND batch_id = ? AND serial_number IN (?) AND status = 'in_stock'`,
                            [item.product_id, bg.batch_id, item.serial_numbers]
                        );
                        if (batchSerials.length > 0) {
                            firstSerialId = batchSerials[0].id;
                            await conn.query(
                                `UPDATE serial_numbers SET status = 'sold', sale_id = ?, sale_item_id = ?,
                     warranty_start_date = CURDATE(), warranty_end_date = DATE_ADD(CURDATE(), INTERVAL ? MONTH)
                 WHERE product_id = ? AND batch_id = ? AND serial_number IN (?) AND status = 'in_stock'`,
                                [saleId, saleItemId, warrantyMonths, item.product_id, bg.batch_id, batchSerials.map(s => s.serial_number)]
                            );
                        }
                    } else {
                        const [autoSerials] = await conn.query(
                            `SELECT id, serial_number FROM serial_numbers 
               WHERE product_id = ? AND batch_id = ? AND status = 'in_stock'
               ORDER BY created_at ASC LIMIT ?`,
                            [item.product_id, bg.batch_id, bg.quantity]
                        );
                        if (autoSerials.length > 0) {
                            firstSerialId = autoSerials[0].id;
                            await conn.query(
                                `UPDATE serial_numbers SET status = 'sold', sale_id = ?, sale_item_id = ?,
                     warranty_start_date = CURDATE(), warranty_end_date = DATE_ADD(CURDATE(), INTERVAL ? MONTH)
                 WHERE id IN (?)`,
                                [saleId, saleItemId, warrantyMonths, autoSerials.map(s => s.id)]
                            );
                        } else {
                            for (let i = 0; i < bg.quantity; i++) {
                                serialCounter++;
                                const autoSerial = `SN-${invoiceNumber.replace('INV-', '')}-${String(serialCounter).padStart(3, '0')}`;
                                const [insertResult] = await conn.query(
                                    `INSERT INTO serial_numbers 
                   (product_id, batch_id, serial_number, status, sale_id, sale_item_id, 
                    warranty_start_date, warranty_end_date, created_at)
                   VALUES (?, ?, ?, 'sold', ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? MONTH), NOW())`,
                                    [item.product_id, bg.batch_id, autoSerial, saleId, saleItemId, warrantyMonths]
                                );
                                if (i === 0) firstSerialId = insertResult.insertId;
                            }
                        }
                    }
                    if (firstSerialId) {
                        await conn.query('UPDATE sale_items SET serial_number_id = ? WHERE id = ?', [firstSerialId, saleItemId]);
                    }
                }
            }

            // Handle remaining manual serials
            if (item.serial_numbers && item.serial_numbers.length > 0) {
                const [remainingSerials] = await conn.query(
                    `SELECT id, serial_number, batch_id FROM serial_numbers 
           WHERE product_id = ? AND serial_number IN (?) AND status = 'in_stock'`,
                    [item.product_id, item.serial_numbers]
                );
                for (const rs of remainingSerials) {
                    const [matchedSaleItem] = await conn.query(
                        `SELECT id FROM sale_items WHERE sale_id = ? AND product_id = ? AND batch_id = ? LIMIT 1`,
                        [saleId, item.product_id, rs.batch_id]
                    );
                    const matchedSaleItemId = matchedSaleItem.length > 0 ? matchedSaleItem[0].id : null;
                    await conn.query(
                        `UPDATE serial_numbers SET status = 'sold', sale_id = ?, sale_item_id = ?,
             warranty_start_date = CURDATE(),
             warranty_end_date = DATE_ADD(CURDATE(), INTERVAL COALESCE((SELECT warranty_months FROM products WHERE id = ?), 12) MONTH)
             WHERE id = ? AND status = 'in_stock'`,
                        [saleId, matchedSaleItemId, item.product_id, rs.id]
                    );
                }
            }
        }

        // Update sale with profit
        const totalProfit = total - total_purchase_cost;
        await conn.query('UPDATE sales SET total_purchase_cost=?, total_profit=? WHERE id=?', [total_purchase_cost, totalProfit, saleId]);

        await conn.commit();
        const [inv] = await conn.query('SELECT invoice_number FROM sales WHERE id=?', [saleId]);

        // ── LOG ACTIVITY ───────────────────────────────────────
        try { await logActivity(req, 'sale_created', 'sale', saleId, `Sale ${invoiceNumber} — ৳${total}`, { total, items: items.length, paid, due }); } catch (e) { }

        // ── AUTO-POST TO CHART OF ACCOUNTS ─────────────────────
        try {
            const postConn = await pool.getConnection();
            try {
                await postConn.beginTransaction();
                const entryNumber = `SALE-${invoiceNumber}`;
                const [accCheck] = await postConn.query("SELECT id FROM accounts WHERE code = '4001' LIMIT 1");
                if (accCheck.length > 0) {
                    let cashCode = '1001';
                    if (payment_method === 'card') cashCode = '1002';
                    else if (payment_method === 'mobile_banking') cashCode = '1003';

                    const [cashAcc] = await postConn.query('SELECT id FROM accounts WHERE code = ?', [cashCode]);
                    const [arAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '1010'");
                    const [salesAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '4001'");
                    const [cogsAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '5001'");
                    const [invAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '1020'");
                    const [vatAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '2010'");
                    const [discAcc] = await postConn.query("SELECT id FROM accounts WHERE code = '5018'");

                    const [je] = await postConn.query(`
                INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, total_amount, is_auto, status, created_by)
                VALUES (?, CURDATE(), ?, 'sale', ?, ?, 1, 'posted', ?)
              `, [entryNumber, `Sale ${invoiceNumber}`, saleId, total, req.user.id]);
                    const jeId = je.insertId;

                    if (paid > 0 && cashAcc.length)
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)', [jeId, cashAcc[0].id, `Cash - ${invoiceNumber}`, paid]);
                    if (due > 0 && arAcc.length)
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)', [jeId, arAcc[0].id, `Credit sale - ${invoiceNumber}`, due]);
                    if (discAmt > 0 && discAcc.length)
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)', [jeId, discAcc[0].id, `Discount - ${invoiceNumber}`, discAmt]);
                    const salesRevenue = total + discAmt - vat_amount;
                    if (salesAcc.length)
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)', [jeId, salesAcc[0].id, `Revenue - ${invoiceNumber}`, salesRevenue > 0 ? salesRevenue : total]);
                    if (vat_amount > 0 && vatAcc.length)
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)', [jeId, vatAcc[0].id, `VAT - ${invoiceNumber}`, vat_amount]);
                    if (total_purchase_cost > 0 && cogsAcc.length && invAcc.length) {
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)', [jeId, cogsAcc[0].id, `COGS - ${invoiceNumber}`, total_purchase_cost]);
                        await postConn.query('INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)', [jeId, invAcc[0].id, `Inventory out - ${invoiceNumber}`, total_purchase_cost]);
                    }
                    await postConn.commit();
                    console.log(`✅ COA posted: ${entryNumber}`);
                } else { await postConn.rollback(); }
            } catch (coaErr) { await postConn.rollback(); console.log('COA post skipped:', coaErr.message); }
            finally { postConn.release(); }
        } catch (coaErr) { console.log('COA connection skipped:', coaErr.message); }

        res.json({ success: true, message: 'Sale created', sale_id: saleId, invoice_number: inv[0].invoice_number });
    } catch (error) {
        await conn.rollback();
        console.error('Sale error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally { conn.release(); }
});

// GET /sales/:id
router.get('/:id', authenticateToken, outletScope, async (req, res) => {
    try {
        const ow = req.outletWhere('s');
        const [sales] = await pool.query(
            `SELECT s.*, u.name AS sold_by_name FROM sales s LEFT JOIN users u ON u.id=s.sold_by WHERE s.id=? ${ow.sql}`,
            [req.params.id, ...ow.params]
        );
        if (!sales.length) return res.status(404).json({ success: false, message: 'Sale not found' });

        const [items] = await pool.query(
            `SELECT si.*, p.barcode, sb.batch_number 
       FROM sale_items si 
       LEFT JOIN products p ON p.id=si.product_id
       LEFT JOIN stock_batches sb ON sb.id=si.batch_id
       WHERE si.sale_id=? ORDER BY si.id`, [req.params.id]
        );

        for (const item of items) {
            const [serials] = await pool.query(
                `SELECT serial_number, warranty_start_date, warranty_end_date FROM serial_numbers WHERE sale_item_id = ?`, [item.id]
            );
            item.serial_numbers = serials.map(s => s.serial_number);
            item.serial_details = serials;
        }

        const [company] = await pool.query('SELECT * FROM company_config LIMIT 1');
        res.json({ success: true, data: { ...sales[0], items, company: company[0] } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// DELETE /sales/:id - with 6-hour rule
router.delete('/:id', authenticateToken, outletScope, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const saleId = req.params.id;

        const [sales] = await conn.query('SELECT * FROM sales WHERE id = ?', [saleId]);
        if (!sales.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Sale not found' }); }
        const sale = sales[0];

        // Outlet user can only delete their own outlet's sales
        if (req.isOutletUser && sale.outlet_id && sale.outlet_id !== req.outletId) {
            await conn.rollback();
            return res.status(403).json({ success: false, message: 'Cannot delete sales from another outlet' });
        }

        if (sale.status === 'deleted') { await conn.rollback(); return res.status(400).json({ success: false, message: 'Sale already deleted' }); }

        // 6-HOUR DELETE RULE FOR OUTLET USERS
        if (req.isOutletUser) {
            const deleteCheck = req.canDelete(sale.created_at);
            if (!deleteCheck.allowed) {
                await conn.rollback();
                try {
                    await pool.query(
                        `INSERT INTO pending_actions (outlet_id, requested_by, action_type, entity_type, entity_id, reason, entity_data)
                         VALUES (?, ?, 'delete_sale', 'sale', ?, ?, ?)`,
                        [req.outletId, req.user.id, saleId, req.body.reason || 'Delete requested', JSON.stringify(sale)]
                    );
                } catch (e) { console.log('Pending action skipped:', e.message); }
                return res.status(202).json({ success: true, message: deleteCheck.reason });
            }
        }

        if (sale.status === 'partial_return' && req.user.role !== 'admin') {
            await conn.rollback();
            return res.status(403).json({ success: false, message: 'Cannot delete partially returned sale. Admin override required.' });
        }

        const [saleItems] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ? AND status = "active"', [saleId]);

        for (const item of saleItems) {
            await conn.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining + ? WHERE id = ?', [item.quantity, item.batch_id]);
            await conn.query(`INSERT INTO stock_movements (product_id, batch_id, movement_type, quantity, reference_id, reference_type, created_by) VALUES (?, ?, 'return', ?, ?, 'delete_sale', ?)`,
                [item.product_id, item.batch_id, item.quantity, saleId, req.user.id]);
            await conn.query(`UPDATE serial_numbers SET status = 'in_stock', sale_id = NULL, sale_item_id = NULL, warranty_start_date = NULL, warranty_end_date = NULL WHERE sale_item_id = ?`, [item.id]);
        }

        if (sale.customer_id && sale.due_amount > 0) {
            await conn.query('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?', [sale.due_amount, sale.customer_id]);
        }

        await conn.query('UPDATE sales SET status = "deleted", deleted_at = NOW(), deleted_by = ? WHERE id = ?', [req.user.id, saleId]);

        await conn.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, reason) VALUES (?, 'delete_sale', 'sale', ?, ?, ?)`,
            [req.user.id, saleId, JSON.stringify(sale), req.body.reason || 'Sale deleted']);

        try { await conn.query("UPDATE journal_entries SET status = 'voided' WHERE reference_type = 'sale' AND reference_id = ?", [saleId]); }
        catch (coaErr) { console.log('COA void skipped:', coaErr.message); }

        await conn.commit();

        try { await logActivity(req, 'sale_deleted', 'sale', saleId, `Sale deleted: ${sale.invoice_number}`, { total: sale.total_amount }); } catch (e) { }

        res.json({ success: true, message: 'Sale deleted and stock restored' });
    } catch (error) {
        await conn.rollback();
        console.error('Delete sale error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally { conn.release(); }
});

// GET /sales/analytics/profit
router.get('/analytics/profit', authenticateToken, outletScope, async (req, res) => {
    try {
        const ow = req.outletWhere('');
        const [data] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'active' THEN total_profit ELSE 0 END), 0) AS daily_profit,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'active' THEN total_amount ELSE 0 END), 0) AS daily_sales,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'active' THEN total_purchase_cost ELSE 0 END), 0) AS daily_cost,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_profit ELSE 0 END), 0) AS monthly_profit,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_amount ELSE 0 END), 0) AS monthly_sales,
        COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_purchase_cost ELSE 0 END), 0) AS monthly_cost,
        COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_profit ELSE 0 END), 0) AS yearly_profit,
        COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_amount ELSE 0 END), 0) AS yearly_sales,
        COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(NOW()) AND status = 'active' THEN total_purchase_cost ELSE 0 END), 0) AS yearly_cost,
        COALESCE(SUM(CASE WHEN status = 'active' THEN total_profit ELSE 0 END), 0) AS lifetime_profit,
        COALESCE(SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END), 0) AS lifetime_sales,
        COALESCE(SUM(CASE WHEN status = 'active' THEN total_purchase_cost ELSE 0 END), 0) AS lifetime_cost
      FROM sales WHERE 1=1 ${ow.sql}
    `, ow.params);

        const result = data[0];
        const profitMargin = result.lifetime_sales > 0 ? ((result.lifetime_profit / result.lifetime_sales) * 100).toFixed(2) : 0;
        res.json({ success: true, data: { ...result, profit_margin: parseFloat(profitMargin) } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
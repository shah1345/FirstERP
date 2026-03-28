const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// SEARCH customers by name or phone (must be BEFORE /:id)
router.get('/search', authenticateToken, async(req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const [customers] = await pool.query(`
      SELECT c.id, c.customer_name, c.phone, c.email, c.address,
             c.customer_type, c.credit_limit,
             COALESCE(
               (SELECT SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END) 
                FROM sales s WHERE s.customer_id = c.id), 0
             ) as current_balance
      FROM customers c
      WHERE c.is_active = 1
        AND (c.customer_name LIKE ? OR c.phone LIKE ?)
      ORDER BY c.customer_name ASC
      LIMIT 10
    `, [`%${q}%`, `%${q}%`]);

        res.json({ success: true, data: customers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET all customers
router.get('/', authenticateToken, async(req, res) => {
    try {
        const { type, has_balance, search } = req.query;

        let query = `
      SELECT c.*,
        (SELECT COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_amount ELSE 0 END), 0) 
         FROM sales s WHERE s.customer_id = c.id) as total_purchases,
        (SELECT COALESCE(SUM(payment_amount), 0) 
         FROM customer_payments WHERE customer_id = c.id) as total_paid,
        (SELECT COALESCE(SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END), 0)
         FROM sales s WHERE s.customer_id = c.id) as current_balance
      FROM customers c
      WHERE c.is_active = 1
    `;
        const params = [];

        if (type) {
            query += ' AND c.customer_type = ?';
            params.push(type);
        }

        if (has_balance === 'true') {
            query += ' HAVING current_balance > 0';
        }

        if (search) {
            query += ' AND (c.customer_name LIKE ? OR c.phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY c.created_at DESC';

        const [customers] = await pool.query(query, params);
        res.json({ success: true, data: customers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET credit customers with dues (must be BEFORE /:id)
router.get('/credit/dues', authenticateToken, async(req, res) => {
    try {
        const [customers] = await pool.query(`
      SELECT c.id, c.customer_name, c.phone, c.email, c.address, c.customer_type, c.credit_limit,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_amount ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.paid_amount ELSE 0 END), 0) as total_paid_in_sales,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END), 0) as current_due,
        (SELECT COALESCE(SUM(payment_amount), 0) FROM customer_payments WHERE customer_id = c.id) as total_payments,
        (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND status='active' AND due_amount > 0) as pending_invoices
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      WHERE c.is_active = 1 AND c.customer_type = 'credit'
      GROUP BY c.id
      HAVING current_due > 0
      ORDER BY current_due DESC
    `);
        res.json({ success: true, data: customers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single customer with details
router.get('/:id', authenticateToken, async(req, res) => {
    try {
        const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (!customers.length) return res.status(404).json({ success: false, message: 'Customer not found' });

        const customer = customers[0];

        // Get recent sales
        const [sales] = await pool.query(`
      SELECT id, invoice_number, total_amount, paid_amount, due_amount, 
             payment_status, created_at
      FROM sales
      WHERE customer_id = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 10
    `, [req.params.id]);

        // Get recent payments
        const [payments] = await pool.query(`
      SELECT cp.*, u.name as received_by_name
      FROM customer_payments cp
      LEFT JOIN users u ON u.id = cp.received_by
      WHERE cp.customer_id = ?
      ORDER BY cp.payment_date DESC
      LIMIT 10
    `, [req.params.id]);

        // Calculate balances
        const [totals] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status='active' THEN total_amount ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN status='active' THEN paid_amount ELSE 0 END), 0) as total_paid_in_sales,
        COALESCE(SUM(CASE WHEN status='active' THEN due_amount ELSE 0 END), 0) as current_due
      FROM sales
      WHERE customer_id = ?
    `, [req.params.id]);

        const [paymentTotal] = await pool.query(`
      SELECT COALESCE(SUM(payment_amount), 0) as total_payments
      FROM customer_payments
      WHERE customer_id = ?
    `, [req.params.id]);

        res.json({
            success: true,
            data: {
                ...customer,
                total_purchases: totals[0].total_purchases,
                total_paid: paymentTotal[0].total_payments,
                current_balance: totals[0].current_due,
                recent_sales: sales,
                recent_payments: payments
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create customer
router.post('/', authenticateToken, async(req, res) => {
    try {
        const { customer_name, phone, email, address, customer_type, credit_limit, notes } = req.body;

        if (!customer_name) {
            return res.status(400).json({ success: false, message: 'Customer name is required' });
        }

        const [result] = await pool.query(`
      INSERT INTO customers (customer_name, phone, email, address, customer_type, credit_limit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [customer_name, phone, email, address, customer_type || 'cash', credit_limit || 0, notes]);

        res.json({ success: true, message: 'Customer created', customer_id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update customer
router.put('/:id', authenticateToken, async(req, res) => {
    try {
        const { customer_name, phone, email, address, customer_type, credit_limit, notes } = req.body;

        await pool.query(`
      UPDATE customers
      SET customer_name = ?, phone = ?, email = ?, address = ?, 
          customer_type = ?, credit_limit = ?, notes = ?
      WHERE id = ?
    `, [customer_name, phone, email, address, customer_type, credit_limit, notes, req.params.id]);

        res.json({ success: true, message: 'Customer updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE customer (soft delete)
router.delete('/:id', requireAdmin, async(req, res) => {
    try {
        // Check if customer has outstanding balance
        const [balanceCheck] = await pool.query(`
      SELECT COALESCE(SUM(due_amount), 0) as balance
      FROM sales
      WHERE customer_id = ? AND status = 'active'
    `, [req.params.id]);

        if (balanceCheck[0].balance > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete customer with outstanding balance of ৳${balanceCheck[0].balance}`
            });
        }

        await pool.query('UPDATE customers SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Customer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST add customer payment
router.post('/:id/payments', authenticateToken, async(req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { payment_amount, payment_method, reference_number, payment_date, notes } = req.body;
        const customer_id = req.params.id;

        if (!payment_amount || payment_amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid payment amount' });
        }

        // Check customer balance
        const [balanceCheck] = await conn.query(`
      SELECT COALESCE(SUM(due_amount), 0) as current_due
      FROM sales
      WHERE customer_id = ? AND status = 'active'
    `, [customer_id]);

        if (payment_amount > balanceCheck[0].current_due) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: `Payment amount exceeds due balance of ৳${balanceCheck[0].current_due}`
            });
        }

        // Insert payment
        const [paymentResult] = await conn.query(`
      INSERT INTO customer_payments 
      (customer_id, payment_amount, payment_method, reference_number, notes, received_by, payment_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [customer_id, payment_amount, payment_method, reference_number, notes, req.user.id, payment_date || new Date()]);

        // Update oldest unpaid sales
        let remaining = parseFloat(payment_amount);
        const [unpaidSales] = await conn.query(`
      SELECT id, due_amount
      FROM sales
      WHERE customer_id = ? AND due_amount > 0 AND status = 'active'
      ORDER BY created_at ASC
    `, [customer_id]);

        for (const sale of unpaidSales) {
            if (remaining <= 0) break;

            const paymentForThisSale = Math.min(remaining, parseFloat(sale.due_amount));

            await conn.query(`
        UPDATE sales
        SET paid_amount = paid_amount + ?,
            due_amount = due_amount - ?,
            payment_status = CASE 
              WHEN due_amount - ? = 0 THEN 'paid'
              WHEN due_amount - ? < due_amount THEN 'partial'
              ELSE payment_status
            END
        WHERE id = ?
      `, [paymentForThisSale, paymentForThisSale, paymentForThisSale, paymentForThisSale, sale.id]);

            remaining -= paymentForThisSale;
        }

        await conn.commit();
        res.json({ success: true, message: 'Payment recorded', payment_id: paymentResult.insertId });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        conn.release();
    }
});

// GET customer statement
router.get('/:id/statement', authenticateToken, async(req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const customer_id = req.params.id;

        // Get customer
        const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [customer_id]);
        if (!customers.length) return res.status(404).json({ success: false, message: 'Customer not found' });

        let transactions = [];

        // Get sales
        let salesQuery = `
      SELECT s.id, s.invoice_number, s.created_at as date, 'sale' as type,
             s.total_amount, s.paid_amount, s.due_amount
      FROM sales s
      WHERE s.customer_id = ? AND s.status = 'active'
    `;
        const params = [customer_id];

        if (start_date) {
            salesQuery += ' AND DATE(s.created_at) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            salesQuery += ' AND DATE(s.created_at) <= ?';
            params.push(end_date);
        }

        const [sales] = await pool.query(salesQuery, params);

        // Get sale items for each sale
        for (const sale of sales) {
            const [items] = await pool.query(`
        SELECT product_name, quantity, unit_price, total_price
        FROM sale_items
        WHERE sale_id = ? AND status = 'active'
      `, [sale.id]);

            transactions.push({
                date: sale.date,
                type: 'sale',
                invoice: sale.invoice_number,
                products: items,
                debit: parseFloat(sale.total_amount),
                credit: 0,
                balance: 0 // Will calculate running balance
            });
        }

        // Get payments
        let paymentsQuery = `
      SELECT payment_date as date, payment_amount, payment_method, reference_number
      FROM customer_payments
      WHERE customer_id = ?
    `;
        const payParams = [customer_id];

        if (start_date) {
            paymentsQuery += ' AND DATE(payment_date) >= ?';
            payParams.push(start_date);
        }
        if (end_date) {
            paymentsQuery += ' AND DATE(payment_date) <= ?';
            payParams.push(end_date);
        }

        const [payments] = await pool.query(paymentsQuery, payParams);

        for (const payment of payments) {
            transactions.push({
                date: payment.date,
                type: 'payment',
                payment_method: payment.payment_method,
                reference: payment.reference_number,
                debit: 0,
                credit: parseFloat(payment.payment_amount),
                balance: 0
            });
        }

        // Sort by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate running balance
        let runningBalance = 0;
        transactions = transactions.map(t => {
            runningBalance += t.debit - t.credit;
            return {...t, balance: runningBalance };
        });

        // Summary
        const totalPurchases = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.debit, 0);
        const totalPayments = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.credit, 0);

        res.json({
            success: true,
            data: {
                customer: customers[0],
                transactions,
                summary: {
                    opening_balance: 0,
                    total_purchases: totalPurchases,
                    total_payments: totalPayments,
                    closing_balance: totalPurchases - totalPayments
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET all sales for a customer (for collect due page)
router.get('/:id/sales', authenticateToken, async(req, res) => {
    try {
        const { status } = req.query;
        let query = `
      SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount, s.due_amount,
             s.payment_status, s.payment_method, s.created_at,
             GROUP_CONCAT(si.product_name SEPARATOR ', ') as products
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id AND si.status = 'active'
      WHERE s.customer_id = ? AND s.status = 'active'
    `;
        const params = [req.params.id];

        if (status === 'due') {
            query += ' AND s.due_amount > 0';
        }

        query += ' GROUP BY s.id ORDER BY s.created_at DESC';

        const [sales] = await pool.query(query, params);
        res.json({ success: true, data: sales });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET all payments for a customer
router.get('/:id/payments', authenticateToken, async(req, res) => {
    try {
        const [payments] = await pool.query(`
      SELECT cp.*, u.name as received_by_name
      FROM customer_payments cp
      LEFT JOIN users u ON u.id = cp.received_by
      WHERE cp.customer_id = ?
      ORDER BY cp.payment_date DESC
    `, [req.params.id]);
        res.json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET payment receipt data
router.get('/:id/payments/:paymentId/receipt', authenticateToken, async(req, res) => {
    try {
        const [payments] = await pool.query(`
      SELECT cp.*, u.name as received_by_name
      FROM customer_payments cp
      LEFT JOIN users u ON u.id = cp.received_by
      WHERE cp.id = ? AND cp.customer_id = ?
    `, [req.params.paymentId, req.params.id]);

        if (!payments.length) return res.status(404).json({ success: false, message: 'Payment not found' });

        const [customers] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        const [company] = await pool.query('SELECT * FROM company_config LIMIT 1');

        // Balance after this payment
        const [balanceData] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END), 0) as current_due
      FROM sales s WHERE s.customer_id = ?
    `, [req.params.id]);

        res.json({
            success: true,
            data: {
                payment: payments[0],
                customer: customers[0],
                company: company[0] || {},
                current_due: balanceData[0].current_due
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
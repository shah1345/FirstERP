const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Helper: build date condition based on period type
function getDateCondition(type, value) {
  switch (type) {
    case 'daily':
      return { where: 'DATE(s.created_at) = ?', params: [value], label: value };
    case 'weekly': {
      // value = "2026-W09" or a date string; derive Mon–Sun
      let startDate;
      if (value.includes('W')) {
        const [y, w] = value.split('-W');
        const jan4 = new Date(parseInt(y), 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        startDate = new Date(jan4);
        startDate.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(w) - 1) * 7);
      } else {
        startDate = new Date(value);
        const day = startDate.getDay() || 7;
        startDate.setDate(startDate.getDate() - day + 1);
      }
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      const s = startDate.toISOString().slice(0, 10);
      const e = endDate.toISOString().slice(0, 10);
      return { where: 'DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?', params: [s, e], label: `${s} to ${e}` };
    }
    case 'monthly': {
      // value = "2026-02"
      const [y, m] = value.split('-');
      return { where: 'MONTH(s.created_at) = ? AND YEAR(s.created_at) = ?', params: [parseInt(m), parseInt(y)], label: value };
    }
    case 'yearly':
      return { where: 'YEAR(s.created_at) = ?', params: [parseInt(value)], label: value };
    case 'range': {
      // value = { start: "2026-01-01", end: "2026-02-28" }
      return { where: 'DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?', params: [value.start, value.end], label: `${value.start} to ${value.end}` };
    }
    default:
      return { where: 'DATE(s.created_at) = CURDATE()', params: [], label: 'Today' };
  }
}

// Same helper but for tables without alias 's'
function getDateConditionRaw(type, value, col) {
  const c = col || 'created_at';
  switch (type) {
    case 'daily':
      return { where: `DATE(${c}) = ?`, params: [value] };
    case 'weekly': {
      let startDate;
      if (value.includes && value.includes('W')) {
        const [y, w] = value.split('-W');
        const jan4 = new Date(parseInt(y), 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        startDate = new Date(jan4);
        startDate.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(w) - 1) * 7);
      } else {
        startDate = new Date(value);
        const day = startDate.getDay() || 7;
        startDate.setDate(startDate.getDate() - day + 1);
      }
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return { where: `DATE(${c}) >= ? AND DATE(${c}) <= ?`, params: [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)] };
    }
    case 'monthly': {
      const [y, m] = value.split('-');
      return { where: `MONTH(${c}) = ? AND YEAR(${c}) = ?`, params: [parseInt(m), parseInt(y)] };
    }
    case 'yearly':
      return { where: `YEAR(${c}) = ?`, params: [parseInt(value)] };
    case 'range':
      return { where: `DATE(${c}) >= ? AND DATE(${c}) <= ?`, params: [value.start, value.end] };
    default:
      return { where: `DATE(${c}) = CURDATE()`, params: [] };
  }
}

// ── GET /reports/statement — Full comprehensive report ─────
router.get('/statement', authenticateToken, async (req, res) => {
  try {
    const { type, value, start_date, end_date } = req.query;

    let dateVal = value;
    if (type === 'range') {
      dateVal = { start: start_date, end: end_date };
    }

    const dc = getDateCondition(type || 'daily', dateVal || new Date().toISOString().slice(0, 10));
    const dcRaw = getDateConditionRaw(type || 'daily', dateVal || new Date().toISOString().slice(0, 10), 'created_at');

    // ─── 1. SALES SUMMARY ────────────────────────────────
    const [salesSummary] = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_purchase_cost ELSE 0 END), 0) as total_cost,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_profit ELSE 0 END), 0) as total_profit,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.vat_amount ELSE 0 END), 0) as total_vat,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.discount_amount ELSE 0 END), 0) as total_discount,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.paid_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END), 0) as total_due,
        COUNT(CASE WHEN s.status='deleted' THEN 1 END) as deleted_count,
        COUNT(CASE WHEN s.status='active' THEN 1 END) as active_count
      FROM sales s
      WHERE ${dc.where}
    `, dc.params);

    // ─── 2. CASH vs CREDIT BREAKDOWN ─────────────────────
    const [paymentBreakdown] = await pool.query(`
      SELECT 
        s.payment_method,
        COUNT(*) as count,
        COALESCE(SUM(s.total_amount), 0) as amount,
        COALESCE(SUM(s.paid_amount), 0) as paid,
        COALESCE(SUM(s.due_amount), 0) as due
      FROM sales s
      WHERE s.status = 'active' AND ${dc.where}
      GROUP BY s.payment_method
      ORDER BY amount DESC
    `, dc.params);

    // ─── 3. PRODUCT-WISE SALES ───────────────────────────
    const [productWise] = await pool.query(`
      SELECT 
        si.product_name,
        SUM(si.quantity) as qty_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.purchase_price * si.quantity), 0) as total_cost,
        COALESCE(SUM(si.profit), 0) as total_profit,
        ROUND(AVG(si.unit_price), 2) as avg_sell_price,
        ROUND(AVG(si.purchase_price), 2) as avg_cost_price
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'active' AND si.status = 'active' AND ${dc.where}
      GROUP BY si.product_id, si.product_name
      ORDER BY total_revenue DESC
    `, dc.params);

    // ─── 4. PROFIT / LOSS ANALYSIS ───────────────────────
    const profitData = {
      total_revenue: parseFloat(salesSummary[0].total_sales),
      total_cost: parseFloat(salesSummary[0].total_cost),
      gross_profit: parseFloat(salesSummary[0].total_profit),
      vat_collected: parseFloat(salesSummary[0].total_vat),
      discounts_given: parseFloat(salesSummary[0].total_discount),
      net_profit: parseFloat(salesSummary[0].total_profit) - parseFloat(salesSummary[0].total_discount),
      profit_margin: parseFloat(salesSummary[0].total_sales) > 0
        ? ((parseFloat(salesSummary[0].total_profit) / parseFloat(salesSummary[0].total_sales)) * 100).toFixed(2)
        : 0
    };

    // ─── 5. STOCK REPORT (current snapshot) ──────────────
    const [stockReport] = await pool.query(`
      SELECT 
        p.id, p.product_name, p.brand, p.model, p.sale_price,
        COALESCE(SUM(sb.quantity_remaining), 0) as current_stock,
        COALESCE(SUM(sb.quantity_remaining * sb.purchase_price), 0) as stock_value_cost,
        COALESCE(SUM(sb.quantity_remaining * p.sale_price), 0) as stock_value_sale
      FROM products p
      LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.quantity_remaining > 0
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.product_name
    `);

    const stockTotals = {
      total_items: stockReport.reduce((s, r) => s + parseInt(r.current_stock), 0),
      total_cost_value: stockReport.reduce((s, r) => s + parseFloat(r.stock_value_cost), 0),
      total_sale_value: stockReport.reduce((s, r) => s + parseFloat(r.stock_value_sale), 0),
      potential_profit: stockReport.reduce((s, r) => s + parseFloat(r.stock_value_sale) - parseFloat(r.stock_value_cost), 0)
    };

    // ─── 6. CREDIT PARTY BALANCE ─────────────────────────
    const [creditParties] = await pool.query(`
      SELECT 
        c.id, c.customer_name, c.phone, c.credit_limit,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.total_amount ELSE 0 END), 0) as total_purchases,
        COALESCE(SUM(CASE WHEN s.status='active' THEN s.due_amount ELSE 0 END), 0) as current_due,
        (SELECT COALESCE(SUM(payment_amount), 0) FROM customer_payments WHERE customer_id = c.id) as total_payments
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      WHERE c.is_active = 1 AND c.customer_type = 'credit'
      GROUP BY c.id
      HAVING current_due > 0 OR total_payments > 0
      ORDER BY current_due DESC
    `);

    const creditTotals = {
      total_parties: creditParties.length,
      total_receivable: creditParties.reduce((s, c) => s + parseFloat(c.current_due), 0),
      total_collected: creditParties.reduce((s, c) => s + parseFloat(c.total_payments), 0)
    };

    // ─── 7. PAYMENTS RECEIVED IN PERIOD ──────────────────
    const [paymentsReceived] = await pool.query(`
      SELECT 
        COALESCE(SUM(payment_amount), 0) as total_received,
        COUNT(*) as payment_count
      FROM customer_payments
      WHERE ${dcRaw.where}
    `, dcRaw.params);

    // ─── 8. STOCK-IN IN PERIOD ───────────────────────────
    const [stockInData] = await pool.query(`
      SELECT 
        p.product_name,
        SUM(sb.quantity_added) as qty_added,
        COALESCE(SUM(sb.quantity_added * sb.purchase_price), 0) as total_investment
      FROM stock_batches sb
      JOIN products p ON p.id = sb.product_id
      WHERE ${dcRaw.where.replace(/created_at/g, 'sb.created_at')}
      GROUP BY sb.product_id, p.product_name
      ORDER BY total_investment DESC
    `, dcRaw.params);

    const stockInTotal = stockInData.reduce((s, r) => s + parseFloat(r.total_investment), 0);

    // ─── 9. COMPANY INFO ─────────────────────────────────
    const [company] = await pool.query('SELECT * FROM company_config LIMIT 1');

    res.json({
      success: true,
      data: {
        period: { type: type || 'daily', label: dc.label },
        company: company[0] || {},
        sales_summary: salesSummary[0],
        payment_breakdown: paymentBreakdown,
        product_wise: productWise,
        profit_loss: profitData,
        stock_report: stockReport,
        stock_totals: stockTotals,
        credit_parties: creditParties,
        credit_totals: creditTotals,
        payments_received: paymentsReceived[0],
        stock_in: stockInData,
        stock_in_total: stockInTotal,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

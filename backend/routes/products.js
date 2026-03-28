const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { outletScope } = require('../middleware/outletScope');
const router = express.Router();

// GET all products with outlet-scoped stock totals
router.get('/', authenticateToken, outletScope, async (req, res) => {
  try {
    const { search, brand, category } = req.query;
    const oid = req.getOutletId();

    // Build stock JOIN with optional outlet filter
    const stockFilter = oid ? 'AND sb.outlet_id = ?' : '';
    const stockParams = oid ? [oid] : [];

    let query = `
      SELECT p.*, 
        COALESCE(SUM(sb.quantity_remaining), 0) as total_stock,
        COUNT(sb.id) as batch_count
      FROM products p
      LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.quantity_remaining > 0 ${stockFilter}
      WHERE p.is_active = 1
    `;
    const params = [...stockParams];

    if (search) {
      query += ' AND (p.product_name LIKE ? OR p.brand LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR p.model LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (brand) { query += ' AND p.brand = ?'; params.push(brand); }
    if (category) { query += ' AND p.category = ?'; params.push(category); }
    query += ' GROUP BY p.id ORDER BY p.product_name';

    const [products] = await pool.query(query, params);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET categories list
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const [cats] = await pool.query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' AND is_active = 1 ORDER BY category");
    res.json({ success: true, data: cats.map(c => c.category) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET brands list
router.get('/brands', authenticateToken, async (req, res) => {
  try {
    const [brands] = await pool.query("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' AND is_active = 1 ORDER BY brand");
    res.json({ success: true, data: brands.map(b => b.brand) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /products/:id/serial-numbers (outlet-scoped)
router.get('/:id/serial-numbers', authenticateToken, outletScope, async (req, res) => {
  try {
    const oid = req.getOutletId();
    let query = `SELECT sn.id, sn.product_id, sn.batch_id, sn.serial_number, sn.status 
       FROM serial_numbers sn
       JOIN stock_batches sb ON sb.id = sn.batch_id
       WHERE sn.product_id = ? AND sn.status = 'in_stock'`;
    const params = [req.params.id];
    if (oid) { query += ' AND sb.outlet_id = ?'; params.push(oid); }
    query += ' ORDER BY sn.created_at DESC';
    const [serials] = await pool.query(query, params);
    res.json({ success: true, data: serials });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET single product
router.get('/:id', authenticateToken, outletScope, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!products.length) return res.status(404).json({ success: false, message: 'Product not found' });
    const oid = req.getOutletId();
    let batchQuery = 'SELECT * FROM stock_batches WHERE product_id = ?';
    const batchParams = [req.params.id];
    if (oid) { batchQuery += ' AND outlet_id = ?'; batchParams.push(oid); }
    batchQuery += ' ORDER BY created_at ASC';
    const [batches] = await pool.query(batchQuery, batchParams);
    res.json({ success: true, data: { ...products[0], batches } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST create product
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_name, brand, model, category, subcategory, sku, size, color, material,
            unit, custom_unit, voltage, capacity, warranty_months, sale_price, vat_percentage,
            barcode, description, has_serial_number } = req.body;
    if (!product_name) return res.status(400).json({ success: false, message: 'Product name is required' });
    const finalUnit = unit === 'custom' ? (custom_unit || 'pcs') : (unit || 'pcs');
    const [result] = await pool.query(`
      INSERT INTO products (product_name, brand, model, category, subcategory, sku, size, color, material,
        unit, custom_unit, voltage, capacity, warranty_months, sale_price, vat_percentage, barcode, description, has_serial_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [product_name, brand, model, category, subcategory, sku, size, color, material,
        finalUnit, custom_unit, voltage, capacity, warranty_months || 0, sale_price || 0,
        vat_percentage || 0, barcode, description, has_serial_number || 0]);
    res.json({ success: true, message: 'Product created', id: result.insertId });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// PUT update product
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { product_name, brand, model, category, subcategory, sku, size, color, material,
            unit, custom_unit, voltage, capacity, warranty_months, sale_price, vat_percentage,
            barcode, description, has_serial_number } = req.body;
    const finalUnit = unit === 'custom' ? (custom_unit || 'pcs') : (unit || 'pcs');
    await pool.query(`
      UPDATE products SET product_name=?, brand=?, model=?, category=?, subcategory=?, sku=?, size=?, color=?, material=?,
        unit=?, custom_unit=?, voltage=?, capacity=?, warranty_months=?, sale_price=?, vat_percentage=?,
        barcode=?, description=?, has_serial_number=? WHERE id=?
    `, [product_name, brand, model, category, subcategory, sku, size, color, material,
        finalUnit, custom_unit, voltage, capacity, warranty_months || 0, sale_price || 0,
        vat_percentage || 0, barcode, description, has_serial_number || 0, req.params.id]);
    res.json({ success: true, message: 'Product updated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// DELETE product (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

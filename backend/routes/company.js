const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// GET company config
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM company_config LIMIT 1');
    if (!rows.length) {
      await pool.query("INSERT INTO company_config (shop_name) VALUES ('My Business')");
      const [newRows] = await pool.query('SELECT * FROM company_config LIMIT 1');
      return res.json({ success: true, data: newRows[0] });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('GET config error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update — updates each field one by one, skips any that fail
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Ensure row exists
    const [check] = await pool.query('SELECT id FROM company_config LIMIT 1');
    let rowId;
    if (!check.length) {
      const [ins] = await pool.query("INSERT INTO company_config (shop_name) VALUES ('My Business')");
      rowId = ins.insertId;
    } else {
      rowId = check[0].id;
    }

    // Fields to save (only simple string/number values, skip objects/arrays/huge base64)
    const updates = {};
    const errors = [];

    for (const [key, val] of Object.entries(req.body)) {
      // Skip internal fields
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
      // Skip objects/arrays
      if (val !== null && typeof val === 'object') continue;
      // Skip huge base64 (use /upload endpoint instead)
      if (typeof val === 'string' && val.length > 60000) continue;

      updates[key] = val;
    }

    // Update each field individually — if column doesn't exist, skip it
    for (const [field, val] of Object.entries(updates)) {
      try {
        let finalVal = val;
        // Type fixes
        if (field === 'vat_percentage') finalVal = parseFloat(finalVal) || 0;
        if (field === 'show_invoice_logo') finalVal = finalVal ? 1 : 0;
        if (field === 'invoice_logo_width') finalVal = parseInt(finalVal) || 120;
        if (field === 'invoice_logo_height') finalVal = parseInt(finalVal) || 60;
        if (finalVal === '' || finalVal === undefined) finalVal = null;

        await pool.query(`UPDATE company_config SET \`${field}\` = ? WHERE id = ?`, [finalVal, rowId]);
      } catch (e) {
        // Column doesn't exist or other error — skip silently
        errors.push(`${field}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      console.log('Config save - some fields skipped:', errors);
    }

    const [updated] = await pool.query('SELECT * FROM company_config LIMIT 1');
    res.json({ success: true, message: 'Configuration saved', data: updated[0] });
  } catch (error) {
    console.error('PUT config error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST upload base64 image
router.post('/upload', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { field, data } = req.body;
    if (!field || !data) return res.status(400).json({ success: false, message: 'field and data required' });

    const [check] = await pool.query('SELECT id FROM company_config LIMIT 1');
    if (!check.length) return res.status(400).json({ success: false, message: 'No config row' });

    // Try to expand column to LONGTEXT first
    try { await pool.query(`ALTER TABLE company_config MODIFY COLUMN \`${field}\` LONGTEXT`); } catch (e) { /* already longtext or column missing */ }

    await pool.query(`UPDATE company_config SET \`${field}\` = ? WHERE id = ?`, [data, check[0].id]);
    res.json({ success: true, message: 'Uploaded' });
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
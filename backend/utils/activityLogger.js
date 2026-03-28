// backend/utils/activityLogger.js
// Usage: await logActivity(req, 'sale_created', 'sale', saleId, 'Created sale INV-001', { total: 5000 });

const { pool } = require('../config/db');

async function logActivity(req, action, entityType, entityId, description, metadata) {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? req.user.name : null;
    const outletId = req.outletId || req.getOutletId ? req.getOutletId() : null;
    const outletName = req.outletName || null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;

    await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, outlet_id, outlet_name, action, entity_type, entity_id, description, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, outletId, outletName, action, entityType || null, entityId || null,
       description || null, metadata ? JSON.stringify(metadata) : null, ip]
    );
  } catch (err) {
    // Never fail the main request because of logging
    console.log('Activity log skipped:', err.message);
  }
}

module.exports = { logActivity };

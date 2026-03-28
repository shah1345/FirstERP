const { pool } = require('../config/db');

// Get user's outlet (returns null for admin/warehouse)
async function getUserOutlet(userId) {
  const [rows] = await pool.query(
    'SELECT ou.outlet_id, ou.role as outlet_role, o.name as outlet_name, o.code as outlet_code FROM outlet_users ou JOIN outlets o ON o.id = ou.outlet_id WHERE ou.user_id = ? AND ou.is_active = 1 LIMIT 1',
    [userId]
  );
  return rows.length ? rows[0] : null;
}

// Middleware: attach outlet info to request
async function attachOutlet(req, res, next) {
  if (!req.user) return next();
  try {
    const outlet = await getUserOutlet(req.user.id);
    req.outlet = outlet; // null = warehouse admin (sees all)
    req.isWarehouseAdmin = req.user.role === 'admin' && !outlet;
  } catch (e) {
    req.outlet = null;
    req.isWarehouseAdmin = req.user.role === 'admin';
  }
  next();
}

// Check if user can delete (within 6hrs or admin)
function canDelete(createdAt, userRole, isWarehouseAdmin) {
  if (isWarehouseAdmin || userRole === 'admin') return { allowed: true };
  const created = new Date(createdAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  if (hoursDiff <= 6) return { allowed: true };
  return { allowed: false, reason: 'Delete window expired (6 hours). Request sent to admin for approval.' };
}

module.exports = { getUserOutlet, attachOutlet, canDelete };

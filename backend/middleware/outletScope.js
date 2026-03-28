// backend/middleware/outletScope.js
// Admin sees ALL data. Outlet user sees only their outlet.
// Admin can optionally view a specific outlet via ?outlet_id=X query param (NOT header).

const { pool } = require('../config/db');

async function outletScope(req, res, next) {
  if (!req.user) return next();

  try {
    // Check if user is assigned to an outlet
    const [rows] = await pool.query(
      `SELECT ou.outlet_id, ou.role as outlet_role, o.name as outlet_name, o.code as outlet_code 
       FROM outlet_users ou JOIN outlets o ON o.id = ou.outlet_id 
       WHERE ou.user_id = ? AND ou.is_active = 1 LIMIT 1`,
      [req.user.id]
    );

    if (rows.length && req.user.role !== 'admin') {
      // Non-admin outlet user: locked to their outlet
      req.outletId = rows[0].outlet_id;
      req.outletRole = rows[0].outlet_role;
      req.outletName = rows[0].outlet_name;
      req.outletCode = rows[0].outlet_code;
      req.isOutletUser = true;
      req.isWarehouseAdmin = false;
    } else {
      // Admin or unassigned user: sees everything
      req.outletId = null;
      req.isOutletUser = false;
      req.isWarehouseAdmin = req.user.role === 'admin';
    }
  } catch (e) {
    // If outlets table doesn't exist yet, treat as no outlet
    req.outletId = null;
    req.isOutletUser = false;
    req.isWarehouseAdmin = req.user.role === 'admin';
  }

  // Helper: get the outlet filter ID
  // Admin = null (sees all). Outlet user = their outlet ID.
  req.getOutletId = () => {
    if (req.isOutletUser) return req.outletId;
    return null; // admin always sees ALL
  };

  // Helper: build WHERE clause
  req.outletWhere = (alias) => {
    const oid = req.getOutletId();
    const prefix = alias ? `${alias}.` : '';
    if (oid) return { sql: ` AND ${prefix}outlet_id = ?`, params: [oid] };
    return { sql: '', params: [] };
  };

  // Helper: 6hr delete window
  req.canDelete = (createdAt) => {
    if (req.isWarehouseAdmin || req.user.role === 'admin') return { allowed: true };
    const created = new Date(createdAt);
    const hours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    if (hours <= 6) return { allowed: true };
    return { allowed: false, reason: 'Delete window expired (6 hours). Request sent to admin.' };
  };

  next();
}

module.exports = { outletScope };
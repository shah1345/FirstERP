// backend/middleware/tenantScope.js
// Attaches tenant context to every request
// Super admin: no tenant filter (sees all) or can switch tenants
// Regular users: always scoped to their tenant_id

const { pool } = require('../config/db');

function tenantScope(req, res, next) {
  try {
    // Super admin can access any tenant via header or query
    if (req.user && req.user.is_super_admin) {
      const targetTenant = req.headers['x-tenant-id'] || req.query.tenant_id || req.body?.tenant_id;
      req.tenantId = targetTenant ? parseInt(targetTenant) : null;
      req.isSuperAdmin = true;

      // Helper: returns tenant WHERE clause
      req.tenantWhere = (alias) => {
        if (!req.tenantId) return { sql: '', params: [] }; // super admin sees all
        const prefix = alias ? `${alias}.` : '';
        return { sql: ` AND ${prefix}tenant_id = ?`, params: [req.tenantId] };
      };

      // Helper: returns tenant_id for INSERT
      req.getTenantId = () => req.tenantId;

      return next();
    }

    // Regular user: must have tenant_id
    if (!req.user || !req.user.tenant_id) {
      return res.status(403).json({ success: false, message: 'No tenant access' });
    }

    req.tenantId = req.user.tenant_id;
    req.isSuperAdmin = false;

    // Helper: returns tenant WHERE clause (always filtered)
    req.tenantWhere = (alias) => {
      const prefix = alias ? `${alias}.` : '';
      return { sql: ` AND ${prefix}tenant_id = ?`, params: [req.tenantId] };
    };

    // Helper: returns tenant_id for INSERT
    req.getTenantId = () => req.tenantId;

    next();
  } catch (err) {
    console.error('Tenant scope error:', err);
    next();
  }
}

module.exports = { tenantScope };

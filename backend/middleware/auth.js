// backend/middleware/auth.js
// Combined auth + tenant scope — every route gets tenant helpers automatically

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'smarterp-secret-key-change-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // ─── TENANT SCOPE ───
    if (decoded.is_super_admin) {
      const targetTenant = req.headers['x-tenant-id'] || req.query.tenant_id;
      req.tenantId = targetTenant ? parseInt(targetTenant) : null;
      req.isSuperAdmin = true;
    } else {
      req.tenantId = decoded.tenant_id || null;
      req.isSuperAdmin = false;
    }

    // Helper: { sql: ' AND alias.tenant_id = ?', params: [id] }
    req.tenantWhere = (alias) => {
      if (!req.tenantId) return { sql: '', params: [] };
      const prefix = alias ? `${alias}.` : '';
      return { sql: ` AND ${prefix}tenant_id = ?`, params: [req.tenantId] };
    };

    req.getTenantId = () => req.tenantId;

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (req.user.is_super_admin) return next();
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id || null, is_super_admin: user.is_super_admin ? true : false },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin, generateToken, JWT_SECRET };
// backend/routes/superAdmin.js
// Super Admin routes — manage tenants, stats, config, module permissions

const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// All available modules
const ALL_MODULES = [
  'dashboard','pos','products','stock','stock_adjust','customers','returns','replacements',
  'sales','sales_history','collect_due','finance','bank_deposit','reports','statement',
  'accounts','production','warehouse','vendors','employees','attendance','payroll','config','logs'
];

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
}

router.use(authenticateToken, requireSuperAdmin);

// ─── GET /api/super/modules ──────────────────────────────────
router.get('/modules', (req, res) => {
  res.json({ success: true, data: ALL_MODULES });
});

// ─── GET /api/super/dashboard ────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const [tenants] = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    const tenantStats = [];

    for (const t of tenants) {
      const [users] = await pool.query('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [t.id]);
      const [products] = await pool.query('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [t.id]);
      const [sales] = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as total FROM sales WHERE tenant_id = ? AND status = "active"', [t.id]);
      const [outlets] = await pool.query('SELECT COUNT(*) as count FROM outlets WHERE tenant_id = ?', [t.id]);
      const [customers] = await pool.query('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?', [t.id]);

      let totalRows = 0;
      const tables = ['products', 'sales', 'sale_items', 'stock_batches', 'customers', 'employees', 'bank_deposits', 'transactions'];
      for (const table of tables) {
        try {
          const [r] = await pool.query(`SELECT COUNT(*) as c FROM \`${table}\` WHERE tenant_id = ?`, [t.id]);
          totalRows += r[0].c;
        } catch (e) {}
      }

      let allowedModules = ALL_MODULES;
      try { if (t.allowed_modules) allowedModules = JSON.parse(t.allowed_modules); } catch (e) {}

      tenantStats.push({
        ...t,
        allowed_modules: allowedModules,
        total_users: users[0].count,
        total_products: products[0].count,
        total_sales: sales[0].count,
        total_revenue: parseFloat(sales[0].total),
        total_outlets: outlets[0].count,
        total_customers: customers[0].count,
        total_rows: totalRows,
        storage_estimate_mb: Math.round(totalRows * 0.002 * 100) / 100,
      });
    }

    const [totalUsers] = await pool.query('SELECT COUNT(*) as c FROM users WHERE is_super_admin = 0');
    const [totalTenants] = await pool.query('SELECT COUNT(*) as c FROM tenants');
    const [activeTenants] = await pool.query("SELECT COUNT(*) as c FROM tenants WHERE status = 'active'");
    const [totalSalesGlobal] = await pool.query("SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as total FROM sales WHERE status = 'active'");

    res.json({
      success: true,
      data: {
        global: {
          total_tenants: totalTenants[0].c,
          active_tenants: activeTenants[0].c,
          total_users: totalUsers[0].c,
          total_sales: totalSalesGlobal[0].c,
          total_revenue: parseFloat(totalSalesGlobal[0].total),
        },
        tenants: tenantStats,
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/super/tenants — create new tenant ─────────────
router.post('/tenants', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, slug, owner_name, owner_email, owner_phone, plan, max_users, max_outlets, max_products, admin_password, monthly_price, setup_fee, per_outlet_fee, allowed_modules } = req.body;

    if (!name || !slug || !owner_email) {
      return res.status(400).json({ success: false, message: 'Name, slug, and owner email are required' });
    }

    const [existing] = await conn.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Slug already exists' });
    }

    const modules = Array.isArray(allowed_modules) && allowed_modules.length > 0
      ? JSON.stringify(allowed_modules)
      : JSON.stringify(ALL_MODULES);

    const [tenantResult] = await conn.query(
      `INSERT INTO tenants (name, slug, owner_name, owner_email, owner_phone, plan, max_users, max_outlets, max_products, monthly_price, setup_fee, per_outlet_fee, allowed_modules, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [name, slug, owner_name || name, owner_email, owner_phone || '', plan || 'trial',
       max_users || 5, max_outlets || 1, max_products || 500,
       monthly_price || 0, setup_fee || 0, per_outlet_fee || 0, modules]
    );
    const tenantId = tenantResult.insertId;

    const hashedPassword = await bcrypt.hash(admin_password || 'admin123', 10);
    await conn.query(
      `INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, 'admin', ?)`,
      [owner_name || 'Admin', owner_email, hashedPassword, tenantId]
    );

    await conn.query(
      `INSERT INTO company_config (shop_name, app_name, app_icon, tenant_id) VALUES (?, 'SmartERP', '⚡', ?)`,
      [name, tenantId]
    );

    await conn.query(
      `INSERT INTO outlets (name, code, status, tenant_id) VALUES (?, 'WAREHOUSE', 'active', ?)`,
      [name + ' Warehouse', tenantId]
    );

    await conn.commit();
    res.json({ success: true, message: 'Business created successfully', data: { tenant_id: tenantId, slug } });
  } catch (error) {
    await conn.rollback();
    console.error('Create tenant error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ─── GET /api/super/tenants/:id — tenant detail ─────────────
router.get('/tenants/:id', async (req, res) => {
  try {
    const [tenants] = await pool.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenants.length) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const tenant = tenants[0];

    try { tenant.allowed_modules = tenant.allowed_modules ? JSON.parse(tenant.allowed_modules) : ALL_MODULES; } catch (e) { tenant.allowed_modules = ALL_MODULES; }

    const [config] = await pool.query('SELECT * FROM company_config WHERE tenant_id = ? LIMIT 1', [tenant.id]);
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE tenant_id = ?', [tenant.id]);
    const [outlets] = await pool.query('SELECT * FROM outlets WHERE tenant_id = ?', [tenant.id]);
    const [products] = await pool.query('SELECT COUNT(*) as c FROM products WHERE tenant_id = ?', [tenant.id]);
    const [sales] = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as total FROM sales WHERE tenant_id = ? AND status = "active"', [tenant.id]);
    const [customers] = await pool.query('SELECT COUNT(*) as c FROM customers WHERE tenant_id = ?', [tenant.id]);

    res.json({
      success: true,
      data: {
        tenant,
        config: config[0] || null,
        users, outlets,
        stats: {
          total_products: products[0].c,
          total_sales: sales[0].c,
          total_revenue: parseFloat(sales[0].total),
          total_customers: customers[0].c,
          total_users: users.length,
          total_outlets: outlets.length,
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/super/tenants/:id — update tenant ─────────────
router.put('/tenants/:id', async (req, res) => {
  try {
    const { name, plan, status, max_users, max_outlets, max_products, plan_start, plan_end, notes, owner_name, owner_email, owner_phone, monthly_price, setup_fee, per_outlet_fee, allowed_modules } = req.body;
    const id = req.params.id;
    const modules = Array.isArray(allowed_modules) ? JSON.stringify(allowed_modules) : null;

    await pool.query(
      `UPDATE tenants SET name=?, plan=?, status=?, max_users=?, max_outlets=?, max_products=?,
       plan_start=?, plan_end=?, notes=?, owner_name=?, owner_email=?, owner_phone=?,
       monthly_price=?, setup_fee=?, per_outlet_fee=?${modules !== null ? ', allowed_modules=?' : ''} WHERE id=?`,
      modules !== null
        ? [name, plan, status, max_users, max_outlets, max_products, plan_start || null, plan_end || null, notes || null, owner_name, owner_email, owner_phone, monthly_price || 0, setup_fee || 0, per_outlet_fee || 0, modules, id]
        : [name, plan, status, max_users, max_outlets, max_products, plan_start || null, plan_end || null, notes || null, owner_name, owner_email, owner_phone, monthly_price || 0, setup_fee || 0, per_outlet_fee || 0, id]
    );
    res.json({ success: true, message: 'Tenant updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/super/tenants/:id/modules — update modules ────
router.put('/tenants/:id/modules', async (req, res) => {
  try {
    const { allowed_modules } = req.body;
    if (!Array.isArray(allowed_modules)) {
      return res.status(400).json({ success: false, message: 'allowed_modules must be an array' });
    }
    await pool.query('UPDATE tenants SET allowed_modules = ? WHERE id = ?', [JSON.stringify(allowed_modules), req.params.id]);
    res.json({ success: true, message: 'Modules updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/super/tenants/:id/status ───────────────────────
router.put('/tenants/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'trial', 'expired'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await pool.query('UPDATE tenants SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Tenant ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/super/tenants/:id/reset ───────────────────────
router.post('/tenants/:id/reset', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tid = req.params.id;
    const resetTables = req.body.tables || [
      'activity_logs', 'bank_deposits', 'transactions',
      'customer_payments', 'serial_numbers', 'sale_items', 'sales',
      'stock_movements', 'stock_batches', 'returns', 'replacements',
    ];
    for (const table of resetTables) {
      try { await conn.query(`DELETE FROM \`${table}\` WHERE tenant_id = ?`, [tid]); } catch (e) {}
    }
    await conn.commit();
    res.json({ success: true, message: `Data reset for tenant #${tid}. ${resetTables.length} tables cleared.` });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ─── DELETE /api/super/tenants/:id ───────────────────────────
router.delete('/tenants/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tid = req.params.id;
    const [t] = await conn.query('SELECT slug FROM tenants WHERE id = ?', [tid]);
    if (t.length && t[0].slug === 'default') {
      return res.status(400).json({ success: false, message: 'Cannot delete default tenant' });
    }
    const allTables = [
      'activity_logs', 'bank_deposits', 'transactions', 'customer_payments',
      'serial_numbers', 'sale_items', 'sales', 'stock_movements', 'stock_batches',
      'returns', 'replacements', 'bank_accounts', 'customers', 'employees',
      'products', 'outlets', 'company_config', 'users'
    ];
    for (const table of allTables) {
      try { await conn.query(`DELETE FROM \`${table}\` WHERE tenant_id = ?`, [tid]); } catch (e) {}
    }
    await conn.query('DELETE FROM tenants WHERE id = ?', [tid]);
    await conn.commit();
    res.json({ success: true, message: 'Tenant deleted permanently' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ─── Tenant Users ────────────────────────────────────────────
router.get('/tenants/:id/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE tenant_id = ?', [req.params.id]);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tenants/:id/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password || 'user123', 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'user', req.params.id]
    );
    res.json({ success: true, message: 'User created', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

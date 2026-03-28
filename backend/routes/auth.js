// backend/routes/auth.js
// Updated for multi-tenancy: login includes tenant_id, super admin support

const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { authenticateToken, generateToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const [users] = await pool.query(
      'SELECT u.*, t.name as tenant_name, t.status as tenant_status, t.allowed_modules as tenant_modules FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?',
      [email]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check tenant status (not for super admin)
    if (!user.is_super_admin && user.tenant_id) {
      if (user.tenant_status === 'suspended') {
        return res.status(403).json({ success: false, message: 'This business account is suspended. Contact super admin.' });
      }
      if (user.tenant_status === 'expired') {
        return res.status(403).json({ success: false, message: 'This business subscription has expired. Contact super admin.' });
      }
    }

    const token = generateToken(user);

    // Parse allowed_modules
    let allowedModules = null;
    if (!user.is_super_admin && user.tenant_modules) {
      try { allowedModules = JSON.parse(user.tenant_modules); } catch (e) { }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        is_super_admin: user.is_super_admin ? true : false,
        tenant_name: user.tenant_name || null,
        allowed_modules: allowedModules,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// GET /api/auth/me — get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.is_super_admin, t.name as tenant_name, t.status as tenant_status, t.allowed_modules as tenant_modules FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.id = ?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    let allowedModules = null;
    if (!user.is_super_admin && user.tenant_modules) {
      try { allowedModules = JSON.parse(user.tenant_modules); } catch (e) { }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        is_super_admin: user.is_super_admin ? true : false,
        tenant_name: user.tenant_name || null,
        allowed_modules: allowedModules,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(current_password, users[0].password);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/users — list users (admin: own tenant, super admin: all or specific tenant)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT id, name, email, role, tenant_id, is_super_admin, created_at FROM users';
    const params = [];

    if (req.user.is_super_admin) {
      // Super admin can filter by tenant
      if (req.query.tenant_id) {
        query += ' WHERE tenant_id = ?';
        params.push(req.query.tenant_id);
      }
    } else {
      // Regular admin: only own tenant
      query += ' WHERE tenant_id = ?';
      params.push(req.user.tenant_id);
    }

    query += ' ORDER BY created_at DESC';
    const [users] = await pool.query(query, params);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/users — create user
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Determine tenant_id
    let tenantId = req.user.tenant_id;
    if (req.user.is_super_admin && req.body.tenant_id) {
      tenantId = req.body.tenant_id;
    }

    const hashed = await bcrypt.hash(password || 'user123', 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, tenant_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, role || 'user', tenantId]
    );

    res.json({ success: true, message: 'User created', data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
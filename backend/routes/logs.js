const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/logs — list logs with filters
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id, outlet_id, action, entity_type, start_date, end_date, search, limit } = req.query;
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (outlet_id) { query += ' AND outlet_id = ?'; params.push(outlet_id); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
    if (start_date) { query += ' AND DATE(created_at) >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND DATE(created_at) <= ?'; params.push(end_date); }
    if (search) {
      query += ' AND (description LIKE ? OR user_name LIKE ? OR outlet_name LIKE ? OR action LIKE ?)';
      const s = `%${search}%`; params.push(s, s, s, s);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit) || 500);

    const [logs] = await pool.query(query, params);
    res.json({ success: true, data: logs });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/logs/summary — log stats
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [today] = await pool.query("SELECT COUNT(*) as count FROM activity_logs WHERE DATE(created_at) = CURDATE()");
    const [actions] = await pool.query(`
      SELECT action, COUNT(*) as count FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY action ORDER BY count DESC LIMIT 20
    `);
    const [users] = await pool.query(`
      SELECT user_id, user_name, COUNT(*) as count FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND user_id IS NOT NULL
      GROUP BY user_id, user_name ORDER BY count DESC LIMIT 15
    `);
    const [outlets] = await pool.query(`
      SELECT outlet_id, outlet_name, COUNT(*) as count FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND outlet_id IS NOT NULL
      GROUP BY outlet_id, outlet_name ORDER BY count DESC LIMIT 10
    `);

    res.json({ success: true, data: { today: today[0].count, actions, users, outlets } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/logs/actions — distinct action types for filter dropdown
router.get('/actions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [actions] = await pool.query('SELECT DISTINCT action FROM activity_logs ORDER BY action');
    res.json({ success: true, data: actions.map(a => a.action) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/logs/users — distinct users for filter dropdown
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT DISTINCT user_id, user_name FROM activity_logs WHERE user_id IS NOT NULL ORDER BY user_name');
    res.json({ success: true, data: users });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

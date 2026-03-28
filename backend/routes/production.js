const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);

// ══════════════════════════════════════════════════════════
// PIPELINES (Templates)
// ══════════════════════════════════════════════════════════

router.get('/pipelines', async (req, res) => {
  try {
    const [pipelines] = await pool.query(`
      SELECT pp.*, p.product_name as final_product_name,
        (SELECT COUNT(*) FROM pipeline_stages WHERE pipeline_id = pp.id) as stage_count,
        (SELECT COUNT(*) FROM production_orders WHERE pipeline_id = pp.id AND status != 'cancelled') as order_count
      FROM production_pipelines pp
      LEFT JOIN products p ON p.id = pp.final_product_id
      WHERE pp.is_active = 1 ORDER BY pp.name
    `);
    res.json({ success: true, data: pipelines });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/pipelines/:id', async (req, res) => {
  try {
    const [pipelines] = await pool.query(`SELECT pp.*, p.product_name as final_product_name FROM production_pipelines pp LEFT JOIN products p ON p.id = pp.final_product_id WHERE pp.id = ?`, [req.params.id]);
    if (!pipelines.length) return res.status(404).json({ success: false, message: 'Not found' });
    const [stages] = await pool.query(`
      SELECT ps.*, p.product_name as output_product_name
      FROM pipeline_stages ps LEFT JOIN products p ON p.id = ps.output_product_id
      WHERE ps.pipeline_id = ? ORDER BY ps.stage_order
    `, [req.params.id]);
    res.json({ success: true, data: { ...pipelines[0], stages } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post('/pipelines', requireAdmin, async (req, res) => {
  try {
    const { name, description, final_product_id, default_quantity, stages } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Pipeline name required' });
    const [result] = await pool.query(
      'INSERT INTO production_pipelines (name, description, final_product_id, default_quantity, created_by) VALUES (?,?,?,?,?)',
      [name, description, final_product_id || null, default_quantity || 1, req.user.id]
    );
    const pipelineId = result.insertId;
    if (stages && stages.length) {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await pool.query(
          'INSERT INTO pipeline_stages (pipeline_id, stage_order, name, description, default_days, default_cost, default_quantity, output_product_id, output_quantity) VALUES (?,?,?,?,?,?,?,?,?)',
          [pipelineId, i + 1, s.name, s.description, s.default_days || 1, s.default_cost || 0, s.default_quantity || null, s.output_product_id || null, s.output_quantity || null]
        );
      }
    }
    res.json({ success: true, message: 'Pipeline created', id: pipelineId });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.put('/pipelines/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, final_product_id, default_quantity, stages } = req.body;
    await pool.query('UPDATE production_pipelines SET name=?, description=?, final_product_id=?, default_quantity=? WHERE id=?',
      [name, description, final_product_id || null, default_quantity || 1, req.params.id]);
    if (stages) {
      await pool.query('DELETE FROM pipeline_stages WHERE pipeline_id = ?', [req.params.id]);
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        await pool.query(
          'INSERT INTO pipeline_stages (pipeline_id, stage_order, name, description, default_days, default_cost, default_quantity, output_product_id, output_quantity) VALUES (?,?,?,?,?,?,?,?,?)',
          [req.params.id, i + 1, s.name, s.description, s.default_days || 1, s.default_cost || 0, s.default_quantity || null, s.output_product_id || null, s.output_quantity || null]
        );
      }
    }
    res.json({ success: true, message: 'Pipeline updated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/pipelines/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE production_pipelines SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Pipeline deactivated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ══════════════════════════════════════════════════════════
// PRODUCTION ORDERS
// ══════════════════════════════════════════════════════════

router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT po.*, p.product_name as final_product_name,
        (SELECT name FROM production_order_stages WHERE order_id = po.id AND status = 'in_progress' LIMIT 1) as active_stage_name,
        (SELECT due_at FROM production_order_stages WHERE order_id = po.id AND status = 'in_progress' LIMIT 1) as active_stage_due
      FROM production_orders po
      LEFT JOIN products p ON p.id = po.final_product_id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND po.status = ?'; params.push(status); }
    query += ' ORDER BY po.created_at DESC';
    const [orders] = await pool.query(query, params);
    res.json({ success: true, data: orders });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT po.*, p.product_name as final_product_name, p.sale_price as final_sale_price
      FROM production_orders po LEFT JOIN products p ON p.id = po.final_product_id WHERE po.id = ?
    `, [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Not found' });
    const [stages] = await pool.query(`
      SELECT pos.*, p.product_name as output_product_name
      FROM production_order_stages pos LEFT JOIN products p ON p.id = pos.output_product_id
      WHERE pos.order_id = ? ORDER BY pos.stage_order
    `, [req.params.id]);
    const [costs] = await pool.query('SELECT * FROM production_additional_costs WHERE order_id = ? ORDER BY id', [req.params.id]);
    res.json({ success: true, data: { ...orders[0], stages, additional_costs: costs } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST — Create production order from pipeline
router.post('/orders', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { pipeline_id, quantity, notes } = req.body;
    if (!pipeline_id) return res.status(400).json({ success: false, message: 'Pipeline required' });

    const [pipelines] = await conn.query('SELECT * FROM production_pipelines WHERE id = ? AND is_active = 1', [pipeline_id]);
    if (!pipelines.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Pipeline not found' }); }
    const pipeline = pipelines[0];

    const [stages] = await conn.query('SELECT * FROM pipeline_stages WHERE pipeline_id = ? ORDER BY stage_order', [pipeline_id]);
    if (!stages.length) { await conn.rollback(); return res.status(400).json({ success: false, message: 'Pipeline has no stages' }); }

    const orderNum = `PRD-${Date.now().toString().slice(-8)}`;
    const qty = quantity || pipeline.default_quantity;

    const [result] = await conn.query(
      `INSERT INTO production_orders (order_number, pipeline_id, pipeline_name, final_product_id, quantity, status, current_stage, total_stages, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      [orderNum, pipeline_id, pipeline.name, pipeline.final_product_id, qty, stages.length, notes, req.user.id]
    );
    const orderId = result.insertId;

    for (const s of stages) {
      await conn.query(
        `INSERT INTO production_order_stages (order_id, stage_id, stage_order, name, quantity, estimated_days, estimated_cost, output_product_id, output_quantity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [orderId, s.id, s.stage_order, s.name, s.default_quantity || qty, s.default_days, s.default_cost, s.output_product_id, s.output_quantity]
      );
    }

    await conn.commit();
    res.json({ success: true, message: `Production order ${orderNum} created`, id: orderId, order_number: orderNum });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// STAGE PROGRESSION
// ══════════════════════════════════════════════════════════

// POST — Start a stage
router.post('/orders/:orderId/stages/:stageId/start', async (req, res) => {
  try {
    const { days, cost, quantity } = req.body;
    const [stage] = await pool.query('SELECT * FROM production_order_stages WHERE id = ? AND order_id = ?', [req.params.stageId, req.params.orderId]);
    if (!stage.length) return res.status(404).json({ success: false, message: 'Stage not found' });
    if (stage[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Stage already started or completed' });

    const estDays = days || stage[0].estimated_days;
    const dueAt = new Date(); dueAt.setDate(dueAt.getDate() + estDays);

    await pool.query(
      `UPDATE production_order_stages SET status = 'in_progress', started_at = NOW(), estimated_days = ?, estimated_cost = ?, quantity = ?, due_at = ? WHERE id = ?`,
      [estDays, cost || stage[0].estimated_cost, quantity || stage[0].quantity, dueAt, req.params.stageId]
    );
    await pool.query("UPDATE production_orders SET status = 'in_progress', current_stage = ?, started_at = COALESCE(started_at, NOW()) WHERE id = ?",
      [stage[0].stage_order, req.params.orderId]);

    res.json({ success: true, message: `Stage "${stage[0].name}" started. Due: ${dueAt.toLocaleDateString()}`, due_at: dueAt });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST — Complete a stage
router.post('/orders/:orderId/stages/:stageId/complete', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { actual_cost, actual_days, notes } = req.body;

    const [stage] = await conn.query('SELECT * FROM production_order_stages WHERE id = ? AND order_id = ?', [req.params.stageId, req.params.orderId]);
    if (!stage.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Stage not found' }); }
    if (stage[0].status !== 'in_progress') { await conn.rollback(); return res.status(400).json({ success: false, message: 'Stage not in progress' }); }

    const s = stage[0];
    const finalCost = actual_cost !== undefined ? parseFloat(actual_cost) : parseFloat(s.estimated_cost);
    const startedAt = new Date(s.started_at);
    const daysTaken = actual_days || Math.max(1, Math.ceil((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)));

    await conn.query(
      `UPDATE production_order_stages SET status = 'completed', completed_at = NOW(), actual_cost = ?, actual_days = ?, notes = ? WHERE id = ?`,
      [finalCost, daysTaken, notes || s.notes, req.params.stageId]
    );

    // If this stage outputs a product → add to stock
    if (s.output_product_id && s.output_quantity > 0 && !s.output_added_to_stock) {
      const [order] = await conn.query('SELECT order_number FROM production_orders WHERE id = ?', [req.params.orderId]);
      await conn.query(
        `INSERT INTO stock_batches (product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining, supplier_name, notes)
         VALUES (?, ?, 0, NULL, ?, ?, 'Production', ?)`,
        [s.output_product_id, `PRD-STG-${order[0].order_number}-S${s.stage_order}`, s.output_quantity, s.output_quantity,
         `Production stage output: ${s.name}`]
      );
      await conn.query('UPDATE production_order_stages SET output_added_to_stock = 1 WHERE id = ?', [req.params.stageId]);
    }

    // Update order totals
    const [allStages] = await conn.query(
      "SELECT COALESCE(SUM(actual_cost),0) as total_cost FROM production_order_stages WHERE order_id = ? AND status = 'completed'",
      [req.params.orderId]
    );
    await conn.query('UPDATE production_orders SET total_production_cost = ?, total_cost = ? + additional_cost WHERE id = ?',
      [parseFloat(allStages[0].total_cost), parseFloat(allStages[0].total_cost), req.params.orderId]);

    // Check if all stages done
    const [pending] = await conn.query(
      "SELECT COUNT(*) as cnt FROM production_order_stages WHERE order_id = ? AND status IN ('pending','in_progress')",
      [req.params.orderId]
    );

    let allDone = pending[0].cnt === 0;
    let nextStage = null;

    if (!allDone) {
      const [next] = await conn.query(
        "SELECT * FROM production_order_stages WHERE order_id = ? AND status = 'pending' ORDER BY stage_order ASC LIMIT 1",
        [req.params.orderId]
      );
      if (next.length) nextStage = next[0];
    }

    await conn.commit();
    res.json({
      success: true,
      message: `🎉 Stage "${s.name}" completed!`,
      all_done: allDone,
      next_stage: nextStage ? { id: nextStage.id, name: nextStage.name, stage_order: nextStage.stage_order } : null,
      stage_cost: finalCost,
    });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// POST — Extend stage time
router.post('/orders/:orderId/stages/:stageId/extend', async (req, res) => {
  try {
    const { extra_days } = req.body;
    if (!extra_days) return res.status(400).json({ success: false, message: 'Extra days required' });
    const [stage] = await pool.query('SELECT * FROM production_order_stages WHERE id = ?', [req.params.stageId]);
    if (!stage.length) return res.status(404).json({ success: false, message: 'Not found' });
    const newDue = new Date(stage[0].due_at || Date.now());
    newDue.setDate(newDue.getDate() + parseInt(extra_days));
    await pool.query('UPDATE production_order_stages SET due_at = ?, estimated_days = estimated_days + ? WHERE id = ?',
      [newDue, parseInt(extra_days), req.params.stageId]);
    res.json({ success: true, message: `Extended by ${extra_days} days. New due: ${newDue.toLocaleDateString()}` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ══════════════════════════════════════════════════════════
// COMPLETE ORDER (Final product → Stock)
// ══════════════════════════════════════════════════════════

router.post('/orders/:id/complete', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { sale_price, additional_costs, notes } = req.body;

    const [orders] = await conn.query('SELECT * FROM production_orders WHERE id = ?', [req.params.id]);
    if (!orders.length) { await conn.rollback(); return res.status(404).json({ success: false, message: 'Not found' }); }
    const order = orders[0];

    // Add additional costs
    let additionalTotal = 0;
    if (additional_costs && additional_costs.length) {
      for (const c of additional_costs) {
        if (c.description && c.amount) {
          await conn.query('INSERT INTO production_additional_costs (order_id, description, amount) VALUES (?,?,?)',
            [req.params.id, c.description, parseFloat(c.amount)]);
          additionalTotal += parseFloat(c.amount);
        }
      }
    }

    const totalCost = parseFloat(order.total_production_cost) + additionalTotal;
    const unitCost = order.quantity > 0 ? totalCost / order.quantity : totalCost;

    // Update order
    await conn.query(
      `UPDATE production_orders SET status = 'completed', completed_at = NOW(), additional_cost = ?, total_cost = ?, unit_cost = ? WHERE id = ?`,
      [additionalTotal, totalCost, unitCost, req.params.id]
    );

    // Add final product to stock
    if (order.final_product_id) {
      const sp = sale_price || null;
      const [batch] = await conn.query(
        `INSERT INTO stock_batches (product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining, supplier_name, notes)
         VALUES (?, ?, ?, ?, ?, ?, 'Production', ?)`,
        [order.final_product_id, `PRD-${order.order_number}`, unitCost, sp, order.quantity, order.quantity,
         `Produced via ${order.pipeline_name}. Total cost: ${totalCost}. ${notes || ''}`]
      );

      // Auto-generate serials if needed
      const [prodInfo] = await conn.query('SELECT has_serial_number FROM products WHERE id = ?', [order.final_product_id]);
      if (prodInfo.length && prodInfo[0].has_serial_number === 1) {
        for (let i = 1; i <= order.quantity; i++) {
          await conn.query(
            "INSERT INTO serial_numbers (product_id, batch_id, serial_number, status, created_at) VALUES (?, ?, ?, 'in_stock', NOW())",
            [order.final_product_id, batch.insertId, `SN-${order.order_number}-${String(i).padStart(3, '0')}`]
          );
        }
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: `✅ Production complete! ${order.quantity} units added to stock at ৳${unitCost.toLocaleString()}/unit`,
      total_cost: totalCost, unit_cost: unitCost,
    });
  } catch (error) { await conn.rollback(); res.status(500).json({ success: false, message: error.message }); }
  finally { conn.release(); }
});

// ══════════════════════════════════════════════════════════
// ADDITIONAL COSTS
// ══════════════════════════════════════════════════════════

router.post('/orders/:id/costs', async (req, res) => {
  try {
    const { description, amount } = req.body;
    if (!description || !amount) return res.status(400).json({ success: false, message: 'Description and amount required' });
    await pool.query('INSERT INTO production_additional_costs (order_id, description, amount) VALUES (?,?,?)',
      [req.params.id, description, parseFloat(amount)]);
    const [totals] = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM production_additional_costs WHERE order_id = ?', [req.params.id]);
    await pool.query('UPDATE production_orders SET additional_cost = ?, total_cost = total_production_cost + ? WHERE id = ?',
      [parseFloat(totals[0].total), parseFloat(totals[0].total), req.params.id]);
    res.json({ success: true, message: 'Cost added' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.delete('/orders/:orderId/costs/:costId', async (req, res) => {
  try {
    await pool.query('DELETE FROM production_additional_costs WHERE id = ? AND order_id = ?', [req.params.costId, req.params.orderId]);
    const [totals] = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM production_additional_costs WHERE order_id = ?', [req.params.orderId]);
    await pool.query('UPDATE production_orders SET additional_cost = ?, total_cost = total_production_cost + ? WHERE id = ?',
      [parseFloat(totals[0].total), parseFloat(totals[0].total), req.params.orderId]);
    res.json({ success: true, message: 'Cost removed' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ══════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ══════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const [active] = await pool.query("SELECT COUNT(*) as cnt FROM production_orders WHERE status = 'in_progress'");
    const [completed] = await pool.query("SELECT COUNT(*) as cnt, COALESCE(SUM(total_cost),0) as cost FROM production_orders WHERE status = 'completed'");
    const [pending] = await pool.query("SELECT COUNT(*) as cnt FROM production_orders WHERE status = 'pending'");
    const [overdue] = await pool.query(`
      SELECT COUNT(*) as cnt FROM production_order_stages 
      WHERE status = 'in_progress' AND due_at < NOW()
    `);
    res.json({
      success: true, data: {
        active_orders: active[0].cnt, completed_orders: completed[0].cnt,
        pending_orders: pending[0].cnt, overdue_stages: overdue[0].cnt,
        total_production_cost: parseFloat(completed[0].cost),
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;

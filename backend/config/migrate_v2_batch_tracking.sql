-- ============================================================
-- MIGRATION v2: Enhanced Batch Tracking
-- ============================================================
USE battery_pos;

-- Ensure batch_id exists in sale_items (should already exist)
ALTER TABLE sale_items 
  ADD COLUMN IF NOT EXISTS batch_id INT DEFAULT NULL,
  ADD KEY IF NOT EXISTS idx_batch (batch_id);

-- Ensure sale_price exists in stock_batches
ALTER TABLE stock_batches 
  ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) DEFAULT NULL 
  COMMENT 'Per-batch sale price override';

SELECT 'Migration complete - batch tracking enhanced!' AS status;

-- ============================================================
-- MIGRATION: Add sale_price to stock_batches
-- Run this if you already have the database set up
-- ============================================================
USE battery_pos;

-- Add sale_price column if not exists
ALTER TABLE stock_batches 
  ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2) DEFAULT NULL 
  COMMENT 'Per-batch sale price override. NULL = use product default sale_price.';

-- Verify
DESCRIBE stock_batches;
SELECT 'Migration complete!' AS status;

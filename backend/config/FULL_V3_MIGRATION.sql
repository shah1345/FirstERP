-- ============================================
-- BATTERY POS V3 - COMPLETE MIGRATION
-- Run this entire file to upgrade from V2 to V3
-- Safe to run multiple times (idempotent)
-- ============================================

USE battery_pos;

-- ============================================
-- STEP 1: Add new columns to existing tables
-- ============================================

-- Add can_edit_price to users
ALTER TABLE users 
ADD COLUMN can_edit_price TINYINT(1) DEFAULT 0 COMMENT 'Permission to change sales price in POS' AFTER role;

-- Add profit tracking to sales
ALTER TABLE sales
ADD COLUMN total_purchase_cost DECIMAL(10,2) DEFAULT 0 COMMENT 'FIFO-based purchase cost' AFTER payment_status,
ADD COLUMN total_profit DECIMAL(10,2) DEFAULT 0 COMMENT 'total_amount - total_purchase_cost' AFTER total_purchase_cost,
ADD COLUMN status ENUM('active', 'deleted', 'returned', 'partial_return') DEFAULT 'active' AFTER sold_by,
ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER status,
ADD COLUMN deleted_by INT DEFAULT NULL AFTER deleted_at,
ADD INDEX idx_status (status);

-- Add price editing to sale_items
ALTER TABLE sale_items
ADD COLUMN original_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Original product/batch price' AFTER product_name,
ADD COLUMN price_edited TINYINT(1) DEFAULT 0 COMMENT 'Was price manually changed?' AFTER unit_price,
ADD COLUMN edited_by INT DEFAULT NULL AFTER price_edited,
ADD COLUMN profit DECIMAL(10,2) DEFAULT 0 COMMENT '(unit_price * quantity) - (purchase_price * quantity)' AFTER total_price,
ADD COLUMN status ENUM('active', 'returned', 'replaced') DEFAULT 'active' AFTER profit,
ADD COLUMN return_id INT DEFAULT NULL AFTER status,
ADD COLUMN replacement_id INT DEFAULT NULL AFTER return_id,
ADD COLUMN serial_number_id INT DEFAULT NULL AFTER batch_id;

-- Update existing sale_items
UPDATE sale_items SET original_price = unit_price WHERE original_price = 0;

-- Add to stock_batches
ALTER TABLE stock_batches
ADD COLUMN quantity_returned INT DEFAULT 0 COMMENT 'Items returned to this batch' AFTER quantity_remaining;

-- Add to products
ALTER TABLE products
ADD COLUMN has_serial_number TINYINT(1) DEFAULT 1 COMMENT 'Track individual units by serial' AFTER barcode;

-- Add foreign key for deleted_by
ALTER TABLE sales
ADD CONSTRAINT fk_sales_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);

-- ============================================
-- STEP 2: Create new tables
-- ============================================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  customer_type ENUM('cash', 'credit') DEFAULT 'cash',
  credit_limit DECIMAL(10,2) DEFAULT 0,
  total_purchases DECIMAL(10,2) DEFAULT 0 COMMENT 'Lifetime purchase amount',
  total_paid DECIMAL(10,2) DEFAULT 0 COMMENT 'Total payments received',
  current_balance DECIMAL(10,2) DEFAULT 0 COMMENT 'Current receivable',
  notes TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_type (customer_type)
);

-- Customer Payments table
CREATE TABLE IF NOT EXISTS customer_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'card', 'mobile_banking', 'bank_transfer') DEFAULT 'cash',
  reference_number VARCHAR(100) COMMENT 'Check/transfer reference',
  notes TEXT,
  received_by INT,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id),
  INDEX idx_customer (customer_id),
  INDEX idx_date (payment_date)
);

-- Serial Numbers table
CREATE TABLE IF NOT EXISTS serial_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_id INT NOT NULL,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  status ENUM('in_stock', 'sold', 'returned', 'replaced') DEFAULT 'in_stock',
  sale_id INT DEFAULT NULL,
  sale_item_id INT DEFAULT NULL,
  warranty_start_date DATE DEFAULT NULL,
  warranty_end_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
  INDEX idx_serial (serial_number),
  INDEX idx_status (status)
);

-- Returns table
CREATE TABLE IF NOT EXISTS returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_number VARCHAR(50) UNIQUE NOT NULL,
  sale_id INT NOT NULL,
  customer_id INT DEFAULT NULL,
  return_type ENUM('full', 'partial') DEFAULT 'partial',
  total_return_amount DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_method ENUM('cash', 'card', 'mobile_banking', 'credit_adjustment') DEFAULT 'cash',
  reason TEXT,
  processed_by INT,
  status ENUM('pending', 'approved', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (processed_by) REFERENCES users(id),
  INDEX idx_return_number (return_number),
  INDEX idx_sale (sale_id)
);

-- Return Items table
CREATE TABLE IF NOT EXISTS return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_id INT NOT NULL,
  sale_item_id INT NOT NULL,
  product_id INT NOT NULL,
  batch_id INT NOT NULL COMMENT 'Original batch to return to',
  serial_number_id INT DEFAULT NULL,
  quantity INT NOT NULL,
  return_price DECIMAL(10,2) NOT NULL COMMENT 'Price at which it was sold',
  purchase_price DECIMAL(10,2) NOT NULL COMMENT 'Original purchase cost',
  reason VARCHAR(255),
  condition_note TEXT COMMENT 'Condition of returned item',
  restocked TINYINT(1) DEFAULT 1 COMMENT 'Was item restocked?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
  FOREIGN KEY (serial_number_id) REFERENCES serial_numbers(id)
);

-- Replacements table
CREATE TABLE IF NOT EXISTS replacements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  replacement_number VARCHAR(50) UNIQUE NOT NULL,
  sale_id INT NOT NULL COMMENT 'Original sale',
  customer_id INT DEFAULT NULL,
  returned_sale_item_id INT NOT NULL,
  returned_product_id INT NOT NULL,
  returned_batch_id INT NOT NULL,
  returned_serial_id INT DEFAULT NULL,
  replacement_product_id INT NOT NULL,
  replacement_batch_id INT NOT NULL,
  replacement_serial_id INT DEFAULT NULL,
  replacement_quantity INT DEFAULT 1,
  price_adjustment DECIMAL(10,2) DEFAULT 0 COMMENT 'Price diff if models differ',
  reason TEXT,
  warranty_reset_date DATE DEFAULT NULL,
  processed_by INT,
  status ENUM('pending', 'completed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (returned_sale_item_id) REFERENCES sale_items(id),
  FOREIGN KEY (returned_product_id) REFERENCES products(id),
  FOREIGN KEY (returned_batch_id) REFERENCES stock_batches(id),
  FOREIGN KEY (returned_serial_id) REFERENCES serial_numbers(id),
  FOREIGN KEY (replacement_product_id) REFERENCES products(id),
  FOREIGN KEY (replacement_batch_id) REFERENCES stock_batches(id),
  FOREIGN KEY (replacement_serial_id) REFERENCES serial_numbers(id),
  FOREIGN KEY (processed_by) REFERENCES users(id),
  INDEX idx_replacement_number (replacement_number),
  INDEX idx_sale (sale_id)
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(50) NOT NULL COMMENT 'delete_sale, return_product, replace_product, etc',
  entity_type VARCHAR(50) NOT NULL COMMENT 'sale, return, replacement, customer',
  entity_id INT NOT NULL,
  old_data JSON COMMENT 'State before change',
  new_data JSON COMMENT 'State after change',
  ip_address VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_date (created_at)
);

-- ============================================
-- STEP 3: Insert default data
-- ============================================

-- Default walk-in customer
INSERT INTO customers (id, customer_name, customer_type) 
VALUES (1, 'Walk-in Customer', 'cash')
ON DUPLICATE KEY UPDATE customer_name = 'Walk-in Customer';

-- Update admin users with price edit permission
UPDATE users SET can_edit_price = 1 WHERE role = 'admin';

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'V3 Migration Complete!' AS status;

-- Show table counts
SELECT 
  (SELECT COUNT(*) FROM customers) as customers_count,
  (SELECT COUNT(*) FROM serial_numbers) as serials_count,
  (SELECT COUNT(*) FROM returns) as returns_count,
  (SELECT COUNT(*) FROM replacements) as replacements_count,
  (SELECT COUNT(*) FROM audit_logs) as audit_logs_count;

-- Show new columns in sales
DESCRIBE sales;

-- Show new columns in sale_items  
DESCRIBE sale_items;

COMMIT;

-- ============================================
-- MIGRATION: V2 to V3 (MariaDB Compatible)
-- PowerCell Battery POS Enhancement
-- ============================================

USE battery_pos;

-- Helper: Check if column exists
DELIMITER $$

CREATE PROCEDURE AddColumnIfNotExists(
    IN tableName VARCHAR(64),
    IN columnName VARCHAR(64),
    IN columnDefinition TEXT
)
BEGIN
    SET @col_exists = (SELECT COUNT(*) 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'battery_pos' 
        AND TABLE_NAME = tableName 
        AND COLUMN_NAME = columnName);
    
    IF @col_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tableName, ' ADD COLUMN ', columnName, ' ', columnDefinition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- Add can_edit_price permission to users
CALL AddColumnIfNotExists('users', 'can_edit_price', 'TINYINT(1) DEFAULT 0 COMMENT "Permission to change sales price in POS" AFTER role');

-- Add profit tracking columns to sales table
CALL AddColumnIfNotExists('sales', 'total_purchase_cost', 'DECIMAL(10,2) DEFAULT 0 COMMENT "FIFO-based purchase cost" AFTER payment_status');
CALL AddColumnIfNotExists('sales', 'total_profit', 'DECIMAL(10,2) DEFAULT 0 COMMENT "total_amount - total_purchase_cost" AFTER total_purchase_cost');
CALL AddColumnIfNotExists('sales', 'status', 'ENUM("active", "deleted", "returned", "partial_return") DEFAULT "active" AFTER sold_by');
CALL AddColumnIfNotExists('sales', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL AFTER status');
CALL AddColumnIfNotExists('sales', 'deleted_by', 'INT DEFAULT NULL AFTER deleted_at');

-- Add index on status if not exists
SET @index_exists = (SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = 'battery_pos' 
    AND TABLE_NAME = 'sales' 
    AND INDEX_NAME = 'idx_status');

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE sales ADD INDEX idx_status (status)',
    'SELECT "Index already exists" AS status');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add price editing columns to sale_items
CALL AddColumnIfNotExists('sale_items', 'original_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT "Original product/batch price" AFTER product_name');
CALL AddColumnIfNotExists('sale_items', 'price_edited', 'TINYINT(1) DEFAULT 0 COMMENT "Was price manually changed?" AFTER unit_price');
CALL AddColumnIfNotExists('sale_items', 'edited_by', 'INT DEFAULT NULL AFTER price_edited');
CALL AddColumnIfNotExists('sale_items', 'profit', 'DECIMAL(10,2) DEFAULT 0 COMMENT "(unit_price * quantity) - (purchase_price * quantity)" AFTER total_price');
CALL AddColumnIfNotExists('sale_items', 'status', 'ENUM("active", "returned", "replaced") DEFAULT "active" AFTER profit');
CALL AddColumnIfNotExists('sale_items', 'return_id', 'INT DEFAULT NULL AFTER status');
CALL AddColumnIfNotExists('sale_items', 'replacement_id', 'INT DEFAULT NULL AFTER return_id');
CALL AddColumnIfNotExists('sale_items', 'serial_number_id', 'INT DEFAULT NULL AFTER batch_id');

-- Update existing sale_items to have original_price = unit_price
UPDATE sale_items SET original_price = unit_price WHERE original_price = 0;

-- Add quantity_returned to stock_batches
CALL AddColumnIfNotExists('stock_batches', 'quantity_returned', 'INT DEFAULT 0 COMMENT "Items returned to this batch" AFTER quantity_remaining');

-- Add has_serial_number to products
CALL AddColumnIfNotExists('products', 'has_serial_number', 'TINYINT(1) DEFAULT 1 COMMENT "Track individual units by serial" AFTER barcode');

-- ============================================
-- CREATE NEW TABLES
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

-- Add foreign key for sales.deleted_by (check if exists first)
SET @constraint_exists = (SELECT COUNT(*) 
  FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = 'battery_pos' 
  AND TABLE_NAME = 'sales' 
  AND CONSTRAINT_NAME = 'fk_sales_deleted_by');

SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE sales ADD CONSTRAINT fk_sales_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)',
  'SELECT "Foreign key fk_sales_deleted_by already exists" AS status');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Insert default walk-in customer
INSERT IGNORE INTO customers (id, customer_name, customer_type) 
VALUES (1, 'Walk-in Customer', 'cash');

-- Update admin users to have price edit permission
UPDATE users SET can_edit_price = 1 WHERE role = 'admin';

-- Clean up helper procedure
DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

SELECT 'Migration V2 to V3 completed successfully!' AS status;

COMMIT;

-- ============================================
-- BATTERY POS V3 - ENHANCED SCHEMA
-- Features: Profit tracking, Customer credit, Returns, Replacements, Audit logs
-- ============================================

CREATE DATABASE IF NOT EXISTS battery_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE battery_pos;

-- ============================================
-- USERS TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee', 'cashier') DEFAULT 'employee',
  can_edit_price TINYINT(1) DEFAULT 0 COMMENT 'Permission to change sales price in POS',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- COMPANY CONFIGURATION TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS company_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_name VARCHAR(200) NOT NULL DEFAULT 'Battery Wholesale Shop',
  logo VARCHAR(500),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  vat_percentage DECIMAL(5,2) DEFAULT 15.00,
  tin_certificate_id VARCHAR(100),
  invoice_footer TEXT,
  currency VARCHAR(10) DEFAULT 'BDT',
  currency_symbol VARCHAR(5) DEFAULT '৳',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- PRODUCTS TABLE - Enhanced with serial tracking
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(200) NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  voltage VARCHAR(50),
  capacity VARCHAR(50),
  warranty_months INT DEFAULT 0,
  sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_percentage DECIMAL(5,2) DEFAULT 0,
  barcode VARCHAR(100),
  description TEXT,
  has_serial_number TINYINT(1) DEFAULT 1 COMMENT 'Track individual units by serial',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_barcode (barcode)
);

-- ============================================
-- STOCK BATCHES TABLE - Enhanced with serial number tracking
-- ============================================
CREATE TABLE IF NOT EXISTS stock_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_number VARCHAR(100),
  purchase_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) DEFAULT NULL COMMENT 'Per-batch sale price override',
  quantity_added INT NOT NULL,
  quantity_remaining INT NOT NULL,
  quantity_returned INT DEFAULT 0 COMMENT 'Items returned to this batch',
  supplier_name VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_fifo (product_id, created_at)
);

-- ============================================
-- SERIAL NUMBERS TABLE - Track individual units
-- ============================================
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

-- ============================================
-- STOCK MOVEMENTS TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_id INT,
  movement_type ENUM('in', 'out', 'adjustment', 'return', 'replacement') NOT NULL,
  quantity INT NOT NULL,
  reference_id INT COMMENT 'sale_id, return_id, etc',
  reference_type VARCHAR(50) COMMENT 'sale, return, replacement, adjustment',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_movement_type (movement_type),
  INDEX idx_reference (reference_type, reference_id)
);

-- ============================================
-- CUSTOMERS TABLE - NEW
-- ============================================
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
  current_balance DECIMAL(10,2) DEFAULT 0 COMMENT 'Current receivable (purchases - payments + returns)',
  notes TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_type (customer_type)
);

-- ============================================
-- SALES TABLE - Enhanced with profit tracking
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT DEFAULT NULL,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  due_amount DECIMAL(10,2) DEFAULT 0,
  payment_method ENUM('cash', 'card', 'mobile_banking', 'credit') DEFAULT 'cash',
  payment_status ENUM('paid', 'partial', 'due') DEFAULT 'paid',
  total_purchase_cost DECIMAL(10,2) DEFAULT 0 COMMENT 'FIFO-based purchase cost',
  total_profit DECIMAL(10,2) DEFAULT 0 COMMENT 'total_amount - total_purchase_cost',
  notes TEXT,
  sold_by INT,
  status ENUM('active', 'deleted', 'returned', 'partial_return') DEFAULT 'active',
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  deleted_by INT DEFAULT NULL,
  is_synced TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (sold_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id),
  INDEX idx_invoice (invoice_number),
  INDEX idx_customer (customer_id),
  INDEX idx_date (created_at),
  INDEX idx_status (status)
);

-- ============================================
-- SALE ITEMS TABLE - Enhanced with editable price
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  batch_id INT,
  serial_number_id INT DEFAULT NULL,
  product_name VARCHAR(200),
  quantity INT NOT NULL,
  original_price DECIMAL(10,2) NOT NULL COMMENT 'Original product/batch price',
  unit_price DECIMAL(10,2) NOT NULL COMMENT 'Final selling price (may be edited)',
  price_edited TINYINT(1) DEFAULT 0 COMMENT 'Was price manually changed?',
  edited_by INT DEFAULT NULL,
  purchase_price DECIMAL(10,2) DEFAULT 0 COMMENT 'FIFO purchase cost per unit',
  vat_percentage DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL COMMENT 'Final line total',
  profit DECIMAL(10,2) DEFAULT 0 COMMENT '(unit_price * quantity) - (purchase_price * quantity)',
  status ENUM('active', 'returned', 'replaced') DEFAULT 'active',
  return_id INT DEFAULT NULL,
  replacement_id INT DEFAULT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
  FOREIGN KEY (serial_number_id) REFERENCES serial_numbers(id),
  FOREIGN KEY (edited_by) REFERENCES users(id),
  INDEX idx_sale (sale_id),
  INDEX idx_status (status)
);

-- ============================================
-- CUSTOMER PAYMENTS TABLE - NEW
-- ============================================
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

-- ============================================
-- RETURNS TABLE - NEW
-- ============================================
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

-- ============================================
-- RETURN ITEMS TABLE - NEW
-- ============================================
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

-- ============================================
-- REPLACEMENTS TABLE - NEW
-- ============================================
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

-- ============================================
-- AUDIT LOG TABLE - NEW
-- ============================================
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
-- EMPLOYEES TABLE (unchanged from v2)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  role VARCHAR(100),
  department VARCHAR(100),
  basic_salary DECIMAL(10,2) DEFAULT 0,
  join_date DATE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- ATTENDANCE RULES TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_start_time TIME DEFAULT '09:00:00',
  late_threshold_minutes INT DEFAULT 15,
  break_duration_minutes INT DEFAULT 60,
  work_days_per_week INT DEFAULT 6,
  lates_per_deduction INT DEFAULT 3,
  deduction_days_per_penalty INT DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- ATTENDANCE TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  break_start TIME,
  break_end TIME,
  status ENUM('present', 'absent', 'late', 'half_day', 'holiday', 'weekend') DEFAULT 'present',
  late_minutes INT DEFAULT 0,
  break_late_minutes INT DEFAULT 0,
  notes TEXT,
  marked_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id),
  UNIQUE KEY unique_attendance (employee_id, date)
);

-- ============================================
-- PAYROLL TABLE (unchanged)
-- ============================================
CREATE TABLE IF NOT EXISTS payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basic_salary DECIMAL(10,2) NOT NULL,
  total_days INT DEFAULT 26,
  present_days INT DEFAULT 0,
  absent_days INT DEFAULT 0,
  late_count INT DEFAULT 0,
  late_deduction_days DECIMAL(5,2) DEFAULT 0,
  absence_deduction DECIMAL(10,2) DEFAULT 0,
  late_deduction DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  payment_status ENUM('pending', 'paid') DEFAULT 'pending',
  payment_date DATE,
  notes TEXT,
  generated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (generated_by) REFERENCES users(id),
  UNIQUE KEY unique_payroll (employee_id, month, year)
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default users with can_edit_price permission
INSERT IGNORE INTO users (id, name, email, password, role, can_edit_price) VALUES
(1, 'System Admin', 'admin@batterypos.com', '$2a$10$rZ8kY5yLxMxVfJ5o9fJxJO0vYX9K7QN8X9K7QN8X9K7QN8X9K7QN8a', 'admin', 1),
(2, 'Cashier User', 'cashier@batterypos.com', '$2a$10$rZ8kY5yLxMxVfJ5o9fJxJO0vYX9K7QN8X9K7QN8X9K7QN8X9K7QN8a', 'cashier', 1);

-- Default company config
INSERT IGNORE INTO company_config (id, shop_name, address, phone, email, vat_percentage, tin_certificate_id, invoice_footer) VALUES
(1, 'Lata Battery Wholesale', 'Dhaka, Bangladesh', '+880 1700-000000', 'info@powercell.com', 5.00, 'TIN-0000000000', 'Thank you for your business! All batteries come with manufacturer warranty.');

-- Default attendance rules
INSERT IGNORE INTO attendance_rules (id, work_start_time, late_threshold_minutes, lates_per_deduction) VALUES
(1, '09:00:00', 15, 3);

-- Sample products with serial number tracking
INSERT IGNORE INTO products (id, product_name, brand, model, voltage, capacity, warranty_months, sale_price, vat_percentage, has_serial_number, barcode) VALUES
(1, 'Volta NS60 Battery', 'Volta', 'NS60', '12V', '45Ah', 12, 4500, 5.00, 1, 'BAT-NS60-001'),
(2, 'Rahimafrooz RM150', 'Rahimafrooz', 'RM150', '12V', '150Ah', 18, 18500, 5.00, 1, 'BAT-RM150-002'),
(3, 'Lucas Solar Battery', 'Lucas', 'SL200', '12V', '200Ah', 24, 22000, 5.00, 1, 'BAT-SL200-003'),
(4, 'Amara Raja MF5L-B', 'Amara Raja', 'MF5L-B', '12V', '5Ah', 6, 1200, 5.00, 0, 'BAT-MF5L-004');

-- Sample stock batches
INSERT IGNORE INTO stock_batches (id, product_id, batch_number, purchase_price, sale_price, quantity_added, quantity_remaining) VALUES
(1, 1, 'BATCH-001', 4000, 4500, 20, 20),
(2, 2, 'BATCH-002', 17000, 18500, 10, 10),
(3, 3, 'BATCH-003', 20000, 22000, 15, 15),
(4, 4, 'BATCH-004', 1000, 1200, 50, 50);

-- Sample customers
INSERT IGNORE INTO customers (id, customer_name, phone, customer_type, credit_limit) VALUES
(1, 'Walk-in Customer', NULL, 'cash', 0),
(2, 'ABC Trading Ltd', '01700000001', 'credit', 500000),
(3, 'XYZ Enterprise', '01700000002', 'credit', 300000);

COMMIT;

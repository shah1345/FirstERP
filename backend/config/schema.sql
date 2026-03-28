-- ============================================
-- BATTERY WHOLESALE POS + ERP DATABASE SCHEMA
-- ============================================

CREATE DATABASE IF NOT EXISTS battery_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE battery_pos;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') DEFAULT 'employee',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- COMPANY CONFIGURATION TABLE
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
-- PRODUCTS TABLE
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
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- STOCK BATCHES TABLE (FIFO)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_number VARCHAR(100),
  purchase_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) DEFAULT NULL COMMENT "Per-batch sale price override",
  quantity_added INT NOT NULL,
  quantity_remaining INT NOT NULL,
  supplier_name VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_fifo (product_id, created_at)
);

-- ============================================
-- STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  batch_id INT,
  movement_type ENUM('in', 'out', 'adjustment') NOT NULL,
  quantity INT NOT NULL,
  reference_id INT,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  total_purchases DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SALES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(50),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  due_amount DECIMAL(10,2) DEFAULT 0,
  payment_method ENUM('cash', 'card', 'mobile_banking', 'credit') DEFAULT 'cash',
  payment_status ENUM('paid', 'partial', 'due') DEFAULT 'paid',
  notes TEXT,
  sold_by INT,
  is_synced TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (sold_by) REFERENCES users(id),
  INDEX idx_created_at (created_at),
  INDEX idx_invoice (invoice_number)
);

-- ============================================
-- SALE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  batch_id INT,
  product_name VARCHAR(200),
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  purchase_price DECIMAL(10,2) DEFAULT 0,
  vat_percentage DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- EMPLOYEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(100),
  role VARCHAR(100),
  department VARCHAR(100),
  basic_salary DECIMAL(10,2) DEFAULT 0,
  join_date DATE,
  status ENUM('active', 'inactive') DEFAULT 'active',
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- ATTENDANCE RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_start_time TIME DEFAULT '09:00:00',
  late_threshold_minutes INT DEFAULT 15,
  break_duration_minutes INT DEFAULT 60,
  work_days_per_week INT DEFAULT 6,
  lates_per_deduction INT DEFAULT 3,
  deduction_days_per_penalty DECIMAL(3,1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- ATTENDANCE TABLE
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
  UNIQUE KEY unique_attendance (employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
);

-- ============================================
-- PAYROLL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basic_salary DECIMAL(10,2),
  total_days INT,
  present_days INT,
  absent_days INT,
  late_count INT DEFAULT 0,
  late_deduction_days DECIMAL(4,1) DEFAULT 0,
  absence_deduction DECIMAL(10,2) DEFAULT 0,
  late_deduction DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2),
  payment_status ENUM('pending', 'paid') DEFAULT 'pending',
  payment_date DATE,
  notes TEXT,
  generated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_payroll (employee_id, month, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- ============================================
-- DEFAULT DATA INSERTS
-- ============================================

-- Default Admin User (password: admin123)
INSERT INTO users (name, email, password, role, status) VALUES 
('System Admin', 'admin@batterypos.com', '$2a$10$rXJGnqMrpFBjGhXGnbkAiOHFbZDWDDq7SfHj1Kq9hRAoFKm3J5Yni', 'admin', 'active'),
('Sales Employee', 'employee@batterypos.com', '$2a$10$rXJGnqMrpFBjGhXGnbkAiOHFbZDWDDq7SfHj1Kq9hRAoFKm3J5Yni', 'employee', 'active')
ON DUPLICATE KEY UPDATE id=id;

-- Default Company Config
INSERT INTO company_config (shop_name, address, phone, email, vat_percentage, tin_certificate_id, invoice_footer) VALUES 
('PowerCell Battery Wholesale', 'Dhaka, Bangladesh', '+880 1700-000000', 'info@powercell.com', 15.00, 'TIN-000000000', 'Thank you for your business! All batteries come with manufacturer warranty.')
ON DUPLICATE KEY UPDATE id=id;

-- Default Attendance Rules
INSERT INTO attendance_rules (work_start_time, late_threshold_minutes, break_duration_minutes, work_days_per_week, lates_per_deduction, deduction_days_per_penalty) VALUES
('09:00:00', 15, 60, 6, 3, 1)
ON DUPLICATE KEY UPDATE id=id;

-- Sample Products
INSERT INTO products (product_name, brand, model, voltage, capacity, warranty_months, sale_price, vat_percentage, barcode) VALUES
('Volta Car Battery', 'Volta', 'NS60', '12V', '45Ah', 24, 4500.00, 15, 'VOLTA-NS60-001'),
('Rahimafrooz IPS Battery', 'Rahimafrooz', 'RM150', '12V', '150Ah', 36, 12000.00, 15, 'RA-RM150-001'),
('Lucas Solar Battery', 'Lucas', 'SL200', '12V', '200Ah', 24, 18500.00, 15, 'LUCAS-SL200-001'),
('Amara Raja Motorbike', 'Amara Raja', 'MF5L-B', '12V', '5Ah', 18, 1800.00, 15, 'AR-MF5LB-001')
ON DUPLICATE KEY UPDATE id=id;

-- Sample Stock Batches
INSERT INTO stock_batches (product_id, batch_number, purchase_price, quantity_added, quantity_remaining, supplier_name) VALUES
(1, 'BATCH-001', 3800.00, 20, 20, 'Volta Bangladesh Ltd'),
(2, 'BATCH-002', 10000.00, 15, 15, 'Rahimafrooz Ltd'),
(3, 'BATCH-003', 15000.00, 10, 10, 'Lucas Battery Importer'),
(4, 'BATCH-004', 1500.00, 50, 50, 'Amara Raja India')
ON DUPLICATE KEY UPDATE id=id;

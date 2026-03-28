// backend/scripts/create-super-admin.js
// Run: node scripts/create-super-admin.js
// Creates the super admin user in the database

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

async function createSuperAdmin() {
  const email = 'superadmin@smarterp.com';
  const password = 'superadmin123'; // Change this!
  const name = 'Super Admin';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Generated bcrypt hash:', hashedPassword);

    // Check if super admin exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    if (existing.length) {
      // Update existing
      await pool.query(
        'UPDATE users SET password = ?, is_super_admin = 1, tenant_id = NULL, role = ? WHERE email = ?',
        [hashedPassword, 'admin', email]
      );
      console.log(`✅ Updated super admin: ${email}`);
    } else {
      // Create new
      await pool.query(
        'INSERT INTO users (name, email, password, role, is_super_admin, tenant_id) VALUES (?, ?, ?, ?, 1, NULL)',
        [name, email, hashedPassword, 'admin']
      );
      console.log(`✅ Created super admin: ${email}`);
    }

    console.log(`\n🔑 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n⚠️  CHANGE THE PASSWORD AFTER FIRST LOGIN!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();

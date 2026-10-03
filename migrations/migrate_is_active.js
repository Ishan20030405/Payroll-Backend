// One-time migration: add is_active column to users table
require('dotenv').config();
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || process.env.DB_HOST || 'mysql-ishan.alwaysdata.net',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || process.env.DB_NAME || 'ishan_ishan_payroll'
    });

    try {
        await conn.execute(
            'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1'
        );
        console.log('✅ is_active column added to users table.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  is_active column already exists — skipping.');
        } else {
            console.error('❌ Migration failed:', err.message);
        }
    } finally {
        await conn.end();
    }
})();


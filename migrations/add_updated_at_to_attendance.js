// backend/add_updated_at_to_attendance.js
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
        console.log('🔄 Adding updated_at column to attendance table...');

        // Check if updated_at column exists
        const [columns] = await conn.execute('SHOW COLUMNS FROM attendance');
        const columnNames = columns.map(c => c.Field);
        
        console.log('📊 Current columns:', columnNames.join(', '));

        // Add updated_at if missing
        if (!columnNames.includes('updated_at')) {
            console.log('📌 Adding updated_at column...');
            await conn.execute(`
                ALTER TABLE attendance 
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            `);
            console.log('✅ updated_at column added.');
        } else {
            console.log('✅ updated_at column already exists.');
        }

        // Also check and add created_at if missing
        if (!columnNames.includes('created_at')) {
            console.log('📌 Adding created_at column...');
            await conn.execute(`
                ALTER TABLE attendance 
                ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            console.log('✅ created_at column added.');
        } else {
            console.log('✅ created_at column already exists.');
        }

        console.log('✅ Migration complete.');
        console.log('📊 Updated columns:', columnNames.join(', '));
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


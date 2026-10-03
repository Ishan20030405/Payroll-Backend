// backend/add_working_hours_to_attendance.js
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
        console.log('🔄 Adding missing columns to attendance table...');

        // Check if working_hours column exists
        const [columns] = await conn.execute('SHOW COLUMNS FROM attendance');
        const columnNames = columns.map(c => c.Field);
        
        console.log('📊 Current columns:', columnNames.join(', '));

        // Add working_hours if missing
        if (!columnNames.includes('working_hours')) {
            console.log('📌 Adding working_hours column...');
            await conn.execute(`
                ALTER TABLE attendance 
                ADD COLUMN working_hours DECIMAL(5,2) DEFAULT 0.00
            `);
            console.log('✅ working_hours column added.');
        } else {
            console.log('✅ working_hours column already exists.');
        }

        // Add overtime if missing
        if (!columnNames.includes('overtime')) {
            console.log('📌 Adding overtime column...');
            await conn.execute(`
                ALTER TABLE attendance 
                ADD COLUMN overtime DECIMAL(5,2) DEFAULT 0.00
            `);
            console.log('✅ overtime column added.');
        } else {
            console.log('✅ overtime column already exists.');
        }

        // Check if check_in and check_out are TIME type (they should be)
        const checkInCol = columns.find(c => c.Field === 'check_in');
        const checkOutCol = columns.find(c => c.Field === 'check_out');
        
        if (checkInCol && checkInCol.Type !== 'time') {
            console.log('📌 Fixing check_in column type...');
            await conn.execute('ALTER TABLE attendance MODIFY check_in TIME');
            console.log('✅ check_in column fixed.');
        }
        
        if (checkOutCol && checkOutCol.Type !== 'time') {
            console.log('📌 Fixing check_out column type...');
            await conn.execute('ALTER TABLE attendance MODIFY check_out TIME');
            console.log('✅ check_out column fixed.');
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


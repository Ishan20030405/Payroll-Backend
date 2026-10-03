// backend/remove_basic_salary_from_employees.js
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
        console.log('🔄 Removing basic_salary column from employees table...');

        // Check if column exists
        const [columns] = await conn.execute('SHOW COLUMNS FROM employees LIKE "basic_salary"');
        
        if (columns.length > 0) {
            console.log('📌 Dropping basic_salary column...');
            await conn.execute('ALTER TABLE employees DROP COLUMN basic_salary');
            console.log('✅ basic_salary column removed successfully.');
        } else {
            console.log('✅ basic_salary column already removed.');
        }

        console.log('✅ Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


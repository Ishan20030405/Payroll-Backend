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
        const [columns] = await conn.execute('SHOW COLUMNS FROM payroll_settings');
        const existingColumns = new Set(columns.map(column => column.Field));

        if (!existingColumns.has('check_in_time')) {
            await conn.execute("ALTER TABLE payroll_settings ADD COLUMN check_in_time TIME DEFAULT '09:00:00' AFTER sunday_ot_rate");
        }
        if (!existingColumns.has('check_out_time')) {
            await conn.execute("ALTER TABLE payroll_settings ADD COLUMN check_out_time TIME DEFAULT '17:00:00' AFTER check_in_time");
        }

        console.log('Attendance times added to payroll_settings.');
    } finally {
        await conn.end();
    }
})().catch(error => {
    console.error('Migration failed:', error.message);
    process.exit(1);
});


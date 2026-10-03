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
        const [columns] = await conn.execute('SHOW COLUMNS FROM attendance LIKE "status"');
        if (columns.length > 0 && !columns[0].Type.includes("'Late'")) {
            await conn.execute("ALTER TABLE attendance MODIFY COLUMN status ENUM('Present', 'Absent', 'Late', 'Leave', 'Holiday') DEFAULT 'Present'");
            console.log('Added Late status to attendance.');
        } else {
            console.log('Late status already exists in attendance.');
        }

        const [indexes] = await conn.execute('SHOW INDEX FROM attendance WHERE Key_name = "unique_attendance"');
        if (indexes.length === 0) {
            await conn.execute('ALTER TABLE attendance ADD UNIQUE KEY unique_attendance (employee_id, date)');
            console.log('Added unique employee/date attendance constraint.');
        }
    } finally {
        await conn.end();
    }
})().catch(error => {
    console.error('Migration failed:', error.message);
    process.exit(1);
});


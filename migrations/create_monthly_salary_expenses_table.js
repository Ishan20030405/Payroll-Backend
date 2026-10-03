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
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS monthly_salary_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                year INT NOT NULL,
                month TINYINT NOT NULL,
                total_monthly_expenses DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_salary_expense_month (year, month),
                CONSTRAINT chk_monthly_salary_expenses_month CHECK (month BETWEEN 1 AND 12)
            )
        `);
        console.log('Table "monthly_salary_expenses" is ready.');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        await conn.end();
    }
})();


// backend/create_salary_structures_table.js
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
        console.log('🔄 Creating salary_structures table...');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS salary_structures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                department VARCHAR(20) NOT NULL,
                designation VARCHAR(100) NOT NULL,
                basic_pay DECIMAL(10,2) DEFAULT 0.00,
                attendance_allowance DECIMAL(10,2) DEFAULT 0.00,
                special_allowance DECIMAL(10,2) DEFAULT 0.00,
                other_allowance DECIMAL(10,2) DEFAULT 0.00,
                travelling_allowance DECIMAL(10,2) DEFAULT 0.00,
                normal_ot_rate DECIMAL(10,2) DEFAULT 0.00,
                sunday_ot_rate DECIMAL(10,2) DEFAULT 0.00,
                late_rate DECIMAL(10,2) DEFAULT 0.00,
                no_pay_rate DECIMAL(10,2) DEFAULT 0.00,
                epf DECIMAL(10,2) DEFAULT 0.00,
                other_deductions DECIMAL(10,2) DEFAULT 0.00,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (department) REFERENCES departments(department_id) ON DELETE CASCADE,
                UNIQUE KEY unique_dept_desig (department, designation)
            )
        `);
        console.log('✅ Table "salary_structures" created successfully.');

        console.log('✅ Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


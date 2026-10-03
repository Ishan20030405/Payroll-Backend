// backend/create_payroll_settings_table.js
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
        console.log('🔄 Creating/updating payroll_settings table...');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS payroll_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                working_days INT DEFAULT 26,
                working_hours DECIMAL(5,2) DEFAULT 8.00,
                ot_rate DECIMAL(10,2) DEFAULT 1.50,
                sunday_ot_rate DECIMAL(10,2) DEFAULT 2.00,
                check_in_time TIME DEFAULT '09:00:00',
                check_out_time TIME DEFAULT '17:00:00',
                salary_method VARCHAR(20) DEFAULT 'Monthly',
                epf_percentage DECIMAL(5,2) DEFAULT 12.00,
                etf_percentage DECIMAL(5,2) DEFAULT 3.00,
                updated_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Table "payroll_settings" created or already exists.');

        // Check if sunday_ot_rate column exists
        const [columns] = await conn.execute('SHOW COLUMNS FROM payroll_settings LIKE "sunday_ot_rate"');
        
        if (columns.length === 0) {
            console.log('📌 Adding sunday_ot_rate column...');
            await conn.execute(`
                ALTER TABLE payroll_settings 
                ADD COLUMN sunday_ot_rate DECIMAL(10,2) DEFAULT 2.00 AFTER ot_rate
            `);
            console.log('✅ sunday_ot_rate column added.');
        } else {
            console.log('✅ sunday_ot_rate column already exists.');
        }

        const [timeColumns] = await conn.execute(
            'SHOW COLUMNS FROM payroll_settings WHERE Field IN ("check_in_time", "check_out_time")'
        );
        const timeColumnNames = new Set(timeColumns.map(column => column.Field));
        if (!timeColumnNames.has('check_in_time')) {
            await conn.execute(
                "ALTER TABLE payroll_settings ADD COLUMN check_in_time TIME DEFAULT '09:00:00' AFTER sunday_ot_rate"
            );
        }
        if (!timeColumnNames.has('check_out_time')) {
            await conn.execute(
                "ALTER TABLE payroll_settings ADD COLUMN check_out_time TIME DEFAULT '17:00:00' AFTER check_in_time"
            );
        }

        const [rows] = await conn.execute('SELECT COUNT(*) as count FROM payroll_settings');
        if (rows[0].count === 0) {
            console.log('📌 Inserting default settings...');
            await conn.execute(`
                INSERT INTO payroll_settings 
                (working_days, working_hours, ot_rate, sunday_ot_rate, check_in_time,
                 check_out_time, salary_method, epf_percentage, etf_percentage)
                VALUES (26, 8, 1.5, 2.0, '09:00:00', '17:00:00', 'Monthly', 12, 3)
            `);
            console.log('✅ Default settings inserted.');
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


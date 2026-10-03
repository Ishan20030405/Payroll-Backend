require('dotenv').config();
const db = require('../src/config/db');

async function createTable() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS employee_monthly_attendance_summary (
                employee_id VARCHAR(10) NOT NULL,
                year INT NOT NULL,
                month TINYINT NOT NULL,
                total_working_days INT DEFAULT 0,
                total_working_hours DECIMAL(8,2) DEFAULT 0.00,
                total_ot_hours DECIMAL(8,2) DEFAULT 0.00,
                total_sunday_working_hours DECIMAL(8,2) DEFAULT 0.00,
                total_late_hours DECIMAL(8,2) DEFAULT 0.00,
                total_no_pay_days INT DEFAULT 0,
                total_leaves INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (employee_id, year, month),
                CONSTRAINT fk_monthly_summary_employee
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                CONSTRAINT chk_monthly_summary_month CHECK (month BETWEEN 1 AND 12)
            )
        `);
        const [columns] = await db.execute('SHOW COLUMNS FROM employee_monthly_attendance_summary');
        if (!columns.some(column => column.Field === 'total_sunday_working_hours')) {
            await db.execute(`
                ALTER TABLE employee_monthly_attendance_summary
                ADD COLUMN total_sunday_working_hours DECIMAL(8,2) DEFAULT 0.00
                AFTER total_ot_hours
            `);
        }
        await db.execute(`
            UPDATE attendance
            SET overtime = working_hours, working_hours = 0
            WHERE DAYOFWEEK(date) = 1 AND working_hours > 0
        `);

        await db.execute(`
            INSERT INTO employee_monthly_attendance_summary
                (employee_id, year, month, total_working_days, total_working_hours,
                 total_ot_hours, total_sunday_working_hours, total_late_hours,
                 total_no_pay_days, total_leaves)
            SELECT e.employee_id, YEAR(a.date), MONTH(a.date),
                COALESCE(MAX(ps.working_days), 0),
                COALESCE(SUM(a.working_hours), 0),
                COALESCE(SUM(CASE WHEN DAYOFWEEK(a.date) <> 1 THEN a.overtime ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN DAYOFWEEK(a.date) = 1 THEN a.overtime ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN a.status = 'Late' AND a.check_in IS NOT NULL
                    THEN GREATEST(TIME_TO_SEC(TIMEDIFF(a.check_in, COALESCE(ps.check_in_time, '09:00:00'))) / 3600, 0)
                    ELSE 0 END), 0),
                SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END),
                SUM(CASE WHEN a.status = 'Leave' THEN 1 ELSE 0 END)
            FROM attendance a
            INNER JOIN employees e ON e.id = a.employee_id
            LEFT JOIN payroll_settings ps ON 1 = 1
            GROUP BY e.employee_id, YEAR(a.date), MONTH(a.date)
            ON DUPLICATE KEY UPDATE
                total_working_days = VALUES(total_working_days),
                total_working_hours = VALUES(total_working_hours),
                total_ot_hours = VALUES(total_ot_hours),
                total_sunday_working_hours = VALUES(total_sunday_working_hours),
                total_late_hours = VALUES(total_late_hours),
                total_no_pay_days = VALUES(total_no_pay_days),
                total_leaves = VALUES(total_leaves)
        `);
        console.log('Employee monthly attendance summary table created and populated successfully.');
    } catch (error) {
        console.error('Error creating employee monthly attendance summary table:', error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

createTable();


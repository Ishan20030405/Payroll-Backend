require('dotenv').config();
const db = require('../src/config/db');

async function updatePayrollOtAmounts() {
    try {
        const [columns] = await db.query('SHOW COLUMNS FROM payrolls');
        if (!columns.some(column => column.Field === 'total_normal_ot_amount')) {
            await db.query('ALTER TABLE payrolls ADD COLUMN total_normal_ot_amount DECIMAL(10,2) DEFAULT 0.00 AFTER deductions');
        }
        if (!columns.some(column => column.Field === 'total_sunday_ot_amount')) {
            await db.query('ALTER TABLE payrolls ADD COLUMN total_sunday_ot_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_normal_ot_amount');
        }

        await db.query(`
            UPDATE payrolls p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN employee_monthly_attendance_summary s
                ON s.employee_id=e.employee_id AND s.year=YEAR(p.month_year) AND s.month=MONTH(p.month_year)
            LEFT JOIN salary_structures ss
                ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department))
                AND ss.designation=e.designation
            SET p.total_normal_ot_amount=COALESCE(ss.normal_ot_rate,0)*COALESCE(s.total_ot_hours,0),
                p.total_sunday_ot_amount=COALESCE(ss.sunday_ot_rate,0)*COALESCE(s.total_sunday_working_hours,0)
        `);

        console.log('Payroll OT amount columns updated successfully.');
    } catch (error) {
        console.error('Payroll OT amount update failed:', error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

updatePayrollOtAmounts();


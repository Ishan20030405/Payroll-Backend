require('dotenv').config();
const db = require('../src/config/db');

async function createBasicPayTable() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS basic_pay (
                employee_id VARCHAR(10) NOT NULL,
                year INT NOT NULL,
                month TINYINT NOT NULL,
                no_pay_amount DECIMAL(10,2) DEFAULT 0.00,
                late_amount DECIMAL(10,2) DEFAULT 0.00,
                net_basic_pay DECIMAL(10,2) DEFAULT 0.00,
                epf DECIMAL(10,2) DEFAULT 0.00,
                PRIMARY KEY (employee_id, year, month),
                CONSTRAINT fk_basic_pay_employee
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
                CONSTRAINT chk_basic_pay_month CHECK (month BETWEEN 1 AND 12)
            )
        `);
        const [basicPayColumns] = await db.query('SHOW COLUMNS FROM basic_pay');
        if (!basicPayColumns.some(column => column.Field === 'net_basic_pay')) {
            await db.query('ALTER TABLE basic_pay ADD COLUMN net_basic_pay DECIMAL(10,2) DEFAULT 0.00 AFTER late_amount');
        }
        if (!basicPayColumns.some(column => column.Field === 'epf')) {
            await db.query('ALTER TABLE basic_pay ADD COLUMN epf DECIMAL(10,2) DEFAULT 0.00 AFTER net_basic_pay');
        }
        await db.execute('DELETE FROM basic_pay');
        await db.execute(`
            INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf)
            SELECT s.employee_id, s.year, s.month,
                COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days,
                COALESCE(ss.late_rate, 0) * (
                    FLOOR(s.total_late_hours) +
                    ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60)
                ),
                COALESCE(ss.basic_pay, 0) - (COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days + COALESCE(ss.late_rate, 0) * (FLOOR(s.total_late_hours) + ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60))),
                (COALESCE(ss.basic_pay, 0) - (COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days + COALESCE(ss.late_rate, 0) * (FLOOR(s.total_late_hours) + ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60)))) * COALESCE(ss.epf, 0) / 100
            FROM employee_monthly_attendance_summary s
            INNER JOIN employees e ON e.employee_id = s.employee_id
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
        `);
        await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_insert');
        await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_insert AFTER INSERT ON employee_monthly_attendance_summary FOR EACH ROW INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf) SELECT NEW.employee_id, NEW.year, NEW.month, COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days, COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60)), COALESCE(ss.basic_pay,0)-(COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days+COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))), (COALESCE(ss.basic_pay,0)-(COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days+COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))))*COALESCE(ss.epf,0)/100 FROM employees e LEFT JOIN salary_structures ss ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department)) AND ss.designation=e.designation WHERE e.employee_id=NEW.employee_id`);
        await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_update');
        await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_update AFTER UPDATE ON employee_monthly_attendance_summary FOR EACH ROW INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf) SELECT NEW.employee_id, NEW.year, NEW.month, COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days, COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60)), COALESCE(ss.basic_pay,0)-(COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days+COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))), (COALESCE(ss.basic_pay,0)-(COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days+COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))))*COALESCE(ss.epf,0)/100 FROM employees e LEFT JOIN salary_structures ss ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department)) AND ss.designation=e.designation WHERE e.employee_id=NEW.employee_id ON DUPLICATE KEY UPDATE no_pay_amount=VALUES(no_pay_amount), late_amount=VALUES(late_amount), net_basic_pay=VALUES(net_basic_pay), epf=VALUES(epf)`);
        await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_delete');
        await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_delete AFTER DELETE ON employee_monthly_attendance_summary FOR EACH ROW DELETE FROM basic_pay WHERE employee_id=OLD.employee_id AND year=OLD.year AND month=OLD.month`);
        await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_salary_insert');
        await db.query(`CREATE TRIGGER sync_basic_pay_after_salary_insert AFTER INSERT ON salary_structures FOR EACH ROW UPDATE basic_pay b JOIN employees e ON e.employee_id=b.employee_id JOIN employee_monthly_attendance_summary s ON s.employee_id=b.employee_id AND s.year=b.year AND s.month=b.month SET b.no_pay_amount=COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days, b.late_amount=COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)), b.net_basic_pay=COALESCE(NEW.basic_pay,0)-(b.no_pay_amount+b.late_amount), b.epf=(COALESCE(NEW.basic_pay,0)-(b.no_pay_amount+b.late_amount))*COALESCE(NEW.epf,0)/100 WHERE e.department=NEW.department AND e.designation=NEW.designation`);
        await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_salary_update');
        await db.query(`CREATE TRIGGER sync_basic_pay_after_salary_update AFTER UPDATE ON salary_structures FOR EACH ROW UPDATE basic_pay b JOIN employees e ON e.employee_id=b.employee_id JOIN employee_monthly_attendance_summary s ON s.employee_id=b.employee_id AND s.year=b.year AND s.month=b.month SET b.no_pay_amount=COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days, b.late_amount=COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)), b.net_basic_pay=COALESCE(NEW.basic_pay,0)-(b.no_pay_amount+b.late_amount), b.epf=(COALESCE(NEW.basic_pay,0)-(b.no_pay_amount+b.late_amount))*COALESCE(NEW.epf,0)/100 WHERE e.department=NEW.department AND e.designation=NEW.designation`);
        console.log('Basic pay table created successfully.');
    } catch (error) {
        console.error('Basic pay table creation failed:', error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

createBasicPayTable();


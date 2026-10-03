// backend/src/config/initDatabase.js
const db = require('./db');
const bcrypt = require('bcrypt');

module.exports = async function initDatabase() {
    try {
        console.log('🔄 Initializing database...');
        await db.ensureDatabase();
        console.log(`✅ Database "${process.env.DB_NAME || 'payroll_db'}" is ready.`);

        const safeExecute = async (fn) => {
            try {
                await fn();
            } catch (err) {
                if (err.code !== 'ER_DBACCESS_DENIED_ERROR') throw err;
                console.log('   ⚠️ Notice (Cloud Restricted):', err.message);
            }
        };

        // ============================================
        // 1. USERS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('ADMIN', 'HR', 'EMPLOYEE') DEFAULT 'EMPLOYEE',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `));
        console.log('   ✅ Table "users" verified.');
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS company_information (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_name VARCHAR(150) NOT NULL,
                email VARCHAR(150),
                registration_number VARCHAR(100),
                tax_number VARCHAR(100),
                phone_number VARCHAR(50),
                website VARCHAR(200),
                company_address VARCHAR(255),
                base_currency VARCHAR(30) DEFAULT 'USD ($)',
                time_zone VARCHAR(100) DEFAULT 'UTC -08:00 (Pacific Time)',
                logo_data LONGBLOB,
                logo_mime_type VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `));
        console.log('   ✅ Table "company_information" verified.');
        await safeExecute(async () => {
            const [companyColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM company_information');
            if (!companyColumns.some(column => column.Field === 'logo_data')) {
                await safeExecute(() => db.execute('ALTER TABLE company_information ADD COLUMN logo_data MEDIUMBLOB AFTER time_zone');
            }
            if (!companyColumns.some(column => column.Field === 'logo_mime_type')) {
                await safeExecute(() => db.execute('ALTER TABLE company_information ADD COLUMN logo_mime_type VARCHAR(100) AFTER logo_data');
            }
            await safeExecute(() => db.execute('ALTER TABLE company_information MODIFY COLUMN logo_data LONGBLOB');
        });

        // ============================================
        // 2. DEPARTMENTS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS departments (
                department_id VARCHAR(20) PRIMARY KEY,
                department_name VARCHAR(100) NOT NULL,
                department_head VARCHAR(100),
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✅ Table "departments" verified.');

        // ============================================
        // 3. DESIGNATIONS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS designations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                designation_name VARCHAR(100) NOT NULL,
                department VARCHAR(20),
                basic_salary DECIMAL(10,2) DEFAULT 0.00,
                ot_eligible BOOLEAN DEFAULT TRUE,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (department) REFERENCES departments(department_id) ON DELETE SET NULL
            )
        `);
        console.log('   ✅ Table "designations" verified.');

        // ============================================
        // 4. EMPLOYEES TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(10) UNIQUE NOT NULL,
                user_id INT NULL,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(15),
                department VARCHAR(20),
                designation VARCHAR(50),
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                dob DATE,
                nic VARCHAR(15),
                gender VARCHAR(10),
                marital_status VARCHAR(20),
                address TEXT,
                emergency_contact VARCHAR(100),
                join_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (department) REFERENCES departments(department_id) ON DELETE SET NULL
            )
        `);
        console.log('   ✅ Table "employees" verified.');

        // ============================================
        // 5. ATTENDANCE TABLE - UPDATED with created_at and updated_at
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                date DATE NOT NULL,
                check_in TIME NULL,
                check_out TIME NULL,
                working_hours DECIMAL(5,2) DEFAULT 0.00,
                overtime DECIMAL(5,2) DEFAULT 0.00,
                status ENUM('Present', 'Absent', 'Late', 'Leave', 'Holiday') DEFAULT 'Present',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                UNIQUE KEY unique_attendance (employee_id, date)
            )
        `);
        console.log('   ✅ Table "attendance" verified.');

        const [attendanceStatusColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM attendance LIKE "status"');
        if (attendanceStatusColumns.length > 0 && !attendanceStatusColumns[0].Type.includes("'Late'")) {
            await safeExecute(() => db.execute("ALTER TABLE attendance MODIFY COLUMN status ENUM('Present', 'Absent', 'Late', 'Leave', 'Holiday') DEFAULT 'Present'");
            console.log('   ✅ Added "Late" status to attendance.');
        }
        const [attendanceIndexes] = await safeExecute(() => db.execute('SHOW INDEX FROM attendance WHERE Key_name = "unique_attendance"');
        if (attendanceIndexes.length === 0) {
            await safeExecute(() => db.execute('ALTER TABLE attendance ADD UNIQUE KEY unique_attendance (employee_id, date)');
            console.log('   ✅ Added unique employee/date attendance constraint.');
        }

        // ============================================
        // 6. EMPLOYEE MONTHLY ATTENDANCE SUMMARY TABLE
        // ============================================
        await safeExecute(() => db.execute(`
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
        const [summaryColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM employee_monthly_attendance_summary');
        if (!summaryColumns.some(column => column.Field === 'total_sunday_working_hours')) {
            await safeExecute(() => db.execute(`
                ALTER TABLE employee_monthly_attendance_summary
                ADD COLUMN total_sunday_working_hours DECIMAL(8,2) DEFAULT 0.00
                AFTER total_ot_hours
            `);
        }
        console.log('   ✅ Table "employee_monthly_attendance_summary" verified.');
        await safeExecute(() => db.execute(`
            UPDATE attendance
            SET overtime = working_hours, working_hours = 0
            WHERE DAYOFWEEK(date) = 1 AND working_hours > 0
        `);

        // ============================================
        // 7. PAYROLL TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS payrolls (
                employee_id INT NOT NULL,
                month_year DATE NOT NULL,
                total_allowances DECIMAL(10,2) DEFAULT 0.00,
                total_deductions DECIMAL(10,2) DEFAULT 0.00,
                total_normal_ot_amount DECIMAL(10,2) DEFAULT 0.00,
                total_sunday_ot_amount DECIMAL(10,2) DEFAULT 0.00,
                total_additions DECIMAL(10,2) DEFAULT 0.00,
                gross_salary DECIMAL(10,2) DEFAULT 0.00,
                net_salary DECIMAL(10,2) DEFAULT 0.00,
                status ENUM('Pending', 'Generated', 'Complete', 'Paid') DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (employee_id, month_year),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            )
        `);
        console.log('   ✅ Table "payrolls" verified.');
        const [payrollColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM payrolls');
        if (payrollColumns.some(column => column.Field === 'allowances')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls CHANGE COLUMN allowances total_allowances DECIMAL(10,2) DEFAULT 0.00');
        }
        if (payrollColumns.some(column => column.Field === 'deductions')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls CHANGE COLUMN deductions total_deductions DECIMAL(10,2) DEFAULT 0.00');
        }
        if (!payrollColumns.some(column => column.Field === 'total_normal_ot_amount')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls ADD COLUMN total_normal_ot_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_deductions');
        }
        if (!payrollColumns.some(column => column.Field === 'total_sunday_ot_amount')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls ADD COLUMN total_sunday_ot_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_normal_ot_amount');
        }
        if (!payrollColumns.some(column => column.Field === 'total_additions')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls ADD COLUMN total_additions DECIMAL(10,2) DEFAULT 0.00 AFTER total_sunday_ot_amount');
        }
        if (!payrollColumns.some(column => column.Field === 'gross_salary')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls ADD COLUMN gross_salary DECIMAL(10,2) DEFAULT 0.00 AFTER total_additions');
        }
        if (!payrollColumns.some(column => column.Field === 'net_salary')) {
            await safeExecute(() => db.execute('ALTER TABLE payrolls ADD COLUMN net_salary DECIMAL(10,2) DEFAULT 0.00 AFTER gross_salary');
        }
        await safeExecute(() => db.execute("ALTER TABLE payrolls MODIFY COLUMN status ENUM('Pending', 'Generated', 'Complete', 'Paid') DEFAULT 'Pending'");
        await safeExecute(() => db.execute(`
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
        await safeExecute(() => db.execute(`
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
        await safeExecute(() => db.execute(`
            UPDATE payrolls p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN employee_monthly_attendance_summary s
                ON s.employee_id = e.employee_id AND s.year = YEAR(p.month_year) AND s.month = MONTH(p.month_year)
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            SET p.total_allowances = COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0),
                p.total_normal_ot_amount = COALESCE(ss.normal_ot_rate, 0) * COALESCE(s.total_ot_hours, 0),
                p.total_sunday_ot_amount = COALESCE(ss.sunday_ot_rate, 0) * COALESCE(s.total_sunday_working_hours, 0),
                p.total_additions = p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount
        `);
        await safeExecute(() => db.execute(`
            INSERT INTO payrolls
                (employee_id, month_year, total_allowances, total_normal_ot_amount, total_sunday_ot_amount, total_additions, status)
            SELECT e.id,
                DATE(CONCAT(s.year, '-', LPAD(s.month, 2, '0'), '-01')),
                COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0),
                COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0),
                COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0),
                COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0)
                    + COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0)
                    + COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0),
                'Pending'
            FROM employee_monthly_attendance_summary s
            INNER JOIN employees e ON e.employee_id = s.employee_id
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            ON DUPLICATE KEY UPDATE
                total_allowances = VALUES(total_allowances),
                total_normal_ot_amount = VALUES(total_normal_ot_amount),
                total_sunday_ot_amount = VALUES(total_sunday_ot_amount),
                total_additions = VALUES(total_additions)
        `);
        await safeExecute(() => db.execute(`
            UPDATE payrolls p
            JOIN employees e ON e.id = p.employee_id
            SET p.status = CASE
                WHEN p.status = 'Paid' THEN 'Paid'
                WHEN (
                    SELECT COUNT(*)
                    FROM attendance a
                    WHERE a.employee_id = e.id
                      AND YEAR(a.date) = YEAR(p.month_year)
                      AND MONTH(a.date) = MONTH(p.month_year)
                ) >= COALESCE((SELECT working_days FROM payroll_settings LIMIT 1), 26)
                THEN 'Complete'
                ELSE 'Pending'
            END
            WHERE p.status <> 'Paid'
        `);

        // ============================================
        // 7. PAYSLIPS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS payslips (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                month_year DATE NOT NULL,
                employee_code VARCHAR(50) NOT NULL,
                employee_name VARCHAR(150) NOT NULL,
                department VARCHAR(100),
                designation VARCHAR(100),
                basic_salary DECIMAL(10,2) DEFAULT 0.00,
                attendance_allowance DECIMAL(10,2) DEFAULT 0.00,
                special_allowance DECIMAL(10,2) DEFAULT 0.00,
                travelling_allowance DECIMAL(10,2) DEFAULT 0.00,
                other_allowance DECIMAL(10,2) DEFAULT 0.00,
                other_deduction DECIMAL(10,2) DEFAULT 0.00,
                employer_epf DECIMAL(10,2) DEFAULT 0.00,
                employer_etf DECIMAL(10,2) DEFAULT 0.00,
                total_allowances DECIMAL(10,2) DEFAULT 0.00,
                total_deductions DECIMAL(10,2) DEFAULT 0.00,
                total_normal_ot_amount DECIMAL(10,2) DEFAULT 0.00,
                total_sunday_ot_amount DECIMAL(10,2) DEFAULT 0.00,
                total_additions DECIMAL(10,2) DEFAULT 0.00,
                gross_salary DECIMAL(10,2) DEFAULT 0.00,
                net_salary DECIMAL(10,2) DEFAULT 0.00,
                total_working_days INT DEFAULT 0,
                total_no_pay_days INT DEFAULT 0,
                total_late_hours DECIMAL(10,2) DEFAULT 0.00,
                no_pay_amount DECIMAL(10,2) DEFAULT 0.00,
                late_amount DECIMAL(10,2) DEFAULT 0.00,
                epf DECIMAL(10,2) DEFAULT 0.00,
                payroll_status VARCHAR(20) NOT NULL,
                payroll_data JSON,
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_employee_month_payslip (employee_id, month_year),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            )
        `);
        const [payslipColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM payslips');
        const payslipColumnNames = new Set(payslipColumns.map(column => column.Field));
        if (payslipColumnNames.has('payroll_id')) {
            await safeExecute(() => db.execute('ALTER TABLE payslips MODIFY COLUMN payroll_id INT NULL');
        }
        const payslipColumnsToAdd = [
            ['month_year', 'DATE NULL AFTER employee_id'],
            ['employee_code', 'VARCHAR(50) NULL AFTER month_year'],
            ['employee_name', 'VARCHAR(150) NULL AFTER employee_code'],
            ['department', 'VARCHAR(100) NULL AFTER employee_name'],
            ['designation', 'VARCHAR(100) NULL AFTER department'],
            ['basic_salary', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['attendance_allowance', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['special_allowance', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['travelling_allowance', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['other_allowance', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['other_deduction', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['employer_epf', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['employer_etf', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_allowances', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_deductions', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_normal_ot_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_sunday_ot_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_additions', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['gross_salary', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['net_salary', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['total_working_days', 'INT DEFAULT 0'],
            ['total_no_pay_days', 'INT DEFAULT 0'],
            ['total_late_hours', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['no_pay_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['late_amount', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['epf', 'DECIMAL(10,2) DEFAULT 0.00'],
            ['payroll_status', "VARCHAR(20) DEFAULT 'Complete'"],
            ['payroll_data', 'JSON'],
            ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
        ];
        for (const [column, definition] of payslipColumnsToAdd) {
            if (!payslipColumnNames.has(column)) {
                await safeExecute(() => db.execute(`ALTER TABLE payslips ADD COLUMN ${column} ${definition}`);
            }
        }
        const [payslipIndexes] = await safeExecute(() => db.execute('SHOW INDEX FROM payslips');
        if (!payslipIndexes.some(index => index.Key_name === 'unique_employee_month_payslip')) {
            await safeExecute(() => db.execute('ALTER TABLE payslips ADD UNIQUE KEY unique_employee_month_payslip (employee_id, month_year)');
        }
        console.log('   ✅ Table "payslips" verified.');

        // ============================================
        // 8. MONTHLY SALARY EXPENSES TABLE
        // ============================================
        await safeExecute(() => db.execute(`
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

        // ============================================
        // 9. ACTIVITY LOGS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                action VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('   ✅ Table "activity_logs" verified.');

        // ============================================
        // 9. PAYROLL SETTINGS TABLE
        // ============================================
        await safeExecute(() => db.execute(`
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
        console.log('   ✅ Table "payroll_settings" verified.');

        const [payrollSettingColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM payroll_settings');
        const payrollSettingColumnNames = new Set(payrollSettingColumns.map(column => column.Field));
        if (!payrollSettingColumnNames.has('check_in_time')) {
            await safeExecute(() => db.execute("ALTER TABLE payroll_settings ADD COLUMN check_in_time TIME DEFAULT '09:00:00' AFTER sunday_ot_rate");
            console.log('   ✅ Added "check_in_time" to payroll_settings.');
        }
        if (!payrollSettingColumnNames.has('check_out_time')) {
            await safeExecute(() => db.execute("ALTER TABLE payroll_settings ADD COLUMN check_out_time TIME DEFAULT '17:00:00' AFTER check_in_time");
            console.log('   ✅ Added "check_out_time" to payroll_settings.');
        }

        const [payrollSettings] = await safeExecute(() => db.execute('SELECT id FROM payroll_settings LIMIT 1');
        if (payrollSettings.length === 0) {
            await safeExecute(() => db.execute(`
                INSERT INTO payroll_settings
                (working_days, working_hours, ot_rate, sunday_ot_rate, check_in_time,
                 check_out_time, salary_method, epf_percentage, etf_percentage)
                VALUES (26, 8.00, 1.50, 2.00, '09:00:00', '17:00:00', 'Monthly', 12.00, 3.00)
            `);
            console.log('   ✅ Default payroll settings inserted.');
        }

        // ============================================
        // 10. SALARY STRUCTURES TABLE
        // ============================================
        await safeExecute(() => db.execute(`
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
        console.log('   ✅ Table "salary_structures" verified.');

        // ============================================
        // SEED DEFAULT DATA
        // ============================================

        // Check if admin user exists
        const [adminCheck] = await safeExecute(() => db.execute('SELECT * FROM users WHERE username = "admin"');
        if (adminCheck.length === 0) {
            console.log('📌 Creating default admin user...');
            const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
            const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
            await safeExecute(() => db.execute(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                ['admin', hashedPassword, 'ADMIN']
            );
            console.log('   ✅ Admin user created (username: admin, password: admin)');
        } else {
            console.log('   ℹ️ Default admin user already exists, skipping.');
        }

        await safeExecute(() => db.execute(`
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

        await safeExecute(() => db.execute(`
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
        const [basicPayColumns] = await safeExecute(() => db.execute('SHOW COLUMNS FROM basic_pay');
        if (!basicPayColumns.some(column => column.Field === 'net_basic_pay')) {
            await safeExecute(() => db.execute('ALTER TABLE basic_pay ADD COLUMN net_basic_pay DECIMAL(10,2) DEFAULT 0.00 AFTER late_amount');
        }
        if (!basicPayColumns.some(column => column.Field === 'epf')) {
            await safeExecute(() => db.execute('ALTER TABLE basic_pay ADD COLUMN epf DECIMAL(10,2) DEFAULT 0.00 AFTER net_basic_pay');
        }
        await safeExecute(() => db.execute('DELETE FROM basic_pay');
        await safeExecute(() => db.execute(`
            INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf)
            SELECT calculated.employee_id, calculated.year, calculated.month,
                calculated.no_pay_amount, calculated.late_amount,
                COALESCE(calculated.salary_basic_pay, 0) - (calculated.no_pay_amount + calculated.late_amount),
                (COALESCE(calculated.salary_basic_pay, 0) - (calculated.no_pay_amount + calculated.late_amount)) * COALESCE(calculated.epf_rate, 0) / 100
            FROM (
                SELECT s.*, COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days AS no_pay_amount,
                    COALESCE(ss.basic_pay, 0) AS salary_basic_pay,
                    COALESCE(ss.epf, 0) AS epf_rate,
                    COALESCE(ss.late_rate, 0) * (
                    FLOOR(s.total_late_hours) +
                    ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60)
                    ) AS late_amount
                FROM employee_monthly_attendance_summary s
                INNER JOIN employees e ON e.employee_id = s.employee_id
                LEFT JOIN salary_structures ss
                    ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                    AND ss.designation = e.designation
            ) calculated
        `);
        await safeExecute(() => db.execute(`
            UPDATE payrolls p
            INNER JOIN employees e ON e.id = p.employee_id
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            LEFT JOIN basic_pay bp
                ON bp.employee_id = e.employee_id
                AND bp.year = YEAR(p.month_year)
                AND bp.month = MONTH(p.month_year)
            SET p.total_deductions = COALESCE(ss.other_deductions, 0) + COALESCE(bp.epf, 0)
        `);
        await safeExecute(() => db.execute(`
            UPDATE payrolls p
            INNER JOIN employees e ON e.id = p.employee_id
            LEFT JOIN basic_pay bp
                ON bp.employee_id = e.employee_id
                AND bp.year = YEAR(p.month_year)
                AND bp.month = MONTH(p.month_year)
            SET p.gross_salary = COALESCE(bp.net_basic_pay, 0) + COALESCE(p.total_additions, 0)
        `);
        await safeExecute(() => db.execute(`
            UPDATE payrolls
            SET net_salary = COALESCE(gross_salary, 0) - COALESCE(total_deductions, 0)
        `);
        await safeExecute(() => db.execute(`
            CREATE TABLE IF NOT EXISTS employer_epf_etf (
                employee_id INT NOT NULL,
                year INT NOT NULL,
                month TINYINT NOT NULL,
                epf_amount DECIMAL(10,2) DEFAULT 0.00,
                etf_amount DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (employee_id, year, month),
                CONSTRAINT fk_employer_epf_etf_employee
                    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                CONSTRAINT chk_employer_epf_etf_month CHECK (month BETWEEN 1 AND 12)
            )
        `);
        await safeExecute(() => db.execute(`
            INSERT INTO employer_epf_etf (employee_id, year, month, epf_amount, etf_amount)
            SELECT e.id, bp.year, bp.month,
                COALESCE(ps.epf_percentage, 12) / 100 * COALESCE(bp.net_basic_pay, 0),
                COALESCE(ps.etf_percentage, 3) / 100 * COALESCE(bp.net_basic_pay, 0)
            FROM basic_pay bp
            INNER JOIN employees e ON e.employee_id = bp.employee_id
            LEFT JOIN payroll_settings ps ON 1 = 1
            ON DUPLICATE KEY UPDATE
                epf_amount = VALUES(epf_amount),
                etf_amount = VALUES(etf_amount)
        `);
        try {
            await db.query('DROP TRIGGER IF EXISTS sync_employer_epf_etf_after_basic_pay_insert');
            await db.query(`CREATE TRIGGER sync_employer_epf_etf_after_basic_pay_insert
                AFTER INSERT ON basic_pay FOR EACH ROW
                INSERT INTO employer_epf_etf (employee_id, year, month, epf_amount, etf_amount)
                SELECT e.id, NEW.year, NEW.month,
                    COALESCE(ps.epf_percentage, 12) / 100 * COALESCE(NEW.net_basic_pay, 0),
                    COALESCE(ps.etf_percentage, 3) / 100 * COALESCE(NEW.net_basic_pay, 0)
                FROM employees e
                LEFT JOIN payroll_settings ps ON 1 = 1
                WHERE e.employee_id = NEW.employee_id
                ON DUPLICATE KEY UPDATE
                    epf_amount = VALUES(epf_amount), etf_amount = VALUES(etf_amount)`);
            await db.query('DROP TRIGGER IF EXISTS sync_employer_epf_etf_after_basic_pay_update');
            await db.query(`CREATE TRIGGER sync_employer_epf_etf_after_basic_pay_update
                AFTER UPDATE ON basic_pay FOR EACH ROW
                UPDATE employer_epf_etf c
                JOIN employees e ON e.id = c.employee_id AND e.employee_id = NEW.employee_id
                JOIN payroll_settings ps ON 1 = 1
                SET c.epf_amount = COALESCE(ps.epf_percentage, 12) / 100 * COALESCE(NEW.net_basic_pay, 0),
                    c.etf_amount = COALESCE(ps.etf_percentage, 3) / 100 * COALESCE(NEW.net_basic_pay, 0)
                WHERE c.year = NEW.year AND c.month = NEW.month`);
                    await db.query('DROP TRIGGER IF EXISTS sync_employer_epf_etf_after_basic_pay_delete');
                    await db.query(`CREATE TRIGGER sync_employer_epf_etf_after_basic_pay_delete
                            AFTER DELETE ON basic_pay FOR EACH ROW
                            DELETE FROM employer_epf_etf
                            WHERE employee_id = (SELECT id FROM employees WHERE employee_id = OLD.employee_id)
                                AND year = OLD.year AND month = OLD.month`);
            await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_insert');
            await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_insert
                AFTER INSERT ON employee_monthly_attendance_summary FOR EACH ROW
                INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf)
                SELECT NEW.employee_id, NEW.year, NEW.month, COALESCE(ss.no_pay_rate, 0) * NEW.total_no_pay_days,
                    COALESCE(ss.late_rate, 0) * (FLOOR(NEW.total_late_hours) + ((NEW.total_late_hours - FLOOR(NEW.total_late_hours)) * 100 / 60)),
                    COALESCE(ss.basic_pay, 0) - (COALESCE(ss.no_pay_rate, 0) * NEW.total_no_pay_days + COALESCE(ss.late_rate, 0) * (FLOOR(NEW.total_late_hours) + ((NEW.total_late_hours - FLOOR(NEW.total_late_hours)) * 100 / 60))),
                    (COALESCE(ss.basic_pay, 0) - (COALESCE(ss.no_pay_rate, 0) * NEW.total_no_pay_days + COALESCE(ss.late_rate, 0) * (FLOOR(NEW.total_late_hours) + ((NEW.total_late_hours - FLOOR(NEW.total_late_hours)) * 100 / 60)))) * COALESCE(ss.epf, 0) / 100
                FROM employees e LEFT JOIN salary_structures ss ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department)) AND ss.designation=e.designation
                WHERE e.employee_id=NEW.employee_id`);
            await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_update');
            await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_update
                AFTER UPDATE ON employee_monthly_attendance_summary FOR EACH ROW
                INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf)
                SELECT NEW.employee_id, NEW.year, NEW.month,
                    COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days,
                    COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))
                    ,COALESCE(ss.basic_pay,0) - (COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days + COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60))),
                    (COALESCE(ss.basic_pay,0) - (COALESCE(ss.no_pay_rate,0)*NEW.total_no_pay_days + COALESCE(ss.late_rate,0)*(FLOOR(NEW.total_late_hours)+((NEW.total_late_hours-FLOOR(NEW.total_late_hours))*100/60)))) * COALESCE(ss.epf,0) / 100
                FROM employees e
                LEFT JOIN salary_structures ss ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department)) AND ss.designation=e.designation
                WHERE e.employee_id=NEW.employee_id
                ON DUPLICATE KEY UPDATE no_pay_amount=VALUES(no_pay_amount), late_amount=VALUES(late_amount), net_basic_pay=VALUES(net_basic_pay), epf=VALUES(epf)`);
            await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_summary_delete');
            await db.query(`CREATE TRIGGER sync_basic_pay_after_summary_delete
                AFTER DELETE ON employee_monthly_attendance_summary FOR EACH ROW
                DELETE FROM basic_pay WHERE employee_id=OLD.employee_id AND year=OLD.year AND month=OLD.month`);
            await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_salary_insert');
            await db.query(`CREATE TRIGGER sync_basic_pay_after_salary_insert
                AFTER INSERT ON salary_structures FOR EACH ROW
                UPDATE basic_pay b JOIN employees e ON e.employee_id=b.employee_id
                JOIN employee_monthly_attendance_summary s ON s.employee_id=b.employee_id AND s.year=b.year AND s.month=b.month
                SET b.no_pay_amount=COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days,
                    b.late_amount=COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)),
                    b.net_basic_pay=COALESCE(NEW.basic_pay,0) - (COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days + COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)))
                    ,b.epf=(COALESCE(NEW.basic_pay,0) - (COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days + COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)))) * COALESCE(NEW.epf,0) / 100
                WHERE (e.department=NEW.department OR e.department=REPLACE(NEW.department, 'DEP-', '')) AND e.designation=NEW.designation`);
            await db.query('DROP TRIGGER IF EXISTS sync_basic_pay_after_salary_update');
            await db.query(`CREATE TRIGGER sync_basic_pay_after_salary_update
                AFTER UPDATE ON salary_structures FOR EACH ROW
                UPDATE basic_pay b
                JOIN employees e ON e.employee_id=b.employee_id
                JOIN employee_monthly_attendance_summary s
                    ON s.employee_id=b.employee_id AND s.year=b.year AND s.month=b.month
                SET b.no_pay_amount=COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days,
                    b.late_amount=COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+
                        ((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)),
                    b.net_basic_pay=COALESCE(NEW.basic_pay,0) - (COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days + COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)))
                    ,b.epf=(COALESCE(NEW.basic_pay,0) - (COALESCE(NEW.no_pay_rate,0)*s.total_no_pay_days + COALESCE(NEW.late_rate,0)*(FLOOR(s.total_late_hours)+((s.total_late_hours-FLOOR(s.total_late_hours))*100/60)))) * COALESCE(NEW.epf,0) / 100
                WHERE (e.department=NEW.department OR e.department=REPLACE(NEW.department, 'DEP-', '')) AND e.designation=NEW.designation`);
        } catch (triggerError) {
            console.log('   ⚠️ Triggers skipped (cloud permissions managed):', triggerError.message);
        }
        console.log('🎉 Database initialization complete!');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
};

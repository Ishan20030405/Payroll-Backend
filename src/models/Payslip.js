const db = require('../config/db');
const MonthlySalaryExpense = require('./MonthlySalaryExpense');

class Payslip {
    static async getForUser(userId) {
        const [rows] = await db.execute(`
            SELECT p.*, DATE_FORMAT(p.month_year, '%Y-%m-%d') AS month_year_text
            FROM payslips p
            INNER JOIN employees e ON e.id = p.employee_id
            WHERE e.user_id = ?
              AND LOWER(TRIM(p.payroll_status)) = 'complete'
            ORDER BY p.month_year DESC
        `, [userId]);
        return rows;
    }

    static async findByEmployeeAndMonth(employeeId, monthYear) {
        const [rows] = await db.execute(`
            SELECT *
            FROM payslips
            WHERE employee_id = ? AND DATE(month_year) = DATE(?)
        `, [employeeId, monthYear]);
        return rows[0] || null;
    }

    static async updateByEmployeeAndMonth(employeeId, monthYear, data) {
        const existing = await this.findByEmployeeAndMonth(employeeId, monthYear);
        let payslip = existing;

        if (!payslip) {
            const [rows] = await db.execute(`
                SELECT p.status, e.employee_id AS employee_code, e.full_name AS employee_name,
                       e.department, e.designation
                FROM payrolls p
                INNER JOIN employees e ON e.id = p.employee_id
                WHERE p.employee_id = ? AND DATE(p.month_year) = DATE(?)
                  AND LOWER(TRIM(p.status)) = 'complete'
            `, [employeeId, monthYear]);
            if (!rows[0]) return false;

            const source = rows[0];
            const payrollData = JSON.stringify(data);
            await db.execute(`
                INSERT INTO payslips (
                    employee_id, month_year, employee_code, employee_name, department, designation,
                    basic_salary, attendance_allowance, special_allowance, travelling_allowance,
                    other_allowance, other_deduction, employer_epf, employer_etf,
                    total_allowances, total_deductions, total_normal_ot_amount,
                    total_sunday_ot_amount, total_additions, gross_salary, net_salary,
                    total_working_days, total_no_pay_days, total_late_hours, no_pay_amount,
                    late_amount, epf, payroll_status, payroll_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                employeeId, monthYear, source.employee_code, source.employee_name, source.department, source.designation,
                data.basic_salary || 0, data.attendance_allowance || 0, data.special_allowance || 0,
                data.travelling_allowance || 0, data.other_allowance || 0, data.other_deduction || 0,
                data.employer_epf || 0, data.employer_etf || 0, data.total_allowances || 0, data.total_deductions || 0,
                data.total_normal_ot_amount || 0, data.total_sunday_ot_amount || 0, data.total_additions || 0,
                data.gross_salary || 0, data.net_salary || 0, data.total_working_days || 0,
                data.total_no_pay_days || 0, data.total_late_hours || 0, data.no_pay_amount || 0,
                data.late_amount || 0, data.epf || 0, source.status, payrollData
            ]);
            return true;
        }

        const currentData = typeof payslip.payroll_data === 'string'
            ? JSON.parse(payslip.payroll_data || '{}')
            : (payslip.payroll_data || {});
        const payrollData = JSON.stringify({ ...currentData, ...data });
        const fields = [
            'basic_salary', 'total_allowances', 'total_deductions', 'total_normal_ot_amount',
            'total_sunday_ot_amount', 'total_additions', 'gross_salary', 'net_salary',
            'total_working_days', 'total_no_pay_days', 'total_late_hours', 'no_pay_amount',
            'late_amount', 'epf', 'attendance_allowance', 'special_allowance',
            'travelling_allowance', 'other_allowance', 'other_deduction', 'employer_epf', 'employer_etf'
        ];
        const values = fields.map(field => data[field] !== undefined ? data[field] : payslip[field]);
        values.push(payrollData, employeeId, monthYear);

        const [result] = await db.execute(`
            UPDATE payslips
            SET ${fields.map(field => `${field} = ?`).join(', ')},
                payroll_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = ? AND DATE(month_year) = DATE(?)
        `, values);
        return result.affectedRows > 0 || Boolean(payslip);
    }

    static async getOptions() {
        const [rows] = await db.execute(`
            SELECT *, DATE_FORMAT(month_year, '%Y-%m-%d') AS month_year_text
            FROM payslips
            ORDER BY month_year DESC, employee_name ASC
        `);
        return rows;
    }

    static async getGenerationOptions() {
        const [rows] = await db.execute(`
            SELECT DISTINCT
                p.month_year,
                DATE_FORMAT(p.month_year, '%Y-%m-%d') AS month_year_text,
                e.id AS employee_id,
                e.employee_id AS employee_code,
                e.full_name AS employee_name,
                e.department,
                e.designation
            FROM payrolls p
            INNER JOIN employees e ON e.id = p.employee_id
            WHERE LOWER(TRIM(p.status)) = 'complete'
            ORDER BY p.month_year DESC, e.full_name ASC
        `);
        return rows;
    }

    static async generate({ monthYear, mode = 'All', employeeId, department, designation }) {
        const filters = ['LOWER(TRIM(p.status)) = LOWER(?) AND DATE(p.month_year) = DATE(?)'];
        const values = ['Complete', monthYear];

        if (mode === 'One by one') {
            filters.push('e.id = ?');
            values.push(employeeId);
        } else if (mode === 'department') {
            filters.push('e.department = ?');
            values.push(department);
        } else if (mode === 'designation') {
            filters.push('e.designation = ?');
            values.push(designation);
        }

        const [rows] = await db.execute(`
            SELECT p.*, e.employee_id AS employee_code, e.full_name AS employee_name,
                   e.department, e.designation,
                   COALESCE(bp.net_basic_pay, 0) AS basic_salary,
                   COALESCE(s.total_working_days, 0) AS total_working_days,
                   COALESCE(s.total_no_pay_days, 0) AS total_no_pay_days,
                   COALESCE(s.total_late_hours, 0) AS total_late_hours,
                   COALESCE(s.total_ot_hours, 0) AS normal_ot_hours,
                   COALESCE(s.total_sunday_working_hours, 0) AS sunday_ot_hours,
                   COALESCE(bp.no_pay_amount, 0) AS no_pay_amount,
                   COALESCE(bp.late_amount, 0) AS late_amount,
                   COALESCE(bp.epf, 0) AS epf,
                   COALESCE(ss.attendance_allowance, 0) AS attendance_allowance,
                   COALESCE(ss.special_allowance, 0) AS special_allowance,
                   COALESCE(ss.travelling_allowance, 0) AS travelling_allowance,
                   COALESCE(ss.other_allowance, 0) AS other_allowance,
                   COALESCE(ss.normal_ot_rate, 0) AS normal_ot_rate,
                   COALESCE(ss.sunday_ot_rate, 0) AS sunday_ot_rate,
                   COALESCE(ss.other_deductions, 0) AS other_deduction,
                   COALESCE(eet.epf_amount, 0) AS employer_epf,
                   COALESCE(eet.etf_amount, 0) AS employer_etf
            FROM payrolls p
            INNER JOIN employees e ON e.id = p.employee_id
            LEFT JOIN employee_monthly_attendance_summary s
              ON s.employee_id = e.employee_id
             AND s.year = YEAR(p.month_year)
             AND s.month = MONTH(p.month_year)
            LEFT JOIN basic_pay bp
              ON bp.employee_id = e.employee_id
             AND bp.year = YEAR(p.month_year)
             AND bp.month = MONTH(p.month_year)
                        LEFT JOIN salary_structures ss
                            ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                         AND ss.designation = e.designation
                         AND ss.status = 'Active'
                        LEFT JOIN employer_epf_etf eet
                            ON eet.employee_id = e.id
                         AND eet.year = YEAR(p.month_year)
                         AND eet.month = MONTH(p.month_year)
            WHERE ${filters.join(' AND ')}
            ORDER BY e.full_name
        `, values);

        for (const row of rows) {
            const snapshot = JSON.stringify(row);
            await db.execute(`
                INSERT INTO payslips (
                    employee_id, month_year, employee_code, employee_name, department, designation,
                    basic_salary, attendance_allowance, special_allowance, travelling_allowance,
                    other_allowance, other_deduction, employer_epf, employer_etf,
                    total_allowances, total_deductions, total_normal_ot_amount,
                    total_sunday_ot_amount, total_additions, gross_salary, net_salary,
                    total_working_days, total_no_pay_days, total_late_hours, no_pay_amount,
                    late_amount, epf, payroll_status, payroll_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    employee_code = VALUES(employee_code), employee_name = VALUES(employee_name),
                    department = VALUES(department), designation = VALUES(designation),
                    basic_salary = VALUES(basic_salary), attendance_allowance = VALUES(attendance_allowance),
                    special_allowance = VALUES(special_allowance), travelling_allowance = VALUES(travelling_allowance),
                    other_allowance = VALUES(other_allowance), other_deduction = VALUES(other_deduction),
                    employer_epf = VALUES(employer_epf), employer_etf = VALUES(employer_etf),
                    total_allowances = VALUES(total_allowances),
                    total_deductions = VALUES(total_deductions), total_normal_ot_amount = VALUES(total_normal_ot_amount),
                    total_sunday_ot_amount = VALUES(total_sunday_ot_amount), total_additions = VALUES(total_additions),
                    gross_salary = VALUES(gross_salary), net_salary = VALUES(net_salary),
                    total_working_days = VALUES(total_working_days), total_no_pay_days = VALUES(total_no_pay_days),
                    total_late_hours = VALUES(total_late_hours), no_pay_amount = VALUES(no_pay_amount),
                    late_amount = VALUES(late_amount), epf = VALUES(epf), payroll_status = VALUES(payroll_status),
                    payroll_data = VALUES(payroll_data), updated_at = CURRENT_TIMESTAMP
            `, [
                row.employee_id, row.month_year, row.employee_code, row.employee_name, row.department, row.designation,
                row.basic_salary, row.attendance_allowance, row.special_allowance, row.travelling_allowance,
                row.other_allowance, row.other_deduction, row.employer_epf, row.employer_etf,
                row.total_allowances, row.total_deductions, row.total_normal_ot_amount,
                row.total_sunday_ot_amount, row.total_additions, row.gross_salary, row.net_salary,
                row.total_working_days, row.total_no_pay_days, row.total_late_hours, row.no_pay_amount,
                row.late_amount, row.epf, row.status, snapshot
            ]);
        }
        await MonthlySalaryExpense.recalculate(monthYear);
        return rows;
    }
}

module.exports = Payslip;
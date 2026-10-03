// backend/src/models/Payroll.js
const db = require('../config/db');

class Payroll {
    static async refreshOvertimeAmounts() {
        await db.execute(`
            UPDATE payrolls p
            INNER JOIN employees e ON e.id = p.employee_id
            LEFT JOIN employee_monthly_attendance_summary s
                ON s.employee_id = e.employee_id
                AND s.year = YEAR(p.month_year)
                AND s.month = MONTH(p.month_year)
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            LEFT JOIN basic_pay bp
                ON bp.employee_id = e.employee_id
                AND bp.year = YEAR(p.month_year)
                AND bp.month = MONTH(p.month_year)
            SET p.total_allowances = COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0),
                p.total_deductions = COALESCE(ss.other_deductions, 0) + COALESCE(bp.epf, 0),
                p.total_normal_ot_amount = COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0),
                p.total_sunday_ot_amount = COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0),
                p.total_additions = p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount,
                p.gross_salary = COALESCE(bp.net_basic_pay, 0)
                    + p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount,
                p.net_salary = (
                    COALESCE(bp.net_basic_pay, 0)
                    + p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount
                ) - p.total_deductions
        `);
    }

    // Get all payrolls
    static async getAll() {
        await this.refreshOvertimeAmounts();
        const query = `
            SELECT p.*, e.full_name, e.employee_id
            FROM payrolls p
            LEFT JOIN employees e ON p.employee_id = e.id
            ORDER BY p.month_year DESC, p.created_at DESC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    static async getMonths() {
        const query = `
            SELECT DISTINCT DATE_FORMAT(month_year, '%Y-%m-%d') AS month_year
            FROM payrolls
            ORDER BY month_year DESC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    // Get payroll by ID
    static async findByKey(employeeId, monthYear) {
        await this.refreshOvertimeAmounts();
        const query = `
            SELECT p.*, e.full_name, e.employee_id
            FROM payrolls p
            LEFT JOIN employees e ON p.employee_id = e.id
            WHERE p.employee_id = ? AND p.month_year = ?
        `;
        const [rows] = await db.execute(query, [employeeId, monthYear]);
        return rows[0] || null;
    }

    // Get payrolls by employee ID
    static async findByEmployeeId(employeeId) {
        await this.refreshOvertimeAmounts();
        const query = `
            SELECT * FROM payrolls 
            WHERE employee_id = ? 
            ORDER BY month_year DESC
        `;
        const [rows] = await db.execute(query, [employeeId]);
        return rows;
    }

    // Get payroll by employee and month
    static async findByEmployeeAndMonth(employeeId, monthYear) {
        await this.refreshOvertimeAmounts();
        const query = `
            SELECT * FROM payrolls 
            WHERE employee_id = ? AND month_year = ?
        `;
        const [rows] = await db.execute(query, [employeeId, monthYear]);
        return rows[0] || null;
    }

    // Get employee IDs and payroll months from attendance summaries
    static async getGenerationRows(monthYear) {
        const query = `
            SELECT
                e.id AS employee_id,
                e.department,
                e.designation,
                DATE(CONCAT(s.year, '-', LPAD(s.month, 2, '0'), '-01')) AS month_year
            FROM employee_monthly_attendance_summary s
            INNER JOIN employees e ON e.employee_id = s.employee_id
            WHERE s.year = YEAR(?) AND s.month = MONTH(?)
            ORDER BY e.id
        `;
        const [rows] = await db.execute(query, [monthYear, monthYear]);
        return rows;
    }

    // Create payroll
    static async create(data) {
        const {
            employee_id,
            month_year,
            total_allowances = 0,
            total_deductions = 0,
            total_normal_ot_amount = 0,
            total_sunday_ot_amount = 0,
            status = 'Pending'
        } = data;

        const query = `
            INSERT INTO payrolls 
            (employee_id, month_year, total_allowances, total_deductions, total_normal_ot_amount, total_sunday_ot_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            employee_id,
            month_year,
            total_allowances,
            total_deductions,
            total_normal_ot_amount,
            total_sunday_ot_amount,
            status
        ]);
        await db.execute(`
            UPDATE payrolls p
            JOIN employees e ON e.id = p.employee_id
            LEFT JOIN employee_monthly_attendance_summary s
                ON s.employee_id=e.employee_id AND s.year=YEAR(p.month_year) AND s.month=MONTH(p.month_year)
            LEFT JOIN salary_structures ss
                ON (ss.department=e.department OR ss.department=CONCAT('DEP-',e.department))
                AND ss.designation=e.designation
            LEFT JOIN basic_pay bp
                ON bp.employee_id=e.employee_id
                AND bp.year=YEAR(p.month_year)
                AND bp.month=MONTH(p.month_year)
            SET p.total_allowances=COALESCE(ss.attendance_allowance,0)
                    + COALESCE(ss.special_allowance,0)
                    + COALESCE(ss.travelling_allowance,0)
                    + COALESCE(ss.other_allowance,0),
                p.total_deductions=COALESCE(ss.other_deductions,0)+COALESCE(bp.epf,0),
                p.total_normal_ot_amount=COALESCE(ss.normal_ot_rate,0)*COALESCE(s.total_ot_hours,0),
                p.total_sunday_ot_amount=COALESCE(ss.sunday_ot_rate,0)*COALESCE(s.total_sunday_working_hours,0),
                p.total_additions=p.total_allowances+p.total_normal_ot_amount+p.total_sunday_ot_amount,
                p.gross_salary=COALESCE(bp.net_basic_pay,0)
                    + p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount,
                p.net_salary=(
                    COALESCE(bp.net_basic_pay,0)
                    + p.total_allowances + p.total_normal_ot_amount + p.total_sunday_ot_amount
                ) - p.total_deductions
            WHERE p.employee_id=? AND p.month_year=?
        `, [employee_id, month_year]);
        return { employee_id, month_year };
    }

    // Update payroll
    static async update(employeeId, monthYear, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'total_allowances', 'total_deductions', 'total_normal_ot_amount', 'total_sunday_ot_amount',
            'total_additions', 'gross_salary', 'net_salary', 'status'
        ];

        allowedFields.forEach(field => {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        });

        if (fields.length === 0) {
            return true;
        }

        values.push(employeeId, monthYear);
        const query = `UPDATE payrolls SET ${fields.join(', ')} WHERE employee_id = ? AND month_year = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    // Delete payroll
    static async delete(employeeId, monthYear) {
        const query = 'DELETE FROM payrolls WHERE employee_id = ? AND month_year = ?';
        const [result] = await db.execute(query, [employeeId, monthYear]);
        return result.affectedRows > 0;
    }

    // Get payroll by month/year
    static async findByMonth(monthYear) {
        await this.refreshOvertimeAmounts();
        const query = `
            SELECT p.*, e.full_name, e.employee_id
            FROM payrolls p
            LEFT JOIN employees e ON p.employee_id = e.id
            WHERE p.month_year = ?
            ORDER BY e.full_name
        `;
        const [rows] = await db.execute(query, [monthYear]);
        return rows;
    }

    // Get summary statistics
    static async getSummary() {
        const query = `
            SELECT 
                COUNT(DISTINCT employee_id) as total_employees,
                SUM(total_deductions) as total_deductions,
                COUNT(*) as total_records
            FROM payrolls
        `;
        const [rows] = await db.execute(query);
        return rows[0] || null;
    }
}

module.exports = Payroll;
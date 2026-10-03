// backend/src/models/Attendance.js
const db = require('../config/db');

class Attendance {
    // Get attendance by ID
    static async findById(id) {
        const query = `
            SELECT 
                a.*,
                e.employee_id,
                e.full_name,
                e.department
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE a.id = ?
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

    // Get attendance by date
    static async getByDate(date) {
        const query = `
            SELECT 
                a.*,
                e.employee_id,
                e.full_name,
                e.department
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE a.date = ?
            ORDER BY e.full_name
        `;
        const [rows] = await db.execute(query, [date]);
        return rows;
    }

    // Get attendance by employee and date
    static async getByEmployeeAndDate(employeeId, date) {
        const query = `
            SELECT * FROM attendance 
            WHERE employee_id = ? AND date = ?
        `;
        const [rows] = await db.execute(query, [employeeId, date]);
        return rows[0] || null;
    }

    // Create attendance
    static async create(data) {
        const {
            employee_id,
            date,
            check_in,
            check_out,
            working_hours = 0,
            overtime = 0,
            status = 'Present'
        } = data;

        const query = `
            INSERT INTO attendance 
            (employee_id, date, check_in, check_out, working_hours, overtime, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            employee_id,
            date,
            check_in || null,
            check_out || null,
            working_hours,
            overtime,
            status
        ]);
        await this.refreshMonthlySummary(employee_id, date);
        return result.insertId;
    }

    static async refreshMonthlySummary(employeeId, date) {
        await db.execute(`
            DELETE FROM employee_monthly_attendance_summary
                        WHERE employee_id = (SELECT employee_id FROM employees WHERE id = ?)
                            AND year = YEAR(?) AND month = MONTH(?)
        `, [employeeId, date, date]);

        await this.refreshBasicPay(employeeId, date);

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
            WHERE a.employee_id = ? AND YEAR(a.date) = YEAR(?) AND MONTH(a.date) = MONTH(?)
            GROUP BY e.employee_id, YEAR(a.date), MONTH(a.date)
        `, [employeeId, date, date]);

        await db.execute(`
            INSERT INTO payrolls
                (employee_id, month_year, total_allowances, total_deductions, total_normal_ot_amount, total_sunday_ot_amount, total_additions, gross_salary, net_salary, status)
            SELECT e.id,
                DATE(CONCAT(s.year, '-', LPAD(s.month, 2, '0'), '-01')),
                MAX(COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0)),
                MAX(COALESCE(ss.other_deductions, 0) + COALESCE(bp.epf, 0)),
                MAX(COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0)),
                MAX(COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0)),
                MAX(COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0)
                    + COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0)
                    + COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0)),
                MAX(COALESCE(bp.net_basic_pay, 0)
                    + COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0)
                    + COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0)
                    + COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0)
                    - (COALESCE(ss.other_deductions, 0) + COALESCE(bp.epf, 0))),
                MAX(COALESCE(bp.net_basic_pay, 0)
                    + COALESCE(ss.attendance_allowance, 0)
                    + COALESCE(ss.special_allowance, 0)
                    + COALESCE(ss.travelling_allowance, 0)
                    + COALESCE(ss.other_allowance, 0)
                    + COALESCE(s.total_ot_hours, 0) * COALESCE(ss.normal_ot_rate, 0)
                    + COALESCE(s.total_sunday_working_hours, 0) * COALESCE(ss.sunday_ot_rate, 0)),
                CASE WHEN COUNT(a.id) >= COALESCE(MAX(ps.working_days), 26)
                    THEN 'Complete' ELSE 'Pending' END
            FROM employee_monthly_attendance_summary s
            INNER JOIN employees e ON e.employee_id = s.employee_id
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            LEFT JOIN basic_pay bp
                ON bp.employee_id = e.employee_id
                AND bp.year = s.year
                AND bp.month = s.month
            LEFT JOIN attendance a
                ON a.employee_id = e.id
                AND YEAR(a.date) = s.year
                AND MONTH(a.date) = s.month
            LEFT JOIN payroll_settings ps ON 1 = 1
            WHERE e.id = ? AND s.year = YEAR(?) AND s.month = MONTH(?)
            GROUP BY e.id, s.year, s.month, s.total_ot_hours, s.total_sunday_working_hours
            ON DUPLICATE KEY UPDATE
                total_allowances = VALUES(total_allowances),
                total_deductions = VALUES(total_deductions),
                total_normal_ot_amount = VALUES(total_normal_ot_amount),
                total_sunday_ot_amount = VALUES(total_sunday_ot_amount),
                total_additions = VALUES(total_additions),
                gross_salary = VALUES(gross_salary),
                net_salary = VALUES(net_salary),
                status = CASE WHEN payrolls.status = 'Paid' THEN 'Paid' ELSE VALUES(status) END
        `, [employeeId, date, date]);

        await this.syncGeneratedPayslip(employeeId, date);
    }

    static async syncGeneratedPayslip(employeeId, date) {
        const [payrollRows] = await db.execute(`
            SELECT month_year, status
            FROM payrolls
            WHERE employee_id = ?
              AND YEAR(month_year) = YEAR(?)
              AND MONTH(month_year) = MONTH(?)
        `, [employeeId, date, date]);

        const payroll = payrollRows[0];
        if (!payroll) return;

        const [payslipRows] = await db.execute(`
            SELECT id
            FROM payslips
            WHERE employee_id = ? AND month_year = ?
        `, [employeeId, payroll.month_year]);

        if (!payslipRows.length) return;

        if (String(payroll.status).toLowerCase() !== 'complete') {
            await db.execute('DELETE FROM payslips WHERE id = ?', [payslipRows[0].id]);
            return;
        }

        const Payslip = require('./Payslip');
        await Payslip.generate({
            monthYear: payroll.month_year,
            mode: 'One by one',
            employeeId
        });
    }

    static async refreshBasicPay(employeeId, date) {
        await db.execute(`
            DELETE FROM basic_pay
            WHERE employee_id = (SELECT employee_id FROM employees WHERE id = ?)
              AND year = YEAR(?) AND month = MONTH(?)
        `, [employeeId, date, date]);

        await db.execute(`
            INSERT INTO basic_pay (employee_id, year, month, no_pay_amount, late_amount, net_basic_pay, epf)
            SELECT s.employee_id, s.year, s.month,
                COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days,
                COALESCE(ss.late_rate, 0) * (
                    FLOOR(s.total_late_hours) +
                    ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60)
                ),
                COALESCE(ss.basic_pay, 0) - (
                    COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days +
                    COALESCE(ss.late_rate, 0) * (FLOOR(s.total_late_hours) +
                        ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60))
                ),
                (COALESCE(ss.basic_pay, 0) - (
                    COALESCE(ss.no_pay_rate, 0) * s.total_no_pay_days +
                    COALESCE(ss.late_rate, 0) * (FLOOR(s.total_late_hours) +
                        ((s.total_late_hours - FLOOR(s.total_late_hours)) * 100 / 60))
                )) * COALESCE(ss.epf, 0) / 100
            FROM employee_monthly_attendance_summary s
            INNER JOIN employees e ON e.employee_id = s.employee_id
            LEFT JOIN salary_structures ss
                ON (ss.department = e.department OR ss.department = CONCAT('DEP-', e.department))
                AND ss.designation = e.designation
            WHERE e.id = ? AND s.year = YEAR(?) AND s.month = MONTH(?)
        `, [employeeId, date, date]);
    }

    // Update attendance
    static async update(id, data) {
        const [existingRows] = await db.execute('SELECT employee_id, date FROM attendance WHERE id = ?', [id]);
        const existing = existingRows[0];
        if (!existing) {
            return false;
        }

        const fields = [];
        const values = [];

        const allowedFields = [
            'check_in', 'check_out', 'working_hours', 'overtime', 'status'
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

        values.push(id);
        const query = `UPDATE attendance SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(query, values);
        await this.refreshMonthlySummary(existing.employee_id, existing.date);
        return result.affectedRows > 0 || Boolean(existing);
    }

    // Delete attendance
    static async delete(id) {
        const [attendanceRows] = await db.execute('SELECT employee_id, date FROM attendance WHERE id = ?', [id]);
        const attendance = attendanceRows[0];
        const query = 'DELETE FROM attendance WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        if (result.affectedRows > 0 && attendance) {
            await this.refreshMonthlySummary(attendance.employee_id, attendance.date);
        }
        return result.affectedRows > 0;
    }

    // Get attendance by employee
    static async getByEmployee(employeeId, startDate, endDate) {
        let query = `
            SELECT * FROM attendance 
            WHERE employee_id = ?
        `;
        const params = [employeeId];

        if (startDate) {
            query += ' AND date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND date <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY date DESC';
        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Get attendance summary for a month
    static async getMonthlySummary(employeeId, month, year) {
        const query = `
            SELECT 
                COUNT(*) as total_days,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_days,
                SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
                SUM(working_hours) as total_hours,
                SUM(overtime) as total_overtime
            FROM attendance
            WHERE employee_id = ?
            AND MONTH(date) = ?
            AND YEAR(date) = ?
        `;
        const [rows] = await db.execute(query, [employeeId, month, year]);
        return rows[0] || null;
    }

    static async getSummaryMonths(employeeId) {
        const query = `
            SELECT DISTINCT year, month
            FROM employee_monthly_attendance_summary
            WHERE employee_id = ?
            ORDER BY year DESC, month DESC
        `;
        const [rows] = await db.execute(query, [employeeId]);
        return rows;
    }

    static async getStoredMonthlySummary(employeeId, year, month) {
        const query = `
            SELECT *
            FROM employee_monthly_attendance_summary
            WHERE employee_id = ? AND year = ? AND month = ?
        `;
        const [rows] = await db.execute(query, [employeeId, year, month]);
        return rows[0] || null;
    }

    static async getBasicPay(employeeId, year, month) {
        const query = `
            SELECT *
            FROM basic_pay
            WHERE employee_id = ? AND year = ? AND month = ?
        `;
        const [rows] = await db.execute(query, [employeeId, year, month]);
        return rows[0] || null;
    }

    // Bulk create attendance
    static async bulkCreate(records) {
        if (!records || records.length === 0) return 0;

        const values = [];
        const placeholders = [];

        records.forEach(record => {
            placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
            values.push(
                record.employee_id,
                record.date,
                record.check_in || null,
                record.check_out || null,
                record.working_hours || 0,
                record.overtime || 0,
                record.status || 'Present'
            );
        });

        const query = `
            INSERT INTO attendance 
            (employee_id, date, check_in, check_out, working_hours, overtime, status)
            VALUES ${placeholders.join(', ')}
            ON DUPLICATE KEY UPDATE
                check_in = VALUES(check_in),
                check_out = VALUES(check_out),
                working_hours = VALUES(working_hours),
                overtime = VALUES(overtime),
                status = VALUES(status)
        `;
        const [result] = await db.execute(query, values);
        const months = new Set(records.map(record => `${record.employee_id}|${record.date}`));
        for (const value of months) {
            const [employeeId, date] = value.split('|');
            await this.refreshMonthlySummary(employeeId, date);
        }
        return result.affectedRows;
    }
}

module.exports = Attendance;
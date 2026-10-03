// backend/src/models/PayrollSetting.js
const db = require('../config/db');

class PayrollSetting {
    // Get payroll settings (first row)
    static async get() {
        const query = 'SELECT * FROM payroll_settings LIMIT 1';
        const [rows] = await db.execute(query);
        return rows[0] || null;
    }

    // Create or update payroll settings
    static async upsert(data) {
        const {
            working_days = 26,
            working_hours = 8,
            ot_rate = 1.5,
            sunday_ot_rate = 2.0,
            check_in_time = '09:00',
            check_out_time = '17:00',
            salary_method = 'Monthly',
            epf_percentage = 12,
            etf_percentage = 3,
            updated_by = null
        } = data;

        const existing = await this.get();

        if (existing) {
            const query = `
                UPDATE payroll_settings 
                SET working_days = ?,
                    working_hours = ?,
                    ot_rate = ?,
                    sunday_ot_rate = ?,
                    check_in_time = ?,
                    check_out_time = ?,
                    salary_method = ?,
                    epf_percentage = ?,
                    etf_percentage = ?,
                    updated_by = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;
            const [result] = await db.execute(query, [
                working_days,
                working_hours,
                ot_rate,
                sunday_ot_rate,
                check_in_time,
                check_out_time,
                salary_method,
                epf_percentage,
                etf_percentage,
                updated_by,
                existing.id
            ]);
            return result.affectedRows > 0;
        } else {
            const query = `
                INSERT INTO payroll_settings 
                (working_days, working_hours, ot_rate, sunday_ot_rate, salary_method, 
                 check_in_time, check_out_time, epf_percentage, etf_percentage, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(query, [
                working_days,
                working_hours,
                ot_rate,
                sunday_ot_rate,
                check_in_time,
                check_out_time,
                salary_method,
                epf_percentage,
                etf_percentage,
                updated_by
            ]);
            return result.insertId > 0;
        }
    }

    // Reset to defaults
    static async reset(updated_by = null) {
        const defaults = {
            working_days: 26,
            working_hours: 8,
            ot_rate: 1.5,
            sunday_ot_rate: 2.0,
            check_in_time: '09:00',
            check_out_time: '17:00',
            salary_method: 'Monthly',
            epf_percentage: 12,
            etf_percentage: 3
        };

        const existing = await this.get();

        if (existing) {
            const query = `
                UPDATE payroll_settings 
                SET working_days = ?,
                    working_hours = ?,
                    ot_rate = ?,
                    sunday_ot_rate = ?,
                    check_in_time = ?,
                    check_out_time = ?,
                    salary_method = ?,
                    epf_percentage = ?,
                    etf_percentage = ?,
                    updated_by = ?,
                    updated_at = NOW()
                WHERE id = ?
            `;
            const [result] = await db.execute(query, [
                defaults.working_days,
                defaults.working_hours,
                defaults.ot_rate,
                defaults.sunday_ot_rate,
                defaults.check_in_time,
                defaults.check_out_time,
                defaults.salary_method,
                defaults.epf_percentage,
                defaults.etf_percentage,
                updated_by,
                existing.id
            ]);
            return result.affectedRows > 0;
        } else {
            const query = `
                INSERT INTO payroll_settings 
                (working_days, working_hours, ot_rate, sunday_ot_rate, salary_method, 
                 check_in_time, check_out_time, epf_percentage, etf_percentage, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await db.execute(query, [
                defaults.working_days,
                defaults.working_hours,
                defaults.ot_rate,
                defaults.sunday_ot_rate,
                defaults.check_in_time,
                defaults.check_out_time,
                defaults.salary_method,
                defaults.epf_percentage,
                defaults.etf_percentage,
                updated_by
            ]);
            return result.insertId > 0;
        }
    }
}

module.exports = PayrollSetting;
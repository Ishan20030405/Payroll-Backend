const db = require('../config/db');

class MonthlySalaryExpense {
    static async getRecent(limit = 12) {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 36));
        const [rows] = await db.execute(`
            SELECT id, year, month, total_monthly_expenses
            FROM monthly_salary_expenses
            ORDER BY year DESC, month DESC
            LIMIT ${safeLimit}
        `);
        return rows.reverse();
    }

    static async recalculate(monthYear) {
        await db.execute(`
            INSERT INTO monthly_salary_expenses (year, month, total_monthly_expenses)
            SELECT YEAR(?), MONTH(?),
                   COALESCE((
                       SELECT SUM(net_salary)
                       FROM payslips
                       WHERE YEAR(month_year) = YEAR(?)
                         AND MONTH(month_year) = MONTH(?)
                   ), 0) + COALESCE((
                       SELECT SUM(epf_amount + etf_amount)
                       FROM employer_epf_etf
                       WHERE year = YEAR(?)
                         AND month = MONTH(?)
                   ), 0)
            ON DUPLICATE KEY UPDATE
                total_monthly_expenses = VALUES(total_monthly_expenses),
                updated_at = CURRENT_TIMESTAMP
        `, [monthYear, monthYear, monthYear, monthYear, monthYear, monthYear]);
    }
}

module.exports = MonthlySalaryExpense;
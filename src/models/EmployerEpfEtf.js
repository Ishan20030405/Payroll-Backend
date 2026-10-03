const db = require('../config/db');

class EmployerEpfEtf {
    static async findByEmployeeAndMonth(employeeId, year, month) {
        const query = `
            SELECT employee_id, year, month, epf_amount, etf_amount
            FROM employer_epf_etf
            WHERE employee_id = ? AND year = ? AND month = ?
        `;
        const [rows] = await db.execute(query, [employeeId, year, month]);
        return rows[0] || null;
    }
}

module.exports = EmployerEpfEtf;
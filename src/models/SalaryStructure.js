// backend/src/models/SalaryStructure.js
const db = require('../config/db');

class SalaryStructure {
    // Get all salary structures
    static async getAll() {
        const query = `
            SELECT * FROM salary_structures 
            ORDER BY department, designation
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    // Get salary structure by ID
    static async findById(id) {
        const query = 'SELECT * FROM salary_structures WHERE id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

    // ✅ Get salary structure by department and designation
    static async findByDepartmentAndDesignation(department, designation) {
        if (!department || !designation) return null;
        
        const query = `
            SELECT * FROM salary_structures 
            WHERE department = ? AND designation = ?
        `;
        const [rows] = await db.execute(query, [department, designation]);
        return rows[0] || null;
    }

    // Create salary structure
    static async create(data) {
        const {
            department,
            designation,
            basic_pay = 0,
            attendance_allowance = 0,
            special_allowance = 0,
            other_allowance = 0,
            travelling_allowance = 0,
            normal_ot_rate = 0,
            sunday_ot_rate = 0,
            late_rate = 0,
            no_pay_rate = 0,
            epf = 0,
            other_deductions = 0,
            status = 'Active'
        } = data;

        const query = `
            INSERT INTO salary_structures 
            (department, designation, basic_pay, attendance_allowance, 
             special_allowance, other_allowance, travelling_allowance,
             normal_ot_rate, sunday_ot_rate, late_rate, no_pay_rate,
             epf, other_deductions, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            department,
            designation,
            basic_pay,
            attendance_allowance,
            special_allowance,
            other_allowance,
            travelling_allowance,
            normal_ot_rate,
            sunday_ot_rate,
            late_rate,
            no_pay_rate,
            epf,
            other_deductions,
            status
        ]);
        return result.insertId;
    }

    // Update salary structure
    static async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'department', 'designation', 'basic_pay', 
            'attendance_allowance', 'special_allowance', 
            'other_allowance', 'travelling_allowance',
            'normal_ot_rate', 'sunday_ot_rate', 
            'late_rate', 'no_pay_rate',
            'epf', 'other_deductions', 'status'
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
        const query = `UPDATE salary_structures SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    // Delete salary structure
    static async delete(id) {
        const query = 'DELETE FROM salary_structures WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows > 0;
    }

    // Get salary structures by department
    static async findByDepartment(department) {
        const query = `
            SELECT * FROM salary_structures 
            WHERE department = ? 
            ORDER BY designation
        `;
        const [rows] = await db.execute(query, [department]);
        return rows;
    }
}

module.exports = SalaryStructure;
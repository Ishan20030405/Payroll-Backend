// backend/src/models/Designation.js
const db = require('../config/db');

class Designation {
    // Get all designations
    static async getAll() {
        const query = 'SELECT * FROM designations ORDER BY designation_name';
        const [rows] = await db.execute(query);
        return rows;
    }

    // Get designation by ID
    static async findById(id) {
        const query = 'SELECT * FROM designations WHERE id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

    // ✅ NEW: Check if designation exists by name
    static async exists(designationName) {
        const query = 'SELECT COUNT(*) as count FROM designations WHERE designation_name = ?';
        const [rows] = await db.execute(query, [designationName]);
        return rows[0].count > 0;
    }

    // Get designations by department
    static async findByDepartment(department) {
        const query = 'SELECT * FROM designations WHERE department = ? ORDER BY designation_name';
        const [rows] = await db.execute(query, [department]);
        return rows;
    }

    // Create designation
    static async create(data) {
        const {
            designation_name,
            department,
            basic_salary = 0,
            ot_eligible = 1,
            status = 'Active'
        } = data;

        const query = `
            INSERT INTO designations 
            (designation_name, department, basic_salary, ot_eligible, status)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            designation_name,
            department || null,
            basic_salary,
            ot_eligible ? 1 : 0,
            status
        ]);
        return result.insertId;
    }

    // Update designation
    static async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'designation_name', 'department', 'basic_salary', 'ot_eligible', 'status'
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
        const query = `UPDATE designations SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    // Delete designation
    static async delete(id) {
        const query = 'DELETE FROM designations WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows > 0;
    }

    // Search designations
    static async search(searchTerm) {
        const query = `
            SELECT * FROM designations 
            WHERE designation_name LIKE ? 
            OR department LIKE ? 
            ORDER BY designation_name
        `;
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await db.execute(query, [searchPattern, searchPattern]);
        return rows;
    }
}

module.exports = Designation;
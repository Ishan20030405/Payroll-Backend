// backend/src/models/Department.js
const db = require('../config/db');

class Department {
    // Get all departments
    static async getAll() {
        const query = 'SELECT * FROM departments ORDER BY department_id';
        const [rows] = await db.execute(query);
        return rows;
    }

    // Get department by ID (now department_id)
    static async findById(id) {
        const query = 'SELECT * FROM departments WHERE department_id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows[0];
    }

    // ✅ NEW: Check if department exists
    static async exists(departmentId) {
        const query = 'SELECT COUNT(*) as count FROM departments WHERE department_id = ?';
        const [rows] = await db.execute(query, [departmentId]);
        return rows[0].count > 0;
    }

    // Get department by code (alias for findById)
    static async findByCode(code) {
        return this.findById(code);
    }

    // Create new department
    static async create(data) {
        const id = data.department_id || data.department_code;

        if (!id) {
            throw new Error('department_id is required');
        }

        const query = `
            INSERT INTO departments (department_id, department_name, department_head, status) 
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            id,
            data.department_name || data.departmentName || '',
            data.department_head || data.departmentHead || null,
            data.status || 'Active'
        ]);
        return id;
    }

    // Update department
    static async update(id, data) {
        const fields = [];
        const values = [];

        const mapping = {
            department_id: 'department_id',
            department_name: 'department_name',
            departmentName: 'department_name',
            department_head: 'department_head',
            departmentHead: 'department_head',
            status: 'status'
        };

        const seenColumns = new Set();
        Object.keys(data).forEach(key => {
            const dbColumn = mapping[key];
            if (dbColumn && !seenColumns.has(dbColumn) && data[key] !== undefined) {
                fields.push(`${dbColumn} = ?`);
                values.push(data[key]);
                seenColumns.add(dbColumn);
            }
        });

        if (fields.length === 0) {
            return true;
        }

        values.push(id);
        const query = `UPDATE departments SET ${fields.join(', ')} WHERE department_id = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    // Delete department
    static async delete(id) {
        const query = 'DELETE FROM departments WHERE department_id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows > 0;
    }

    // Count employees using this department
    static async countEmployeesUsing(departmentId) {
        const query = 'SELECT COUNT(*) as count FROM employees WHERE department = ?';
        const [rows] = await db.execute(query, [departmentId]);
        return rows[0].count;
    }

    // Search departments
    static async search(searchTerm) {
        const query = `
            SELECT * FROM departments 
            WHERE department_name LIKE ? 
            OR department_id LIKE ? 
            ORDER BY department_id
        `;
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await db.execute(query, [searchPattern, searchPattern]);
        return rows;
    }
}

module.exports = Department;
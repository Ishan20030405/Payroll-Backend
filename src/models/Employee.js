// backend/src/models/Employee.js
const db = require('../config/db');

class Employee {
    // Get all employees with designation salary
    static async getAll() {
        const query = `
            SELECT 
                e.*,
                d.basic_salary as designation_basic_salary,
                d.designation_name as designation_name,
                u.role as user_role,
                u.is_active as user_account_active
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN designations d ON e.designation = d.designation_name
            ORDER BY e.employee_id ASC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }

    // Get employee by ID (database primary key)
    static async findById(id) {
        const query = `
            SELECT 
                e.*,
                d.basic_salary as designation_basic_salary,
                d.designation_name as designation_name,
                u.role as user_role,
                u.is_active as user_account_active
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN designations d ON e.designation = d.designation_name
            WHERE e.id = ?
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

    // ✅ Get employee by employee_id (string like 'E001', 'EMP-1001')
    static async findByEmployeeId(employeeId) {
        const query = `
            SELECT 
                e.*,
                d.basic_salary as designation_basic_salary,
                d.designation_name as designation_name,
                u.role as user_role,
                u.is_active as user_account_active
            FROM employees e
            LEFT JOIN users u ON e.user_id = u.id
            LEFT JOIN designations d ON e.designation = d.designation_name
            WHERE e.employee_id = ?
        `;
        const [rows] = await db.execute(query, [employeeId]);
        return rows[0] || null;
    }

    static async findByUserId(userId) {
        const query = `
            SELECT e.*
            FROM employees e
            WHERE e.user_id = ?
        `;
        const [rows] = await db.execute(query, [userId]);
        return rows[0] || null;
    }

    // Get employees by department
    static async findByDepartment(department) {
        const query = `
            SELECT 
                e.*,
                d.basic_salary as designation_basic_salary,
                d.designation_name as designation_name
            FROM employees e
            LEFT JOIN designations d ON e.designation = d.designation_name
            WHERE e.department = ?
            ORDER BY e.employee_id ASC
        `;
        const [rows] = await db.execute(query, [department]);
        return rows;
    }

    // Create employee
    static async create(data) {
        const {
            employeeId,
            fullName,
            email,
            phone,
            department,
            designation,
            joinDate,
            address,
            status = 'Active',
            dob,
            nic,
            gender,
            maritalStatus,
            emergencyContact,
            userRole
        } = data;

        // Generate employee ID if not provided
        let empId = employeeId;
        if (!empId) {
            const [maxId] = await db.execute('SELECT MAX(CAST(SUBSTRING(employee_id, 2) AS UNSIGNED)) as max FROM employees');
            const nextNum = (maxId[0].max || 0) + 1;
            empId = `E${String(nextNum).padStart(3, '0')}`;
        }

        const query = `
            INSERT INTO employees 
            (employee_id, full_name, email, phone, department, designation, 
             join_date, address, status, dob, nic, gender, marital_status, emergency_contact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            empId,
            fullName,
            email,
            phone || null,
            department || null,
            designation || null,
            joinDate || null,
            address || null,
            status,
            dob || null,
            nic,
            gender || null,
            maritalStatus || null,
            emergencyContact || null
        ]);
        return result.insertId;
    }

    // Update employee
    static async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'employee_id', 'full_name', 'email', 'phone', 'department', 
            'designation', 'join_date', 'address', 'status', 'dob', 
            'nic', 'gender', 'marital_status', 'emergency_contact', 'user_id'
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
        const query = `UPDATE employees SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    // Delete employee
    static async delete(id) {
        const query = 'DELETE FROM employees WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result;
    }

    // Search employees
    static async search(searchTerm) {
        const query = `
            SELECT 
                e.*,
                d.basic_salary as designation_basic_salary,
                d.designation_name as designation_name
            FROM employees e
            LEFT JOIN designations d ON e.designation = d.designation_name
            WHERE e.full_name LIKE ? 
            OR e.employee_id LIKE ?
            OR e.email LIKE ?
            OR e.phone LIKE ?
            ORDER BY e.employee_id ASC
        `;
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await db.execute(query, [
            searchPattern, searchPattern, searchPattern, searchPattern
        ]);
        return rows;
    }

    // Get employee stats
    static async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive
            FROM employees
        `;
        const [rows] = await db.execute(query);
        return rows[0] || { total: 0, active: 0, inactive: 0 };
    }
}

module.exports = Employee;
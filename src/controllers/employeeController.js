// backend/src/controllers/employeeController.js
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const User = require('../models/User');

// Get all employees
exports.getAllEmployees = async (req, res) => {
    try {
        const employees = await Employee.getAll();
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ message: 'Error fetching employees', error: error.message });
    }
};

// Get employee by ID
exports.getEmployeeById = async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.status(200).json(employee);
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ message: 'Error fetching employee', error: error.message });
    }
};

// Get employee by employee_id
exports.getEmployeeByEmployeeId = async (req, res) => {
    try {
        const employee = await Employee.findByEmployeeId(req.params.employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.status(200).json(employee);
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ message: 'Error fetching employee', error: error.message });
    }
};

// Create employee
exports.createEmployee = async (req, res) => {
    try {
        const {
            employeeId,
            fullName,
            email,
            phone,
            department,
            designation,
            joinDate,
            address,
            status,
            dob,
            nic,
            gender,
            maritalStatus,
            emergencyContact,
            userRole
        } = req.body;

        if (!fullName || !email) {
            return res.status(400).json({ message: 'Full name and email are required' });
        }

        if (!nic) {
            return res.status(400).json({ message: 'NIC number is required' });
        }

        if (department) {
            const deptExists = await Department.exists(department);
            if (!deptExists) {
                return res.status(400).json({ message: `Department "${department}" does not exist` });
            }
        }

        if (designation) {
            const desigExists = await Designation.exists(designation);
            if (!desigExists) {
                return res.status(400).json({ message: `Designation "${designation}" does not exist` });
            }
        }

        const employeeData = {
            employeeId: employeeId || undefined,
            fullName,
            email,
            phone: phone || null,
            department: department || null,
            designation: designation || null,
            joinDate: joinDate || null,
            address: address || null,
            status: status || 'Active',
            dob: dob || null,
            nic: nic,
            gender: gender || null,
            maritalStatus: maritalStatus || null,
            emergencyContact: emergencyContact || null,
            userRole: userRole || 'EMPLOYEE'
        };

        const id = await Employee.create(employeeData);
        const created = await Employee.findById(id);
        res.status(201).json({ message: 'Employee created successfully', data: created });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Employee with this email or ID already exists' });
        }
        res.status(500).json({ message: 'Error creating employee', error: error.message });
    }
};

// Update employee
exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            employeeId,
            fullName,
            email,
            phone,
            department,
            designation,
            joinDate,
            address,
            status,
            dob,
            nic,
            gender,
            maritalStatus,
            emergencyContact,
            userRole
        } = req.body;

        const existing = await Employee.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        if (department) {
            const deptExists = await Department.exists(department);
            if (!deptExists) {
                return res.status(400).json({ message: `Department "${department}" does not exist` });
            }
        }

        if (designation) {
            const desigExists = await Designation.exists(designation);
            if (!desigExists) {
                return res.status(400).json({ message: `Designation "${designation}" does not exist` });
            }
        }

        const employeeData = {
            employee_id: employeeId || existing.employee_id,
            full_name: fullName || existing.full_name,
            email: email || existing.email,
            phone: phone !== undefined ? phone : existing.phone,
            department: department !== undefined ? department : existing.department,
            designation: designation !== undefined ? designation : existing.designation,
            join_date: joinDate !== undefined ? joinDate : existing.join_date,
            address: address !== undefined ? address : existing.address,
            status: status || existing.status,
            dob: dob !== undefined ? dob : existing.dob,
            nic: nic || existing.nic,
            gender: gender !== undefined ? gender : existing.gender,
            marital_status: maritalStatus !== undefined ? maritalStatus : existing.marital_status,
            emergency_contact: emergencyContact !== undefined ? emergencyContact : existing.emergency_contact
        };

        const success = await Employee.update(id, employeeData);
        if (!success) {
            return res.status(404).json({ message: 'Employee not found or no changes made' });
        }

        if (status === 'Inactive' && existing.user_id) {
            await User.deactivate(existing.user_id);
        }

        if (status === 'Active' && existing.user_id) {
            await User.activate(existing.user_id);
        }

            if (userRole && existing.user_id && ['ADMIN', 'HR', 'EMPLOYEE'].includes(userRole)) {
                await User.update(existing.user_id, { role: userRole });
            }

        const updated = await Employee.findById(id);
        res.status(200).json({ message: 'Employee updated successfully', data: updated });
    } catch (error) {
        console.error('Update employee error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Employee with this email or ID already exists' });
        }
        res.status(500).json({ message: 'Error updating employee', error: error.message });
    }
};

// ✅ FIXED: Delete employee and cascade delete user account
exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if employee exists
        const existing = await Employee.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Store user_id before deletion
        const userId = existing.user_id;

        // ✅ First delete the user account if it exists
        let userDeleted = false;
        if (userId) {
            try {
                // First try to deactivate the user (soft delete)
                await User.deactivate(userId);
                // Then delete the user (hard delete)
                const deleted = await User.delete(userId);
                userDeleted = deleted;
                console.log(`✅ User account ${userId} deleted successfully`);
            } catch (userError) {
                console.error('Error deleting user account:', userError);
                // If user deletion fails due to foreign key, try to delete employee first
                // then delete user
            }
        }

        // ✅ Delete the employee
        const result = await Employee.delete(id);
        if (!result.affectedRows) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // ✅ If user deletion failed but we have a userId, try to delete user again
        if (userId && !userDeleted) {
            try {
                const deleted = await User.delete(userId);
                userDeleted = deleted;
                if (deleted) {
                    console.log(`✅ User account ${userId} deleted successfully (retry)`);
                }
            } catch (retryError) {
                console.error('Retry user deletion failed:', retryError);
            }
        }

        res.status(200).json({ 
            message: 'Employee deleted successfully',
            userDeleted: userDeleted
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ message: 'Error deleting employee', error: error.message });
    }
};

// Search employees
exports.searchEmployees = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search term is required' });
        }
        const employees = await Employee.search(query);
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error searching employees:', error);
        res.status(500).json({ message: 'Error searching employees', error: error.message });
    }
};

// Get employees by department
exports.getEmployeesByDepartment = async (req, res) => {
    try {
        const { department } = req.params;
        const employees = await Employee.findByDepartment(department);
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees by department:', error);
        res.status(500).json({ message: 'Error fetching employees by department', error: error.message });
    }
};

// Get employee stats
exports.getEmployeeStats = async (req, res) => {
    try {
        const stats = await Employee.getStats();
        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching employee stats:', error);
        res.status(500).json({ message: 'Error fetching employee stats', error: error.message });
    }
};
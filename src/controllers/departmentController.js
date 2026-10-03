// src/controllers/departmentController.js
const Department = require('../models/Department');

exports.getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.getAll();
        res.status(200).json(departments);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ message: 'Error fetching departments', error: error.message });
    }
};

exports.getDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }
        res.status(200).json(department);
    } catch (error) {
        console.error('Error fetching department:', error);
        res.status(500).json({ message: 'Error fetching department', error: error.message });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        // Support both field names for backward compatibility
        const id = req.body.department_id || req.body.department_code || req.body.departmentId || req.body.departmentCode;
        const name = req.body.department_name || req.body.departmentName;

        if (!id || !name) {
            return res.status(400).json({ message: 'Department ID and name are required' });
        }

        // Check if department already exists
        const existing = await Department.findById(id);
        if (existing) {
            return res.status(409).json({ message: `Department with ID "${id}" already exists` });
        }

        const newId = await Department.create({
            department_id: id,
            department_name: name,
            department_head: req.body.department_head || req.body.departmentHead || null,
            status: req.body.status || 'Active'
        });

        res.status(201).json({ message: 'Department created successfully', id: newId });
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ message: 'Error creating department', error: error.message });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        // Prevent updating department_id (primary key)
        const updateData = { ...req.body };
        delete updateData.department_id;
        delete updateData.departmentCode;
        delete updateData.departmentId;
        delete updateData.department_code;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        const success = await Department.update(req.params.id, updateData);
        if (!success) {
            return res.status(404).json({ message: 'Department not found or no changes made' });
        }
        res.status(200).json({ message: 'Department updated successfully' });
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({ message: 'Error updating department', error: error.message });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        // ✅ FIXED: Use department_id from params
        const departmentId = req.params.id;
        console.log('🗑️ Deleting department with ID:', departmentId);

        // Check if department exists first
        const existing = await Department.findById(departmentId);
        if (!existing) {
            console.log('⚠️ Department not found:', departmentId);
            return res.status(404).json({ message: 'Department not found' });
        }

        // Check if department is being used by any employees
        const employeesUsing = await Department.countEmployeesUsing(departmentId);
        if (employeesUsing > 0) {
            return res.status(409).json({ 
                message: `Cannot delete department: ${employeesUsing} employees are assigned to this department` 
            });
        }

        const success = await Department.delete(departmentId);
        if (!success) {
            return res.status(404).json({ message: 'Department not found' });
        }
        
        console.log('✅ Department deleted successfully:', departmentId);
        res.status(200).json({ message: 'Department deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting department:', error);
        res.status(500).json({ message: 'Error deleting department', error: error.message });
    }
};

exports.searchDepartments = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search term is required' });
        }
        const departments = await Department.search(query);
        res.status(200).json(departments);
    } catch (error) {
        console.error('Error searching departments:', error);
        res.status(500).json({ message: 'Error searching departments', error: error.message });
    }
};
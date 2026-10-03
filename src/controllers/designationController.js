// src/controllers/designationController.js
const Designation = require('../models/Designation');
const Department = require('../models/Department');

exports.getAllDesignations = async (req, res) => {
    try {
        const designations = await Designation.getAll();
        res.status(200).json(designations);
    } catch (error) {
        console.error('Error fetching designations:', error);
        res.status(500).json({ message: 'Error fetching designations', error: error.message });
    }
};

exports.getDesignation = async (req, res) => {
    try {
        const designation = await Designation.findById(req.params.id);
        if (!designation) {
            return res.status(404).json({ message: 'Designation not found' });
        }
        res.status(200).json(designation);
    } catch (error) {
        console.error('Error fetching designation:', error);
        res.status(500).json({ message: 'Error fetching designation', error: error.message });
    }
};

exports.createDesignation = async (req, res) => {
    try {
        const { designation_name, department, basic_salary, ot_eligible, status } = req.body;

        if (!designation_name) {
            return res.status(400).json({ message: 'Designation name is required' });
        }

        // Validate department if provided
        if (department) {
            const deptExists = await Department.findById(department);
            if (!deptExists) {
                return res.status(400).json({ 
                    message: `Department with ID "${department}" does not exist` 
                });
            }
        }

        const newId = await Designation.create({
            designation_name,
            department: department || null,
            basic_salary: basic_salary || 0,
            ot_eligible: ot_eligible !== undefined ? ot_eligible : 1,
            status: status || 'Active'
        });

        const created = await Designation.findById(newId);
        res.status(201).json({ 
            message: 'Designation created successfully', 
            id: newId,
            designation: created
        });
    } catch (error) {
        console.error('Error creating designation:', error);
        res.status(500).json({ message: 'Error creating designation', error: error.message });
    }
};

exports.updateDesignation = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if designation exists
        const existing = await Designation.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Designation not found' });
        }

        // Validate department if provided
        if (req.body.department) {
            const deptExists = await Department.findById(req.body.department);
            if (!deptExists) {
                return res.status(400).json({ 
                    message: `Department with ID "${req.body.department}" does not exist` 
                });
            }
        }

        const success = await Designation.update(id, req.body);
        if (!success) {
            return res.status(404).json({ message: 'Designation not found or no changes made' });
        }

        const updated = await Designation.findById(id);
        res.status(200).json({ 
            message: 'Designation updated successfully',
            designation: updated
        });
    } catch (error) {
        console.error('Error updating designation:', error);
        res.status(500).json({ message: 'Error updating designation', error: error.message });
    }
};

exports.deleteDesignation = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if designation exists
        const existing = await Designation.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Designation not found' });
        }

        const success = await Designation.delete(id);
        if (!success) {
            return res.status(404).json({ message: 'Designation not found' });
        }
        res.status(200).json({ message: 'Designation deleted successfully' });
    } catch (error) {
        console.error('Error deleting designation:', error);
        res.status(500).json({ message: 'Error deleting designation', error: error.message });
    }
};

exports.searchDesignations = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search term is required' });
        }
        const designations = await Designation.search(query);
        res.status(200).json(designations);
    } catch (error) {
        console.error('Error searching designations:', error);
        res.status(500).json({ message: 'Error searching designations', error: error.message });
    }
};

exports.getDesignationsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;
        
        // Validate department
        const deptExists = await Department.findById(departmentId);
        if (!deptExists) {
            return res.status(404).json({ message: 'Department not found' });
        }

        const designations = await Designation.findByDepartment(departmentId);
        res.status(200).json(designations);
    } catch (error) {
        console.error('Error fetching designations by department:', error);
        res.status(500).json({ message: 'Error fetching designations', error: error.message });
    }
};
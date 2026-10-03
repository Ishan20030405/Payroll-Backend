// backend/src/controllers/salaryStructureController.js
const SalaryStructure = require('../models/SalaryStructure');

// Get all salary structures
exports.getAllSalaryStructures = async (req, res) => {
    try {
        const structures = await SalaryStructure.getAll();
        res.status(200).json(structures);
    } catch (error) {
        console.error('Error fetching salary structures:', error);
        res.status(500).json({ message: 'Error fetching salary structures', error: error.message });
    }
};

// Get salary structure by ID
exports.getSalaryStructureById = async (req, res) => {
    try {
        const structure = await SalaryStructure.findById(req.params.id);
        if (!structure) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }
        res.status(200).json(structure);
    } catch (error) {
        console.error('Error fetching salary structure:', error);
        res.status(500).json({ message: 'Error fetching salary structure', error: error.message });
    }
};

// Get salary structure by department and designation
exports.getSalaryStructureByDeptDesig = async (req, res) => {
    try {
        const { department, designation } = req.query;
        if (!department || !designation) {
            return res.status(400).json({ message: 'Department and designation are required' });
        }
        const structure = await SalaryStructure.findByDepartmentAndDesignation(department, designation);
        res.status(200).json(structure || []);
    } catch (error) {
        console.error('Error fetching salary structure:', error);
        res.status(500).json({ message: 'Error fetching salary structure', error: error.message });
    }
};

// Create salary structure
exports.createSalaryStructure = async (req, res) => {
    try {
        const {
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
        } = req.body;

        if (!department || !designation) {
            return res.status(400).json({ message: 'Department and designation are required' });
        }

        // Check if structure already exists
        const existing = await SalaryStructure.findByDepartmentAndDesignation(department, designation);
        if (existing) {
            return res.status(409).json({ 
                message: `Salary structure already exists for "${department}" - "${designation}"`,
                existing: existing
            });
        }

        const id = await SalaryStructure.create({
            department,
            designation,
            basic_pay: parseFloat(basic_pay) || 0,
            attendance_allowance: parseFloat(attendance_allowance) || 0,
            special_allowance: parseFloat(special_allowance) || 0,
            other_allowance: parseFloat(other_allowance) || 0,
            travelling_allowance: parseFloat(travelling_allowance) || 0,
            normal_ot_rate: parseFloat(normal_ot_rate) || 0,
            sunday_ot_rate: parseFloat(sunday_ot_rate) || 0,
            late_rate: parseFloat(late_rate) || 0,
            no_pay_rate: parseFloat(no_pay_rate) || 0,
            epf: parseFloat(epf) || 0,
            other_deductions: parseFloat(other_deductions) || 0,
            status: status || 'Active'
        });

        const created = await SalaryStructure.findById(id);
        res.status(201).json({ 
            message: 'Salary structure created successfully', 
            data: created 
        });
    } catch (error) {
        console.error('Error creating salary structure:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ 
                message: 'Salary structure already exists for this department and designation' 
            });
        }
        res.status(500).json({ message: 'Error creating salary structure', error: error.message });
    }
};

// Update salary structure
exports.updateSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;
        const {
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
        } = req.body;

        const existing = await SalaryStructure.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }

        if (department && designation && 
            (department !== existing.department || designation !== existing.designation)) {
            const duplicate = await SalaryStructure.findByDepartmentAndDesignation(department, designation);
            if (duplicate && duplicate.id !== parseInt(id)) {
                return res.status(409).json({ 
                    message: `Salary structure already exists for "${department}" - "${designation}"` 
                });
            }
        }

        const success = await SalaryStructure.update(id, {
            department: department || existing.department,
            designation: designation || existing.designation,
            basic_pay: basic_pay !== undefined ? parseFloat(basic_pay) : existing.basic_pay,
            attendance_allowance: attendance_allowance !== undefined ? parseFloat(attendance_allowance) : existing.attendance_allowance,
            special_allowance: special_allowance !== undefined ? parseFloat(special_allowance) : existing.special_allowance,
            other_allowance: other_allowance !== undefined ? parseFloat(other_allowance) : existing.other_allowance,
            travelling_allowance: travelling_allowance !== undefined ? parseFloat(travelling_allowance) : existing.travelling_allowance,
            normal_ot_rate: normal_ot_rate !== undefined ? parseFloat(normal_ot_rate) : existing.normal_ot_rate,
            sunday_ot_rate: sunday_ot_rate !== undefined ? parseFloat(sunday_ot_rate) : existing.sunday_ot_rate,
            late_rate: late_rate !== undefined ? parseFloat(late_rate) : existing.late_rate,
            no_pay_rate: no_pay_rate !== undefined ? parseFloat(no_pay_rate) : existing.no_pay_rate,
            epf: epf !== undefined ? parseFloat(epf) : existing.epf,
            other_deductions: other_deductions !== undefined ? parseFloat(other_deductions) : existing.other_deductions,
            status: status || existing.status
        });

        if (!success) {
            return res.status(404).json({ message: 'Salary structure not found or no changes made' });
        }

        const updated = await SalaryStructure.findById(id);
        res.status(200).json({ 
            message: 'Salary structure updated successfully', 
            data: updated 
        });
    } catch (error) {
        console.error('Error updating salary structure:', error);
        res.status(500).json({ message: 'Error updating salary structure', error: error.message });
    }
};

// Delete salary structure
exports.deleteSalaryStructure = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await SalaryStructure.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }
        const success = await SalaryStructure.delete(id);
        if (!success) {
            return res.status(404).json({ message: 'Salary structure not found' });
        }
        res.status(200).json({ message: 'Salary structure deleted successfully' });
    } catch (error) {
        console.error('Error deleting salary structure:', error);
        res.status(500).json({ message: 'Error deleting salary structure', error: error.message });
    }
};
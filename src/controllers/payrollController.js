// backend/src/controllers/payrollController.js
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');

const employeeCanAccessPayroll = async (req, employeeId) => {
    if (req.user.role !== 'EMPLOYEE') return true;
    const employee = await Employee.findByUserId(req.user.id);
    return Boolean(employee && Number(employee.id) === Number(employeeId));
};

// Get all payrolls
exports.getAllPayrolls = async (req, res) => {
    try {
        const payrolls = await Payroll.getAll();
        res.status(200).json(payrolls);
    } catch (error) {
        console.error('Error fetching payrolls:', error);
        res.status(500).json({ message: 'Error fetching payrolls', error: error.message });
    }
};

exports.getPayrollMonths = async (req, res) => {
    try {
        const months = await Payroll.getMonths();
        res.status(200).json(months);
    } catch (error) {
        console.error('Error fetching payroll months:', error);
        res.status(500).json({ message: 'Error fetching payroll months', error: error.message });
    }
};

// Get payroll by ID
exports.getPayrollById = async (req, res) => {
    try {
        if (!(await employeeCanAccessPayroll(req, req.params.employeeId))) {
            return res.status(403).json({ message: 'You can only access your own payroll' });
        }
        const payroll = await Payroll.findByKey(req.params.employeeId, req.params.monthYear);
        if (!payroll) {
            return res.status(404).json({ message: 'Payroll not found' });
        }
        res.status(200).json(payroll);
    } catch (error) {
        console.error('Error fetching payroll:', error);
        res.status(500).json({ message: 'Error fetching payroll', error: error.message });
    }
};

// Get payrolls by employee ID
exports.getPayrollsByEmployee = async (req, res) => {
    try {
        if (!(await employeeCanAccessPayroll(req, req.params.employeeId))) {
            return res.status(403).json({ message: 'You can only access your own payroll' });
        }
        const payrolls = await Payroll.findByEmployeeId(req.params.employeeId);
        res.status(200).json(payrolls);
    } catch (error) {
        console.error('Error fetching employee payrolls:', error);
        res.status(500).json({ message: 'Error fetching employee payrolls', error: error.message });
    }
};

// Create payroll
exports.createPayroll = async (req, res) => {
    try {
        const { employee_id, month_year, total_allowances, total_deductions, total_normal_ot_amount, total_sunday_ot_amount, total_additions, gross_salary, net_salary, status } = req.body;

        if (!employee_id || !month_year) {
            return res.status(400).json({ message: 'Employee ID and month/year are required' });
        }

        // Check if payroll already exists for this employee and month
        const existing = await Payroll.findByEmployeeAndMonth(employee_id, month_year);
        if (existing) {
            return res.status(409).json({ message: 'Payroll already exists for this employee and month' });
        }

        const payrollData = {
            employee_id,
            month_year,
            total_allowances: total_allowances || 0,
            total_deductions: total_deductions || 0,
            total_normal_ot_amount: total_normal_ot_amount || 0,
            total_sunday_ot_amount: total_sunday_ot_amount || 0,
            status: status || 'Pending'
        };

        const id = await Payroll.create(payrollData);
        res.status(201).json({ message: 'Payroll created successfully', id });
    } catch (error) {
        console.error('Error creating payroll:', error);
        res.status(500).json({ message: 'Error creating payroll', error: error.message });
    }
};

// Update payroll
exports.updatePayroll = async (req, res) => {
    try {
        const { employeeId, monthYear } = req.params;
        const { employee_id, month_year, total_allowances, total_deductions, total_normal_ot_amount, total_sunday_ot_amount, total_additions, gross_salary, net_salary, status } = req.body;

        const existing = await Payroll.findByKey(employeeId, monthYear);
        if (!existing) {
            return res.status(404).json({ message: 'Payroll not found' });
        }

        const payrollData = {
            total_allowances: total_allowances !== undefined ? total_allowances : existing.total_allowances,
            total_deductions: total_deductions !== undefined ? total_deductions : existing.total_deductions,
            total_normal_ot_amount: total_normal_ot_amount !== undefined ? total_normal_ot_amount : existing.total_normal_ot_amount,
            total_sunday_ot_amount: total_sunday_ot_amount !== undefined ? total_sunday_ot_amount : existing.total_sunday_ot_amount,
            total_additions: total_additions !== undefined ? total_additions : existing.total_additions,
            gross_salary: gross_salary !== undefined ? gross_salary : existing.gross_salary,
            net_salary: net_salary !== undefined ? net_salary : existing.net_salary,
            status: status || existing.status
        };

        const success = await Payroll.update(employeeId, monthYear, payrollData);
        if (!success) {
            return res.status(404).json({ message: 'Payroll not found or no changes made' });
        }
        res.status(200).json({ message: 'Payroll updated successfully' });
    } catch (error) {
        console.error('Error updating payroll:', error);
        res.status(500).json({ message: 'Error updating payroll', error: error.message });
    }
};

// Delete payroll
exports.deletePayroll = async (req, res) => {
    try {
        const { employeeId, monthYear } = req.params;
        const existing = await Payroll.findByKey(employeeId, monthYear);
        if (!existing) {
            return res.status(404).json({ message: 'Payroll not found' });
        }
        const success = await Payroll.delete(existing.employee_id, existing.month_year);
        if (!success) {
            return res.status(404).json({ message: 'Payroll not found' });
        }
        res.status(200).json({ message: 'Payroll deleted successfully' });
    } catch (error) {
        console.error('Error deleting payroll:', error);
        res.status(500).json({ message: 'Error deleting payroll', error: error.message });
    }
};

// Generate payroll for all employees for a month
exports.generatePayroll = async (req, res) => {
    try {
        const { month_year } = req.body;
        if (!month_year) {
            return res.status(400).json({ message: 'Month/Year is required' });
        }

        const SalaryStructure = require('../models/SalaryStructure');
        const employees = await Payroll.getGenerationRows(month_year);

        let created = 0;
        let skipped = 0;

        for (const employee of employees) {
            // Check if payroll already exists
            const existing = await Payroll.findByEmployeeAndMonth(employee.employee_id, employee.month_year);
            if (existing) {
                skipped++;
                continue;
            }

            // Calculate payroll based on attendance and settings
            // This is a simplified calculation - you can expand as needed
            const salaryStruct = await SalaryStructure.findByDepartmentAndDesignation(employee.department, employee.designation);
            const basic_salary = salaryStruct ? Number(salaryStruct.basic_pay) : 0;
            
            const payrollData = {
                employee_id: employee.employee_id,
                month_year: employee.month_year,
                total_allowances: 1000,
                total_deductions: basic_salary * 0.08,
                status: 'Generated'
            };

            await Payroll.create(payrollData);
            created++;
        }

        res.status(200).json({
            message: 'Payroll generated successfully',
            data: {
                total_employees: employees.length,
                created,
                skipped
            }
        });
    } catch (error) {
        console.error('Error generating payroll:', error);
        res.status(500).json({ message: 'Error generating payroll', error: error.message });
    }
};
const Payslip = require('../models/Payslip');

const ActivityLog = require('../models/ActivityLog');

const fieldLabels = {
    basic_salary: 'Basic salary',
    total_allowances: 'Total allowances',
    total_deductions: 'Total deductions',
    total_normal_ot_amount: 'Normal overtime amount',
    total_sunday_ot_amount: 'Sunday overtime amount',
    total_additions: 'Total additions',
    gross_salary: 'Gross salary',
    net_salary: 'Net salary',
    total_working_days: 'Working days',
    total_no_pay_days: 'No-pay days',
    total_late_hours: 'Late hours',
    no_pay_amount: 'No-pay amount',
    late_amount: 'Late amount',
    epf: 'EPF'
};

const formatValue = value => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    : String(value ?? '-');

const describeChanges = (previous, next) => Object.keys(fieldLabels)
    .filter(field => next[field] !== undefined && String(previous?.[field] ?? '') !== String(next[field] ?? ''))
    .map(field => `${fieldLabels[field]} changed from ${formatValue(previous?.[field])} to ${formatValue(next[field])}`)
    .join('; ') || 'No values changed.';

exports.getMyPayslips = async (req, res) => {
    try {
        const payslips = await Payslip.getForUser(req.user.id);
        res.status(200).json(payslips);
    } catch (error) {
        console.error('Error fetching employee payslips:', error);
        res.status(500).json({ message: 'Error fetching employee payslips', error: error.message });
    }
};

exports.getByEmployeeAndMonth = async (req, res) => {
    try {
        const payslip = await Payslip.findByEmployeeAndMonth(req.params.employeeId, req.params.monthYear);
        if (!payslip) return res.status(404).json({ message: 'Payslip not found' });
        res.status(200).json(payslip);
    } catch (error) {
        console.error('Error fetching payslip:', error);
        res.status(500).json({ message: 'Error fetching payslip', error: error.message });
    }
};

exports.updateByEmployeeAndMonth = async (req, res) => {
    try {
        const previous = await Payslip.findByEmployeeAndMonth(req.params.employeeId, req.params.monthYear);
        const updated = await Payslip.updateByEmployeeAndMonth(
            req.params.employeeId,
            req.params.monthYear,
            req.body || {}
        );
        if (!updated) return res.status(404).json({ message: 'Payslip not found' });
        await ActivityLog.create({
            userId: req.user.id,
            action: 'Update payslip values',
            details: `${describeChanges(previous, req.body || {})}.`,
            ipAddress: req.ip
        });
        res.status(200).json({ message: 'Payslip updated successfully' });
    } catch (error) {
        console.error('Error updating payslip:', error);
        res.status(500).json({ message: 'Error updating payslip', error: error.message });
    }
};

exports.getOptions = async (req, res) => {
    try {
        const options = await Payslip.getOptions();
        res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching payslip options:', error);
        res.status(500).json({ message: 'Error fetching payslip options', error: error.message });
    }
};

exports.getGenerationOptions = async (req, res) => {
    try {
        const options = await Payslip.getGenerationOptions();
        res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching payslip generation options:', error);
        res.status(500).json({ message: 'Error fetching payslip generation options', error: error.message });
    }
};

exports.generate = async (req, res) => {
    try {
        const { month_year, mode = 'All', employee_id, department, designation } = req.body;
        if (!month_year) return res.status(400).json({ message: 'Payroll month is required' });
        if (!['All', 'One by one', 'department', 'designation'].includes(mode)) {
            return res.status(400).json({ message: 'Invalid payslip generation mode' });
        }
        if (mode === 'One by one' && !employee_id) return res.status(400).json({ message: 'Employee is required' });
        if (mode === 'department' && !department) return res.status(400).json({ message: 'Department is required' });
        if (mode === 'designation' && !designation) return res.status(400).json({ message: 'Designation is required' });

        const rows = await Payslip.generate({ monthYear: month_year, mode, employeeId: employee_id, department, designation });
        await ActivityLog.create({
            userId: req.user.id,
            action: 'Generate payslips',
            details: `${rows.length} payslip${rows.length === 1 ? '' : 's'} generated successfully.`,
            ipAddress: req.ip
        });
        res.status(200).json({ message: rows.length ? 'Payslips saved successfully' : 'No Complete payrolls matched the selection', saved: rows.length });
    } catch (error) {
        console.error('Error generating payslips:', error);
        res.status(500).json({ message: 'Error saving payslips', error: error.message });
    }
};
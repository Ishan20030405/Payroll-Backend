// backend/src/controllers/payrollSettingController.js
const PayrollSetting = require('../models/PayrollSetting');

// Get payroll settings
exports.getPayrollSettings = async (req, res) => {
    try {
        const settings = await PayrollSetting.get();
        if (!settings) {
            return res.status(200).json({
                working_days: 26,
                working_hours: 8,
                ot_rate: 1.5,
                sunday_ot_rate: 2.0,
                check_in_time: '09:00',
                check_out_time: '17:00',
                salary_method: 'Monthly',
                epf_percentage: 12,
                etf_percentage: 3
            });
        }
        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching payroll settings:', error);
        res.status(500).json({ message: 'Error fetching payroll settings', error: error.message });
    }
};

// Update payroll settings
exports.updatePayrollSettings = async (req, res) => {
    try {
        const {
            working_days,
            working_hours,
            ot_rate,
            sunday_ot_rate,
            check_in_time,
            check_out_time,
            salary_method,
            epf_percentage,
            etf_percentage
        } = req.body;

        // Validations
        if (working_days !== undefined && (isNaN(working_days) || working_days < 1 || working_days > 31)) {
            return res.status(400).json({ message: 'Invalid working days' });
        }
        if (working_hours !== undefined && (isNaN(working_hours) || working_hours < 1 || working_hours > 24)) {
            return res.status(400).json({ message: 'Invalid working hours' });
        }
        if (ot_rate !== undefined && (isNaN(ot_rate) || ot_rate < 0)) {
            return res.status(400).json({ message: 'Invalid overtime rate' });
        }
        if (sunday_ot_rate !== undefined && (isNaN(sunday_ot_rate) || sunday_ot_rate < 0)) {
            return res.status(400).json({ message: 'Invalid Sunday overtime rate' });
        }
        if (epf_percentage !== undefined && (isNaN(epf_percentage) || epf_percentage < 0 || epf_percentage > 100)) {
            return res.status(400).json({ message: 'Invalid EPF percentage' });
        }
        if (etf_percentage !== undefined && (isNaN(etf_percentage) || etf_percentage < 0 || etf_percentage > 100)) {
            return res.status(400).json({ message: 'Invalid ETF percentage' });
        }

        const updated_by = req.user?.id || null;

        const success = await PayrollSetting.upsert({
            working_days: working_days === undefined ? 26 : parseFloat(working_days),
            working_hours: working_hours === undefined ? 8 : parseFloat(working_hours),
            ot_rate: ot_rate === undefined ? 1.5 : parseFloat(ot_rate),
            sunday_ot_rate: sunday_ot_rate === undefined ? 2.0 : parseFloat(sunday_ot_rate),
            check_in_time: check_in_time || '09:00',
            check_out_time: check_out_time || '17:00',
            salary_method: salary_method || 'Monthly',
            epf_percentage: epf_percentage === undefined ? 12 : parseFloat(epf_percentage),
            etf_percentage: etf_percentage === undefined ? 3 : parseFloat(etf_percentage),
            updated_by
        });

        if (!success) {
            return res.status(500).json({ message: 'Failed to save payroll settings' });
        }

        const updated = await PayrollSetting.get();
        res.status(200).json({ message: 'Payroll settings saved successfully', data: updated });
    } catch (error) {
        console.error('Error updating payroll settings:', error);
        res.status(500).json({ message: 'Error updating payroll settings', error: error.message });
    }
};

// Reset payroll settings to defaults
exports.resetPayrollSettings = async (req, res) => {
    try {
        const updated_by = req.user?.id || null;
        const success = await PayrollSetting.reset(updated_by);
        
        if (!success) {
            return res.status(500).json({ message: 'Failed to reset payroll settings' });
        }

        const settings = await PayrollSetting.get();
        res.status(200).json({ 
            message: 'Payroll settings reset to defaults successfully', 
            data: settings 
        });
    } catch (error) {
        console.error('Error resetting payroll settings:', error);
        res.status(500).json({ 
            message: 'Error resetting payroll settings', 
            error: error.message 
        });
    }
};
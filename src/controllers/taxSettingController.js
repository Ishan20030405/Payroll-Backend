const db = require('../config/db');
const ActivityLog = require('../models/ActivityLog');

// ─── Parse text bracket → { min, max } ───────────────────────────────────────
function parseBracketRange(rangeText) {
    const text = (rangeText || '').toLowerCase().trim();
    // Clean out commas for number parsing
    const clean = text.replace(/,/g, '');

    if (text.startsWith('up to') || text.startsWith('0 -')) {
        const max = parseFloat(clean.match(/[\d.]+/g)?.pop()) || 100000;
        return { min: 0, max };
    }
    if (text.startsWith('over') || text.startsWith('above')) {
        const min = parseFloat(clean.match(/[\d.]+/g)?.[0]) || 308333;
        return { min, max: Infinity };
    }
    // e.g. "100001 - 141667" or "100,001 - 141,667"
    const nums = clean.match(/[\d.]+/g) || [];
    if (nums.length >= 2) {
        return { min: parseFloat(nums[0]), max: parseFloat(nums[1]) };
    }
    if (nums.length === 1) {
        return { min: parseFloat(nums[0]), max: Infinity };
    }
    return { min: 0, max: Infinity };
}

// ─── Progressive (slab-based) APIT calculation ───────────────────────────────
function calcProgressiveAPIT(grossSalary, brackets) {
    const salary = parseFloat(grossSalary) || 0;
    let totalTax = 0;
    const breakdown = [];

    for (const b of brackets) {
        const { min, max } = parseBracketRange(b.monthly_salary_range);
        const rate = parseFloat(b.tax_rate) / 100;

        if (salary <= min) break; // salary doesn't reach this bracket

        const taxableInBracket = Math.min(salary, max === Infinity ? salary : max) - min;
        const taxForBracket = taxableInBracket * rate;
        totalTax += taxForBracket;

        breakdown.push({
            range: b.monthly_salary_range,
            rate: b.tax_rate,
            taxable_amount: parseFloat(taxableInBracket.toFixed(2)),
            tax_amount: parseFloat(taxForBracket.toFixed(2))
        });

        if (salary <= (max === Infinity ? salary : max)) break;
    }

    return { totalTax: parseFloat(totalTax.toFixed(2)), breakdown };
}

// ─── GET /api/tax-settings ────────────────────────────────────────────────────
exports.getTaxSettings = async (req, res) => {
    try {
        const [settings] = await db.execute('SELECT * FROM tax_settings ORDER BY id ASC');
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching tax settings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tax settings', error: error.message });
    }
};

// ─── PUT /api/tax-settings ────────────────────────────────────────────────────
exports.updateTaxSettings = async (req, res) => {
    try {
        const { brackets } = req.body;
        if (!Array.isArray(brackets)) {
            return res.status(400).json({ success: false, message: 'Brackets must be an array' });
        }

        await db.execute('DELETE FROM tax_settings');
        for (const b of brackets) {
            await db.execute(
                'INSERT INTO tax_settings (monthly_salary_range, tax_rate) VALUES (?, ?)',
                [b.monthly_salary_range, b.tax_rate]
            );
        }

        await ActivityLog.create({ userId: req.user.id, action: 'UPDATE_TAX_SETTINGS', details: 'Updated APIT/PAYE Tax brackets' });

        const [settings] = await db.execute('SELECT * FROM tax_settings ORDER BY id ASC');
        res.status(200).json({ success: true, message: 'Tax settings updated successfully', data: settings });
    } catch (error) {
        console.error('Error updating tax settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update tax settings', error: error.message });
    }
};

// ─── POST /api/tax-settings/calculate ────────────────────────────────────────
// Calculates progressive APIT for ALL payroll records and saves to payrolls.apit_tax
exports.calculateAndSaveTax = async (req, res) => {
    try {
        // 1. Load tax brackets
        const [brackets] = await db.execute('SELECT * FROM tax_settings ORDER BY id ASC');
        if (brackets.length === 0) {
            return res.status(400).json({ success: false, message: 'No tax brackets configured. Please add them in Settings → Tax Settings first.' });
        }

        // 2. Load all payroll records
        const [payrolls] = await db.execute(
            `SELECT p.*, e.employee_id AS emp_code, e.full_name
             FROM payrolls p
             JOIN employees e ON e.id = p.employee_id`
        );

        if (payrolls.length === 0) {
            return res.status(400).json({ success: false, message: 'No payroll records found. Generate payroll first.' });
        }

        // 3. Calculate and save APIT for each payroll record
        const results = [];
        for (const p of payrolls) {
            const { totalTax, breakdown } = calcProgressiveAPIT(p.gross_salary, brackets);
            const prevTax = parseFloat(p.apit_tax || 0);
            let baseDeductions = parseFloat(p.total_deductions || 0) - prevTax;
            if (baseDeductions < 0) baseDeductions = 0; // sanity check
            
            const newTotalDeductions = baseDeductions + totalTax;
            const newNetSalary = parseFloat(p.gross_salary || 0) - newTotalDeductions;

            await db.execute(
                'UPDATE payrolls SET apit_tax = ?, total_deductions = ?, net_salary = ? WHERE employee_id = ? AND month_year = ?',
                [totalTax, newTotalDeductions, newNetSalary, p.employee_id, p.month_year]
            );
            results.push({
                employee_id: p.emp_code,
                full_name: p.full_name,
                month_year: p.month_year,
                gross_salary: p.gross_salary,
                apit_tax: totalTax,
                breakdown
            });
        }

        await ActivityLog.create({
            userId: req.user.id,
            action: 'CALCULATE_APIT_TAX',
            details: `Calculated and saved APIT for ${results.length} payroll record(s)`
        });

        res.status(200).json({
            success: true,
            message: `APIT calculated and saved for ${results.length} record(s).`,
            data: results
        });
    } catch (error) {
        console.error('Error calculating tax:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate tax', error: error.message });
    }
};

// ─── GET /api/tax-settings/summary ───────────────────────────────────────────
// Returns payroll records with their saved apit_tax values
exports.getTaxSummary = async (req, res) => {
    try {
        const { month } = req.query; // optional: ?month=2026-09-01
        let query = `
            SELECT p.employee_id AS payroll_id, p.month_year, p.gross_salary,
                   p.net_salary, p.apit_tax,
                   e.employee_id AS emp_code, e.full_name
            FROM payrolls p
            JOIN employees e ON e.id = p.employee_id
        `;
        const params = [];
        if (month) {
            query += ' WHERE p.month_year = ?';
            params.push(month);
        }
        query += ' ORDER BY p.month_year DESC, e.employee_id ASC';

        const [rows] = await db.execute(query, params);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching tax summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tax summary', error: error.message });
    }
};

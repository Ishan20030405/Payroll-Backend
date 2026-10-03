const MonthlySalaryExpense = require('../models/MonthlySalaryExpense');

exports.getRecent = async (req, res) => {
    try {
        const expenses = await MonthlySalaryExpense.getRecent(req.query.limit);
        res.status(200).json(expenses);
    } catch (error) {
        console.error('Error fetching monthly salary expenses:', error);
        res.status(500).json({ message: 'Error fetching monthly salary expenses', error: error.message });
    }
};
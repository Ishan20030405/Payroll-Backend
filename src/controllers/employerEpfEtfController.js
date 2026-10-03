const EmployerEpfEtf = require('../models/EmployerEpfEtf');

exports.getByEmployeeAndMonth = async (req, res) => {
    try {
        const { employeeId, year, month } = req.params;
        const contribution = await EmployerEpfEtf.findByEmployeeAndMonth(employeeId, year, month);
        if (!contribution) {
            return res.status(404).json({ message: 'Employer EPF/ETF contribution not found' });
        }
        res.status(200).json(contribution);
    } catch (error) {
        console.error('Error fetching employer EPF/ETF contribution:', error);
        res.status(500).json({ message: 'Error fetching employer EPF/ETF contribution', error: error.message });
    }
};
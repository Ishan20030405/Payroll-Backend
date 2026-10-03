// backend/src/controllers/companySettingController.js
const CompanySetting = require('../models/CompanySetting');

exports.getSettings = async (req, res) => {
    try {
        const settings = await CompanySetting.get();
        res.status(200).json(settings || {});
    } catch (error) {
        console.error('Error fetching company settings:', error);
        res.status(500).json({ message: 'Failed to fetch company settings' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const success = await CompanySetting.upsert(req.body);
        res.status(200).json({ message: 'Company settings updated successfully', success });
    } catch (error) {
        console.error('Error updating company settings:', error);
        res.status(500).json({ message: 'Failed to update company settings' });
    }
};

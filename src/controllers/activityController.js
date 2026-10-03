const ActivityLog = require('../models/ActivityLog');

exports.getRecent = async (req, res) => {
    try {
        const activities = await ActivityLog.getRecent(req.query.limit);
        res.status(200).json(activities);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Error fetching activities', error: error.message });
    }
};

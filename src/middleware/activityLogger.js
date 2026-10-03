const ActivityLog = require('../models/ActivityLog');

const ignoredPaths = ['/api/activities', '/api/health'];

const formatWords = value => value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

const describeRequest = req => {
    const path = req.path.toLowerCase();
    const method = req.method;
    const resource = path.split('/').filter(Boolean).pop() || 'system';

    if (path.includes('/auth/me')) return 'Viewed account profile';
    if (path.includes('/employees')) return method === 'GET' ? 'Viewed employee records' : `${method === 'POST' ? 'Added' : method === 'DELETE' ? 'Deleted' : 'Updated'} employee record`;
    if (path.includes('/attendance')) return method === 'GET' ? 'Viewed attendance records' : 'Updated attendance record';
    if (path.includes('/payroll')) return method === 'GET' ? 'Viewed payroll records' : `${method === 'POST' ? 'Created' : 'Updated'} payroll values`;
    if (path.includes('/payslips')) return method === 'GET' ? 'Viewed payslip records' : 'Updated payslip values';
    if (path.includes('/settings')) return 'Updated system settings';
    if (path.includes('/company-information')) return method === 'GET' ? 'Viewed company information' : 'Updated company information';
    if (method === 'GET') return `Viewed ${formatWords(resource)}`;
    if (method === 'POST') return `Created ${formatWords(resource)}`;
    if (method === 'PUT' || method === 'PATCH') return `Updated ${formatWords(resource)}`;
    if (method === 'DELETE') return `Deleted ${formatWords(resource)}`;
    return 'Used the system';
};

module.exports = (req, res, next) => {
    if (ignoredPaths.some(path => req.originalUrl.startsWith(path))) return next();

    res.on('finish', () => {
        if (req.originalUrl.startsWith('/api/auth/login') || req.originalUrl.startsWith('/api/auth/logout')) return;
        if (req.originalUrl.startsWith('/api/payslips/generate') || req.originalUrl.includes('/api/payslips/employee/')) return;
        if (!req.user) return;

        const details = res.statusCode >= 400 ? 'This action could not be completed.' : 'Completed successfully.';
        ActivityLog.create({
            userId: req.user.id,
            action: describeRequest(req),
            details,
            ipAddress: req.ip
        });
    });

    next();
};

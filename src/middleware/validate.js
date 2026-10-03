// src/middleware/validate.js
exports.validateEmployee = (req, res, next) => {
    const { fullName, email } = req.body;
    if (!fullName && !req.body.full_name) {
        return res.status(400).json({ error: 'Full name is required' });
    }
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    next();
};

exports.validateRegistration = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    next();
};

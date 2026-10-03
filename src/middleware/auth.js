// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_123456789';

exports.authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : authHeader || req.headers['x-auth-token'] || req.headers.token;

        if (!tokenFromHeader) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(tokenFromHeader, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};
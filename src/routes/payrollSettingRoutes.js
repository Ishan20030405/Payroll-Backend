// backend/src/routes/payrollSettingRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
    getPayrollSettings,
    updatePayrollSettings,
    resetPayrollSettings
} = require('../controllers/payrollSettingController');

// All routes require authentication
router.use(authenticate);

// Get settings
router.get('/', getPayrollSettings);

// Update settings (Admin only)
router.put('/', authorize('ADMIN'), updatePayrollSettings);

// Reset settings to defaults (Admin only)
router.post('/reset', authorize('ADMIN'), resetPayrollSettings);

module.exports = router;
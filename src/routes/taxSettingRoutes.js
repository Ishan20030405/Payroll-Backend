const express = require('express');
const router = express.Router();
const taxSettingController = require('../controllers/taxSettingController');
const { authenticate, authorize } = require('../middleware/auth');

// Tax brackets CRUD
router.get('/', authenticate, taxSettingController.getTaxSettings);
router.put('/', authenticate, authorize('ADMIN'), taxSettingController.updateTaxSettings);

// Progressive APIT calculation → saves to payrolls.apit_tax
router.post('/calculate', authenticate, authorize('ADMIN'), taxSettingController.calculateAndSaveTax);

// Summary: payroll records with saved apit_tax
router.get('/summary', authenticate, taxSettingController.getTaxSummary);

module.exports = router;

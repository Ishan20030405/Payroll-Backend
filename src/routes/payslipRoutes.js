const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const payslipController = require('../controllers/payslipController');

router.get('/my', authenticate, payslipController.getMyPayslips);
router.get('/employee/:employeeId/month/:monthYear', authenticate, authorize('ADMIN', 'HR'), payslipController.getByEmployeeAndMonth);
router.put('/employee/:employeeId/month/:monthYear', authenticate, authorize('ADMIN', 'HR'), payslipController.updateByEmployeeAndMonth);
router.get('/options', authenticate, authorize('ADMIN', 'HR'), payslipController.getOptions);
router.get('/generation-options', authenticate, authorize('ADMIN', 'HR'), payslipController.getGenerationOptions);
router.post('/generate', authenticate, authorize('ADMIN', 'HR'), payslipController.generate);

module.exports = router;
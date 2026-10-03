// backend/src/routes/payrollRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const payrollController = require('../controllers/payrollController');

// Get all payrolls
router.get('/', authenticate, payrollController.getAllPayrolls);

// Get distinct payroll months
router.get('/months', authenticate, payrollController.getPayrollMonths);

// Get payrolls by employee
router.get('/employee/:employeeId', authenticate, payrollController.getPayrollsByEmployee);

// Get payroll by ID
router.get('/employee/:employeeId/month/:monthYear', authenticate, payrollController.getPayrollById);

// Create payroll
router.post('/', authenticate, payrollController.createPayroll);

// Generate payroll for all employees
router.post('/generate', authenticate, payrollController.generatePayroll);

// Update payroll
router.put('/employee/:employeeId/month/:monthYear', authenticate, payrollController.updatePayroll);

// Delete payroll
router.delete('/employee/:employeeId/month/:monthYear', authenticate, payrollController.deletePayroll);

module.exports = router;
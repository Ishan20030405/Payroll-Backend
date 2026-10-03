// src/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('ADMIN'), employeeController.getAllEmployees);
router.get('/search', authenticate, authorize('ADMIN'), employeeController.searchEmployees);
router.get('/stats', authenticate, authorize('ADMIN'), employeeController.getEmployeeStats);
router.get('/:id', authenticate, authorize('ADMIN'), employeeController.getEmployeeById);
router.post('/', authenticate, authorize('ADMIN'), employeeController.createEmployee);
router.put('/:id', authenticate, authorize('ADMIN'), employeeController.updateEmployee);
router.delete('/:id', authenticate, authorize('ADMIN'), employeeController.deleteEmployee);

module.exports = router;
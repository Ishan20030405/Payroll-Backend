// backend/src/routes/salaryStructureRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
    getAllSalaryStructures,
    getSalaryStructureById,
    getSalaryStructureByDeptDesig,
    createSalaryStructure,
    updateSalaryStructure,
    deleteSalaryStructure
} = require('../controllers/salaryStructureController');

// All routes require authentication
router.use(authenticate);

// Get all salary structures (Admin only)
router.get('/', authorize('ADMIN'), getAllSalaryStructures);

// Get salary structure by department and designation (query params)
router.get('/search', authorize('ADMIN'), getSalaryStructureByDeptDesig);

// Get salary structure by ID
router.get('/:id', authorize('ADMIN'), getSalaryStructureById);

// Create salary structure (Admin only)
router.post('/', authorize('ADMIN'), createSalaryStructure);

// Update salary structure (Admin only)
router.put('/:id', authorize('ADMIN'), updateSalaryStructure);

// Delete salary structure (Admin only)
router.delete('/:id', authorize('ADMIN'), deleteSalaryStructure);

module.exports = router;
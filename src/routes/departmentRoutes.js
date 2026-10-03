// backend/src/routes/departmentRoutes.js
const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', departmentController.getAllDepartments);
router.get('/search', departmentController.searchDepartments);
router.get('/:id', departmentController.getDepartment);
router.post('/', authorize('ADMIN'), departmentController.createDepartment);
router.put('/:id', authorize('ADMIN'), departmentController.updateDepartment);
router.delete('/:id', authorize('ADMIN'), departmentController.deleteDepartment);

module.exports = router;
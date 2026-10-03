// src/routes/designationRoutes.js
const express = require('express');
const router = express.Router();
const designationController = require('../controllers/designationController');
const { authenticate } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authenticate);

// Get all designations
router.get('/', designationController.getAllDesignations);

// Search designations (should be defined before /:id to prevent matching as an ID)
router.get('/search', designationController.searchDesignations);

// Get a specific designation by ID
router.get('/:id', designationController.getDesignation);

// Create a new designation
router.post('/', designationController.createDesignation);

// Update a designation
router.put('/:id', designationController.updateDesignation);

// Delete a designation
router.delete('/:id', designationController.deleteDesignation);

module.exports = router;

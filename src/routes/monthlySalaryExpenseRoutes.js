const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/monthlySalaryExpenseController');

router.get('/', authenticate, authorize('ADMIN', 'HR'), controller.getRecent);

module.exports = router;
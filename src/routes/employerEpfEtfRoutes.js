const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getByEmployeeAndMonth } = require('../controllers/employerEpfEtfController');

router.get('/employee/:employeeId/year/:year/month/:month', authenticate, getByEmployeeAndMonth);

module.exports = router;
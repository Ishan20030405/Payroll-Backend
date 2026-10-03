const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const activityController = require('../controllers/activityController');

router.get('/', authenticate, authorize('ADMIN', 'HR'), activityController.getRecent);

module.exports = router;

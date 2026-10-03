// backend/src/routes/companySettingRoutes.js
const express = require('express');
const router = express.Router();
const companySettingController = require('../controllers/companySettingController');

router.get('/', companySettingController.getSettings);
router.put('/', companySettingController.updateSettings);

module.exports = router;

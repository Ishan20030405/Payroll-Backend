const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getCompanyInformation, updateCompanyInformation, resetCompanyInformation, uploadCompanyLogo, getCompanyLogo } = require('../controllers/companyInformationController');

router.use(authenticate);
router.get('/', getCompanyInformation);
router.get('/logo', getCompanyLogo);
router.put('/', authorize('ADMIN'), updateCompanyInformation);
router.post('/reset', authorize('ADMIN'), resetCompanyInformation);
router.post('/logo', authorize('ADMIN'), uploadCompanyLogo);

module.exports = router;
// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authenticate, authorize('ADMIN'), authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, authController.logout);
router.put('/update/:id', authenticate, authController.updateUser);

// Register user from employee (Admin only)
router.post('/register-user', authenticate, authController.registerUserFromEmployee);

module.exports = router;

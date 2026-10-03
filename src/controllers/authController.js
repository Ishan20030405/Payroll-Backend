// backend/src/controllers/authController.js
const User = require('../models/User');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const ActivityLog = require('../models/ActivityLog');

const JWT_SECRET = process.env.JWT_SECRET || 'payroll_secret_key';

const { sendOTPEmail } = require('../config/mailer');

// Step 1: Initial Login (Verifies username/password and sends OTP to email)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user by username
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({ 
                message: 'Your account has been deactivated. Please contact your administrator.' 
            });
        }

        // Verify password
        const isValid = await User.verifyPassword(username, password);
        if (!isValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Get employee email linked to user or fallback to user username if email format
        let targetEmail = null;
        const [empRows] = await db.execute('SELECT * FROM employees WHERE user_id = ?', [user.id]);
        if (empRows.length > 0 && empRows[0].email) {
            targetEmail = empRows[0].email;
        } else {
            return res.status(400).json({ 
                message: 'No email address found for your account. Please contact your administrator to link an employee email.' 
            });
        }

        // Generate 6-digit OTP code and expiry (10 mins)
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save OTP code in user record
        await db.execute('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [otpCode, expiresAt, user.id]);

        // Send OTP via Gmail SMTP
        try {
            await sendOTPEmail(targetEmail, otpCode);
            console.log(`📧 2FA OTP sent to ${targetEmail} for user ${user.username}`);
        } catch (mailErr) {
            console.error('❌ Error sending OTP email:', mailErr);
            return res.status(500).json({ message: 'Failed to send OTP verification email. Please try again.' });
        }

        // Obfuscate target email for response display (e.g. c***@gmail.com)
        const emailParts = targetEmail.split('@');
        const maskedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];

        res.status(200).json({
            require2FA: true,
            message: `Verification code sent to ${maskedEmail}`,
            username: user.username,
            email: maskedEmail
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed', error: error.message });
    }
};

// Step 2: Verify OTP and complete Login
exports.verifyOTP = async (req, res) => {
    try {
        const { username, otp } = req.body;

        if (!username || !otp) {
            return res.status(400).json({ message: 'Username and OTP code are required' });
        }

        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const [rows] = await db.execute('SELECT otp_code, otp_expires_at FROM users WHERE id = ?', [user.id]);
        if (rows.length === 0 || !rows[0].otp_code) {
            return res.status(400).json({ message: 'No OTP requested or code expired. Please log in again.' });
        }

        const { otp_code, otp_expires_at } = rows[0];

        // Check if OTP matches
        if (rows[0].otp_code !== String(otp).trim()) {
            return res.status(400).json({ message: 'Invalid verification code. Please check your email and try again.' });
        }

        // Check if OTP expired
        if (new Date() > new Date(otp_expires_at)) {
            return res.status(400).json({ message: 'Verification code has expired. Please log in again.' });
        }

        // Clear OTP after successful verification
        await db.execute('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = ?', [user.id]);

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Get employee data if linked
        let employeeData = null;
        const [empRows] = await db.execute('SELECT * FROM employees WHERE user_id = ?', [user.id]);
        if (empRows.length > 0) {
            employeeData = empRows[0];
        }

        await ActivityLog.create({
            userId: user.id,
            action: 'Login 2FA',
            details: `User ${user.username} completed 2-step verification successfully`,
            ipAddress: req.ip
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                is_active: user.is_active,
                employee: employeeData
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Verification failed', error: error.message });
    }
};

// Register (Admin only)
exports.register = async (req, res) => {
    try {
        const { username, password, role = 'EMPLOYEE' } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        if (password.length < 4) {
            return res.status(400).json({ message: 'Password must be at least 4 characters' });
        }

        // Check if user already exists
        const existing = await User.findByUsername(username);
        if (existing) {
            return res.status(409).json({ message: 'Username already exists' });
        }

        const userId = await User.create({ username, password, role });
        const user = await User.findById(userId);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// ✅ FIXED: Register user from employee creation
exports.registerUserFromEmployee = async (req, res) => {
    try {
        const { username, password, role = 'EMPLOYEE', employeeId, fullName } = req.body;

        console.log('📝 Registering user from employee:', { username, role, employeeId, fullName });

        // ✅ Validate required fields
        if (!username) {
            return res.status(400).json({ 
                success: false,
                message: 'Username (email) is required' 
            });
        }

        if (!password) {
            return res.status(400).json({ 
                success: false,
                message: 'Password (NIC) is required' 
            });
        }

        // ✅ Ensure password is a string and not empty
        const passwordStr = String(password).trim();
        if (passwordStr.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Password (NIC) cannot be empty' 
            });
        }

        // ✅ Ensure username is a string and not empty
        const usernameStr = String(username).trim();
        if (usernameStr.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Username (email) cannot be empty' 
            });
        }

        // Check if user already exists
        const existing = await User.findByUsername(usernameStr);
        if (existing) {
            return res.status(409).json({ 
                success: false,
                message: 'User already exists with this email' 
            });
        }

        // ✅ Create user with validated password
        const userId = await User.create({
            username: usernameStr,
            password: passwordStr,
            role: role || 'EMPLOYEE',
            is_active: true
        });

        // Link user to employee if employeeId is provided
        if (employeeId) {
            // Get the employee by employee_id
            const employee = await Employee.findByEmployeeId(employeeId);
            if (employee) {
                // Update employee with user_id
                await Employee.update(employee.id, { 
                    user_id: userId
                });
                console.log(`✅ User ${userId} linked to employee ${employeeId}`);
            }
        }

        const user = await User.findById(userId);
        res.status(201).json({
            success: true,
            message: 'User account created successfully',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.error('❌ Register user from employee error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create user account', 
            error: error.message 
        });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let employeeData = null;
        const [empRows] = await db.execute('SELECT * FROM employees WHERE user_id = ?', [user.id]);
        if (empRows.length > 0) {
            employeeData = empRows[0];
        }

        res.status(200).json({
            id: user.id,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            employee: employeeData
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ message: 'Failed to get user', error: error.message });
    }
};

// Update user profile
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, role, is_active } = req.body;

        // Check if user exists
        const existing = await User.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if username is taken (if changing)
        if (username && username !== existing.username) {
            const taken = await User.findByUsername(username);
            if (taken) {
                return res.status(409).json({ message: 'Username already taken' });
            }
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (role) updateData.role = role;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (password) updateData.password = password;

        const success = await User.update(id, updateData);
        if (!success) {
            return res.status(404).json({ message: 'User not found or no changes made' });
        }

        const updated = await User.findById(id);
        res.status(200).json({
            message: 'User updated successfully',
            user: updated
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Failed to update user', error: error.message });
    }
};

// Logout (client-side token removal)
exports.logout = async (req, res) => {
    await ActivityLog.create({
        userId: req.user?.id || null,
        action: 'Logout',
        details: 'User logged out',
        ipAddress: req.ip
    });
    res.status(200).json({ message: 'Logged out successfully' });
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        // You'll need to add this method to User model
        const query = 'SELECT id, username, role, is_active, created_at, updated_at FROM users';
        const [rows] = await db.execute(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Failed to get users', error: error.message });
    }
};
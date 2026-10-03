// backend/src/app.js
const express = require('express');
const cors = require('cors');
const activityLogger = require('./middleware/activityLogger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(activityLogger);

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const designationRoutes = require('./routes/designationRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const payrollSettingRoutes = require('./routes/payrollSettingRoutes');
const salaryStructureRoutes = require('./routes/salaryStructureRoutes');
const employerEpfEtfRoutes = require('./routes/employerEpfEtfRoutes');
const companyInformationRoutes = require('./routes/companyInformationRoutes');
const payslipRoutes = require('./routes/payslipRoutes');
const monthlySalaryExpenseRoutes = require('./routes/monthlySalaryExpenseRoutes');
const activityRoutes = require('./routes/activityRoutes');

// ✅ Register routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);  // ✅ Must be registered
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/payrolls', payrollRoutes);
app.use('/api/payroll-settings', payrollSettingRoutes);
app.use('/api/salary-structures', salaryStructureRoutes);
app.use('/api/employer-epf-etf', employerEpfEtfRoutes);
app.use('/api/company-information', companyInformationRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/monthly-salary-expenses', monthlySalaryExpenseRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/tax-settings', require('./routes/taxSettingRoutes'));

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        message: `Route not found: ${req.method} ${req.url}` 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
});

module.exports = app;
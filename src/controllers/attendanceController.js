// backend/src/controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const SalaryStructure = require('../models/SalaryStructure');
const PayrollSetting = require('../models/PayrollSetting');

// Helper function to check if a date is Sunday
const isSunday = (dateString) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.getDay() === 0; // 0 = Sunday
};

const getAttendanceStatus = async (checkIn, requestedStatus) => {
    if (requestedStatus === 'Absent' || requestedStatus === 'Leave') {
        return requestedStatus;
    }

    if (!checkIn) return requestedStatus || 'Present';

    const settings = await PayrollSetting.get();
    const checkInTime = settings?.check_in_time || '09:00:00';
    const actualTime = new Date(`1970-01-01T${checkIn}`);
    const expectedTime = new Date(`1970-01-01T${checkInTime}`);

    return actualTime > expectedTime ? 'Late' : 'Present';
};

// Helper function to calculate Sunday overtime
const calculateSundayOvertime = async (employeeId, date, workingHours) => {
    try {
        // Get employee details
        const employee = await Employee.findById(employeeId);
        if (!employee) return 0;

        // Get salary structure for this employee
        const salaryStructure = await SalaryStructure.findByDepartmentAndDesignation(
            employee.department,
            employee.designation
        );
        
        if (!salaryStructure) return 0;

        // Get payroll settings
        const payrollSettings = await PayrollSetting.get();
        if (!payrollSettings) return 0;

        // Base rate = basic_pay / (working_days * working_hours)
        const baseRate = payrollSettings.working_days > 0 && payrollSettings.working_hours > 0
            ? salaryStructure.basic_pay / (payrollSettings.working_days * payrollSettings.working_hours)
            : 0;

        // Sunday OT Rate = baseRate * sunday_ot_rate from salary structure
        const sundayOtRate = baseRate * (salaryStructure.sunday_ot_rate || 0);

        // Overtime hours (working hours beyond 8 hours)
        const hrs = Math.floor(workingHours);
        const mins = Math.round((workingHours - hrs) * 100);
        const totalMins = hrs * 60 + mins;
        
        const overtimeMins = Math.max(0, totalMins - 480);
        const overtimeHoursDecimal = overtimeMins / 60; // For money math, we NEED true decimal!

        // Sunday overtime amount = Sunday OT Rate * overtimeHours
        return sundayOtRate * overtimeHoursDecimal;

    } catch (error) {
        console.error('Error calculating Sunday overtime:', error);
        return 0;
    }
};

// Get attendance by date
exports.getAttendanceByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }
        const records = await Attendance.getByDate(date);
        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Error fetching attendance', error: error.message });
    }
};

// Get attendance by ID
exports.getAttendanceById = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await Attendance.findById(id);
        if (!record) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.status(200).json(record);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ message: 'Error fetching attendance', error: error.message });
    }
};

// Add manual attendance with Sunday OT calculation
exports.addManualAttendance = async (req, res) => {
    try {
        const {
            employee_id,
            date,
            check_in,
            check_out,
            working_hours,
            overtime,
            status,
            remarks
        } = req.body;

        console.log('📝 Adding attendance:', { employee_id, date, check_in, check_out });

        // Validate required fields
        if (!employee_id || !date) {
            return res.status(400).json({ 
                message: 'Employee ID and date are required' 
            });
        }

        // Find employee
        let employee;
        if (isNaN(employee_id)) {
            employee = await Employee.findByEmployeeId(employee_id);
        } else {
            employee = await Employee.findById(parseInt(employee_id));
        }

        if (!employee) {
            return res.status(404).json({ 
                message: `Employee not found with ID: ${employee_id}` 
            });
        }

        const dbEmployeeId = employee.id;

        // Calculate working hours if check_in and check_out provided
        let finalWorkingHours = working_hours || 0;
        let finalOvertime = overtime || 0;

        if (check_in && check_out && finalWorkingHours === 0) {
            const d1 = new Date(`1970-01-01T${check_in}`);
            let d2 = new Date(`1970-01-01T${check_out}`);
            if (d2 < d1) d2 = new Date(`1970-01-02T${check_out}`);
            if (!isNaN(d1) && !isNaN(d2)) {
                const diffMins = Math.floor((d2 - d1) / 60000);
                const totalHours = parseFloat(`${Math.floor(diffMins / 60)}.${(diffMins % 60).toString().padStart(2, '0')}`);

                // Sunday: all shift hours are overtime, regular hours remain 0
                if (isSunday(date)) {
                    finalWorkingHours = 0;
                    finalOvertime = totalHours;
                    console.log(`📊 Sunday hours moved to OT: ${finalOvertime} for employee ${employee_id}`);
                } else {
                    const wHrs = Math.floor(diffMins / 60);
                    const wMins = diffMins % 60;
                    finalWorkingHours = parseFloat(`${wHrs}.${wMins.toString().padStart(2, '0')}`);

                    // Regular overtime (hours beyond 8)
                    finalOvertime = 0;
                    const diffMinsForOt = Math.floor((d2 - d1) / 60000);
                    if (diffMinsForOt > 480) {
                        const otMins = diffMinsForOt - 480;
                        const oHrs = Math.floor(otMins / 60);
                        const oM = otMins % 60;
                        finalOvertime = parseFloat(`${oHrs}.${oM.toString().padStart(2, '0')}`);
                    }
                }
            }
        }

        const finalStatus = await getAttendanceStatus(check_in, status);

        // Check if attendance already exists
        const existing = await Attendance.getByEmployeeAndDate(dbEmployeeId, date);
        if (existing) {
            return res.status(409).json({
                message: 'Attendance already exists for this employee on this date.'
            });
        }

        // Create new attendance record
        const id = await Attendance.create({
            employee_id: dbEmployeeId,
            date,
            check_in: check_in || null,
            check_out: check_out || null,
            working_hours: finalWorkingHours,
            overtime: finalOvertime,
            status: finalStatus
        });

        const created = await Attendance.findById(id);
        res.status(201).json({ 
            message: 'Attendance added successfully', 
            data: created,
            is_sunday: isSunday(date),
            sunday_ot_rate_applied: isSunday(date)
        });
    } catch (error) {
        console.error('Error adding attendance:', error);
        res.status(500).json({ 
            message: 'Error adding attendance', 
            error: error.message 
        });
    }
};

// Bulk upload attendance with Sunday OT calculation
exports.bulkUploadAttendance = async (req, res) => {
    try {
        const { records } = req.body;

        if (!records || records.length === 0) {
            return res.status(400).json({ message: 'No records provided' });
        }

        const validatedRecords = [];
        const errors = [];
        const sundayRecords = [];
        const payrollSettings = await PayrollSetting.get();
        const checkInTime = payrollSettings?.check_in_time || '09:00:00';

        for (const record of records) {
            if (!record.employee_id || !record.date) {
                errors.push(`Missing employee_id or date for record: ${JSON.stringify(record)}`);
                continue;
            }

            let employee;
            if (isNaN(record.employee_id)) {
                employee = await Employee.findByEmployeeId(record.employee_id);
            } else {
                employee = await Employee.findById(parseInt(record.employee_id));
            }

            if (!employee) {
                errors.push(`Employee not found: ${record.employee_id}`);
                continue;
            }

            // Calculate working hours
            let workingHours = record.working_hours || 0;
            let overtime = record.overtime || 0;

            if (record.check_in && record.check_out && workingHours === 0) {
                const d1 = new Date(`1970-01-01T${record.check_in}`);
                let d2 = new Date(`1970-01-01T${record.check_out}`);
                if (d2 < d1) d2 = new Date(`1970-01-02T${record.check_out}`);
                if (!isNaN(d1) && !isNaN(d2)) {
                    const diffMins = Math.floor((d2 - d1) / 60000);
                    const wHrs = Math.floor(diffMins / 60);
                    const wMins = diffMins % 60;
                    workingHours = parseFloat(`${wHrs}.${wMins.toString().padStart(2, '0')}`);
                    
                    // Check if date is Sunday
                    if (isSunday(record.date)) {
                        overtime = workingHours;
                        workingHours = 0;
                        sundayRecords.push({
                            employee: employee.full_name,
                            date: record.date,
                            sunday_ot: overtime
                        });
                    } else {
                        overtime = 0;
                        if (diffMins > 480) {
                            const otMins = diffMins - 480;
                            const oH = Math.floor(otMins / 60);
                            const oM = otMins % 60;
                            overtime = parseFloat(`${oH}.${oM.toString().padStart(2, '0')}`);
                        }
                    }
                }
            }

            const actualCheckIn = record.check_in ? new Date(`1970-01-01T${record.check_in}`) : null;
            const expectedCheckIn = new Date(`1970-01-01T${checkInTime}`);
            const status = record.status === 'Absent' || record.status === 'Leave'
                ? record.status
                : actualCheckIn && actualCheckIn > expectedCheckIn ? 'Late' : 'Present';

            validatedRecords.push({
                employee_id: employee.id,
                date: record.date,
                check_in: record.check_in || null,
                check_out: record.check_out || null,
                working_hours: workingHours,
                overtime: overtime,
                status
            });
        }

        if (validatedRecords.length === 0) {
            return res.status(400).json({ 
                message: 'No valid records to import', 
                errors 
            });
        }

        const inserted = await Attendance.bulkCreate(validatedRecords);
        res.status(200).json({ 
            message: 'Attendance imported successfully', 
            inserted,
            sunday_records: sundayRecords,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error bulk uploading attendance:', error);
        res.status(500).json({ 
            message: 'Error bulk uploading attendance', 
            error: error.message 
        });
    }
};

// Update attendance with Sunday OT calculation
exports.updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            check_in,
            check_out,
            working_hours,
            overtime,
            status
        } = req.body;

        const existing = await Attendance.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        let finalWorkingHours = working_hours !== undefined && working_hours !== null ? working_hours : (existing.working_hours || 0);
        let finalOvertime = overtime !== undefined && overtime !== null ? overtime : (existing.overtime || 0);

        if (check_in && check_out && (working_hours === undefined || working_hours === null || working_hours === 0)) {
            const d1 = new Date(`1970-01-01T${check_in}`);
            let d2 = new Date(`1970-01-01T${check_out}`);
            if (d2 < d1) d2 = new Date(`1970-01-02T${check_out}`);
            if (!isNaN(d1) && !isNaN(d2)) {
                const diffMins = Math.floor((d2 - d1) / 60000);
                const totalHours = parseFloat(`${Math.floor(diffMins / 60)}.${(diffMins % 60).toString().padStart(2, '0')}`);

                if (isSunday(existing.date)) {
                    finalWorkingHours = 0;
                    finalOvertime = totalHours;
                } else {
                    const wHrs = Math.floor(diffMins / 60);
                    const wMins = diffMins % 60;
                    finalWorkingHours = parseFloat(`${wHrs}.${wMins.toString().padStart(2, '0')}`);
                    finalOvertime = 0;
                    if (diffMins > 480) {
                        const otMins = diffMins - 480;
                        const oH = Math.floor(otMins / 60);
                        const oM = otMins % 60;
                        finalOvertime = parseFloat(`${oH}.${oM.toString().padStart(2, '0')}`);
                    }
                }
            }
        }

        const finalCheckIn = check_in !== undefined ? check_in : existing.check_in;
        const finalCheckOut = check_out !== undefined ? check_out : existing.check_out;
        const finalStatus = await getAttendanceStatus(finalCheckIn, status || existing.status);

        const success = await Attendance.update(id, {
            check_in: finalCheckIn,
            check_out: finalCheckOut,
            working_hours: finalWorkingHours,
            overtime: finalOvertime,
            status: finalStatus
        });

        if (!success) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        const updated = await Attendance.findById(id);
        res.status(200).json({ 
            message: 'Attendance updated successfully', 
            data: updated,
            is_sunday: isSunday(existing.date)
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ 
            message: 'Error updating attendance', 
            error: error.message 
        });
    }
};

// Delete attendance
exports.deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Attendance.findById(id);
        if (!existing) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        const success = await Attendance.delete(id);
        if (!success) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }
        res.status(200).json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Error deleting attendance:', error);
        res.status(500).json({ message: 'Error deleting attendance', error: error.message });
    }
};

// Get employee attendance summary
exports.getEmployeeAttendanceSummary = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query;

        if (!employeeId || !month || !year) {
            return res.status(400).json({ 
                message: 'Employee ID, month, and year are required' 
            });
        }

        let dbEmployeeId = employeeId;
        if (isNaN(employeeId)) {
            const employee = await Employee.findByEmployeeId(employeeId);
            if (!employee) return res.status(404).json({ message: 'Employee not found' });
            dbEmployeeId = employee.id;
        }

        const summary = await Attendance.getMonthlySummary(dbEmployeeId, parseInt(month), parseInt(year));
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({ 
            message: 'Error fetching attendance summary', 
            error: error.message 
        });
    }
};

// Get available payroll months from employee monthly attendance summaries
exports.getEmployeeSummaryMonths = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const months = await Attendance.getSummaryMonths(employeeId);
        res.status(200).json(months);
    } catch (error) {
        console.error('Error fetching summary months:', error);
        res.status(500).json({ message: 'Error fetching summary months', error: error.message });
    }
};

// Get a stored employee monthly attendance summary
exports.getStoredEmployeeMonthlySummary = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year, month } = req.query;
        if (!employeeId || !year || !month) {
            return res.status(400).json({ message: 'Employee ID, year, and month are required' });
        }

        const summary = await Attendance.getStoredMonthlySummary(employeeId, parseInt(year), parseInt(month));
        res.status(200).json(summary || {});
    } catch (error) {
        console.error('Error fetching stored monthly summary:', error);
        res.status(500).json({ message: 'Error fetching stored monthly summary', error: error.message });
    }
};

// Get calculated basic pay for an employee and month
exports.getEmployeeBasicPay = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { year, month } = req.query;
        if (!employeeId || !year || !month) {
            return res.status(400).json({ message: 'Employee ID, year, and month are required' });
        }

        const basicPay = await Attendance.getBasicPay(employeeId, parseInt(year), parseInt(month));
        res.status(200).json(basicPay || {});
    } catch (error) {
        console.error('Error fetching basic pay:', error);
        res.status(500).json({ message: 'Error fetching basic pay', error: error.message });
    }
};

// Get employee attendance history
exports.getEmployeeAttendance = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { startDate, endDate } = req.query;

        let dbEmployeeId = employeeId;
        if (isNaN(employeeId)) {
            const employee = await Employee.findByEmployeeId(employeeId);
            if (!employee) return res.status(404).json({ message: 'Employee not found' });
            dbEmployeeId = employee.id;
        }

        const records = await Attendance.getByEmployee(dbEmployeeId, startDate, endDate);
        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching employee attendance:', error);
        res.status(500).json({ 
            message: 'Error fetching employee attendance', 
            error: error.message 
        });
    }
};
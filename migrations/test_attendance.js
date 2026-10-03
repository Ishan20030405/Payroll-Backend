const db = require('./src/config/db');
const Attendance = require('./src/models/Attendance');

async function test() {
    try {
        const data = {
            employee_id: 'E009',
            date: '2026-08-05',
            check_in: '05:45',
            check_out: '17:43',
            working_hours: 11.97,
            overtime: 3.97,
            status: 'Present'
        };
        
        console.log("Testing Attendance.create...");
        const id = await Attendance.create(data);
        console.log("Success! Insert ID:", id);
        process.exit(0);
    } catch (e) {
        console.error("Error in test:", e);
        process.exit(1);
    }
}

test();


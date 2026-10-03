const db = require('./src/config/db');

async function test() {
    try {
        // Check for active employees
        const [emps] = await db.query('SELECT employee_id, full_name, status FROM employees WHERE status = "Active" LIMIT 5');
        console.log('Active employees:', emps.length);
        emps.forEach(e => console.log(`  ${e.employee_id} - ${e.full_name}`));

        if (emps.length === 0) {
            console.log('No active employees found - this would cause the modal dropdown to be empty');
            process.exit(0);
        }

        // Try inserting a test record
        const testData = {
            employee_id: emps[0].employee_id,
            date: '2026-08-07',
            check_in: '09:00',
            check_out: '17:00',
            working_hours: 8,
            overtime: 0,
            status: 'Present'
        };
        console.log('\nTesting INSERT with:', testData);

        const [result] = await db.execute(
            'INSERT INTO attendance (employee_id, date, check_in, check_out, working_hours, overtime, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [testData.employee_id, testData.date, testData.check_in, testData.check_out, testData.working_hours, testData.overtime, testData.status]
        );
        console.log('INSERT SUCCESS! ID:', result.insertId);

        // Clean up test record
        await db.execute('DELETE FROM attendance WHERE id = ?', [result.insertId]);
        console.log('Test record cleaned up.');

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.code, '-', err.message);
        console.error('SQL State:', err.sqlState);
        console.error('SQL:', err.sql);
        process.exit(1);
    }
}

test();


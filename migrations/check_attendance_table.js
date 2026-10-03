const db = require('./src/config/db');

async function check() {
    try {
        const [rows] = await db.query('SHOW TABLES LIKE "attendance"');
        if (rows.length > 0) {
            console.log('attendance table EXISTS');
            const [cols] = await db.query('DESCRIBE attendance');
            cols.forEach(c => console.log(`  ${c.Field} - ${c.Type} ${c.Null === 'NO' ? 'NOT NULL' : 'NULL'}`));
        } else {
            console.log('attendance table DOES NOT EXIST - creating now...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS attendance (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id VARCHAR(50) NOT NULL,
                    date DATE NOT NULL,
                    check_in TIME NOT NULL,
                    check_out TIME NOT NULL,
                    working_hours DECIMAL(5,2) DEFAULT 0,
                    overtime DECIMAL(5,2) DEFAULT 0,
                    status VARCHAR(20) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
                )
            `);
            console.log('attendance table CREATED successfully');
        }
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

check();


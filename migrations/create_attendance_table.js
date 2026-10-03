const db = require('./src/config/db');

async function createTable() {
    try {
        await db.query('DROP TABLE IF EXISTS attendance');
        const query = `
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
        `;
        await db.query(query);
        console.log("Attendance table created successfully");
        process.exit(0);
    } catch (err) {
        console.error("Error creating table:", err);
        process.exit(1);
    }
}

createTable();


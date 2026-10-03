const db = require('./src/config/db');

async function createDesignationsTable() {
    try {
        // Check if department column exists and needs migration
        try {
            const [columns] = await db.execute('SHOW COLUMNS FROM designations');
            const hasDepartment = columns.some(c => c.Field === 'department');
            
            if (hasDepartment) {
                // Check if it's already VARCHAR(20) with foreign key
                const deptCol = columns.find(c => c.Field === 'department');
                if (deptCol && deptCol.Type !== 'varchar(20)') {
                    console.log('🔄 Updating department column type to VARCHAR(20)...');
                    await db.execute('ALTER TABLE designations MODIFY department VARCHAR(20) NULL');
                }
            }
        } catch (e) {
            // Table doesn't exist yet
        }

        const query = `
            CREATE TABLE IF NOT EXISTS designations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                designation_name VARCHAR(100) NOT NULL,
                department VARCHAR(20),
                basic_salary DECIMAL(10,2) DEFAULT 0.00,
                ot_eligible TINYINT(1) DEFAULT 1,
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (department) REFERENCES departments(department_id) ON DELETE CASCADE ON UPDATE CASCADE
            )
        `;

        console.log('Creating designations table...');
        await db.execute(query);
        console.log('Designations table created successfully (or already exists).');

        // Check if it's empty, and insert some default data if so
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM designations');
        if (rows[0].count === 0) {
            console.log('Inserting default designations...');
            
            // First check if departments exist
            const [depts] = await db.execute('SELECT department_id FROM departments');
            
            if (depts.length === 0) {
                console.log('⚠️ No departments found. Please run create_departments_table.js first.');
                process.exit(1);
            }

            const insertQuery = `
                INSERT INTO designations (designation_name, department, basic_salary, ot_eligible, status) VALUES 
                ('Senior Software Engineer', 'DEP-ENG', 85000.00, 1, 'Active'),
                ('Software Engineer', 'DEP-ENG', 65000.00, 1, 'Active'),
                ('Junior Software Engineer', 'DEP-ENG', 45000.00, 1, 'Active'),
                ('Sales Manager', 'DEP-SLS', 75000.00, 0, 'Active'),
                ('Sales Executive', 'DEP-SLS', 55000.00, 0, 'Active'),
                ('Finance Manager', 'DEP-FIN', 80000.00, 0, 'Active'),
                ('Accountant', 'DEP-FIN', 60000.00, 0, 'Active')
            `;
            await db.execute(insertQuery);
            console.log('Default designations inserted successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating designations table:', error);
        process.exit(1);
    }
}

createDesignationsTable();


const db = require('./src/config/db');

async function createDepartmentsTable() {
    try {
        // First check if the old table exists and migrate if needed
        try {
            const [oldColumns] = await db.execute('SHOW COLUMNS FROM departments');
            const hasIdColumn = oldColumns.some(c => c.Field === 'id');
            const hasDepartmentCode = oldColumns.some(c => c.Field === 'department_code');

            if (hasIdColumn && hasDepartmentCode) {
                console.log('🔄 Old structure detected. Run migrate_departments_to_code_pk.js first.');
                console.log('   Then run this script again.');
                process.exit(1);
            }
        } catch (e) {
            // Table doesn't exist yet, that's fine
        }

        const query = `
            CREATE TABLE IF NOT EXISTS departments (
                department_id VARCHAR(20) PRIMARY KEY,
                department_name VARCHAR(100) NOT NULL,
                department_head VARCHAR(100),
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;

        console.log('Creating departments table...');
        await db.execute(query);
        console.log('Departments table created successfully (or already exists).');

        // Check if it's empty, and insert some default data if so
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM departments');
        if (rows[0].count === 0) {
            console.log('Inserting default departments...');
            const insertQuery = `
                INSERT INTO departments (department_id, department_name, department_head, status) VALUES 
                ('DEP-ENG', 'Engineering', 'Yuki Tanaka', 'Active'),
                ('DEP-SLS', 'Sales', 'Sofia Marchetti', 'Active'),
                ('DEP-FIN', 'Finance', 'Devon Okafor', 'Active')
            `;
            await db.execute(insertQuery);
            console.log('Default departments inserted successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating departments table:', error);
        process.exit(1);
    }
}

createDepartmentsTable();


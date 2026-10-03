// migrate_designations_to_department_id.js
// Run this script to migrate designations table: node migrate_designations_to_department_id.js
require('dotenv').config();
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || process.env.DB_HOST || 'mysql-ishan.alwaysdata.net',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || process.env.DB_NAME || 'ishan_ishan_payroll'
    });

    try {
        console.log('🔄 Starting designations table migration...');

        // Check current structure
        const [columns] = await conn.execute('SHOW COLUMNS FROM designations');
        console.log('Current columns:', columns.map(c => c.Field).join(', '));

        // 1. Check if department column exists
        const [deptColumn] = await conn.execute("SHOW COLUMNS FROM designations LIKE 'department'");
        if (deptColumn.length === 0) {
            console.log('⚠️ department column not found in designations table. Adding it...');
            await conn.execute('ALTER TABLE designations ADD COLUMN department VARCHAR(20)');
        }

        // 2. Get all departments to map department names to IDs
        console.log('📌 Mapping department names to department_ids...');
        const [departments] = await conn.execute('SELECT department_id, department_name FROM departments');
        
        // Create a mapping of department name -> department_id
        const deptMap = {};
        departments.forEach(d => {
            deptMap[d.department_name] = d.department_id;
            deptMap[d.department_id] = d.department_id; // Also map ID to itself
        });

        // 3. Update designations.department to use department_id
        console.log('📌 Updating designations department values...');
        
        // First, get all designations
        const [designations] = await conn.execute('SELECT id, department FROM designations WHERE department IS NOT NULL');
        
        for (const desig of designations) {
            let newDeptId = null;
            
            // Check if the current value is a department name or ID
            if (deptMap[desig.department]) {
                newDeptId = deptMap[desig.department];
            } else {
                // Try to find by partial match or exact match
                for (const d of departments) {
                    if (d.department_name.toLowerCase() === desig.department.toLowerCase() ||
                        d.department_id.toLowerCase() === desig.department.toLowerCase()) {
                        newDeptId = d.department_id;
                        break;
                    }
                }
            }
            
            if (newDeptId) {
                await conn.execute(
                    'UPDATE designations SET department = ? WHERE id = ?',
                    [newDeptId, desig.id]
                );
                console.log(`   Updated designation ${desig.id}: "${desig.department}" -> "${newDeptId}"`);
            } else if (desig.department) {
                console.log(`   ⚠️ Could not map department: "${desig.department}" for designation ${desig.id}`);
                // Set to NULL if can't map
                await conn.execute(
                    'UPDATE designations SET department = NULL WHERE id = ?',
                    [desig.id]
                );
            }
        }

        // 4. Change department column type to VARCHAR(20) to match department_id
        console.log('📌 Changing department column type to VARCHAR(20)...');
        await conn.execute('ALTER TABLE designations MODIFY department VARCHAR(20) NULL');

        // 5. Drop existing foreign key if exists
        console.log('📌 Checking for existing foreign key...');
        const [fkResults] = await conn.execute(`
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'designations'
            AND COLUMN_NAME = 'department'
            AND REFERENCED_TABLE_NAME = 'departments'
        `);

        for (const fk of fkResults) {
            console.log(`   Dropping foreign key: ${fk.CONSTRAINT_NAME}`);
            await conn.execute(`ALTER TABLE designations DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }

        // 6. Add foreign key constraint with CASCADE DELETE
        console.log('📌 Adding foreign key constraint with CASCADE DELETE...');
        await conn.execute(`
            ALTER TABLE designations
            ADD CONSTRAINT fk_designations_department
            FOREIGN KEY (department) REFERENCES departments(department_id)
            ON DELETE CASCADE
            ON UPDATE CASCADE
        `);
        console.log('   ✅ Foreign key added with CASCADE DELETE');

        // 7. Add index on department for better performance (only if it doesn't exist)
        console.log('📌 Checking for existing index...');
        const [existingIndexes] = await conn.execute(`
            SELECT INDEX_NAME 
            FROM information_schema.STATISTICS 
            WHERE TABLE_NAME = 'designations' 
            AND INDEX_NAME = 'idx_designations_department'
        `);

        if (existingIndexes.length === 0) {
            console.log('   Adding index on department column...');
            await conn.execute('CREATE INDEX idx_designations_department ON designations(department)');
            console.log('   ✅ Index added');
        } else {
            console.log('   ℹ️ Index already exists, skipping...');
        }

        console.log('✅ Migration complete!');
        console.log('📊 New structure: designations.department references departments.department_id with CASCADE DELETE');

        // Show new structure
        const [newColumns] = await conn.execute('SHOW COLUMNS FROM designations');
        console.log('New columns:', newColumns.map(c => c.Field).join(', '));

        // Show the updated data
        const [sample] = await conn.execute(`
            SELECT d.id, d.designation_name, d.department, dept.department_name as dept_name
            FROM designations d
            LEFT JOIN departments dept ON d.department = dept.department_id
            LIMIT 10
        `);
        console.log('\nSample data after migration:');
        console.table(sample);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.sql) console.error('SQL:', error.sql);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


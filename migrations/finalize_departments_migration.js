// backend/finalize_departments_migration.js
// Run this script: node finalize_departments_migration.js
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
        console.log('🔍 Checking current departments table structure...');
        
        // Check current columns
        const [columns] = await conn.execute('SHOW COLUMNS FROM departments');
        console.log('Current columns:', columns.map(c => c.Field).join(', '));

        // Check if department_id is primary key
        const [pkInfo] = await conn.execute(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'departments' 
            AND COLUMN_KEY = 'PRI'
        `);
        
        console.log('Current primary key:', pkInfo.length > 0 ? pkInfo[0].COLUMN_NAME : 'NONE');

        // If department_id is already set as primary key, we're done
        if (pkInfo.length > 0 && pkInfo[0].COLUMN_NAME === 'department_id') {
            console.log('✅ departments table is already correctly migrated!');
            console.log('   - department_id is the primary key');
            console.log('   - id column has been removed');
        } else {
            // If department_id exists but is not primary key, fix it
            console.log('📌 Setting department_id as primary key...');
            
            // Check if department_id is unique
            const [uniqueCheck] = await conn.execute(`
                SELECT COUNT(*) as total, COUNT(DISTINCT department_id) as unique_count 
                FROM departments
            `);
            
            if (uniqueCheck[0].total !== uniqueCheck[0].unique_count) {
                console.error('❌ Duplicate department_id values found!');
                console.log('   Total records:', uniqueCheck[0].total);
                console.log('   Unique department_id values:', uniqueCheck[0].unique_count);
                process.exit(1);
            }

            // Make department_id NOT NULL if it isn't already
            await conn.execute('ALTER TABLE departments MODIFY department_id VARCHAR(20) NOT NULL');
            
            // Drop any existing primary key
            try {
                await conn.execute('ALTER TABLE departments DROP PRIMARY KEY');
            } catch (e) {
                console.log('   ℹ️ No primary key to drop, or already dropped');
            }
            
            // Set department_id as primary key
            await conn.execute('ALTER TABLE departments ADD PRIMARY KEY (department_id)');
            console.log('   ✅ department_id set as primary key');
        }

        // Verify and update foreign key constraints
        console.log('📌 Verifying foreign key constraints...');
        
        // Check if employees table has foreign key constraint
        const [fkCheck] = await conn.execute(`
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'employees'
            AND REFERENCED_TABLE_NAME = 'departments'
        `);

        if (fkCheck.length === 0) {
            console.log('   ℹ️ No foreign key found on employees.department');
            console.log('   📌 Adding foreign key constraint...');
            
            try {
                // First check if department column exists in employees
                const [empCols] = await conn.execute('SHOW COLUMNS FROM employees');
                const hasDepartmentCol = empCols.some(c => c.Field === 'department');
                
                if (hasDepartmentCol) {
                    // Check if there are any values that don't match existing departments
                    const [orphanCheck] = await conn.execute(`
                        SELECT COUNT(*) as count 
                        FROM employees e
                        LEFT JOIN departments d ON e.department = d.department_id
                        WHERE e.department IS NOT NULL AND d.department_id IS NULL
                    `);
                    
                    if (orphanCheck[0].count > 0) {
                        console.warn(`   ⚠️ Found ${orphanCheck[0].count} employees with department values that don't exist in departments table.`);
                        console.log('   📌 Setting orphaned department values to NULL...');
                        await conn.execute(`
                            UPDATE employees 
                            SET department = NULL 
                            WHERE department NOT IN (SELECT department_id FROM departments)
                            AND department IS NOT NULL
                        `);
                        console.log('   ✅ Orphaned department values set to NULL');
                    }
                    
                    await conn.execute(`
                        ALTER TABLE employees 
                        ADD CONSTRAINT fk_employees_department 
                        FOREIGN KEY (department) REFERENCES departments(department_id) 
                        ON DELETE SET NULL
                    `);
                    console.log('   ✅ Foreign key added to employees.department');
                }
            } catch (e) {
                console.log('   ⚠️ Could not add foreign key for employees:', e.message);
            }
        } else {
            console.log('   ✅ Foreign key already exists:', fkCheck[0].CONSTRAINT_NAME);
        }

        // Display final structure
        console.log('\n📊 Final departments table structure:');
        const [finalCols] = await conn.execute('SHOW COLUMNS FROM departments');
        console.log('   Columns:', finalCols.map(c => `${c.Field} (${c.Type})`).join(', '));
        
        const [finalPk] = await conn.execute(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'departments' 
            AND COLUMN_KEY = 'PRI'
        `);
        console.log('   Primary Key:', finalPk.length > 0 ? finalPk[0].COLUMN_NAME : 'NONE');
        
        const [rowCount] = await conn.execute('SELECT COUNT(*) as count FROM departments');
        console.log('   Total Records:', rowCount[0].count);

        console.log('\n✅ Migration finalized successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.sql) console.error('SQL:', error.sql);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


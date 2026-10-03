// backend/migrate_departments_to_code_pk.js
// Run this script: node migrate_departments_to_code_pk.js
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
        console.log('🔄 Starting departments table migration...');

        // Check current structure
        const [columns] = await conn.execute('SHOW COLUMNS FROM departments');
        console.log('Current columns:', columns.map(c => c.Field).join(', '));

        // --- 1. Remove AUTO_INCREMENT from 'id' column ---
        console.log('📌 Removing AUTO_INCREMENT from id column...');
        await conn.execute('ALTER TABLE departments MODIFY id INT NOT NULL');
        console.log('   ✅ AUTO_INCREMENT removed.');

        // --- 2. Drop existing foreign keys referencing departments.id ---
        console.log('📌 Dropping foreign key constraints...');
        const [fkResults] = await conn.execute(`
            SELECT CONSTRAINT_NAME, TABLE_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'departments'
            AND REFERENCED_COLUMN_NAME = 'id'
        `);

        for (const fk of fkResults) {
            console.log(`   Dropping foreign key: ${fk.CONSTRAINT_NAME} on ${fk.TABLE_NAME}`);
            await conn.execute(`ALTER TABLE ${fk.TABLE_NAME} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }

        // --- 3. Make department_code unique and NOT NULL ---
        console.log('📌 Ensuring department_code is unique...');
        await conn.execute('ALTER TABLE departments MODIFY department_code VARCHAR(20) NOT NULL');

        // Check for duplicate department_codes
        const [duplicates] = await conn.execute(`
            SELECT department_code, COUNT(*) as count 
            FROM departments 
            GROUP BY department_code 
            HAVING COUNT(*) > 1
        `);
        if (duplicates.length > 0) {
            console.warn('⚠️ Duplicate department codes found. Please resolve them first.');
            console.log('Duplicates:', duplicates);
            process.exit(1);
        }

        // --- 4. Drop the old PRIMARY KEY (on 'id') ---
        console.log('📌 Dropping old primary key on id...');
        await conn.execute('ALTER TABLE departments DROP PRIMARY KEY');
        console.log('   ✅ Old primary key dropped.');

        // --- 5. Set PRIMARY KEY on department_code ---
        console.log('📌 Adding primary key on department_code...');
        await conn.execute('ALTER TABLE departments ADD PRIMARY KEY (department_code)');

        // --- 6. Rename department_code to department_id ---
        console.log('📌 Renaming department_code to department_id...');
        await conn.execute('ALTER TABLE departments CHANGE department_code department_id VARCHAR(20) NOT NULL');

        // --- 7. Drop the old 'id' column ---
        console.log('📌 Dropping old id column...');
        await conn.execute('ALTER TABLE departments DROP COLUMN id');

        // --- 8. Re-add foreign key constraints (e.g., on employees table) ---
        console.log('📌 Re-adding foreign key constraints...');
        try {
            // Check if employees table has a 'department' column
            const [empColumns] = await conn.execute('SHOW COLUMNS FROM employees LIKE "department"');
            if (empColumns.length > 0) {
                // Drop existing foreign key if it exists
                const [existingFk] = await conn.execute(`
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'employees' 
                    AND COLUMN_NAME = 'department'
                    AND REFERENCED_TABLE_NAME = 'departments'
                `);
                if (existingFk.length > 0) {
                    await conn.execute(`ALTER TABLE employees DROP FOREIGN KEY ${existingFk[0].CONSTRAINT_NAME}`);
                }

                // Add new foreign key
                await conn.execute(`
                    ALTER TABLE employees 
                    ADD CONSTRAINT fk_employees_department 
                    FOREIGN KEY (department) REFERENCES departments(department_id) 
                    ON DELETE SET NULL
                `);
                console.log('   ✅ Foreign key added to employees.department');
            }
        } catch (e) {
            console.log('   ℹ️ Could not add foreign key for employees:', e.message);
        }

        console.log('✅ Migration complete!');
        console.log('📊 New structure: departments (department_id as PK)');

        // Show new structure
        const [newColumns] = await conn.execute('SHOW COLUMNS FROM departments');
        console.log('New columns:', newColumns.map(c => c.Field).join(', '));

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.sql) console.error('SQL:', error.sql);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


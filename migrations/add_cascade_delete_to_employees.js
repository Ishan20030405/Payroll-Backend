// backend/add_cascade_delete_to_employees.js
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
        console.log('🔄 Setting up cascade delete for employees...');

        // Check if foreign key exists on user_id
        const [fkCheck] = await conn.execute(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'employees' 
            AND COLUMN_NAME = 'user_id'
            AND REFERENCED_TABLE_NAME = 'users'
        `);

        if (fkCheck.length > 0) {
            const fkName = fkCheck[0].CONSTRAINT_NAME;
            
            // Drop existing foreign key
            console.log(`📌 Dropping foreign key: ${fkName}`);
            await conn.execute(`ALTER TABLE employees DROP FOREIGN KEY ${fkName}`);
            
            // Re-add with ON DELETE CASCADE
            console.log('📌 Adding foreign key with ON DELETE CASCADE...');
            await conn.execute(`
                ALTER TABLE employees 
                ADD CONSTRAINT ${fkName} 
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            `);
            console.log('✅ Foreign key updated with ON DELETE CASCADE');
        } else {
            console.log('ℹ️ No foreign key found for user_id. Creating one...');
            await conn.execute(`
                ALTER TABLE employees 
                ADD CONSTRAINT fk_employee_user 
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            `);
            console.log('✅ Foreign key added with ON DELETE CASCADE');
        }

        console.log('✅ Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
})();


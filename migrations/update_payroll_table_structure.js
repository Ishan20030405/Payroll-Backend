require('dotenv').config();
const db = require('../src/config/db');

async function updatePayrollTable() {
    try {
        const [columns] = await db.execute('SHOW COLUMNS FROM payrolls');
        const columnNames = new Set(columns.map(column => column.Field));

        if (columnNames.has('id')) {
            const [referencingKeys] = await db.execute(`
                SELECT TABLE_NAME, CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
                  AND REFERENCED_TABLE_NAME = 'payrolls'
                  AND REFERENCED_COLUMN_NAME = 'id'
            `);
            for (const key of referencingKeys) {
                await db.execute(`ALTER TABLE \`${key.TABLE_NAME}\` DROP FOREIGN KEY \`${key.CONSTRAINT_NAME}\``);
            }
            await db.execute(`
                DELETE first_row FROM payrolls first_row
                INNER JOIN payrolls duplicate_row
                    ON first_row.employee_id = duplicate_row.employee_id
                    AND first_row.month_year = duplicate_row.month_year
                    AND first_row.id > duplicate_row.id
            `);
            await db.execute('ALTER TABLE payrolls MODIFY COLUMN id INT NOT NULL');
            await db.execute('ALTER TABLE payrolls DROP PRIMARY KEY');
            await db.execute('ALTER TABLE payrolls DROP COLUMN id');
        }

        for (const column of ['working_days', 'days_present', 'overtime_hours', 'tax', 'gross_salary', 'net_salary']) {
            if (columnNames.has(column)) {
                await db.execute(`ALTER TABLE payrolls DROP COLUMN ${column}`);
            }
        }

        const [primaryKey] = await db.execute(`
            SELECT COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'payrolls'
              AND CONSTRAINT_NAME = 'PRIMARY'
            ORDER BY ORDINAL_POSITION
        `);
        const keyColumns = primaryKey.map(column => column.COLUMN_NAME);
        if (keyColumns.join(',') !== 'employee_id,month_year') {
            if (keyColumns.length > 0) {
                await db.execute('ALTER TABLE payrolls DROP PRIMARY KEY');
            }
            await db.execute('ALTER TABLE payrolls ADD PRIMARY KEY (employee_id, month_year)');
        }

        console.log('Payroll table updated successfully.');
    } catch (error) {
        console.error('Payroll table update failed:', error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

updatePayrollTable();


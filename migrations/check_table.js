const db = require('./src/config/db');

async function check() {
    try {
        const [columns] = await db.execute('SHOW COLUMNS FROM employees');
        console.log(columns);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();


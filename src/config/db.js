// backend/src/config/db.js
const mysql = require('mysql2/promise');

const databaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
};
const databaseName = process.env.DB_NAME || 'payroll_db';

async function ensureDatabase() {
    if (!/^[A-Za-z0-9_$]+$/.test(databaseName)) {
        throw new Error('DB_NAME contains unsupported characters');
    }

    const connection = await mysql.createConnection(databaseConfig);
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    } catch (err) {
        // Shared cloud hosts (like AlwaysData) block CREATE DATABASE privileges.
        // Ignore ER_DBACCESS_DENIED_ERROR if the database already exists.
        if (err.code !== 'ER_DBACCESS_DENIED_ERROR') {
            throw err;
        }
    } finally {
        await connection.end();
    }
}

// Create connection pool
const pool = mysql.createPool({
    ...databaseConfig,
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.ensureDatabase = ensureDatabase;
module.exports = pool;
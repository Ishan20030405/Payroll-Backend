const db = require('../config/db');

class ActivityLog {
    static async create({ userId = null, action, details = '', ipAddress = null }) {
        try {
            await db.execute(`
                INSERT INTO activity_logs (user_id, action, details, ip_address)
                VALUES (?, ?, ?, ?)
            `, [userId, action, details, ipAddress]);
        } catch (error) {
            console.error('Failed to save activity log:', error.message);
        }
    }

    static async getRecent(limit = 100) {
        const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
        const [rows] = await db.query(`
            SELECT a.*, u.username
            FROM activity_logs a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT ${safeLimit}
        `);
        return rows;
    }
}

module.exports = ActivityLog;

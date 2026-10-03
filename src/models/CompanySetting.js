// backend/src/models/CompanySetting.js
const db = require('../config/db');

class CompanySetting {
    static async get() {
        const query = 'SELECT * FROM company_settings LIMIT 1';
        const [rows] = await db.execute(query);
        return rows[0] || null;
    }

    static async upsert(data) {
        const {
            company_name,
            email,
            registration_number,
            tax_number,
            phone,
            website,
            address,
            currency,
            time_zone
        } = data;

        const existing = await this.get();

        if (existing) {
            const query = 'UPDATE company_settings SET company_name = ?, email = ?, registration_number = ?, tax_number = ?, phone = ?, website = ?, address = ?, currency = ?, time_zone = ?, updated_at = NOW() WHERE id = ?';
            const [result] = await db.execute(query, [company_name, email, registration_number, tax_number, phone, website, address, currency, time_zone, existing.id]);
            return result.affectedRows > 0;
        } else {
            const query = 'INSERT INTO company_settings (company_name, email, registration_number, tax_number, phone, website, address, currency, time_zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const [result] = await db.execute(query, [company_name, email, registration_number, tax_number, phone, website, address, currency, time_zone]);
            return result.insertId > 0;
        }
    }
}

module.exports = CompanySetting;

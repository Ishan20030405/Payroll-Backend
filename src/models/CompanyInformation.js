const db = require('../config/db');

class CompanyInformation {
    static getDefaults() {
        return {
            company_name: 'Northfield (Pvt) Ltd',
            email: 'admin@northfield.co',
            registration_number: 'REG-9938472',
            tax_number: 'TAX-449-1120',
            phone_number: '+1 415 555 0100',
            website: 'www.northfield.co',
            company_address: '100 Tech Park Blvd, Suite 400, San Francisco, CA',
            base_currency: 'USD ($)',
            time_zone: 'UTC -08:00 (Pacific Time)'
        };
    }

    static async get() {
        const [rows] = await db.execute(`
            SELECT id, company_name, email, registration_number, tax_number,
                phone_number, website, company_address, base_currency, time_zone,
                created_at, updated_at
            FROM company_information LIMIT 1
        `);
        return rows[0] || null;
    }

    static async getLogo() {
        const [rows] = await db.execute('SELECT logo_data, logo_mime_type FROM company_information WHERE id = 1');
        return rows[0] || null;
    }

    static async upsert(data) {
        const fields = [
            'company_name', 'email', 'registration_number', 'tax_number',
            'phone_number', 'website', 'company_address', 'base_currency', 'time_zone'
        ];
        const values = fields.map(field => data[field] || null);
        const query = `
            INSERT INTO company_information (id, ${fields.join(', ')})
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name), email = VALUES(email),
                registration_number = VALUES(registration_number), tax_number = VALUES(tax_number),
                phone_number = VALUES(phone_number), website = VALUES(website),
                company_address = VALUES(company_address), base_currency = VALUES(base_currency),
                time_zone = VALUES(time_zone)
        `;
        await db.execute(query, values);
        return this.get();
    }

    static async updateLogo(buffer, mimeType) {
        await db.execute(`
            INSERT INTO company_information (id, company_name, logo_data, logo_mime_type)
            VALUES (1, 'Northfield (Pvt) Ltd', ?, ?)
            ON DUPLICATE KEY UPDATE logo_data = VALUES(logo_data), logo_mime_type = VALUES(logo_mime_type)
        `, [buffer, mimeType]);
        return this.get();
    }

    static async reset() {
        const defaults = this.getDefaults();
        await db.execute(`
            INSERT INTO company_information
                (id, company_name, email, registration_number, tax_number, phone_number,
                 website, company_address, base_currency, time_zone, logo_data, logo_mime_type)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name), email = VALUES(email),
                registration_number = VALUES(registration_number), tax_number = VALUES(tax_number),
                phone_number = VALUES(phone_number), website = VALUES(website),
                company_address = VALUES(company_address), base_currency = VALUES(base_currency),
                time_zone = VALUES(time_zone), logo_data = NULL, logo_mime_type = NULL
        `, Object.values(defaults));
        return this.get();
    }
}

module.exports = CompanyInformation;
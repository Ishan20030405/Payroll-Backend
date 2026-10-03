const CompanyInformation = require('../models/CompanyInformation');
const multer = require('multer');

const uploadLogo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        callback(null, file.mimetype.startsWith('image/'));
    }
}).single('logo');

exports.getCompanyInformation = async (req, res) => {
    try {
        res.status(200).json(await CompanyInformation.get());
    } catch (error) {
        res.status(500).json({ message: 'Error fetching company information', error: error.message });
    }
};

exports.updateCompanyInformation = async (req, res) => {
    try {
        const data = {
            company_name: req.body.company_name,
            email: req.body.email,
            registration_number: req.body.registration_number,
            tax_number: req.body.tax_number,
            phone_number: req.body.phone_number,
            website: req.body.website,
            company_address: req.body.company_address,
            base_currency: req.body.base_currency,
            time_zone: req.body.time_zone
        };
        const company = await CompanyInformation.upsert(data);
        res.status(200).json({ message: 'Company information saved successfully', data: company });
    } catch (error) {
        res.status(500).json({ message: 'Error saving company information', error: error.message });
    }
};

exports.uploadCompanyLogo = (req, res) => {
    uploadLogo(req, res, async (error) => {
        if (error) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Logo image must be 30 MB or smaller'
                : error.message;
            return res.status(400).json({ message });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'A valid image logo is required' });
        }
        try {
            const company = await CompanyInformation.updateLogo(req.file.buffer, req.file.mimetype);
            res.status(200).json({ message: 'Company logo saved successfully', data: company });
        } catch (saveError) {
            res.status(500).json({ message: 'Error saving company logo', error: saveError.message });
        }
    });
};

exports.getCompanyLogo = async (req, res) => {
    try {
        const logo = await CompanyInformation.getLogo();
        if (!logo?.logo_data) {
            return res.status(404).json({ message: 'Company logo not found' });
        }
        res.type(logo.logo_mime_type || 'application/octet-stream').send(logo.logo_data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching company logo', error: error.message });
    }
};

exports.resetCompanyInformation = async (req, res) => {
    try {
        const company = await CompanyInformation.reset();
        res.status(200).json({ message: 'Company information reset successfully', data: company });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting company information', error: error.message });
    }
};
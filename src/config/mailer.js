// backend/src/config/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'ishanpaboda08@gmail.com',
        pass: process.env.EMAIL_PASS || 'gsrphnyayhonbecb'
    }
});

const sendOTPEmail = async (toEmail, otpCode) => {
    const mailOptions = {
        from: `"Payroll System Security" <${process.env.EMAIL_USER || 'ishanpaboda08@gmail.com'}>`,
        to: toEmail,
        subject: '🔒 Login Verification Code (2FA OTP)',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px;">
                <h2 style="color: #4F46E5; text-align: center;">Payroll System Verification</h2>
                <p>Hello,</p>
                <p>Your one-time 2-step verification code to access your account is:</p>
                <div style="background: #F3F4F6; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #111827; margin: 20px 0;">
                    ${otpCode}
                </div>
                <p style="color: #6B7280; font-size: 13px;">This OTP is valid for 10 minutes. Please do not share this code with anyone.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #9CA3AF; font-size: 12px; text-align: center;">If you did not request this code, please ignore this email.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    transporter,
    sendOTPEmail
};

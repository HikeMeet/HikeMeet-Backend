"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mailer_1 = __importDefault(require("../../config/mailer"));
const firebaseAdmin_1 = __importDefault(require("../../config/firebaseAdmin"));
const verificationCodes_1 = require("../helpers/verificationCodes");
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
router.post('/send-verification-code', async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ error: 'Email is required' });
    const user = await User_1.User.findOne({ email });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const { code } = (0, verificationCodes_1.generateVerificationCode)(email);
    const mailOptions = {
        from: '"HikeMeet Team" <HikeMeet@gmail.com>',
        to: email,
        subject: 'Your Verification Code',
        html: `<p>Your verification code is:</p><h3>${code}</h3><p>This code will expire in 10 minutes.</p>`,
    };
    await mailer_1.default.sendMail(mailOptions);
    res.status(200).json({ message: 'Verification code sent successfully' });
});
router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code)
        return res.status(400).json({ error: 'Email and code are required' });
    const storedCode = (0, verificationCodes_1.getVerificationCode)(email);
    if (!storedCode || storedCode.code !== code || storedCode.expires < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    (0, verificationCodes_1.deleteVerificationCode)(email);
    res.status(200).json({ message: 'Verification successful' });
});
router.post('/update-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
        return res.status(400).send({ error: 'Email and new password are required.' });
    const user = await firebaseAdmin_1.default.auth().getUserByEmail(email);
    if (!user)
        return res.status(404).send({ error: 'User not found.' });
    await firebaseAdmin_1.default.auth().updateUser(user.uid, { password: newPassword });
    res.status(200).send({ message: 'Password updated successfully.' });
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map
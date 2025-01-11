"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVerificationCode = exports.getVerificationCode = exports.generateVerificationCode = void 0;
const verificationCodesMap = {};
const generateVerificationCode = (email) => {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 1 * 60 * 1000);
    verificationCodesMap[email] = { code, expires };
    console.log(code);
    console.log(expires);
    return { code, expires };
};
exports.generateVerificationCode = generateVerificationCode;
const getVerificationCode = (email) => {
    return verificationCodesMap[email] || null;
};
exports.getVerificationCode = getVerificationCode;
const deleteVerificationCode = (email) => {
    delete verificationCodesMap[email];
};
exports.deleteVerificationCode = deleteVerificationCode;
//# sourceMappingURL=verificationCodes.js.map
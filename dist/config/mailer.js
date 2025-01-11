"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    service: 'Gmail',
    auth: {
        user: 'royinagar2@gmail.com',
        pass: 'pryk uqde apyp kuwl',
    },
});
exports.default = transporter;
//# sourceMappingURL=mailer.js.map
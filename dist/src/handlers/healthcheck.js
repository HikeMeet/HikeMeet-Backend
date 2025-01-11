"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const healthCheck = async (_req, res) => {
    logger_1.default.info('Server is starting');
    res.send('Server is working');
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=healthcheck.js.map
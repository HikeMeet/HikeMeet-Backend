"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const healthcheck_1 = require("../handlers/healthcheck");
const router = express_1.default.Router();
router.get('/', healthcheck_1.healthCheck);
exports.default = router;
//# sourceMappingURL=index.js.map
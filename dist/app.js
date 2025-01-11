"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const error_1 = require("./helpers/error");
const httpLogger_1 = __importDefault(require("./middlewares/httpLogger"));
const userRouter_1 = __importDefault(require("./routes/userRouter"));
const index_1 = __importDefault(require("./routes/index"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
require("./config/firebaseAdmin");
const app = (0, express_1.default)();
const allowedOrigins = ['http://localhost:3000', 'http://10.100.102.172:3000', 'http://10.100.102.172:5000'];
const mongoURI = process.env.MONGO_URI_STAGE || 'mongodb://localhost:27017/Hikemeet';
mongoose_1.default
    .connect(mongoURI)
    .then(() => {
    console.info(`Connected to MongoDB`);
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            if (!origin || !allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error('not allowed by CORS' + origin));
            }
        },
    }));
    app.use(httpLogger_1.default);
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: false }));
    app.use((0, cookie_parser_1.default)());
    app.use('/api/', index_1.default);
    app.use('/api/user', userRouter_1.default);
    app.use('/api/auth', authRoutes_1.default);
    app.use((_req, _res, next) => {
        next((0, http_errors_1.default)(404));
    });
    const errorHandler = (err, _req, res) => {
        (0, error_1.handleError)(err, res);
    };
    app.use(errorHandler);
    const port = parseInt(process.env.PORT || '3000', 10);
    app.set('port', port);
    const server = http_1.default.createServer(app);
    function onError(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }
        switch (error.code) {
            case 'EACCES':
                process.exit(1);
                break;
            case 'EADDRINUSE':
                process.exit(1);
                break;
            default:
                throw error;
        }
    }
    function onListening() {
        const addr = server.address();
        const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr === null || addr === void 0 ? void 0 : addr.port}`;
        console.info(`Server is listening on ${bind}`);
    }
    app.listen(port, '0.0.0.0', () => {
        console.log('Server is running on http://0.0.0.0:3000');
    });
    server.on('error', onError);
    server.on('listening', onListening);
})
    .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
});
//# sourceMappingURL=app.js.map
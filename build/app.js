"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
require('dotenv').config();
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const error_1 = require("./middleware/error");
const user_route_1 = __importDefault(require("./routes/user.route"));
const course_route_1 = __importDefault(require("./routes/course.route"));
const order_route_1 = __importDefault(require("./routes/order.route"));
const notification_route_1 = __importDefault(require("./routes/notification.route"));
const analytics_route_1 = __importDefault(require("./routes/analytics.route"));
const layout_route_1 = __importDefault(require("./routes/layout.route"));
const express_rate_limit_1 = require("express-rate-limit");
//body parser
exports.app.use(express_1.default.json({ limit: "50mb" }));
//cookie parser
exports.app.use((0, cookie_parser_1.default)());
//cors => cors origin resorse sharing
const origin = process.env.ORIGIN;
console.log("🚀 ~ origin:", origin);
exports.app.use((0, cors_1.default)({
    origin: origin,
    credentials: true
}));
// api request limit
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
});
// routes
exports.app.use('/api/v1/', user_route_1.default);
exports.app.use('/api/v1/', course_route_1.default);
exports.app.use('/api/v1/', order_route_1.default);
exports.app.use('/api/v1/', notification_route_1.default);
exports.app.use('/api/v1/', analytics_route_1.default);
exports.app.use('/api/v1/', layout_route_1.default);
//TESTING API
exports.app.get("/test", (req, res, next) => {
    res.status(201).json({
        success: true,
        message: "API is working"
    });
});
// app.all("", (req: Request, res: Response, next: NextFunction) => {
//     const err = new Error(`Route ${req.originalUrl} not found `) as any; 
//     err.statusCode = 404;
//     next(err);
// });
//miiddleware calls
exports.app.use(limiter);
exports.app.use(error_1.ErrorMiddleware);
//zA0dKDDqgrBFEQEV
//uAxkYc5Kz3C0aUXy 
//shahzad@1234

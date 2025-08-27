"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.isAuthenticated = void 0;
const catchAsyncErrors_1 = require("./catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const redis_1 = require("../utils/redis");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
// authenticated user
exports.isAuthenticated = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const access_token = req.cookies.access_token;
    if (!access_token) {
        return next(new ErrorHandler_1.default("Please login to access this resource", 401));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(access_token, process.env.ACCESS_TOKEN);
        const redisKey = `user:${decoded.id}`;
        let userData = await redis_1.redis.get(redisKey);
        let user;
        if (userData) {
            user = JSON.parse(userData);
            // If courses field is missing, fetch from MongoDB
            if (!user.courses || user.courses.length === 0) {
                user = await user_model_1.default.findById(decoded.id).select("+courses");
                await redis_1.redis.set(redisKey, JSON.stringify(user)); // update Redis
            }
        }
        else {
            user = await user_model_1.default.findById(decoded.id).select("+courses");
            if (!user) {
                return next(new ErrorHandler_1.default("please login to access this resource", 404));
            }
            await redis_1.redis.set(redisKey, JSON.stringify(user)); // cache to Redis
        }
        req.user = user;
        next();
    }
    catch (error) {
        return next(new ErrorHandler_1.default("Access token is invalid or expired", 401));
    }
});
// validate user role
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role || '')) {
            return next(new ErrorHandler_1.default(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;

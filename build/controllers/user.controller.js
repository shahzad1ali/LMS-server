"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.getAllUsers = exports.updateProfilePicture = exports.updatePassword = exports.updateUserInfo = exports.socialAuth = exports.getUserInfo = exports.updateAccessToken = exports.authorizeRoles = exports.logoutUser = exports.loginUser = exports.activeUser = exports.createActivationToken = exports.registrationUser = void 0;
require('dotenv').config();
const user_model_1 = __importDefault(require("../models/user.model"));
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const jwt_1 = require("../utils/jwt");
const redis_1 = require("../utils/redis");
const user_service_1 = require("../services/user.service");
const cloudinary_1 = __importDefault(require("cloudinary"));
exports.registrationUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const isEmailExist = await user_model_1.default.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler_1.default("Email already exist", 400));
        }
        ;
        const user = {
            name,
            email,
            password,
        };
        const activationToken = (0, exports.createActivationToken)(user);
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode };
        const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/activation-mail.ejs"), data);
        try {
            await (0, sendMail_1.default)({
                email: user.email,
                subject: "Active your Account",
                template: "activation-mail.ejs",
                data,
            });
            res.status(201).json({
                success: true,
                message: `please check your email:- ${user.email} to activate your account!`,
                activationCode: activationToken.token,
            });
        }
        catch (error) {
            return next(new ErrorHandler_1.default(error.message, 400));
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
const createActivationToken = (user) => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const token = jsonwebtoken_1.default.sign({
        user, activationCode
    }, process.env.ACTIVATION_SECRET, {
        expiresIn: "1d"
    });
    return { token, activationCode };
};
exports.createActivationToken = createActivationToken;
exports.activeUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        //   console.log("🔥 req.body:", req.body);
        const { activation_token, activation_code } = req.body;
        const newUser = jsonwebtoken_1.default.verify(activation_token, process.env.ACTIVATION_SECRET);
        if (String(newUser.activationCode) !== String(activation_code)) {
            return next(new ErrorHandler_1.default("Invalid activation code", 400));
        }
        const { name, email, password } = newUser.user;
        const existUser = await user_model_1.default.findOne({ email });
        if (existUser) {
            return next(new ErrorHandler_1.default("Email already exists", 400));
        }
        const user = await user_model_1.default.create({ name, email, password });
        res.status(201).json({
            success: true,
            message: "Account activated successfully!",
        });
    }
    catch (error) {
        //   console.error("❌ Activation error:", error);
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.loginUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return next(new ErrorHandler_1.default("Please enter email and password", 400));
        }
        ;
        const user = await user_model_1.default.findOne({ email }).select("+password");
        if (!user) {
            return next(new ErrorHandler_1.default("Invalid email and password", 400));
        }
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return next(new ErrorHandler_1.default("Invalid email or password", 400));
        }
        ;
        (0, jwt_1.sendToken)(user, 200, res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//logout user 
exports.logoutUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        res.cookie("access_token", "", { maxAge: 1 });
        res.cookie("refresh_token", "", { maxAge: 1 });
        const userId = req.user?._id;
        // console.log("userId is" ,userId);
        if (!userId) {
            return next(new ErrorHandler_1.default("User not authenticated", 401));
        }
        const redisKey = `user:${userId}`;
        const deleted = await redis_1.redis.del(redisKey);
        // console.log("🚪 Redis DEL:", redisKey, "| Deleted:", deleted);
        res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
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
//update access token
exports.updateAccessToken = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const refresh_token = req.cookies.refresh_token
            || req.headers["x-refresh-token"]
            || req.body.refresh_token;
        const message = 'Could not refresh token';
        if (!refresh_token || typeof refresh_token !== "string") {
            return next(new ErrorHandler_1.default("Refresh token missing", 400));
        }
        const decoded = jsonwebtoken_1.default.verify(refresh_token, process.env.REFRESH_TOKEN);
        const session = await redis_1.redis.get(`user:${decoded.id}`);
        if (!session) {
            return next(new ErrorHandler_1.default("Please login for access this resource!", 400));
        }
        const user = JSON.parse(session);
        const accessToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.ACCESS_TOKEN, { expiresIn: "1d" });
        const newRefreshToken = jsonwebtoken_1.default.sign({ id: user._id }, process.env.REFRESH_TOKEN, { expiresIn: "3d" });
        req.user = user;
        res.cookie("access_token", accessToken, jwt_1.accessTokenOptions);
        res.cookie("refresh_token", newRefreshToken, jwt_1.refreshTokenOptions);
        await redis_1.redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7 days
        next();
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//get user info
exports.getUserInfo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const userId = req.user?._id;
    if (!userId) {
        return next(new ErrorHandler_1.default("User ID not found", 400));
    }
    const user = await (0, user_service_1.getUserById)(userId.toString());
    if (!user) {
        return next(new ErrorHandler_1.default("User not found", 404));
    }
    res.status(200).json({
        success: true,
        user,
    });
});
exports.socialAuth = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { email, name, avatar } = req.body;
        const user = await user_model_1.default.findOne({ email });
        if (!user) {
            const newUser = await user_model_1.default.create({ name, email, avatar });
            (0, jwt_1.sendToken)(newUser, 200, res);
        }
        else {
            (0, jwt_1.sendToken)(user, 200, res);
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.updateUserInfo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { name } = req.body;
        const userId = req.user?._id?.toString();
        if (!userId) {
            return next(new ErrorHandler_1.default("User ID not found", 400));
        }
        const user = await user_model_1.default.findById(userId);
        if (name && user) {
            user.name = name;
        }
        await user?.save();
        await redis_1.redis.set(userId, JSON.stringify(user));
        res.status(201).json({
            success: true,
            user,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.updatePassword = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        // ✅ Fix condition logic
        if (!oldPassword || !newPassword) {
            return next(new ErrorHandler_1.default("Please enter old and new password", 400));
        }
        // ✅ Ensure user is authenticated
        const user = await user_model_1.default.findById(req.user?._id).select("+password");
        if (!user || user.password === undefined) {
            return next(new ErrorHandler_1.default("Invalid user", 400));
        }
        // ✅ Compare old password
        const isPasswordMatch = await user.comparePassword(oldPassword);
        if (!isPasswordMatch) {
            return next(new ErrorHandler_1.default("Invalid old password", 400));
        }
        // ✅ Update password
        user.password = newPassword;
        await user.save();
        // ✅ Update Redis cache with new user data
        const userId = req.user?._id;
        if (userId) {
            await redis_1.redis.set(userId.toString(), JSON.stringify(user));
        }
        res.status(200).json({
            success: true,
            user,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
exports.updateProfilePicture = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { avatar } = req.body;
        const userId = req.user?._id;
        if (!userId) {
            return next(new ErrorHandler_1.default("User ID not found", 400));
        }
        const user = await user_model_1.default.findById(userId);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        if (avatar) {
            // If user already has an avatar, delete it
            if (user.avatar?.public_id) {
                await cloudinary_1.default.v2.uploader.destroy(user.avatar.public_id);
            }
            // Upload new avatar
            const myCloud = await cloudinary_1.default.v2.uploader.upload(avatar, {
                folder: "avatars",
                width: 150,
                crop: "scale", // optional
            });
            user.avatar = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            };
        }
        await user.save();
        // Update Redis cache
        await redis_1.redis.set(userId.toString(), JSON.stringify(user));
        res.status(200).json({
            success: true,
            user,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// get all users --- only admin
exports.getAllUsers = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, user_service_1.getAllUsersService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// update user role --- only for admin
exports.updateUserRole = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const { email, role } = req.body;
    if (!email)
        return next(new ErrorHandler_1.default("Email is required", 400));
    if (!role)
        return next(new ErrorHandler_1.default("Role is required", 400));
    const user = await user_model_1.default.findOneAndUpdate({ email }, { role }, { new: true });
    if (!user)
        return next(new ErrorHandler_1.default("User not found", 404));
    res.status(200).json({
        success: true,
        user,
    });
});
// delete user -- only admin
exports.deleteUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await user_model_1.default.findById(id);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        await user.deleteOne({ id });
        await redis_1.redis.del(id);
        res.status(201).json({
            success: true,
            message: "User Deleted Successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});

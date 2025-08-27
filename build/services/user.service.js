"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserRoleService = exports.getAllUsersService = exports.getUserById = void 0;
// user.service.ts
const user_model_1 = __importDefault(require("../models/user.model"));
const redis_1 = require("../utils/redis");
// Get user by ID and return the user
const getUserById = async (id) => {
    const userJson = await redis_1.redis.get(id);
    if (userJson) {
        return JSON.parse(userJson);
    }
    const user = await user_model_1.default.findById(id);
    if (user) {
        await redis_1.redis.set(id, JSON.stringify(user));
        return user;
    }
    return null;
};
exports.getUserById = getUserById;
// Get all users
const getAllUsersService = async (res) => {
    const users = await user_model_1.default.find().sort({ createdAt: -1 });
    res.status(201).json({
        success: true,
        users,
    });
};
exports.getAllUsersService = getAllUsersService;
// update user role
const updateUserRoleService = async (res, id, role) => {
    const user = await user_model_1.default.findByIdAndUpdate(id, { role }, { new: true });
    console.log(user);
    res.status(201).json({
        success: true,
        user,
    });
};
exports.updateUserRoleService = updateUserRoleService;

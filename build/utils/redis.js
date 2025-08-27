"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    throw new Error("❌ REDIS_URL not defined in environment variables");
}
exports.redis = new ioredis_1.default(redisUrl);
exports.redis.on("connect", () => {
    console.log("✅ Redis connected successfully");
});
exports.redis.on("error", (err) => {
    console.error("❌ Redis connection error:", err);
});

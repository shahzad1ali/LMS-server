import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = "rediss://default:ATNpAAIncDIwNzA2ZGIyMGY2MTE0MjVhYTMyNWM4ZDJjYTRkYTI4YXAyMTMxNjE@actual-kitten-13161.upstash.io:6379";
console.log("🚀 ~ redisUrl:", redisUrl)

if (!redisUrl) {
  throw new Error("❌ REDIS_URL not defined in environment variables");
}

export const redis = new Redis(redisUrl);

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

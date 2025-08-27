import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { redis } from "../utils/redis";
import Jwt, { JwtPayload } from "jsonwebtoken";
import userModel from "../models/user.model";

// authenticated user
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.cookies.access_token;

    if (!access_token) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    try {
      const decoded = Jwt.verify(
        access_token,
        process.env.ACCESS_TOKEN as string
      ) as JwtPayload;

      const redisKey = `user:${decoded.id}`;
      let userData = await redis.get(redisKey);

      let user;
      if (userData) {
        user = JSON.parse(userData);

        // If courses field is missing, fetch from MongoDB
        if (!user.courses || user.courses.length === 0) {
          user = await userModel.findById(decoded.id).select("+courses");
          await redis.set(redisKey, JSON.stringify(user)); // update Redis
        }
      } else {
        user = await userModel.findById(decoded.id).select("+courses");
        if (!user) {
          return next(new ErrorHandler("please login to access this resource", 404));
        }
        await redis.set(redisKey, JSON.stringify(user)); // cache to Redis
      }

      req.user = user;
      next();
    } catch (error: any) {
      return next(new ErrorHandler("Access token is invalid or expired", 401));
    }
  }
);

// validate user role
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || '')) {
      return next(
        new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403)
      );
    }
    next();
  };
};

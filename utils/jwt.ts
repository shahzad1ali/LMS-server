import { Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";

require("dotenv").config();

interface ITokenOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none" | undefined;
  secure?: boolean;
}

// parse environment variables to integers with fallback values
  const accessTokenExpire = parseInt(process.env.ACCESS_TOKEN_EXPIRE || "15", 10); // 15 minutes
  const refreshTokenExpire = parseInt(process.env.REFRESH_TOKEN_EXPIRE || "3", 10); // 3 days

  //options for cookies
  export const accessTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 1000), // minutes to milliseconds
    maxAge: accessTokenExpire * 60 * 1000, // minutes to milliseconds
    httpOnly: true,
    sameSite: "none",
    secure: true,
  };

    export const refreshTokenOptions: ITokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000), // days to milliseconds
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000, // days to milliseconds
    httpOnly: true,
    sameSite: "none",
    secure: true,
  };
  

export const sendToken = async (user: IUser, statusCode: number, res: Response) => {
  const accessToken = user.SignAccessToken();
  const refreshToken = user.SignRefreshToken();


  //upload session to redis
  const redisKey = `user:${user._id}`;
  await redis.set(redisKey, JSON.stringify(user));
  console.log("✅ Redis SET:", redisKey);

  

  // Cookie options are already set above with environment-based configuration

  res.cookie("access_token", accessToken, accessTokenOptions);
  res.cookie("refresh_token", refreshToken, refreshTokenOptions);
 // 🕒 Log expiration info
  console.log("🍪 Access Token will expire in:", accessTokenExpire, "minutes");
  console.log("🕒 Access Token Expires At:", accessTokenOptions.expires.toISOString());

  console.log("🍪 Refresh Token will expire in:", refreshTokenExpire, "days");
  console.log("🕒 Refresh Token Expires At:", refreshTokenOptions.expires.toISOString());
  res.status(statusCode).json({
    success: true,
    user,
    accessToken,
    refreshToken
  });
};

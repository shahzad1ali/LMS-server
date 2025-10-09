// user.service.ts
import userModel from "../models/user.model";
import { redis } from "../utils/redis";
import { Response } from "express";

// Get user by ID and return the user
export const getUserById = async (id: string) => {
  const userJson = await redis.get(id);

  if (userJson) {
    return JSON.parse(userJson);
  }

  const user = await userModel.findById(id);

  if (user) {
    await redis.set(id, JSON.stringify(user));
    return user;
  }

  return null;
};



// Get all users
export const getAllUsersService = async (res: Response) => {
  const users = await userModel.find().sort({createdAt: -1});

  res.status(201).json({
  success: true,
  users,
  })
}


// update user role
export const updateUserRoleService = async (res: Response,id: string, role: string) => {
  
  const user = await userModel.findByIdAndUpdate(id, {role}, { new: true });
   console.log(user);
   
  res.status(201).json({
    success: true,
    user,
  });
}
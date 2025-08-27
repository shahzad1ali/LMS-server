import { NextFunction,Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import OrderModel from "../models/orderModel";


// Create new order
export const newOrder = CatchAsyncError(
  async (data: any, res: Response, next: NextFunction) => {
    // console.log("Creating order with data:", data); // Add logging for debugging
    const order = await OrderModel.create(data);
    res.status(201).json({
      success: true,
      order,
    });
  }
);


// Get all users
export const getAllOrdersService = async (res: Response) => {
  const orders = await OrderModel.find().sort({createdAt: -1});

  res.status(201).json({
  success: true,
  orders,
  })
}
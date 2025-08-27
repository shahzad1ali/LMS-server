import { NextFunction,Response,Request } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel, { IOrder } from "../models/orderModel";
import userModel from "../models/user.model";
import CourseModel, { ICourse } from "../models/course.model";
import ejs from "ejs"
import path from "path";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";
import { getAllOrdersService, newOrder } from "../services/order.service";
import { redis } from "../utils/redis";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);



// create order
export const createOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, contentId, payment_Info, userId } = req.body as IOrder & { contentId?: string };

      // Validate payment_Info
      if (payment_Info && (!payment_Info.id || !payment_Info.status)) {
        return next(new ErrorHandler("Invalid payment information", 400));
      }

      // Verify payment with Stripe if provided
      if (payment_Info?.id) {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_Info.id);
        if (paymentIntent.status !== "succeeded") {
          return next(new ErrorHandler("Payment not authorized", 400));
        }
      }

      // Find user (either from token or body)
      const user = await userModel.findById(userId || req.user?._id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Find course
      const course:ICourse | null = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // If contentId is provided, verify it exists inside courseData
      if (contentId) {
        const contentExists = course.courseData?.some(
          (item: any) => item._id?.toString() === contentId
        );
        if (!contentExists) {
          return next(new ErrorHandler("Invalid content id", 400));
        }
      }

      // Prevent duplicate purchase
      const alreadyPurchased = user.courses.some(
        (c: any) => c._id.toString() === courseId
      );
      if (alreadyPurchased) {
        return next(new ErrorHandler("You have already purchased this course", 400));
      }

      // Prepare order data
      const orderData: any = {
        courseId: course._id,
        userId: user._id,
        payment_Info: payment_Info || undefined,
      };

      // Send confirmation email
      const mailData = {
        order: {
          _id: course._id.toString(),
          name: course.name,
          price: course.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      await sendMail({
        email: user.email,
        subject: "Order Confirmation",
        template: "order-confirmation.ejs",
        data: mailData,
      });

      // Add course to user's courses
      user.courses.push(course._id);
      await redis.set(String(user._id), JSON.stringify(user));
      await user.save();

      // Create notification
      await NotificationModel.create({
        user: user._id,
        title: "New Order",
        message: `You have a new order from ${course.name}`,
      });

      // Increment purchased count
      course.purchased = (course.purchased || 0) + 1;
      await course.save();

      // Save order in DB
      newOrder(orderData, res, next);

    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// // create order
// export const createOrder = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { courseId, payment_Info } = req.body as Iorder;

//       // Validate payment_Info
//       if (payment_Info && (!payment_Info.id || !payment_Info.status)) {
//         return next(new ErrorHandler("Invalid payment information", 400));
//       }

//       // Verify payment with Stripe if payment_Info is provided
//       if (payment_Info?.id) {
//         const paymentIntent = await stripe.paymentIntents.retrieve(payment_Info.id);
//         if (paymentIntent.status !== "succeeded") {
//           return next(new ErrorHandler("Payment not authorized", 400));
//         }
//       }

//       const user = await userModel.findById(req.user?._id);
//       if (!user) {
//         return next(new ErrorHandler("User not found", 404));
//       }

//       const course = await CourseModel.findById(courseId);
//       if (!course) {
//         return next(new ErrorHandler("Course not found", 404));
//       }

//       const courseExistInUser = user.courses.some(
//         (course: any) => course._id.toString() === courseId
//       );
//       if (courseExistInUser) {
//         return next(new ErrorHandler("You have already purchased this course", 400));
//       }

//       const data: any = {
//         courseId: course._id,
//         userId: user._id,
//         payment_Info: payment_Info || undefined, // Ensure payment_Info is undefined if not provided
//       };

//       // Send order confirmation email
//       const mailData = {
//         order: {
//           _id: course._id.toString(),
//           name: course.name,
//           price: course.price,
//           date: new Date().toLocaleDateString("en-US", {
//             year: "numeric",
//             month: "long",
//             day: "numeric",
//           }),
//         },
//       };

//       const html = await ejs.renderFile(
//         path.join(__dirname, "../mails/order-confirmation.ejs"),
//         { order: mailData }
//       );

//       try {
//         await sendMail({
//           email: user.email,
//           subject: "Order Confirmation",
//           template: "order-confirmation.ejs",
//           data: mailData,
//         });
//       } catch (error: any) {
//         return next(new ErrorHandler(error.message, 400));
//       }

//       // Add course to user's courses
//       user.courses.push(course._id);
//       await redis.set(String(req.user?._id), JSON.stringify(user));
//       await user.save();

//       // Create notification
//       await NotificationModel.create({
//         user: user._id,
//         title: "New Order",
//         message: `You have a new order from ${course.name}`,
//       });

//       // Increment course purchased count
//       course.purchased = (course.purchased || 0) + 1;
//       await course.save();

//       // Create order
//       newOrder(data, res, next);
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 400));
//     }
//   }
// );


// get all orders --- only admin
  export const getAllOrders = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
  try {
    getAllOrdersService(res);
  } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
  })


  //send stripe public key
  export const sendStripePublishableKey = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
    res.status(200).json({
        publishablekey: process.env.STRIPE_PUBLISHABLE_KEY
    })
  });

  //new payment
  // new payment
export const newPayment = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const myPayment = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: "usd", // lowercase recommended
      metadata: { // ✅ fixed from metaData
        company: "E-Learning",
      },
      automatic_payment_methods: { // ✅ fixed from autometic_payment_methods
        enabled: true,
      },
    });

    res.status(200).json({
      success: true,
      client_secret: myPayment.client_secret,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

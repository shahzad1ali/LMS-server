"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newPayment = exports.sendStripePublishableKey = exports.getAllOrders = exports.createOrder = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const user_model_1 = __importDefault(require("../models/user.model"));
const course_model_1 = __importDefault(require("../models/course.model"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const notificationModel_1 = __importDefault(require("../models/notificationModel"));
const order_service_1 = require("../services/order.service");
const redis_1 = require("../utils/redis");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// create order
exports.createOrder = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { courseId, contentId, payment_Info, userId } = req.body;
        // Validate payment_Info
        if (payment_Info && (!payment_Info.id || !payment_Info.status)) {
            return next(new ErrorHandler_1.default("Invalid payment information", 400));
        }
        // Verify payment with Stripe if provided
        if (payment_Info?.id) {
            const paymentIntent = await stripe.paymentIntents.retrieve(payment_Info.id);
            if (paymentIntent.status !== "succeeded") {
                return next(new ErrorHandler_1.default("Payment not authorized", 400));
            }
        }
        // Find user (either from token or body)
        const user = await user_model_1.default.findById(userId || req.user?._id);
        if (!user) {
            return next(new ErrorHandler_1.default("User not found", 404));
        }
        // Find course
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // If contentId is provided, verify it exists inside courseData
        if (contentId) {
            const contentExists = course.courseData?.some((item) => item._id?.toString() === contentId);
            if (!contentExists) {
                return next(new ErrorHandler_1.default("Invalid content id", 400));
            }
        }
        // Prevent duplicate purchase
        const alreadyPurchased = user.courses.some((c) => c._id.toString() === courseId);
        if (alreadyPurchased) {
            return next(new ErrorHandler_1.default("You have already purchased this course", 400));
        }
        // Prepare order data
        const orderData = {
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
        await (0, sendMail_1.default)({
            email: user.email,
            subject: "Order Confirmation",
            template: "order-confirmation.ejs",
            data: mailData,
        });
        // Add course to user's courses
        user.courses.push(course._id);
        await redis_1.redis.set(String(user._id), JSON.stringify(user));
        await user.save();
        // Create notification
        await notificationModel_1.default.create({
            user: user._id,
            title: "New Order",
            message: `You have a new order from ${course.name}`,
        });
        // Increment purchased count
        course.purchased = (course.purchased || 0) + 1;
        await course.save();
        // Save order in DB
        (0, order_service_1.newOrder)(orderData, res, next);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
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
exports.getAllOrders = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, order_service_1.getAllOrdersService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
//send stripe public key
exports.sendStripePublishableKey = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    res.status(200).json({
        publishablekey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});
//new payment
// new payment
exports.newPayment = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const myPayment = await stripe.paymentIntents.create({
            amount: req.body.amount,
            currency: "usd", // lowercase recommended
            metadata: {
                company: "E-Learning",
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        res.status(200).json({
            success: true,
            client_secret: myPayment.client_secret,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});

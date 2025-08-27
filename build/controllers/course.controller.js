"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVedioUrl = exports.deleteCourse = exports.getAdminAllCources = exports.addReplyToReview = exports.addReview = exports.addAnwser = exports.addQuestion = exports.getCourseByUser = exports.getAllCourses = exports.getSingleCourse = exports.editCourse = exports.uploadCourse = void 0;
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const cloudinary_1 = __importDefault(require("cloudinary"));
const course_service_1 = require("../services/course.service");
const course_model_1 = __importDefault(require("../models/course.model"));
const redis_1 = require("../utils/redis");
const mongoose_1 = __importDefault(require("mongoose"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const notificationModel_1 = __importDefault(require("../models/notificationModel"));
const axios = require("axios");
// upload course
exports.uploadCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if (thumbnail) {
            const myCloud = await cloudinary_1.default.v2.uploader.upload(thumbnail, {
                folder: "courses"
            });
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.url,
            };
        }
        (0, course_service_1.createCourse)(data, res, next);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// edit course
// export const editCourse = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const data = req.body as any;
//     const courseId = req.params.id;
//     const courseData = await CourseModel.findById(courseId) as any;
//     if (!courseData) {
//       return next(new ErrorHandler("Course not found", 404));
//     }
//     // Prepare thumbnail payload: default to existing
//     let thumbnailPayload = courseData.thumbnail;
//     if (typeof data.thumbnail === "string" && data.thumbnail.trim() !== "") {
//       const incoming = data.thumbnail as string;
//       if (!incoming.startsWith("https")) {
//         // New image string (probably base64 or a file URL) — replace
//         if (courseData.thumbnail?.public_id) {
//           await cloudinary.v2.uploader.destroy(courseData.thumbnail.public_id).catch(() => {
//             // optionally log but don't crash if destroy fails
//           });
//         }
//         const myCloud = await cloudinary.v2.uploader.upload(incoming, {
//           folder: "courses",
//         });
//         thumbnailPayload = {
//           public_id: myCloud.public_id,
//           url: myCloud.secure_url,
//         };
//       } else {
//         // Incoming is an https URL: assume they want to keep existing stored thumbnail
//         // (could add logic here to detect if it's different and upload if needed)
//         thumbnailPayload = courseData.thumbnail;
//       }
//     }
//     // Build update object without accidentally overwriting thumbnail with undefined
//     const updateData: any = { ...data };
//     if (thumbnailPayload) {
//       updateData.thumbnail = thumbnailPayload;
//     } else {
//       delete updateData.thumbnail;
//     }
//     const course = await CourseModel.findByIdAndUpdate(
//       courseId,
//       { $set: updateData },
//       { new: true }
//     );
//     res.status(200).json({
//       success: true,
//       course,
//     });
//   }
// );
exports.editCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    const data = req.body;
    const courseId = req.params.id;
    const courseData = await course_model_1.default.findById(courseId);
    if (!courseData) {
        return next(new ErrorHandler_1.default("Course not found", 404));
    }
    // Prepare thumbnail payload
    let thumbnailPayload = courseData.thumbnail || null;
    if (typeof data.thumbnail === "string" && data.thumbnail.trim() !== "") {
        let incoming = data.thumbnail.replace(/^http:/, "https:"); // Normalize to https
        if (!incoming.startsWith("https")) {
            // New image (e.g., base64)
            if (courseData.thumbnail?.public_id) {
                await cloudinary_1.default.v2.uploader.destroy(courseData.thumbnail.public_id).catch(() => { });
            }
            try {
                const myCloud = await cloudinary_1.default.v2.uploader.upload(incoming, {
                    folder: "courses",
                });
                thumbnailPayload = {
                    public_id: myCloud.public_id,
                    url: myCloud.secure_url, // Use secure_url for HTTPS
                };
            }
            catch (error) {
                return next(new ErrorHandler_1.default("Failed to upload thumbnail", 500));
            }
        }
        else {
            // Existing HTTPS URL
            if (courseData.thumbnail?.public_id) {
                try {
                    await cloudinary_1.default.v2.api.resource(courseData.thumbnail.public_id);
                    thumbnailPayload = courseData.thumbnail;
                }
                catch (error) {
                    return next(new ErrorHandler_1.default(`Invalid thumbnail URL: ${incoming}`, 400));
                }
            }
            else {
                return next(new ErrorHandler_1.default("Invalid thumbnail: No public_id found", 400));
            }
        }
    }
    else {
        thumbnailPayload; // No thumbnail provided
    }
    // Build update object
    const updateData = { ...data, thumbnail: thumbnailPayload };
    try {
        const course = await course_model_1.default.findByIdAndUpdate(courseId, { $set: updateData }, { new: true });
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default("Failed to update course", 500));
    }
});
// get single course without purchasing
exports.getSingleCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const courseId = req.params.id;
        const isCatchExist = await redis_1.redis.get(courseId);
        if (isCatchExist) {
            const course = JSON.parse(isCatchExist);
            res.status(200).json({
                success: true,
                course,
            });
        }
        else {
            const course = await course_model_1.default.findById(req.params.id).select("-courseData.videoUrl -courseData.suggetion -courseData.questions -courseData.links");
            await redis_1.redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
            res.status(200).json({
                success: true,
                course,
            });
        }
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// get all course without purchasing
exports.getAllCourses = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const courses = await course_model_1.default.find().select("-courseData.videoUrl -courseData.suggetion -courseData.questions -courseData.links");
        await redis_1.redis.set("allCourses", JSON.stringify(courses));
        res.status(200).json({
            success: true,
            courses,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// get course content -- only for valid user
exports.getCourseByUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        const courseExists = userCourseList?.find((course) => course._id.toString() === courseId);
        if (!courseExists) {
            return next(new ErrorHandler_1.default("You are not eligible to access this course", 404));
        }
        const course = await course_model_1.default.findById(courseId);
        const content = course?.courseData;
        res.status(200).json({
            success: true,
            content,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
//  export const addQuestion = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { question, courseId, contentId }: IAddQuestionData = req.body;
//       const course = await CourseModel.findById(courseId);
//       if (!mongoose.Types.ObjectId.isValid(contentId)) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       const couseContent = course?.courseData?.find((item: any) =>
//         item._id.equals(contentId)
//       );
//       console.log("thisis course content data ============ line no 207",couseContent)
//       if (!couseContent) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       // Create and push the new question
//       const newQuestion: any = {
//         user: req.user,
//         question,
//         questionReplies: [],
//       };
//       couseContent.questions?.push(newQuestion);
//        await NotificationModel.create({
//           user: req.user?._id,
//           title: "New Question Recieved",
//           message: `You have a new question in ${couseContent?.title}`
//               });
//       // Save the updated course
//       await course?.save();
//       res.status(200).json({
//         success: true,
//         message: "Question added successfully",
//         course,
//       });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//   }
// );
//add answer 
exports.addQuestion = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { question, courseId, contentId } = req.body;
        // Validate course existence
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // Validate contentId
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        // Ensure courseData exists
        if (!course.courseData || !Array.isArray(course.courseData)) {
            return next(new ErrorHandler_1.default("Course data is missing or invalid", 400));
        }
        // Find course content, safely handling potential undefined _id
        const courseContent = course.courseData.find((item) => {
            if (!item._id) {
                console.warn("Found courseData item without _id:", item);
                return false;
            }
            return item._id.equals(contentId);
        });
        if (!courseContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        // Create and push the new question
        const newQuestion = {
            user: req.user,
            question,
            questionReplies: [],
        };
        courseContent.questions = courseContent.questions || [];
        courseContent.questions.push(newQuestion);
        // Create notification
        await notificationModel_1.default.create({
            user: req.user?._id,
            title: "New Question Received",
            message: `You have a new question in ${courseContent?.title}`,
        });
        // Save the updated course
        await course.save();
        res.status(200).json({
            success: true,
            message: "Question added successfully",
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// export const addAnwser = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const  {answer, courseId, contentId, questionId}:IAddAnswerData = req.body;
//       const course = await CourseModel.findById(courseId);
//       if (!mongoose.Types.ObjectId.isValid(contentId)) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       const couseContent = course?.courseData?.find((item: any) =>
//         item._id.equals(contentId)
//       );
//       if (!couseContent) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       const question = couseContent?.questions?.find((item:any) => 
//       item._id.equals(questionId)
//     );
//     if (!question) {
//       return next(new ErrorHandler("Invalid question Id", 400));
//     }
//     // create a new answer object
//     const newAnswer: any = {
//      user: req.user,
//      answer,
//      createdAt: new Date().toISOString(),
//      updatedAt: new Date().toISOString(),
//     };
//     // add this answer to our course content
//     question?.questionReplies?.push(newAnswer);
//     await course?.save();
//     if (req.user?._id === question.user._id) {
//       //create a notification
//       await NotificationModel.create({
//           user: req.user?._id,
//           title: "New Question Recieved",
//           message: `You have a new question in ${couseContent?.title}`
//               });
//     } else {
//       const data = {
//         name: question.user.name,
//         title: couseContent.title,
//       };
//       const html = await ejs.renderFile(path.join(__dirname, "../mails/question-reply.ejs"),
//      data
//     );
//     try {
//       await sendMail({
//         email: question.user.email,
//         subject: "Questio Replies",
//         template: "question-reply.ejs",
//         data
//       });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//     }
//     res.status(200).json({
//       success: true,
//       course,
//     });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//   })
// add review in course
exports.addAnwser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { answer, courseId, contentId, questionId } = req.body;
        // Validate course existence
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        // Validate contentId
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        // Ensure courseData exists and is an array
        if (!course.courseData || !Array.isArray(course.courseData)) {
            return next(new ErrorHandler_1.default("Course data is missing or invalid", 400));
        }
        // Find course content, safely handling potential undefined _id
        const courseContent = course.courseData.find((item) => {
            if (!item._id) {
                console.warn("Found courseData item without _id:", item);
                return false;
            }
            return item._id.equals(contentId);
        });
        if (!courseContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        // Validate questionId
        if (!mongoose_1.default.Types.ObjectId.isValid(questionId)) {
            return next(new ErrorHandler_1.default("Invalid question id", 400));
        }
        // Find the question
        const question = courseContent.questions?.find((item) => {
            if (!item._id) {
                console.warn("Found question without _id:", item);
                return false;
            }
            return item._id.equals(questionId);
        });
        if (!question) {
            return next(new ErrorHandler_1.default("Invalid question id", 400));
        }
        // Create a new answer object
        const newAnswer = {
            user: req.user,
            answer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        // Initialize questionReplies if undefined
        question.questionReplies = question.questionReplies || [];
        question.questionReplies.push(newAnswer);
        // Save the updated course
        await course.save();
        // Create notification or send email
        if (req.user?._id === question.user._id) {
            await notificationModel_1.default.create({
                user: req.user?._id,
                title: "New Question Reply Received",
                message: `You have a new reply to your question in ${courseContent.title}`,
            });
        }
        else {
            const data = {
                name: question.user.name,
                title: courseContent.title,
            };
            const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/question-reply.ejs"), data);
            try {
                await (0, sendMail_1.default)({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data,
                });
            }
            catch (error) {
                return next(new ErrorHandler_1.default(error.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userCourseList = req.user?.courses;
        const courseId = req.params.id;
        // check if courseId already exist in user Course list base
        const courseExist = userCourseList?.some((course) => course._id.toString() === courseId.toString());
        if (!courseExist) {
            return next(new ErrorHandler_1.default("you are not eligible to access these course", 404));
        }
        const course = await course_model_1.default.findById(courseId);
        const { review, rating } = req.body;
        const reviewData = {
            user: req.user,
            rating,
            Comment: review,
        };
        course?.reviews.push(reviewData);
        let avg = 0;
        course?.reviews.forEach((rev) => {
            avg = rev.rating;
        });
        if (course) {
            course.ratings = avg / course.reviews.length;
        }
        await course?.save();
        await redis_1.redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
        //create notification
        await notificationModel_1.default.create({
            user: req.user?._id,
            title: "New Review Recieved",
            message: `${req.user?.name} has given a review in ${course?.name}`,
        });
        res.status(201).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addReplyToReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { comment, courseId, reviewId } = req.body;
        console.log("Received reviewId:", reviewId);
        const course = await course_model_1.default.findById(courseId);
        if (!course) {
            return next(new ErrorHandler_1.default("Course not found", 404));
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(reviewId)) {
            return next(new ErrorHandler_1.default("Invalid review id", 400));
        }
        const review = course?.reviews?.find((rev) => rev._id.toString() === reviewId);
        if (!review) {
            return next(new ErrorHandler_1.default("Review not found", 404));
        }
        if (!review.commentReplies) {
            review.commentReplies = [];
        }
        const replyData = {
            user: req.user,
            comment,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        review.commentReplies.push(replyData);
        await course.save();
        await redis_1.redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
        res.status(200).json({
            success: true,
            course,
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
// get all course --- only admin  
exports.getAdminAllCources = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, course_service_1.getAllCoursesService)(res);
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// delete course -- only admin
exports.deleteCourse = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const course = await course_model_1.default.findById(id);
        if (!course) {
            return next(new ErrorHandler_1.default("course not found", 404));
        }
        await course.deleteOne({ id });
        await redis_1.redis.del(id);
        res.status(201).json({
            success: true,
            message: "Course Deleted Successfully"
        });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 400));
    }
});
// genrate vedio Url
exports.generateVedioUrl = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { videoId } = req.body;
        // console.log("📦 videoId received in backend:", videoId);
        if (!videoId || typeof videoId !== "string") {
            return next(new ErrorHandler_1.default("Video ID is missing or invalid", 400));
        }
        const response = await axios.post(`https://dev.vdocipher.com/api/videos/${videoId}/otp`, { ttl: 300 }, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
            },
        });
        res.json(response.data);
    }
    catch (error) {
        console.error("❌ VdoCipher API Error:", error.response?.data || error.message);
        return next(new ErrorHandler_1.default(error.response?.data?.message || error.message, 400));
    }
});
// export const addQuestion = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { question, courseId, contentId }: IAddQuestionData = req.body;
//       const course = await CourseModel.findById(courseId);
//       if (!mongoose.Types.ObjectId.isValid(contentId)) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       const couseContent = course?.courseData?.find((item: any) =>
//         item._id.equals(contentId)
//       );
//       if (!couseContent) {
//         return next(new ErrorHandler("Invalid content id", 400));
//       }
//       // Create and push the new question
//       const newQuestion: any = {
//         user: req.user,
//         question,
//         questionReplies: [],
//       };
//       couseContent.questions?.push(newQuestion);
//        await NotificationModel.create({
//           user: req.user?._id,
//           title: "New Question Recieved",
//           message: `You have a new question in ${couseContent?.title}`
//               });
//       // Save the updated course
//       await course?.save();
//       res.status(200).json({
//         success: true,
//         message: "Question added successfully",
//         course,
//       });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//   }
// );
// //last
// export const addReplyToReview = CatchAsyncError(
// async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const {comment, courseId, reviewId} = req.body as IAddReviewData;
//     const course = await CourseModel.findById(courseId);
//     if (!course) {
//      return next(new ErrorHandler("Course not found", 404));
//     }
//     const review = course?.reviews?.find((rev:any) => rev._id.toString() === reviewId);
//     if (!review) {
//        return next(new ErrorHandler("Review not found", 404));
//     }
//     const replyData: any = {
//       user: req.user,
//       comment,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//     };
//     review.commentReplies?.push(replyData);
//     await course?.save();
//     res.status(200).json({
//       success: true,
//       course
//     })
//     if (!review.commentReplies) {
//    review.commentReplies = [];   
//     }
//   } catch (error: any) {
//     return next(new ErrorHandler(error.message, 500));
//   }
// })
// //last
//get all courses without purchasing
// export const getAllCourses = CatchAsyncError(async(req:Request,res:Response,next:NextFunction) => {
// try {
//       const isCatchExist = await redis.get("allCourses");
//       if (isCatchExist) {
//       const courses = JSON.parse(isCatchExist);
//     res.status(200).json({
//         success: true,
//         courses,
//     });
//       } else {
//  const courses =  await CourseModel.find().select(
//         "-courseData.videoUrl -courseData.suggetion -courseData.questions -courseData.links"
//     );
//     await redis.set("allCourses", JSON.stringify(courses));
//     res.status(200).json({
//         success: true,
//         courses,
//     });
//       }
// } catch (error: any) {
//         return next(new ErrorHandler(error.message, 500));
//     }
// })

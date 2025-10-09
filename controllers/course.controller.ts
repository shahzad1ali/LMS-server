import { NextFunction,Response,Request } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs  from "ejs" 
import path from "path";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notificationModel";
const axios = require("axios");

// upload course
export const uploadCourse = CatchAsyncError(async(req:Request,res:Response,next:NextFunction) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if (thumbnail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbnail,{
                folder:"courses"
            });

            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.url,
            }
        }
        createCourse(data,res,next);
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})


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

export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body as any;
    const courseId = req.params.id;

    const courseData = await CourseModel.findById(courseId);
    if (!courseData) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Prepare thumbnail payload
    let thumbnailPayload = courseData.thumbnail || null;

    if (typeof data.thumbnail === "string" && data.thumbnail.trim() !== "") {
      let incoming = data.thumbnail.replace(/^http:/, "https:"); // Normalize to https

      if (!incoming.startsWith("https")) {
        // New image (e.g., base64)
        if (courseData.thumbnail?.public_id) {
          await cloudinary.v2.uploader.destroy(courseData.thumbnail.public_id).catch(() => {});
        }
        try {
          const myCloud = await cloudinary.v2.uploader.upload(incoming, {
            folder: "courses",
          });
          thumbnailPayload = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url, // Use secure_url for HTTPS
          };
        } catch (error) {
          return next(new ErrorHandler("Failed to upload thumbnail", 500));
        }
      } else {
        // Existing HTTPS URL
        if (courseData.thumbnail?.public_id) {
          try {
            await cloudinary.v2.api.resource(courseData.thumbnail.public_id);
            thumbnailPayload = courseData.thumbnail;
          } catch (error) {
            return next(new ErrorHandler(`Invalid thumbnail URL: ${incoming}`, 400));
          }
        } else {
          return next(new ErrorHandler("Invalid thumbnail: No public_id found", 400));
        }
      }
    } else {
      thumbnailPayload // No thumbnail provided
    }

    // Build update object
    const updateData: any = { ...data, thumbnail: thumbnailPayload };

    try {
      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: updateData },
        { new: true }
      );
      res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      return next(new ErrorHandler("Failed to update course", 500));
    }
  }
);



// get single course without purchasing
export const getSingleCourse = CatchAsyncError(async(req:Request,res:Response,next:NextFunction) => {
try {

    const courseId = req.params.id;

    const isCatchExist = await redis.get(courseId);

    if (isCatchExist) {
        const course = JSON.parse(isCatchExist);
        res.status(200).json({
        success: true,
        course,
    });
    } else {
     const course =  await CourseModel.findById(req.params.id).select(
        "-courseData.videoUrl -courseData.suggetion -courseData.questions -courseData.links"
    );

    await redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days
    
    res.status(200).json({
        success: true,
        course,
    });
    }
   
} catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})


// get all course without purchasing
export const getAllCourses = CatchAsyncError(async(req:Request,res:Response,next:NextFunction) => {
try {
     
 const courses =  await CourseModel.find().select(
        "-courseData.videoUrl -courseData.suggetion -courseData.questions -courseData.links"
    );
    await redis.set("allCourses", JSON.stringify(courses));
    res.status(200).json({
        success: true,
        courses,
    });
      }
  catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
})





// get course content -- only for valid user
export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExists = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );

      if (!courseExists) {
        return next(
          new ErrorHandler("You are not eligible to access this course", 404)
        );
      }

      const course = await CourseModel.findById(courseId);

      const content = course?.courseData;

      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add question in course
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

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


export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;

      // Validate course existence
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Validate contentId
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      // Ensure courseData exists
      if (!course.courseData || !Array.isArray(course.courseData)) {
        return next(new ErrorHandler("Course data is missing or invalid", 400));
      }

      // Find course content, safely handling potential undefined _id
      const courseContent = course.courseData.find((item: any) => {
        if (!item._id) {
          console.warn("Found courseData item without _id:", item);
          return false;
        }
        return item._id.equals(contentId);
      });

      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      // Create and push the new question
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      courseContent.questions = courseContent.questions || [];
      courseContent.questions.push(newQuestion);

      // Create notification
      await NotificationModel.create({
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
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


// add answer
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

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
  
  export const addAnwser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId }: IAddAnswerData = req.body;

      // Validate course existence
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Validate contentId
      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      // Ensure courseData exists and is an array
      if (!course.courseData || !Array.isArray(course.courseData)) {
        return next(new ErrorHandler("Course data is missing or invalid", 400));
      }

      // Find course content, safely handling potential undefined _id
      const courseContent = course.courseData.find((item: any) => {
        if (!item._id) {
          console.warn("Found courseData item without _id:", item);
          return false;
        }
        return item._id.equals(contentId);
      });

      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      // Validate questionId
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return next(new ErrorHandler("Invalid question id", 400));
      }

      // Find the question
      const question = courseContent.questions?.find((item: any) => {
        if (!item._id) {
          console.warn("Found question without _id:", item);
          return false;
        }
        return item._id.equals(questionId);
      });

      if (!question) {
        return next(new ErrorHandler("Invalid question id", 400));
      }

      // Create a new answer object
      const newAnswer: any = {
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
        await NotificationModel.create({
          user: req.user?._id,
          title: "New Question Reply Received",
          message: `You have a new reply to your question in ${courseContent.title}`,
        });
      } else {
        const data = {
          name: question.user.name,
          title: courseContent.title,
        };

        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          await sendMail({
            email: question.user.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
  
  
  
  
  interface IAddReviewData {
    review: string;
    rating: number;
    userId: string;
  }

  export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;

      const courseId = req.params.id;

      // check if courseId already exist in user Course list base
        const courseExist = userCourseList?.some((course: any) => course._id.toString() === courseId.toString());

        if (!courseExist) {
        return next(new ErrorHandler("you are not eligible to access these course", 404));    
        }

        const course = await CourseModel.findById(courseId);

        const {review,rating} = req.body as IAddReviewData;

        const reviewData: any = {
          user: req.user,
          rating,
          Comment: review,
        }

        course?.reviews.push(reviewData);

        let avg = 0;
         
        course?.reviews.forEach((rev: any) => {
          avg = rev.rating;
        });

        if (course) {
          course.ratings = avg / course.reviews.length;
        }

        await course?.save();

       await redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days

        //create notification
          await NotificationModel.create({
          user: req.user?._id,
         title: "New Review Recieved",
          message: `${req.user?.name} has given a review in ${course?.name}`,
        });

        res.status(201).json({
          success: true,
          course,
        })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  })

  // add reply on review
  interface IAddReviewData {
    comment: string;
    courseId: string;
    reviewId: string;
  }

  export const addReplyToReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comment, courseId, reviewId } = req.body as IAddReviewData;
      console.log("Received reviewId:", reviewId);

      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return next(new ErrorHandler("Invalid review id", 400));
      }

      const review = course?.reviews?.find((rev: any) => rev._id.toString() === reviewId);
      if (!review) {
        return next(new ErrorHandler("Review not found", 404));
      }

      if (!review.commentReplies) {
        review.commentReplies = [];
      }

      const replyData: any = {
        user: req.user,
        comment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      review.commentReplies.push(replyData);

      await course.save();

        await redis.set(courseId, JSON.stringify(course), 'EX', 604800); // 7days

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


  // get all course --- only admin  
  
  export const getAdminAllCources = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
  try {
    getAllCoursesService(res);
  } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
  })



  // delete course -- only admin
  export const deleteCourse = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
  
      const course = await CourseModel.findById(id);
  
      if (!course) {
          return next(new ErrorHandler("course not found" , 404));    
      }
  
      await course.deleteOne({ id });
  
      await redis.del(id);
  
      res.status(201).json({
        success: true,
        message: "Course Deleted Successfully"
      });
  
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
  })
  

  // genrate vedio Url
//   export const generateVedioUrl = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { videoId } = req.body;

//     console.log("📦 videoId received in backend:", videoId);
//     console.log("🔑 VdoCipher API Secret exists:", !!process.env.VDOCIPHER_API_SECRET);

//     if (!videoId || typeof videoId !== "string") {
//       console.log("❌ Invalid video ID:", videoId);
//       return next(new ErrorHandler("Video ID is missing or invalid", 400));
//     }

//     if (!process.env.VDOCIPHER_API_SECRET) {
//       console.log("❌ VdoCipher API Secret not configured");
//       return next(new ErrorHandler("VdoCipher API credentials not configured", 500));
//     }

//     console.log("🌐 Making request to VdoCipher API for video:", videoId);

//     const response = await axios.post(
//       `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
//       { 
//         ttl: 300,
//         // Add region and network settings to avoid restrictions
//         restrictions: {
//           allowedCountries: [], // Empty array means all countries allowed
//           blockedCountries: [],
//           allowedNetworks: [],
//           blockedNetworks: []
//         }
//       },
//       {
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/json",
//           Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
//         },
//       }
//     );

//     console.log("✅ VdoCipher API response received");
//     res.json(response.data);
//   } catch (error: any) {
//     console.error("❌ VdoCipher API Error Details:");
//     console.error("  - Status:", error.response?.status);
//     console.error("  - Data:", error.response?.data);
//     console.error("  - Message:", error.message);
//     console.error("  - Video ID:", req.body.videoId);
    
//     const errorMessage = error.response?.data?.message || error.message || "Unknown error";
//     return next(new ErrorHandler(errorMessage, 400));
//   }
// });

// generate video url
export const generateVedioUrl = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoId } = req.body;
      const response = await axios.post(
        `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        { ttl: 300 },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Apisecret ${process.env.VDOCIPHER_API_SECRET}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);











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
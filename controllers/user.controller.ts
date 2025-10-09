require('dotenv').config();
import { Request,Response,NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import Jwt, { JwtPayload, Secret } from "jsonwebtoken";

import ejs from "ejs"
import path from "path";
import sendMail from "../utils/sendMail";
import { accessTokenOptions, refreshTokenOptions, sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import { getAllUsersService, getUserById, updateUserRoleService } from "../services/user.service";
import cloudinary from "cloudinary";

// register user
interface IRegistrationBody{
    name: string;
    email: string;
    password: string;
    avatar?:string;
}

export const registrationUser = CatchAsyncError(async (req:Request,res:Response,next:NextFunction) => {
    try {
        const {name,email,password} = req.body;


        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist){
            return next(new ErrorHandler("Email already exist", 400))
        };

        const user:IRegistrationBody = {
            name,
            email,
            password,
        };

        const activationToken = createActivationToken(user);

       const activationCode = activationToken.activationCode;

       const data = {user: {name: user.name}, activationCode};
    const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);
    
    try {
        await sendMail({
            email: user.email,
            subject: "Active your Account",
            template: "activation-mail.ejs",
            data,
        });

        res.status(201).json({
            success: true,
            message: `please check your email:- ${user.email} to activate your account!`,
            activationCode: activationToken.token,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400))
    }
    } catch (error: any) {
        return next(new ErrorHandler(error.message,400))
    }
});

interface IActivationToken{
    token: string;
    activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = Jwt.sign({
        user,activationCode
    }, 
    process.env.ACTIVATION_SECRET as Secret,
    {
        expiresIn:"1d"
    });

    return {token, activationCode}
};


// active user 
interface IActivationRequest{
    activation_token: string;
    activation_code: string;
}

export const activeUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    //   console.log("🔥 req.body:", req.body);

      const { activation_token, activation_code } = req.body as IActivationRequest;

      const newUser = Jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (String(newUser.activationCode) !== String(activation_code)) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler("Email already exists", 400));
      }

      const user = await userModel.create({ name, email, password });

      res.status(201).json({
        success: true,
        message: "Account activated successfully!",
      });
    } catch (error: any) {
    //   console.error("❌ Activation error:", error);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// login user
interface ILginRequest {
    email: string;
    password: string;
}

export const loginUser = CatchAsyncError(async (req:Request, res:Response, next:NextFunction) => {
try {
    const {email,password} = req.body as ILginRequest;

    if (!email || !password) {
       return next(new ErrorHandler("Please enter email and password", 400)) ;    
    };

    const user = await userModel.findOne({email}).select("+password");

    if (!user) {
        return next(new ErrorHandler("Invalid email and password", 400)) ;           
    }

    const isPasswordMatch = await user.comparePassword(password);

     if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400)) ;           
    };

    sendToken(user, 200, res)
} catch (error:any) {
       return next(new ErrorHandler(error.message,400))
}
})

//logout user 
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Clear cookies
      const cookieOptions = {
        maxAge: 1,
        httpOnly: true,
        sameSite: "none" as const,
        secure: true,
      };

      res.cookie("access_token", "", cookieOptions);
      res.cookie("refresh_token", "", cookieOptions);

      const userId = req.user?._id;
            // console.log("userId is" ,userId);

      if (!userId) {
        return next(new ErrorHandler("User not authenticated", 401));
      }
      

      const redisKey = `user:${userId}`;
      const deleted = await redis.del(redisKey);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// validate user role
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || '')) {
      return next(
        new ErrorHandler(
          `Role: ${req.user?.role} is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};

//update access token
export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("🔄 Token refresh attempt for:", req.originalUrl);
    console.log("🍪 Cookies available:", Object.keys(req.cookies));
    
    const refresh_token = req.cookies.refresh_token 
                       || req.headers["x-refresh-token"] 
                       || req.body.refresh_token;

    if (!refresh_token || typeof refresh_token !== "string") {
      console.log("⚠️ No refresh token found, continuing without token refresh");
      return next();
    }
    
    console.log("✅ Refresh token found, attempting to refresh");

    const decoded = Jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

    const session = await redis.get(`user:${decoded.id}`);
    if (!session) {
      console.log("No session found in Redis, continuing without token refresh");
      return next();
    }

    const user = JSON.parse(session);

    const accessToken = Jwt.sign(
      { id: user._id },
      process.env.ACCESS_TOKEN as string,
      { expiresIn: "1d" }
    );

    const newRefreshToken = Jwt.sign(
      { id: user._id },
      process.env.REFRESH_TOKEN as string,
      { expiresIn: "3d" }
    );

    req.user = user;

    // Set cookies with proper options for production
    const cookieOptions = {
      ...accessTokenOptions,
      sameSite: "none"  as const,
      secure: true,
    };

    res.cookie("access_token", accessToken, cookieOptions);
    res.cookie("refresh_token", newRefreshToken, {
      ...refreshTokenOptions,
      sameSite: "none" as const,
      secure: true,
    });

    await redis.set(user._id,JSON.stringify(user), "EX", 604800); // 7 days

    next();
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

//get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;

    if (!userId) {
      return next(new ErrorHandler("User ID not found", 400));
    }

    const user = await getUserById(userId.toString());

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.status(200).json({
      success: true,
      user,
    });
  }
);


// social auth
interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

export const socialAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {email,name,avatar} = req.body as ISocialAuthBody;
    const user = await userModel.findOne({email});
    if (!user) {
      const newUser = await userModel.create({ name, email, avatar });
      sendToken(newUser, 200, res);
    } else {
         sendToken(user, 200, res);  
    }
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
})


// update user Info
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {name} = req.body as IUpdateUserInfo;
const userId = req.user?._id?.toString();

if (!userId) {
  return next(new ErrorHandler("User ID not found", 400));
}

const user = await userModel.findById(userId);

    

    if (name && user) {
      user.name = name;
    }

    await user?.save();

    await redis.set(userId, JSON.stringify(user));

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
})


//update password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      // ✅ Fix condition logic
      if (!oldPassword || !newPassword) {
        return next(
          new ErrorHandler("Please enter old and new password", 400)
        );
      }

      // ✅ Ensure user is authenticated
      const user = await userModel.findById(req.user?._id).select("+password");

      if (!user || user.password === undefined) {
        return next(new ErrorHandler("Invalid user", 400));
      }

      // ✅ Compare old password
      const isPasswordMatch = await user.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      // ✅ Update password
      user.password = newPassword;
      await user.save();

      // ✅ Update Redis cache with new user data
      const userId = req.user?._id;
      if (userId) {
        await redis.set(userId.toString(), JSON.stringify(user));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update profile picture
interface IUpdateProfilePicture {
  avatar: string;
}

export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateProfilePicture;

      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 400));
      }

      const user = await userModel.findById(userId);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (avatar) {
        // If user already has an avatar, delete it
        if (user.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        // Upload new avatar
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
          crop: "scale", // optional
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      await user.save();

      // Update Redis cache
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// get all users --- only admin
export const getAllUsers = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
try {
  getAllUsersService(res);
} catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
})

// update user role --- only for admin
export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, role } = req.body;

    if (!email) return next(new ErrorHandler("Email is required", 400));
    if (!role) return next(new ErrorHandler("Role is required", 400));

    const user = await userModel.findOneAndUpdate(
      { email },
      { role },
      { new: true }
    );
    if (!user) return next(new ErrorHandler("User not found", 404));

    res.status(200).json({
      success: true,
      user,
    });
  }
);

// delete user -- only admin
export const deleteUser = CatchAsyncError(async(req: Request,res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await userModel.findById(id);

    if (!user) {
        return next(new ErrorHandler("User not found" , 404));    
    }

    await user.deleteOne({ id });

    await redis.del(id);

    res.status(201).json({
      success: true,
      message: "User Deleted Successfully"
    });

  } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
})

import express from "express";
import {
  activeUser,
  deleteUser,
  getAllUsers,
  getUserInfo,
  loginUser,
  logoutUser,
  registrationUser,
  socialAuth,
  updateAccessToken,
  updatePassword,
  updateProfilePicture,
  updateUserInfo,
  updateUserRole,
} from "../controllers/user.controller";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";

const userRouter = express.Router();

userRouter.post("/registration", registrationUser);
userRouter.post("/activate-user", activeUser);
userRouter.post("/login", loginUser);
userRouter.get("/logout", isAuthenticated, logoutUser);
userRouter.get("/refresh", updateAccessToken);
userRouter.get("/me", updateAccessToken, isAuthenticated, getUserInfo);
userRouter.get("/test-auth", isAuthenticated, (req, res) => {
  res.json({ success: true, message: "Authentication working", user: req.user });
});

userRouter.get("/test-cookies", (req, res) => {
  res.json({ 
    success: true, 
    message: "Cookie test", 
    cookies: req.cookies,
    headers: {
      origin: req.headers.origin,
      cookie: req.headers.cookie
    }
  });
});
userRouter.post("/social-auth", socialAuth);
userRouter.put("/update-user-info", updateAccessToken, isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password", updateAccessToken, isAuthenticated, updatePassword);
userRouter.put("/update-user-avatar", updateAccessToken, isAuthenticated, updateProfilePicture);
userRouter.get("/get-users", updateAccessToken, isAuthenticated, authorizeRoles('admin'), getAllUsers);
userRouter.put("/update-user", updateAccessToken, isAuthenticated, authorizeRoles('admin'), updateUserRole);
userRouter.delete("/delete-user/:id", updateAccessToken, isAuthenticated, authorizeRoles('admin'), deleteUser);



export default userRouter; 
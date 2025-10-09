import express from "express"
import { isAuthenticated } from "../middleware/auth";
import { authorizeRoles, updateAccessToken } from "../controllers/user.controller";
import { getAllNotifications, updateNotification } from "../controllers/notification.controller";
const notificationRouter = express.Router();

notificationRouter.get("/get-all-notifications", updateAccessToken, isAuthenticated, authorizeRoles('admin'), getAllNotifications);

notificationRouter.put("/update-notification/:id", updateAccessToken, isAuthenticated, authorizeRoles('admin'), updateNotification);

export default notificationRouter;
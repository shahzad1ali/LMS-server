import express from "express"
import { isAuthenticated } from "../middleware/auth";
import { authorizeRoles, updateAccessToken } from "../controllers/user.controller";
import { getCoursesAnalytics, getOrdersAnalytics, getUserAnalytics } from "../controllers/analytics.controller";
const analyticsRouter = express.Router();

analyticsRouter.get("/get-users-analytics", updateAccessToken, isAuthenticated, authorizeRoles('admin'), getUserAnalytics);

analyticsRouter.get("/get-courses-analytics", updateAccessToken, isAuthenticated, authorizeRoles('admin'), getCoursesAnalytics);

analyticsRouter.get("/get-orders-analytics", updateAccessToken, isAuthenticated, authorizeRoles('admin'), getOrdersAnalytics);


export default analyticsRouter;
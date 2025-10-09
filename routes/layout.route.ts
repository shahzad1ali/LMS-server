import express from "express"
import { isAuthenticated } from "../middleware/auth";
import { authorizeRoles, updateAccessToken } from "../controllers/user.controller";
import { createLayout, editLayout, getLayoutByType } from "../controllers/layout.controller";

const layoutRouter = express.Router();

layoutRouter.post("/create-layout", updateAccessToken, isAuthenticated, authorizeRoles('admin'), createLayout);

// Edit layout
layoutRouter.put("/edit-layout", updateAccessToken, isAuthenticated, authorizeRoles('admin'), editLayout);


// in your layout route file
layoutRouter.get("/get-layout/:type", getLayoutByType);



export default layoutRouter;
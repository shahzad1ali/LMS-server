import { app } from "./app";
import {v2 as cloudinary} from "cloudinary";
import http from "http";
import dotenv from "dotenv";
import connectDB from "./utils/db";
import { initSocketServer } from "./socketServer";
dotenv.config();
const server = http.createServer(app);

// cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,

})

initSocketServer(server);


const port = process.env.PORT;
// create server 
server.listen(process.env.PORT, () => {
    console.log(`server is connected with port ${port}`);
     connectDB();
});
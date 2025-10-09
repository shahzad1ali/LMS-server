import mongoose from "mongoose";
require('dotenv').config();

const dbUrl:string = "mongodb+srv://shahzadali:e-shop1234@cluster0.cwnl5rv.mongodb.net/lms?retryWrites=true&w=majority&appName=Cluster0";

const connectDB = async () => {
    try {
        await mongoose.connect(dbUrl).then((data:any) => {
            console.log(`database connected with ${data.connection.host}`);
            
        })
    } catch (error:any) {
        console.log(error.message);
        setTimeout(connectDB, 4000)       
    }
}

export default connectDB;
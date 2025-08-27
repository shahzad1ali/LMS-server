"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const orderSchema = new mongoose_1.Schema({
    courseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Course",
        required: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    payment_Info: {
        id: { type: String, required: true },
        status: { type: String, required: true },
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
    },
}, { timestamps: true });
// Avoid model overwrite on hot-reload
const OrderModel = mongoose_1.default.models.Order || mongoose_1.default.model("Order", orderSchema);
exports.default = OrderModel;
// import mongoose, { Document, Model, Schema } from "mongoose";
// export interface Iorder extends Document {
//   courseId: mongoose.Types.ObjectId;
//   userId: mongoose.Types.ObjectId;
//   payment_Info?: {
//     id: string;
//     status: string;
//     amount: number;
//     currency: string;
//   };
//   createdAt: Date;
//   updatedAt: Date;
// }
// const orderSchema = new Schema<Iorder>(
//   {
//     courseId: {
//       type: Schema.Types.ObjectId,
//       ref: "Course", // Reference to the Course model
//       required: true,
//     },
//     userId: {
//       type: Schema.Types.ObjectId,
//       ref: "User", // Reference to the User model
//       required: true,
//     },
//     payment_Info: {
//       type: {
//         id: { type: String, required: true },
//         status: { type: String, required: true },
//         amount: { type: Number, required: true },
//         currency: { type: String, required: true },
//       },
//       required: false, // Make payment_Info optional for flexibility
//     },
//   },
//   { timestamps: true }
// );
// const OrderModel: Model<Iorder> = mongoose.model("Order", orderSchema);
// export default OrderModel;

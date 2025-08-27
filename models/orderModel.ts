
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPaymentInfo {
  id: string;
  status: string;
  amount: number;
  currency: string;
}

export interface IOrder extends Document {
  courseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  payment_Info?: IPaymentInfo;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payment_Info: {
      id: { type: String, required: true },
      status: { type: String, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
  },
  { timestamps: true }
);

// Avoid model overwrite on hot-reload
const OrderModel: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);

export default OrderModel;

















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
import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { IUser } from "./user.model";

// ---------- Interfaces ----------

// Embedded (subdocument) shapes — do NOT extend Document here
interface IComment {
  user: any; // you can replace `any` with a more specific user snapshot if needed
  question: string;
  questionReplies?: IComment[];
}

interface IReview {
  user: any;
  rating: number;
  comment: string;
  commentReplies?: IComment[];
}

interface ILink {
  title: string;
  url: string;
}

interface ICourseData {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail?: object; // optional if frontend doesn't supply it yet
  videoSection: string;
  videoLength: number;
  videoPlayer?: string; // optional if not always provided
  links: ILink[];
  suggestion?: string;
  questions?: IComment[];
}

export interface ICourse extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  categories?: string;
  price: number;
  estimatedPrice?: number;
  // thumbnail: object;
  thumbnail: {
    public_id?: string;
    url?: string;
  };
  tags: string[];
  level: string;
  demoUrl: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased: number;
}

// ---------- Schemas ----------

const commentSchema = new Schema<IComment>(
  {
    user: Object,
    question: String,
    questionReplies: [this], // recursive; Mongoose allows this but watch for deep nesting
  },
  { _id: true }
);

const reviewSchema = new Schema<IReview>(
  {
    user: Object,
    rating: {
      type: Number,
      default: 0,
    },
    comment: String,
    commentReplies: [commentSchema],
  },
  { _id: false }
);

const linkSchema = new Schema<ILink>(
  {
    title: String,
    url: String,
  },
  { _id: false }
);

const courseDataSchema = new Schema<ICourseData>(
  {
    videoUrl: String,
    title: String,
    videoSection: String,
    description: String,
    videoLength: Number,
    videoPlayer: String,
    videoThumbnail: Schema.Types.Mixed,
    links: [linkSchema],
    suggestion: String,
    questions: [commentSchema],
  },
  { _id: true }
);

const courseSchema = new Schema<ICourse>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    categories: {
      type: String,
      // required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    estimatedPrice: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    tags: {
      type: [String],
      required: true,
    },
    level: {
      type: String,
      required: true,
    },
    demoUrl: {
      type: String,
      required: true,
    },
    benefits: [
      {
        title: String,
      },
    ],
    prerequisites: [
      {
        title: String,
      },
    ],
    reviews: [reviewSchema],
    courseData: [courseDataSchema],
    ratings: {
      type: Number,
      default: 0,
    },
    purchased: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);

export default CourseModel;

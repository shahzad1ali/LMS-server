import mongoose, { Schema, model } from "mongoose";

// Interfaces (assumed, you should define these if not already)
interface FaqItem {
  question: string;
  answer: string;
}

interface Category {
  title: string;
}

interface BannerImage {
  public_id: string;
  url: string;
}

interface Layout {
  type: string;
  faq: FaqItem[];
  categories: Category[];
  banner: {
    image: BannerImage;
    title: string;
    subTitle: string;
  };
}

// Schemas
const faqSchema = new Schema<FaqItem>({
  question: { type: String },
  answer: { type: String },
});

const categorySchema = new Schema<Category>({
  title: { type: String },
});

const bannerImageSchema = new Schema<BannerImage>({
  public_id: { type: String },
  url: { type: String },
});

const layoutSchema = new Schema<Layout>({
  type: { type: String },
  faq: [faqSchema],
  categories: [categorySchema],
  banner: {
    image: bannerImageSchema,
    title: { type: String },
    subTitle: { type: String },
  },
});

// Model
const LayoutModel = model<Layout>('Layout', layoutSchema);

export default LayoutModel;

import { NextFunction, Response, Request } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import LayoutModel from "../models/layout.model";

// create layout
export const createLayout = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.body;
    const isTypeExist = await LayoutModel.findOne({ type });
    if (isTypeExist) {
      return next(new ErrorHandler(`${type} already exist`, 400));
    }

    if (type === "Banner") {
      const { image, title, subTitle } = req.body;
      const myCloud = await cloudinary.v2.uploader.upload(image, {
        folder: "layout",
      });
      const banner = {
        type: "Banner",
        banner: {
          image: {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          },
          title,
          subTitle,
        },
      };
      await LayoutModel.create(banner);
    }

    if (type === "FAQ") {
      const { faq } = req.body;
      const faqItems = await Promise.all(
        (faq || []).map(async (item: any) => {
          return {
            question: item.question,
            answer: item.answer,
          };
        })
      );
      await LayoutModel.create({ type: "FAQ", faq: faqItems });
    }

    if (type === "Categories") {
      const { categories } = req.body;
      const categoriesItems = await Promise.all(
        (categories || []).map(async (item: any) => {
          return {
            title: item.title,
          };
        })
      );
      await LayoutModel.create({
        type: "Categories",
        categories: categoriesItems,
      });
    }

    res.status(200).json({
      success: true,
      message: "Layout created successfully",
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Edit layout
export const editLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;

      if (type === "Banner") {
        const bannerData: any = await LayoutModel.findOne({ type: "Banner" });

        if (!bannerData) {
          return next(new ErrorHandler("Banner layout not found", 404));
        }

        const { image, title, subTitle } = req.body;

        const data = image.startsWith("https")
          ? bannerData
          : await cloudinary.v2.uploader.upload(image, {
              folder: "layout",
            });

        const banner = {
          type: "Banner",
          image: {
            public_id: image.startsWith("https")
              ? bannerData.banner.image.public_id
              : data?.public_id,
            url: image.startsWith("https")
              ? bannerData.banner.image.url
              : data?.secure_url,
          },
          title,
          subTitle,
        };

        await LayoutModel.findByIdAndUpdate(bannerData._id, { banner });
      }

      if (type === "FAQ") {
        const { faq } = req.body;
        const FaqItem = await LayoutModel.findOne({ type: "FAQ" });
        if (!FaqItem) {
          return next(new ErrorHandler("FAQ layout not found", 404));
        }
        const faqItems = await Promise.all(
          (faq || []).map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await LayoutModel.findByIdAndUpdate(FaqItem._id, {
          type: "FAQ",
          faq: faqItems,
        });
      }

      if (type === "Categories") {
        const { categories } = req.body;
        const categoriesData = await LayoutModel.findOne({
          type: "Categories",
        });
        if (!categoriesData) {
          return next(new ErrorHandler("Categories layout not found", 404));
        }
        const categoriesItems = await Promise.all(
          (categories || []).map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await LayoutModel.findByIdAndUpdate(categoriesData._id, {
          type: "Categories",
          categories: categoriesItems,
        });
      }

      res.status(200).json({
        success: true,
        message: "Layout Updated successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get layout by type (now reading from URL param)
export const getLayoutByType = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.params.type;
    if (!type) {
      return next(new ErrorHandler("Layout type is required", 400));
    }
    
    const layout = await LayoutModel.findOne({ type });
    
    // If layout doesn't exist, create default layout for categories
    if (!layout && type === "Categories") {
      console.log("📝 Creating default categories layout");
      const defaultCategories = [
        { title: "Programming" },
        { title: "Web Development" },
        { title: "Data Science" },
        { title: "Design" },
        { title: "Business" }
      ];
      
      const newLayout = await LayoutModel.create({
        type: "Categories",
        categories: defaultCategories,
      });
      
      return res.status(200).json({
        success: true,
        layout: newLayout,
      });
    }
    
    if (!layout) {
      return next(new ErrorHandler(`${type} layout not found`, 404));
    }
    
    res.status(200).json({
      success: true,
      layout,
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

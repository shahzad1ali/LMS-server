// types/express/index.d.ts
import { IUser } from "../../models/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: IUser & { courses?: any[] }; // Add your custom fields
    }
  }
}

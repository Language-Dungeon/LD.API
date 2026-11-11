import { User as UserClass } from "@schemas/user";
import { JwtPayload, JwtRefreshPayload } from "./jwt";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserClass {}
    interface Request {
      id: string;
      user: IUser | undefined;
      jwt: JwtPayload | undefined;
      session: JwtRefreshPayload | undefined;
    }
  }
}

export {};

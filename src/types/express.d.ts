import { JwtRefreshPayload, JwtPayload } from "./jwt";
import { IAuthUser as UserType } from "./user";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserType {}
    interface Request {
      id: string;
      user: User | undefined;
      jwt: JwtPayload | undefined;
      session: JwtRefreshPayload | undefined;
    }
  }
}

export {};

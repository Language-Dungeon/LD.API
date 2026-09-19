import { JwtPayload, JwtRefreshPayload } from "./jwt";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends JwtPayload {} // trzeba nadpisac typ z passport bo jest rozjebany
    interface Request {
      id: string;
      user: User | undefined;
      session: JwtRefreshPayload | undefined;
    }
  }
}

export {};

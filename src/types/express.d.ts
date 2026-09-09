import { JwtPayload, JwtRefreshPayload } from "./jwt";

declare global {
  namespace Express {
    interface Request {
      id: string;
      user: JwtPayload;
      session: JwtRefreshPayload;
    }
  }
}

export {};

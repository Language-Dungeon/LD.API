import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction) {
    req.id = crypto.randomUUID();
    next();
  }
}

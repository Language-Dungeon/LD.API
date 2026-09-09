import { LoggerService } from "@modules/logger";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Config } from "@types";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<Config>) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const logger = new LoggerService(GlobalMiddleware.name, this.config);
    req.id = crypto.randomUUID();
    //TODO: add user
    logger.log(
      `${req.id}: [ ip: ${req.ip}, path: ${req.originalUrl}, method: ${req.method}, body: ${JSON.stringify(req.body)} | Date: ${Date.now()} ]`,
    );

    next();
  }
}

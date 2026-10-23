import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req: Request = ctx.switchToHttp().getRequest();
  if (!req.user) throw new UnauthorizedException();

  return req.user;
});

export const CurrentSession = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req: Request = ctx.switchToHttp().getRequest();
  if (!req.session) throw new UnauthorizedException();

  return req.session;
});

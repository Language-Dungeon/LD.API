import { createParamDecorator, ExecutionContext, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { SKIP_REFRESH_ROUTE } from "@types";
import type { Request } from "express";

export const SkipRefreshRoute = () => SetMetadata(SKIP_REFRESH_ROUTE, true);

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

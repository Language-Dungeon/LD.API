import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_PROVIDER, SKIP_ACCOUNT_ACTIVATED } from "@types";
import type { Request } from "express";

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_PROVIDER, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipAccountActivated = this.reflector.getAllAndOverride<boolean>(SKIP_ACCOUNT_ACTIVATED, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || skipAccountActivated) return true;

    if (!req.user) throw new UnauthorizedException("xd");
    if (req.user.activated === false) throw new ForbiddenException("ACCOUNT_NOT_ACTIVATED");

    return true;
  }
}

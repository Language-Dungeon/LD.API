import { CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_PROVIDER } from "@types";
import type { Request } from "express";

export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_PROVIDER, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const user = req.user;
    if (!user) throw new UnauthorizedException();

    return false;
  }
}

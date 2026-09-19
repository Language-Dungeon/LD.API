import { getPermissionValue } from "@common/utils/permissions";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  IS_PUBLIC_PROVIDER,
  PermissionKeys,
  PermissionValue,
  REQUIRED_PERMISSIONS,
  Roles,
  rolesPermissions,
  SKIP_REFRESH_ROUTE,
} from "@types";
import type { Request } from "express";

//TODO: implement permission_overrides
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_PROVIDER, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipRefreshRoute = this.reflector.getAllAndOverride<boolean>(SKIP_REFRESH_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || skipRefreshRoute) return true;

    const user = req.user;
    if (!user) throw new UnauthorizedException();

    const requiredPermissions =
      this.reflector.getAllAndOverride<Roles | PermissionKeys[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "user";

    const requiredPermissionsValues = (
      typeof requiredPermissions === "string"
        ? this.getAllPermissionsFromRole(requiredPermissions)
        : this.getAllPermissionsFromPermissionKeys(requiredPermissions)
    ) as PermissionValue[];

    const permissions = this.getAllPermissionsFromRole(user.role);
    const hasAllPermissions = requiredPermissionsValues.every((perm) => permissions.includes(perm));
    const hasOverridePermissions = requiredPermissionsValues.every((perm) => {
      if (!user.permissions_overrides) return true;
      if (user.permissions_overrides[perm] === false || user.permissions_overrides[perm] === undefined)
        throw new UnauthorizedException();
      else return true;
    });

    if (!hasAllPermissions && hasOverridePermissions) throw new UnauthorizedException();
    return true;
  }

  getAllPermissionsFromRole(role: Roles): PermissionValue[] {
    return rolesPermissions[role];
  }

  getAllPermissionsFromPermissionKeys(keys: PermissionKeys[]): PermissionValue[] {
    return keys.map((k) => getPermissionValue(k));
  }
}

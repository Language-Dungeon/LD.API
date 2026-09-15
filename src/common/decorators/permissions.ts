import { SetMetadata } from "@nestjs/common";
import { PermissionKeys, REQUIRED_PERMISSIONS, Roles } from "@types";

export const RequiredPermissions = (requiredPermissions: Roles | PermissionKeys[]) =>
  SetMetadata<string, Roles | PermissionKeys[]>(REQUIRED_PERMISSIONS, requiredPermissions);

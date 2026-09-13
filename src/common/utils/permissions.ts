import { permissions, type PermissionKeys, type PermissionValue } from "@types";

const permissionKeys = Object.keys(permissions) as PermissionKeys[];

export const getPermissionValue = (key: PermissionKeys) => permissions[key];
export const getPermissionKey = (value: PermissionValue): PermissionKeys | undefined =>
  permissionKeys[value] as PermissionKeys;

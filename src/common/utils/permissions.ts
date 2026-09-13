import { permissions, type PermissionKeys } from "@types";

export const getPermissionValue = (key: PermissionKeys) => permissions[key];

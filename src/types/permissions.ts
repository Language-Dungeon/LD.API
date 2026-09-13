export const permissions = {
  ALL: 0,
  MANAGE_PERMISSIONS: 1,
  READ_USERS: 2,
  UPDATE_USERS: 3,
  DELETE_USERS: 4,
  WRITE_LESSONS: 5,
} as const;

export type PermissionKeys = keyof typeof permissions;
export type PermissionValue = (typeof permissions)[PermissionKeys];
export type Permissions = PermissionKeys | PermissionValue;

export type Roles = "user" | "admin" | "tester" | "developer";

export const rolesPermissions: Record<Roles, Permissions[]> = {
  admin: [permissions.ALL],
  developer: [permissions.READ_USERS, permissions.WRITE_LESSONS],
  user: [],
  tester: [],
};

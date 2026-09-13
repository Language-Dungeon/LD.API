export const permissions = {
  ALL: "ALL",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  READ_USERS: "USERS:READ",
  UPDATE_USERS: "USERS:UPDATE",
  DELETE_USERS: "USERS:DELETE",
  WRITE_LESSONS: "LESSONS:WRITE",
} as const;

export type PermissionKeys = keyof typeof permissions;
export type PermissionValue = (typeof permissions)[PermissionKeys];

export const ROLES = ["user", "admin", "tester", "developer"] as const;
export type Roles = (typeof ROLES)[number];

export const rolesPermissions: Record<Roles, PermissionValue[]> = {
  admin: [permissions.ALL],
  developer: [permissions.READ_USERS, permissions.WRITE_LESSONS],
  user: [],
  tester: [],
};

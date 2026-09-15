export const APP_NAME = "LD.API";

/* providers for custom decorators */
export const IS_PUBLIC_PROVIDER = "isPublic";
export const REQUIRED_PERMISSIONS = "requiredPermissions";
export const USER_PROVIDER = "UserRepository";

/* redis keys */
export const FAMILY_KEY = "refresh:family";
export const USER_KEY = "user";
export const BLACKLIST_KEY = "blacklist";

/* defined time in seconds */
export const EXPIRES_IN_7_DAYS = 604800;
export const EXPIRES_IN_10MINS = 600;

/* routes */
export const ROUTES = {
  MAIN: {
    BASE: "",
  },
  AUTH: {
    BASE: "auth",
    LOGIN: "login",
    REGISTER: "register",
    REFRESH: "refresh",
    ME: "me",
    LOGOUT: "logout",
  },
} as const;

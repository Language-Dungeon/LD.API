export const APP_NAME = "LD.API";

/* providers for custom decorators */
export const IS_PUBLIC_PROVIDER = "Public";
export const REQUIRED_PERMISSIONS = "requiredPermissions";
export const SKIP_REFRESH_ROUTE = "skipRefreshRoute";
export const SKIP_ACCOUNT_ACTIVATED = "skipAccountActivated";
export const USER_PROVIDER = "UserRepository";

/* redis keys */
export const FAMILY_KEY = "refresh:family";
export const USER_KEY = "user";
export const BLACKLIST_KEY = "blacklist";
export const OTP_KEY = "otp";
export const PASSWORD_OTP_KEY = "password:otp";
export const AI_EMBED_CACHE_KEY = "ai:embed";
export const AI_HEALTH_CACHE_KEY = "ai:health";

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
    GENERATE_OTP: "generate-otp",
    APPLY_OTP: "apply-otp",
    FORGOT_PASSWORD: "forgot-password",
    FORGOT_PASSWORD_APPLY_OTP: "forgot-password/apply-otp",
    CHANGE_PASSWORD: "change-password",
    GOOGLE: "google",
    GOOGLE_CALLBACK: "google/callback",
  },
  AI: {
    BASE: "ai",
    PROVIDERS: "providers",
    HEALTH: "health",
    COMPLETE: "complete",
    STREAM: "stream",
    EMBED: "embed",
    THREADS: "threads",
    THREAD: ":threadId",
    THREAD_MESSAGES: ":threadId/messages",
    PROFILE: "profile",
    EMBEDS: "embeds",
    EMBED_DETAIL: ":embedId",
    EMBED_EVENTS: ":embedId/events",
  },
} as const;

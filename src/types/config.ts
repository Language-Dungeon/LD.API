export interface Config {
  NODE_ENV: "production" | "dev";
  PORT_MAIN: number;
  WEBHOOK: string;
  PASSWORD_HASH_SECRET: string;
  EMAIL_HMAC_SECRET: string;
  ENCRYPTION_SECRET: string;

  DB_URI: string;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;

  REDIS_URI: string;
  REDIS_PORT: number;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;

  RESEND_API_KEY: string;

  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  COOKIE_SECRET: string;

  AUTH_BYPASS?: "true" | "false";
}

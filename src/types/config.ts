export interface Config {
  NODE_ENV: "production" | "dev";
  PORT_MAIN: number;
  DB_HOST: string;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_PORT: number;
  WEBHOOK: string;

  REDIS_URI: string;
  REDIS_PORT: number;

  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  COOKIE_SECRET: string;
}

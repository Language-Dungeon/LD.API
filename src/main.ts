import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@modules";
import { type Config } from "@types";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { writeFileSync } from "node:fs";
import cookieParser from "cookie-parser";

function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    writeFileSync("./startup-debug.log", line + "\n", { flag: "a" });
  } catch (_) {}
}

process.on("unhandledRejection", (reason) => {
  debugLog("unhandledRejection: " + String(reason));
});

process.on("uncaughtException", (err: { message?: string; stack?: string }) => {
  debugLog(
    "uncaughtException: " +
      (err?.message ?? String(err)) +
      " | stack: " +
      (err?.stack?.split("\n").slice(0, 5).join(" | ") ?? "none"),
  );
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: process.env.NODE_ENV == "production" ? false : true,
  });

  app.useBodyParser("json", { limit: "20mb" });
  const config = app.get(ConfigService<Config>);
  const logger = new LoggerService("Bootstrap", config);
  const port = config.getOrThrow("PORT_MAIN");

  try {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    app.useLogger(logger);
    app.use(cookieParser(config.getOrThrow<string>("COOKIE_SECRET")));

    await app.listen(port, "0.0.0.0", () => logger.log(`listening on ${port} `));
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
bootstrap();

const rec: Record<string, string> = {
  dsd: "",
};

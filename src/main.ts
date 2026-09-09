import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@modules";
import { type Config } from "@types";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: process.env.NODE_ENV == "production" ? false : true,
    bodyParser: false,
  });

  const config = app.get(ConfigService<Config>);
  const logger = new LoggerService("BOOTSTRAP", config);

  const port = config.getOrThrow("PORT_MAIN");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useLogger(logger);
  await app.listen(port, "0.0.0.0", () => logger.log(`listening on ${port} `));
}
bootstrap();

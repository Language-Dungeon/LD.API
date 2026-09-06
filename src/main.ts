import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@modules";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: process.env.NODE_ENV == "production" ? false : true,
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const logger = new LoggerService("BOOTSTRAP", config);

  app.useLogger(logger);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

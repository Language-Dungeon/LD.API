import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { AppController } from "./modules/main/app.controller";
import { AppService } from "./modules/main/app.service";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "path";
import Joi from "joi";
import { type Config } from "@types";
import { GlobalMiddleware } from "@common";
import { LoggerModule, LoggerService } from "@modules/logger";

const envFileName = process.env.NODE_ENV === "production" ? ".env.production" : ".env";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), envFileName),
      validationSchema: Joi.object<Config>({
        NODE_ENV: Joi.string().valid("production", "dev").required(),
        PORT_MAIN: Joi.number().port().required(),

        // DB_HOST: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        DB_URI: Joi.string().required(),
        // DB_USERNAME: Joi.string().required(),
        // DB_PASSWORD: Joi.string().required(),
        // DB_PORT: Joi.number().port().required(),

        WEBHOOK: Joi.string().uri().required(),

        // REDIS_URI: Joi.string().required(),
        // REDIS_PORT: Joi.number().port().required(),

        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        COOKIE_SECRET: Joi.string().required(),
      }).unknown(true),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService, LoggerModule.register("DB")],
      useFactory: (config: ConfigService<Config>, logger: LoggerService) => {
        return {
          uri: config.getOrThrow("DB_URI"),
          dbName: config.getOrThrow("DB_NAME"),
          onConnectionCreate(connection) {
            logger.log(`app connected to ${connection.db?.databaseName}`);
          },
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GlobalMiddleware).forRoutes("*");
  }
}

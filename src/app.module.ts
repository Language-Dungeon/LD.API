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
import { Connection } from "mongoose";

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
      imports: [LoggerModule.register("DB")],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Config>, logger: LoggerService) => ({
        uri: config.getOrThrow("DB_URI"),
        dbName: config.getOrThrow("DB_NAME"),
        retryAttempts: 2,
        retryDelay: 3000,
        verboseRetryLog: true,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 5000,

        connectionFactory: (connection: Connection) => {
          connection.once("connected", () => {
            logger.log(`MongoDB connected to ${connection.db?.databaseName}`);
          });

          connection.on("error", (error) => {
            logger.error(`MongoDB connection error: ${error.message}`);
          });

          connection.on("disconnected", () => {
            logger.warn("MongoDB disconnected");
          });

          return connection;
        },
      }),
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

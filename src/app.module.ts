import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import {
  LoggerModule,
  LoggerService,
  AppService,
  AppController,
  AuthModule,
  CryptoModule,
  UsersModule,
} from "@modules";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "path";
import Joi from "joi";
import { type Config } from "@types";
import { GlobalMiddleware, PermissionsGuard } from "@common";
import { Connection } from "mongoose";
import { CacheModule } from "@nestjs/cache-manager";
import KeyvRedis from "@keyv/redis";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "@common";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";

const envFileName = process.env.NODE_ENV === "production" ? ".env.production" : ".env";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), envFileName),
      validationSchema: Joi.object<Config>({
        NODE_ENV: Joi.string().valid("production", "dev").required(),
        PORT_MAIN: Joi.number().port().required(),
        PASSWORD_HASH_SECRET: Joi.string().required(),
        EMAIL_HMAC_SECRET: Joi.string().required(),
        ENCRYPTION_SECRET: Joi.string().required(),

        // DB_HOST: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        DB_URI: Joi.string().required(),
        // DB_USERNAME: Joi.string().required(),
        // DB_PASSWORD: Joi.string().required(),
        // DB_PORT: Joi.number().port().required(),

        WEBHOOK: Joi.string().uri().required(),

        REDIS_URI: Joi.string().required(),
        REDIS_PORT: Joi.number().port().required(),

        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_REDIRECT_URI: Joi.string().uri().required(),

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
            logger.error(`MongoDB connection error: ${JSON.stringify(error)}`);
          });

          connection.on("disconnected", () => {
            logger.warn("MongoDB disconnected");
          });

          return connection;
        },
      }),
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      imports: [LoggerModule.register("Cache")],
      inject: [ConfigService, LoggerService],
      useFactory: async (config: ConfigService<Config>, logger: LoggerService) => {
        const host = config.getOrThrow("REDIS_URI", { infer: true });
        const port = config.getOrThrow("REDIS_PORT", { infer: true });
        const store = new KeyvRedis(`${host}:${port}`, {
          throwOnConnectError: true,
          throwOnErrors: true,
        });

        store.set("healthcheck", "healthcheck", 1000);
        store.on("connect", () => logger.log("Connected to redis"));
        store.on("error", (error) => logger.error(error));

        return {
          stores: [store],
          ttl: 600000,
        };
      },
    }),

    JwtModule.register({
      global: true,
    }),

    BullModule.forRootAsync({
      imports: [LoggerModule.register("Queue")],
      inject: [ConfigService, LoggerService],
      useFactory: async (config: ConfigService<Config>, logger: LoggerService) => {
        const uri = config.getOrThrow("REDIS_URI");
        const host = new URL(uri).hostname;
        const port = config.getOrThrow("REDIS_PORT");

        logger.log(`Connecting BullMQ to Redis at ${host}:${port}`);

        return {
          connection: {
            host,
            port,
          },
          prefix: "bullmq",
        };
      },
    }),

    EventEmitterModule.forRoot({
      global: true,
      delimiter: ".",
    }),

    CryptoModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GlobalMiddleware).forRoutes("*");
  }
}

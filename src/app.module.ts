import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import {
  LoggerModule,
  LoggerService,
  AppService,
  AppController,
  AuthModule,
  CryptoModule,
  UsersModule,
  AiModule,
} from "@modules";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "path";
import Joi from "joi";
import { type Config } from "@types";
import { AccountGuard, GlobalMiddleware, PermissionsGuard } from "@common";
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

        RESEND_API_KEY: Joi.string().required(),

        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        COOKIE_SECRET: Joi.string().required(),

        AUTH_BYPASS: Joi.boolean().default(false),

        AI_LOCAL_ENABLED: Joi.boolean().default(true),
        AI_CLOUD_ENABLED: Joi.boolean().default(true),
        AI_FORCE_LOCAL: Joi.boolean().default(false),
        AI_BYPASS: Joi.boolean().default(true),
        AI_BYPASS_LOCAL_ONLY: Joi.boolean().default(true),
        AI_DEFAULT_PROVIDER: Joi.string()
          .valid(
            "ollama",
            "lmstudio",
            "llamacpp",
            "vllm",
            "openai",
            "anthropic",
            "google",
            "openrouter",
            "groq",
            "mistral",
            "deepseek",
          )
          .default("ollama"),
        AI_DEFAULT_MODEL: Joi.string().optional(),
        AI_EMBED_MODEL: Joi.string().optional(),
        AI_MAX_OUTPUT_TOKENS: Joi.number().integer().min(64).max(32768).default(1024),
        AI_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(600000).default(60000),
        AI_CONTEXT_MAX_TURNS: Joi.number().integer().min(2).max(64).default(16),
        AI_CONTEXT_SUMMARY_TURNS: Joi.number().integer().min(1).max(32).default(6),
        AI_FAILOVER_CHAIN: Joi.string().allow("").default(""),

        AI_OLLAMA_URL: Joi.string().uri().default("http://127.0.0.1:11434"),
        AI_OLLAMA_MODEL: Joi.string().default("llama3.2"),
        AI_OLLAMA_EMBED_MODEL: Joi.string().default("nomic-embed-text"),

        AI_LMSTUDIO_URL: Joi.string().uri().default("http://127.0.0.1:1234/v1"),
        AI_LMSTUDIO_MODEL: Joi.string().default("local-model"),
        AI_LMSTUDIO_EMBED_MODEL: Joi.string().default("nomic-embed-text"),

        AI_LLAMACPP_URL: Joi.string().uri().default("http://127.0.0.1:8080/v1"),
        AI_LLAMACPP_MODEL: Joi.string().default("local-model"),
        AI_LLAMACPP_EMBED_MODEL: Joi.string().allow("").default(""),

        AI_VLLM_URL: Joi.string().uri().default("http://127.0.0.1:8000/v1"),
        AI_VLLM_MODEL: Joi.string().default("local-model"),
        AI_VLLM_EMBED_MODEL: Joi.string().allow("").default(""),

        AI_OPENAI_API_KEY: Joi.string().allow("").default(""),
        AI_OPENAI_URL: Joi.string().uri().default("https://api.openai.com/v1"),
        AI_OPENAI_MODEL: Joi.string().default("gpt-4o-mini"),
        AI_OPENAI_EMBED_MODEL: Joi.string().default("text-embedding-3-small"),

        AI_ANTHROPIC_API_KEY: Joi.string().allow("").default(""),
        AI_ANTHROPIC_URL: Joi.string().uri().default("https://api.anthropic.com/v1"),
        AI_ANTHROPIC_MODEL: Joi.string().default("claude-3-5-sonnet-latest"),

        AI_GOOGLE_API_KEY: Joi.string().allow("").default(""),
        AI_GOOGLE_URL: Joi.string().uri().default("https://generativelanguage.googleapis.com/v1beta"),
        AI_GOOGLE_MODEL: Joi.string().default("gemini-2.0-flash"),
        AI_GOOGLE_EMBED_MODEL: Joi.string().default("text-embedding-004"),

        AI_OPENROUTER_API_KEY: Joi.string().allow("").default(""),
        AI_OPENROUTER_URL: Joi.string().uri().default("https://openrouter.ai/api/v1"),
        AI_OPENROUTER_MODEL: Joi.string().default("meta-llama/llama-3.1-8b-instruct"),

        AI_GROQ_API_KEY: Joi.string().allow("").default(""),
        AI_GROQ_URL: Joi.string().uri().default("https://api.groq.com/openai/v1"),
        AI_GROQ_MODEL: Joi.string().default("llama-3.1-8b-instant"),

        AI_MISTRAL_API_KEY: Joi.string().allow("").default(""),
        AI_MISTRAL_URL: Joi.string().uri().default("https://api.mistral.ai/v1"),
        AI_MISTRAL_MODEL: Joi.string().default("mistral-small-latest"),
        AI_MISTRAL_EMBED_MODEL: Joi.string().default("mistral-embed"),

        AI_DEEPSEEK_API_KEY: Joi.string().allow("").default(""),
        AI_DEEPSEEK_URL: Joi.string().uri().default("https://api.deepseek.com/v1"),
        AI_DEEPSEEK_MODEL: Joi.string().default("deepseek-chat"),
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
      verboseMemoryLeak: true,
    }),

    CryptoModule,
    AuthModule,
    UsersModule,
    AiModule,
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
      useClass: AccountGuard,
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

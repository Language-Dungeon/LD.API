import { Module, type DynamicModule } from "@nestjs/common";
import { LoggerService } from "./logger.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { Config } from "@types";

@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {
  static register(context: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [ConfigModule],
      providers: [
        {
          inject: [ConfigService],
          provide: LoggerService,
          useFactory: async (config: ConfigService<Config>) => {
            return new LoggerService(context, config);
          },
        },
      ],
    };
  }
}

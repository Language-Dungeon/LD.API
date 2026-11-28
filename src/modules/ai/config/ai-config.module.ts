import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Config } from "@types";
import { AiConfigFactory } from "./ai-config.factory";
import { AI_MODULE_CONFIG } from "./ai-config.tokens";
import type { AiConfig } from "./ai-config.types";

@Module({
  providers: [
    {
      provide: AI_MODULE_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Config>): AiConfig => AiConfigFactory.from(config),
    },
  ],
  exports: [AI_MODULE_CONFIG],
})
export class AiConfigModule {}

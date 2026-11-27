import { Module, type FactoryProvider } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { LoggerModule, LoggerService } from "@modules/logger";
import { AiConfigModule } from "./config/ai-config.module";
import { AI_LOGGER } from "./config/ai-config.tokens";
import { AiHttpClient } from "./transport/ai-http.client";
import { AiGatewayRegistry } from "./providers/ai-gateway.registry";
import { AiGatewayService } from "./providers/ai-gateway.service";
import { AiHealthService } from "./health/ai-health.service";
import { AiDiagnosticsService } from "./diagnostics/ai-diagnostics.service";
import { AiProfileRepository } from "./profile/ai-profile.repository";
import { AiLevelService } from "./profile/ai-level.service";
import { AiThreadRepository } from "./conversation/ai-thread.repository";
import { AiConversationService } from "./conversation/ai-conversation.service";
import { AiContextService } from "./context/ai-context.service";
import { AiPromptService } from "./chat/ai-prompt.service";
import { AiChatService } from "./chat/ai-chat.service";
import { AiEmbedRepository } from "./embeds/ai-embed.repository";
import { AiEmbeddingService } from "./embeds/ai-embedding.service";
import { AiController } from "./ai.controller";
import { AiExceptionFilter } from "./errors/ai-exception.filter";
import { AiLogger } from "./errors/ai-logger";
import { AI_SCHEMAS } from "./schemas/ai.schemas";

const AI_LOGGER_PROVIDER: FactoryProvider = {
  provide: AI_LOGGER,
  inject: [{ token: LoggerService, optional: true }],
  useFactory: (logger?: LoggerService) => (logger ? new AiLogger(logger, "AI") : AiLogger.console()),
};

@Module({
  imports: [LoggerModule.register("AI"), AiConfigModule, MongooseModule.forFeature([...AI_SCHEMAS])],
  controllers: [AiController],
  providers: [
    AI_LOGGER_PROVIDER,
    AiExceptionFilter,
    AiHttpClient,
    AiGatewayRegistry,
    AiGatewayService,
    AiHealthService,
    AiDiagnosticsService,
    AiProfileRepository,
    AiLevelService,
    AiThreadRepository,
    AiConversationService,
    AiContextService,
    AiPromptService,
    AiChatService,
    AiEmbedRepository,
    AiEmbeddingService,
  ],
  exports: [AiGatewayService, AiHealthService, AiDiagnosticsService, AiChatService, AiEmbedRepository],
})
export class AiModule {}

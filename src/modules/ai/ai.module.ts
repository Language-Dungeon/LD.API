import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AiEmbed,
  AiEmbedEvent,
  AiEmbedEventSchema,
  AiEmbedSchema,
  AiMessage,
  AiMessageSchema,
  AiProfile,
  AiProfileSchema,
  AiThread,
  AiThreadSchema,
} from "@schemas";
import { LoggerModule } from "@modules/logger";
import { AiController } from "./ai.controller";
import { AiGatewayService } from "./providers/ai-gateway.service";
import { AiLevelService } from "./profile/ai-level.service";
import { AiConversationService } from "./conversation/ai-conversation.service";
import { AiContextService } from "./context/ai-context.service";
import { AiPromptService } from "./chat/ai-prompt.service";
import { AiChatService } from "./chat/ai-chat.service";
import { AiEmbedService } from "./embeds/ai-embed.service";
import { AiEmbeddingService } from "./embeds/ai-embedding.service";
import { AiGatewayEmbeddingAdapter } from "./embeds/ai-gateway-embedding.adapter";

@Module({
  imports: [
    LoggerModule.register("AI"),
    MongooseModule.forFeature([
      { name: AiProfile.name, schema: AiProfileSchema },
      { name: AiThread.name, schema: AiThreadSchema },
      { name: AiMessage.name, schema: AiMessageSchema },
      { name: AiEmbed.name, schema: AiEmbedSchema },
      { name: AiEmbedEvent.name, schema: AiEmbedEventSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiGatewayService,
    AiLevelService,
    AiConversationService,
    AiContextService,
    AiPromptService,
    AiChatService,
    AiEmbedService,
    AiEmbeddingService,
    AiGatewayEmbeddingAdapter,
  ],
  exports: [
    AiGatewayService,
    AiLevelService,
    AiConversationService,
    AiContextService,
    AiPromptService,
    AiChatService,
    AiEmbedService,
    AiEmbeddingService,
    AiGatewayEmbeddingAdapter,
  ],
})
export class AiModule {}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { CurrentUser } from "@common";
import { ROUTES, type JwtPayload } from "@types";
import {
  AiCompleteDTO,
  AiCreateEmbedDTO,
  AiEmbedEventDTO,
  AiEmbedTextDTO,
  AiSetGoalsDTO,
  AiSetLevelDTO,
  AiStreamDTO,
} from "./dto";
import { AiChatService } from "./chat/ai-chat.service";
import { AiGatewayService } from "./providers/ai-gateway.service";
import { AiContextService } from "./context/ai-context.service";
import { AiConversationService } from "./conversation/ai-conversation.service";
import { AiEmbeddingService } from "./embeds/ai-embedding.service";
import { AiEmbedService } from "./embeds/ai-embed.service";
import { AiLevelService } from "./profile/ai-level.service";
import { toPositiveInt } from "./utils/text";

@Controller(ROUTES.AI.BASE)
export class AiController {
  constructor(
    private readonly chat: AiChatService,
    private readonly gateways: AiGatewayService,
    private readonly context: AiContextService,
    private readonly conversations: AiConversationService,
    private readonly levels: AiLevelService,
    private readonly embeddings: AiEmbeddingService,
    private readonly embeds: AiEmbedService,
  ) {}

  @Get(ROUTES.AI.PROVIDERS)
  @HttpCode(200)
  providers() {
    return { providers: this.gateways.list(), active: this.gateways.provider, runtime: this.gateways.runtime };
  }

  @Get(ROUTES.AI.HEALTH)
  @HttpCode(200)
  async health() {
    const startedAt = performance.now();

    try {
      const result = await this.gateways.complete([{ role: "user", content: "ping" }], {
        maxTokens: 8,
        timeoutMs: 5000,
      });

      return {
        ok: true,
        provider: result.provider,
        runtime: result.runtime,
        model: result.model,
        latencyMs: Math.round(performance.now() - startedAt),
        bypassed: result.bypassed,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.gateways.provider,
        runtime: this.gateways.runtime,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Math.round(performance.now() - startedAt),
      };
    }
  }

  @Post(ROUTES.AI.COMPLETE)
  @HttpCode(200)
  async complete(@CurrentUser() user: JwtPayload, @Body() body: AiCompleteDTO) {
    return this.chat.complete({ userId: user.sub, threadId: body.threadId, question: body.question, withEmbeds: true });
  }

  @Post(ROUTES.AI.STREAM)
  @Sse()
  stream(@CurrentUser() user: JwtPayload, @Body() body: AiStreamDTO): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    void (async () => {
      try {
        for await (const event of this.chat.stream({
          userId: user.sub,
          threadId: body.threadId,
          question: body.question,
          withEmbeds: true,
        })) {
          if ("delta" in event) subject.next({ type: "delta", data: { delta: event.delta } });
          else if ("meta" in event) subject.next({ type: "meta", data: event.meta });
          else subject.next({ type: "reply", data: event.reply });
        }

        subject.next({ type: "done", data: { done: true } });
      } catch (error) {
        subject.next({ type: "error", data: { message: error instanceof Error ? error.message : String(error) } });
      } finally {
        subject.complete();
      }
    })();

    return subject.asObservable();
  }

  @Post(ROUTES.AI.EMBED)
  @HttpCode(200)
  async embed(@Body() body: AiEmbedTextDTO) {
    const [vector] = await this.embeddings.embed([body.text]);
    if (!vector) throw new BadRequestException("EMBEDDINGS_UNAVAILABLE");

    return { dimensions: vector.length, vector, provider: this.gateways.provider, model: this.gateways.model };
  }

  @Get(ROUTES.AI.THREADS)
  @HttpCode(200)
  async threads(@CurrentUser() user: JwtPayload, @Query("limit") limit?: string) {
    const documents = await this.conversations.listThreads(user.sub, toPositiveInt(limit, 20));
    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      provider: document.provider,
      runtime: document.runtime,
      model: document.model,
      messageCount: document.message_count,
      lastMessageAt: document.last_message_at,
    }));
  }

  @Get(ROUTES.AI.THREAD)
  @HttpCode(200)
  async thread(@CurrentUser() user: JwtPayload, @Param("threadId") threadId: string) {
    const thread = await this.conversations.findThread(user.sub, threadId);
    if (!thread) throw new NotFoundException();

    const [messages, embeds] = await Promise.all([
      this.conversations.threadMessages(thread.id, user.sub),
      this.embeds.listForThread(user.sub, thread.id),
    ]);

    return {
      id: thread.id,
      title: thread.title,
      provider: thread.provider,
      runtime: thread.runtime,
      model: thread.model,
      messageCount: thread.message_count,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        tokens: message.tokens,
        provider: message.provider,
        model: message.model,
        latencyMs: message.latency_ms,
        embedIds: message.embed_ids,
        createdAt: (message as unknown as { createdAt?: Date }).createdAt,
      })),
      embeds: embeds.map((embed) => ({
        id: embed.id,
        messageId: embed.message_id,
        kind: embed.kind,
        title: embed.title,
        props: embed.props,
        revision: embed.revision,
      })),
    };
  }

  @Post(ROUTES.AI.THREAD_MESSAGES)
  @HttpCode(200)
  async appendMessage(
    @CurrentUser() user: JwtPayload,
    @Param("threadId") threadId: string,
    @Body() body: AiCompleteDTO,
  ) {
    return this.chat.complete({ userId: user.sub, threadId, question: body.question, withEmbeds: true });
  }

  @Patch(`${ROUTES.AI.THREAD}/archive`)
  @HttpCode(200)
  async archive(@CurrentUser() user: JwtPayload, @Param("threadId") threadId: string) {
    const archived = await this.conversations.archiveThread(user.sub, threadId);
    if (!archived) throw new NotFoundException();

    return { archived };
  }

  @Get(ROUTES.AI.PROFILE)
  @HttpCode(200)
  async profile(@CurrentUser() user: JwtPayload) {
    const context = await this.context.build(user.sub);

    return {
      level: context.level,
      skills: context.skills,
      weakAreas: context.weakAreas,
      recurringMistakes: context.recurringMistakes,
      goals: context.goals,
      sampled: { threads: context.threadsSampled, turns: context.summarizedTurns },
    };
  }

  @Patch(`${ROUTES.AI.PROFILE}/level`)
  @HttpCode(200)
  async setLevel(@CurrentUser() user: JwtPayload, @Body() body: AiSetLevelDTO) {
    return this.levels.setDeclaredLevel(user.sub, body.level);
  }

  @Patch(`${ROUTES.AI.PROFILE}/goals`)
  @HttpCode(200)
  async setGoals(@CurrentUser() user: JwtPayload, @Body() body: AiSetGoalsDTO) {
    return this.levels.setGoals(user.sub, body.goals);
  }

  @Get(ROUTES.AI.EMBEDS)
  @HttpCode(200)
  async embedsForThread(@CurrentUser() user: JwtPayload, @Query("threadId") threadId: string) {
    const documents = await this.embeds.listForThread(user.sub, threadId);
    return documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      props: document.props,
      revision: document.revision,
    }));
  }

  @Post(ROUTES.AI.EMBEDS)
  @HttpCode(201)
  async createEmbed(@CurrentUser() user: JwtPayload, @Body() body: AiCreateEmbedDTO) {
    const normalized = AiEmbedService.normalize(body);
    if (!normalized) throw new BadRequestException("INVALID_EMBED_PAYLOAD");

    const embed = await this.embeds.create({
      userId: user.sub,
      threadId: body.threadId,
      messageId: body.messageId,
      kind: normalized.kind,
      title: normalized.title,
      props: normalized.props,
    });

    return { id: embed.id, kind: embed.kind, title: embed.title, props: embed.props, revision: embed.revision };
  }

  @Get(ROUTES.AI.EMBED)
  @HttpCode(200)
  async embedById(@CurrentUser() user: JwtPayload, @Param("embedId") embedId: string) {
    const embed = await this.embeds.find(user.sub, embedId);
    if (!embed) throw new NotFoundException();

    return { id: embed.id, kind: embed.kind, title: embed.title, props: embed.props, revision: embed.revision };
  }

  @Post(ROUTES.AI.EMBED_EVENTS)
  @HttpCode(201)
  async embedEvent(@CurrentUser() user: JwtPayload, @Param("embedId") embedId: string, @Body() body: AiEmbedEventDTO) {
    const result = await this.embeds.recordEvent(user.sub, embedId, body.type, body.payload ?? {});
    if (!result) throw new NotFoundException();

    return result;
  }
}

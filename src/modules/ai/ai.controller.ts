import { Body, Controller, Get, HttpCode, MessageEvent, Param, Patch, Post, Query, Sse } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { CurrentUser } from "@common";
import { type JwtPayload } from "@types";
import { AI_ROUTES as ROUTES } from "./ai.routes";
import {
  AiCompleteDTO,
  AiCreateEmbedDTO,
  AiDiagnosticsDTO,
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
import { AiEmbedRepository } from "./embeds/ai-embed.repository";
import { AiLevelService } from "./profile/ai-level.service";
import { AiHealthService } from "./health/ai-health.service";
import { AiDiagnosticsService } from "./diagnostics/ai-diagnostics.service";
import { AiException } from "./errors/ai-exception";
import { AiErrorClassifier } from "./errors/ai-error-classifier";
import { AI_ERROR_CATALOG } from "./errors/ai-error-catalog";
import { toPositiveInt } from "./utils/ai-text.utils";

@Controller(ROUTES.BASE)
export class AiController {
  constructor(
    private readonly chat: AiChatService,
    private readonly gateways: AiGatewayService,
    private readonly context: AiContextService,
    private readonly conversations: AiConversationService,
    private readonly levels: AiLevelService,
    private readonly embeddings: AiEmbeddingService,
    private readonly embeds: AiEmbedRepository,
    private readonly health: AiHealthService,
    private readonly diagnostics: AiDiagnosticsService,
  ) {}

  @Get(ROUTES.PROVIDERS)
  @HttpCode(200)
  providers() {
    return {
      providers: this.gateways.list(),
      active: this.gateways.provider,
      runtime: this.gateways.runtime,
      route: this.gateways.route(),
      embedKinds: ["game", "flashcards"],
      levels: ["A1", "A2", "B1", "B2", "C1", "C2"],
    };
  }

  @Get(ROUTES.HEALTH)
  @HttpCode(200)
  async healthCheck() {
    return this.health.check();
  }

  @Get(ROUTES.DIAGNOSTICS)
  @HttpCode(200)
  async diagnosticsReport(@Query() query: AiDiagnosticsDTO) {
    return this.diagnostics.report({ probe: query.probe === true });
  }

  @Get(ROUTES.ERRORS)
  @HttpCode(200)
  errors() {
    return { errors: this.diagnostics.catalog() };
  }

  @Get(ROUTES.PROVIDER_DETAIL)
  @HttpCode(200)
  async providerDetail(@Param("provider") provider: string) {
    const gateway = this.gateways.resolve(provider);

    return { info: this.gateways.describe(gateway), probe: await this.gateways.probe(gateway.provider as never) };
  }

  @Post(ROUTES.COMPLETE)
  @HttpCode(200)
  async complete(@CurrentUser() user: JwtPayload, @Body() body: AiCompleteDTO) {
    return this.chat.complete({
      userId: user.sub,
      threadId: body.threadId,
      question: body.question,
      withEmbeds: body.withEmbeds ?? true,
    });
  }

  @Post(ROUTES.STREAM)
  @Sse()
  stream(@CurrentUser() user: JwtPayload, @Body() body: AiStreamDTO): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    void (async () => {
      try {
        for await (const event of this.chat.stream({
          userId: user.sub,
          threadId: body.threadId,
          question: body.question,
          withEmbeds: body.withEmbeds ?? true,
        })) {
          if ("delta" in event) subject.next({ type: "delta", data: { delta: event.delta } });
          else if ("meta" in event) subject.next({ type: "meta", data: event.meta });
          else subject.next({ type: "reply", data: event.reply });
        }

        subject.next({ type: "done", data: { done: true } });
      } catch (error) {
        subject.next({ type: "error", data: this.toStreamError(error) });
      } finally {
        subject.complete();
      }
    })();

    return subject.asObservable();
  }

  @Post(ROUTES.EMBED)
  @HttpCode(200)
  async embed(@Body() body: AiEmbedTextDTO) {
    const [vector] = await this.embeddings.embed([body.text]);
    if (!vector) throw new AiException("AI_EMBEDDINGS_UNAVAILABLE", { details: { reason: "empty-vector" } });

    return { dimensions: vector.length, vector, provider: this.gateways.provider, model: this.gateways.model };
  }

  @Get(ROUTES.THREADS)
  @HttpCode(200)
  async threads(@CurrentUser() user: JwtPayload, @Query("limit") limit?: string) {
    return this.conversations.list(user.sub, toPositiveInt(limit, 20, 50));
  }

  @Get(ROUTES.THREAD)
  @HttpCode(200)
  async thread(@CurrentUser() user: JwtPayload, @Param("threadId") threadId: string) {
    const thread = await this.conversations.require(user.sub, threadId);

    const [messages, embeds] = await Promise.all([
      this.conversations.messages(user.sub, thread.id),
      this.embeds.listForThread(user.sub, thread.id),
    ]);

    return {
      id: thread.id,
      title: thread.title,
      provider: thread.provider,
      runtime: thread.runtime,
      model: thread.model,
      messageCount: thread.message_count,
      messages,
      embeds,
    };
  }

  @Post(ROUTES.THREAD_MESSAGES)
  @HttpCode(200)
  async appendMessage(
    @CurrentUser() user: JwtPayload,
    @Param("threadId") threadId: string,
    @Body() body: AiCompleteDTO,
  ) {
    return this.chat.complete({
      userId: user.sub,
      threadId,
      question: body.question,
      withEmbeds: body.withEmbeds ?? true,
    });
  }

  @Patch(ROUTES.THREAD_ARCHIVE)
  @HttpCode(200)
  async archive(@CurrentUser() user: JwtPayload, @Param("threadId") threadId: string) {
    return { archived: await this.conversations.archive(user.sub, threadId) };
  }

  @Get(ROUTES.PROFILE)
  @HttpCode(200)
  async profile(@CurrentUser() user: JwtPayload) {
    const context = await this.context.build(user.sub);

    return {
      level: context.level,
      skills: context.skills,
      weakAreas: context.weakAreas,
      recurringMistakes: context.recurringMistakes,
      goals: context.goals,
      sampled: { threads: context.threadsSampled, turns: context.summarizedTurns, tokens: context.tokensEstimate },
    };
  }

  @Patch(ROUTES.PROFILE_LEVEL)
  @HttpCode(200)
  async setLevel(@CurrentUser() user: JwtPayload, @Body() body: AiSetLevelDTO) {
    return this.levels.setDeclaredLevel(user.sub, body.level);
  }

  @Patch(ROUTES.PROFILE_GOALS)
  @HttpCode(200)
  async setGoals(@CurrentUser() user: JwtPayload, @Body() body: AiSetGoalsDTO) {
    return this.levels.setGoals(user.sub, body.goals);
  }

  @Get(ROUTES.EMBEDS)
  @HttpCode(200)
  async embedsForThread(@CurrentUser() user: JwtPayload, @Query("threadId") threadId: string) {
    return this.embeds.listForThread(user.sub, threadId);
  }

  @Post(ROUTES.EMBEDS)
  @HttpCode(201)
  async createEmbed(@CurrentUser() user: JwtPayload, @Body() body: AiCreateEmbedDTO) {
    const normalized = AiEmbedRepository.normalize(body);
    if (!normalized) {
      throw new AiException("AI_EMBED_PAYLOAD_INVALID", {
        details: { kind: body.kind, required: body.kind === "game" ? "props.items[]" : "props.cards[]" },
      });
    }

    return this.embeds.create({
      userId: user.sub,
      threadId: body.threadId,
      messageId: body.messageId,
      kind: normalized.kind,
      title: normalized.title,
      props: normalized.props,
    });
  }

  @Get(ROUTES.EMBED_DETAIL)
  @HttpCode(200)
  async embedById(@CurrentUser() user: JwtPayload, @Param("embedId") embedId: string) {
    return this.embeds.require(user.sub, embedId);
  }

  @Post(ROUTES.EMBED_EVENTS)
  @HttpCode(201)
  async embedEvent(@CurrentUser() user: JwtPayload, @Param("embedId") embedId: string, @Body() body: AiEmbedEventDTO) {
    return this.embeds.recordEvent(user.sub, embedId, body.type, body.payload ?? {});
  }

  private toStreamError(error: unknown): Record<string, unknown> {
    const classification = AiErrorClassifier.classify(error);
    const code = classification?.code ?? "AI_STREAM_INTERRUPTED";

    return {
      code,
      message: error instanceof Error ? error.message : AI_ERROR_CATALOG[code].message,
      hint: AI_ERROR_CATALOG[code].hint,
      transient: AI_ERROR_CATALOG[code].transient,
    };
  }
}

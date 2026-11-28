import { Inject, Injectable } from "@nestjs/common";
import { AiGatewayService } from "../providers/ai-gateway.service";
import { AiPromptService } from "./ai-prompt.service";
import { AiConversationService } from "../conversation/ai-conversation.service";
import { AiEmbedRepository, type AiEmbedView } from "../embeds/ai-embed.repository";
import { AiLevelService } from "../profile/ai-level.service";
import { AiException } from "../errors/ai-exception";
import { AiLogger } from "../errors/ai-logger";
import { AiErrorClassifier } from "../errors/ai-error-classifier";
import { AI_LOGGER, AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";
import type { AiCefrLevel, AiPromptPlan } from "../profile/ai-level.types";
import type { AiStreamChunk, AiUsage } from "../providers/ai-provider.types";
import { estimateTokens } from "../utils/ai-text.utils";

export interface AiChatRequest {
  userId: string;
  threadId?: string;
  question: string;
  withEmbeds?: boolean;
}

export interface AiChatReply {
  threadId: string;
  messageId: string;
  content: string;
  embeds: { id: string; kind: string; title: string; props: Record<string, unknown> }[];
  provider: string;
  runtime: string;
  model: string;
  level: { declared: AiCefrLevel; effective: AiCefrLevel; confidence: number };
  usage?: AiUsage;
  latencyMs: number;
  bypassed: boolean;
}

export type AiStreamEvent = AiStreamChunk | { meta: Record<string, unknown> } | { reply: AiChatReply };

@Injectable()
export class AiChatService {
  constructor(
    private readonly gateways: AiGatewayService,
    private readonly prompts: AiPromptService,
    private readonly conversations: AiConversationService,
    private readonly embeds: AiEmbedRepository,
    private readonly levels: AiLevelService,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
    @Inject(AI_LOGGER) private readonly logger: AiLogger,
  ) {}

  async complete(request: AiChatRequest): Promise<AiChatReply> {
    const question = this.normalize(request.question);
    const plan = await this.plan(request, question);

    const [completion] = await Promise.all([
      this.gateways.complete(plan.messages, { bypass: plan.bypass }),
      this.observeTurn(request.userId, question),
    ]);

    return this.persist({ ...request, threadId: request.threadId }, plan, completion.content, {
      latencyMs: completion.latencyMs,
      usage: completion.usage,
      bypassed: completion.bypassed,
      question,
    });
  }

  async *stream(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    const question = this.normalize(request.question);
    const plan = await this.plan(request, question);
    const threadId = await this.ensureThread(request, plan);
    const startedAt = performance.now();

    let buffer = "";
    let observed = false;

    yield {
      meta: { threadId, provider: plan.provider, runtime: plan.runtime, model: plan.model, level: plan.context.level },
    };

    try {
      for await (const chunk of this.gateways.stream(plan.messages, { bypass: plan.bypass })) {
        if (!observed) {
          observed = true;
          void this.observeTurn(request.userId, question);
        }

        if (chunk.delta) {
          buffer += chunk.delta;
          yield { delta: chunk.delta, done: false };
        }

        if (chunk.done) break;
      }
    } catch (error) {
      const classification = AiErrorClassifier.classify(error);
      this.logger.failure("stream", error, plan.provider);

      throw new AiException(classification?.code ?? "AI_STREAM_INTERRUPTED", {
        provider: plan.provider,
        cause: error,
        details: {
          threadId,
          receivedChars: buffer.length,
          ...(classification?.providerStatus ? { status: classification.providerStatus } : {}),
        },
      });
    }

    const reply = await this.persist({ ...request, threadId }, plan, buffer, {
      latencyMs: Math.round(performance.now() - startedAt),
      bypassed: plan.bypass,
      question,
    });

    yield { reply };
  }

  private async plan(request: AiChatRequest, question: string): Promise<AiPromptPlan> {
    return request.withEmbeds
      ? this.prompts.planWithEmbed(request.userId, question, request.threadId)
      : this.prompts.plan(request.userId, question, request.threadId);
  }

  private async ensureThread(request: AiChatRequest, plan: AiPromptPlan): Promise<string> {
    if (request.threadId) {
      const existing = await this.conversations.find(request.userId, request.threadId);
      if (existing) return existing.id;
    }

    const thread = await this.conversations.create({
      userId: request.userId,
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
    });

    return thread.id;
  }

  private async persist(
    request: AiChatRequest,
    plan: AiPromptPlan,
    raw: string,
    completion: { latencyMs: number; usage?: AiUsage; bypassed: boolean; question: string },
  ): Promise<AiChatReply> {
    const threadId = request.threadId ?? (await this.ensureThread(request, plan));
    const parsed = this.prompts.parseEmbedBlock(raw);
    const content = parsed.text || raw;

    await this.conversations.append({
      userId: request.userId,
      threadId,
      role: "user",
      content: completion.question,
      tokens: estimateTokens(completion.question),
    });

    const assistant = await this.conversations.append({
      userId: request.userId,
      threadId,
      role: "assistant",
      content,
      tokens: estimateTokens(content),
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
      latencyMs: completion.latencyMs,
    });

    const embed = await this.createEmbed(request.userId, threadId, assistant.id, parsed.payload);

    if (embed) await this.conversations.attachEmbeds(assistant.id, [embed.id]);

    return {
      threadId,
      messageId: assistant.id,
      content,
      embeds: embed ? [embed] : [],
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
      level: {
        declared: plan.context.level.declared,
        effective: plan.context.level.effective,
        confidence: plan.context.level.confidence,
      },
      usage: completion.usage,
      latencyMs: completion.latencyMs,
      bypassed: completion.bypassed,
    };
  }

  private async createEmbed(
    userId: string,
    threadId: string,
    messageId: string,
    payload: unknown,
  ): Promise<AiEmbedView | null> {
    const normalized = AiEmbedRepository.normalize(payload);
    if (!normalized) {
      if (payload !== null) {
        this.logger.provider(
          "chat",
          "create-embed",
          "model returned an embed block that does not match its kind",
          "warn",
        );
      }

      return null;
    }

    const embed = await this.embeds.create({
      userId,
      threadId,
      messageId,
      kind: normalized.kind,
      title: normalized.title,
      props: normalized.props,
    });

    return { id: embed.id, kind: embed.kind, title: embed.title, props: embed.props, revision: embed.revision };
  }

  private async observeTurn(userId: string, question: string): Promise<void> {
    try {
      await this.levels.observeUserTurn(userId, question);
    } catch (error) {
      this.logger.failure("observe-turn", error);
    }
  }

  private normalize(question: string): string {
    const trimmed = typeof question === "string" ? question.trim() : "";

    if (trimmed.length === 0) throw new AiException("AI_QUESTION_EMPTY");
    if (trimmed.length > this.config.limits.maxQuestionChars) {
      throw new AiException("AI_QUESTION_TOO_LONG", {
        details: { length: trimmed.length, limit: this.config.limits.maxQuestionChars },
      });
    }

    return trimmed;
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AI_CEFR_LEVELS,
  type AiCefrLevel,
  type IAiCompletionResult,
  type IAiEmbedPayload,
  type IAiPromptPlan,
  type IAiStreamChunk,
} from "@types";
import { AiConversationService } from "../conversation/ai-conversation.service";
import { AiEmbedService } from "../embeds/ai-embed.service";
import { AiLevelService } from "../profile/ai-level.service";
import { AiPromptService, parseEmbedBlock } from "./ai-prompt.service";
import { AiGatewayService } from "../providers/ai-gateway.service";
import { estimateTokens } from "../utils/text";

export interface ChatRequest {
  userId: string;
  threadId?: string;
  question: string;
  withEmbeds?: boolean;
}

export interface ChatReply {
  threadId: string;
  messageId: string;
  content: string;
  embeds: { id: string; kind: string; title: string; props: Record<string, unknown> }[];
  provider: string;
  runtime: string;
  model: string;
  level: { declared: AiCefrLevel; effective: AiCefrLevel; confidence: number };
  usage: IAiCompletionResult["usage"];
  latencyMs: number;
  bypassed: boolean;
}

@Injectable()
export class AiChatService {
  constructor(
    private readonly gateways: AiGatewayService,
    private readonly prompts: AiPromptService,
    private readonly conversations: AiConversationService,
    private readonly embeds: AiEmbedService,
    private readonly levels: AiLevelService,
  ) {}

  async complete(request: ChatRequest): Promise<ChatReply> {
    const question = this.normalize(request.question);
    const plan = await this.plan(request, question);

    const [completion] = await Promise.all([
      this.gateways.complete(plan.messages, { bypass: true }),
      this.levels.observeUserTurn(request.userId, question),
    ]);

    return this.persist(request, plan, completion.content, completion);
  }

  async *stream(
    request: ChatRequest,
  ): AsyncIterable<IAiStreamChunk | { meta: Record<string, unknown> } | { reply: ChatReply }> {
    const question = this.normalize(request.question);
    const plan = await this.plan(request, question);

    const threadId = await this.ensureThread(request, plan);
    const startedAt = performance.now();

    let buffer = "";
    let first = true;

    yield {
      meta: { threadId, provider: plan.provider, runtime: plan.runtime, model: plan.model, level: plan.context.level },
    };

    for await (const chunk of this.gateways.stream(plan.messages, { bypass: true })) {
      if (first) {
        first = false;
        this.levels.observeUserTurn(request.userId, question).catch(() => undefined);
      }

      if (chunk.delta) {
        buffer += chunk.delta;
        yield { delta: chunk.delta, done: false };
      }

      if (chunk.done) break;
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    const reply = await this.persist({ ...request, threadId }, plan, buffer, { latencyMs }, question);

    yield { reply };
  }

  private async plan(request: ChatRequest, question: string): Promise<IAiPromptPlan> {
    return request.withEmbeds
      ? this.prompts.planWithEmbed(request.userId, question, request.threadId)
      : this.prompts.plan(request.userId, question, request.threadId);
  }

  private async ensureThread(request: ChatRequest, plan: IAiPromptPlan): Promise<string> {
    if (request.threadId) {
      const existing = await this.conversations.findThread(request.userId, request.threadId);
      if (existing) return existing.id;
    }

    const thread = await this.conversations.createThread({
      userId: request.userId,
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
    });

    return thread.id;
  }

  private async persist(
    request: ChatRequest,
    plan: IAiPromptPlan,
    raw: string,
    completion: { latencyMs?: number; usage?: IAiCompletionResult["usage"]; bypassed?: boolean },
    question?: string,
  ): Promise<ChatReply> {
    const threadId = request.threadId ?? (await this.ensureThread(request, plan));
    const userContent = question ?? this.normalize(request.question);
    const parsed = parseEmbedBlock(raw);

    await this.conversations.appendMessage({
      userId: request.userId,
      threadId,
      role: "user",
      content: userContent,
      tokens: estimateTokens(userContent),
    });

    const assistant = await this.conversations.appendMessage({
      userId: request.userId,
      threadId,
      role: "assistant",
      content: parsed.text || raw,
      tokens: estimateTokens(parsed.text || raw),
      status: "complete",
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
      latencyMs: completion.latencyMs ?? 0,
    });

    const created = await this.createEmbeds(request.userId, threadId, assistant?.id ?? "", parsed.payload);

    if (created.length > 0 && assistant) {
      await this.conversations.attachEmbeds(
        assistant.id,
        created.map((embed) => embed.id),
      );
    }

    return {
      threadId,
      messageId: assistant?.id ?? "",
      content: parsed.text || raw,
      embeds: created,
      provider: plan.provider,
      runtime: plan.runtime,
      model: plan.model,
      level: {
        declared: plan.context.level.declared,
        effective: plan.context.level.effective,
        confidence: plan.context.level.confidence,
      },
      usage: completion.usage,
      latencyMs: completion.latencyMs ?? 0,
      bypassed: completion.bypassed ?? true,
    };
  }

  private async createEmbeds(
    userId: string,
    threadId: string,
    messageId: string,
    payload: unknown,
  ): Promise<{ id: string; kind: string; title: string; props: Record<string, unknown> }[]> {
    const normalized = AiEmbedService.normalize(payload);
    if (!normalized || !messageId) return [];

    const embed = await this.embeds.create({
      userId,
      threadId,
      messageId,
      kind: normalized.kind,
      title: normalized.title,
      props: normalized.props,
    });

    return [{ id: embed.id, kind: embed.kind, title: embed.title, props: embed.props }];
  }

  private normalize(question: string): string {
    const trimmed = question?.trim() ?? "";
    if (trimmed.length < 1) throw new BadRequestException("question is required");

    return trimmed;
  }
}

export function isCefrLevel(value: unknown): value is AiCefrLevel {
  return typeof value === "string" && (AI_CEFR_LEVELS as readonly string[]).includes(value);
}

export type { IAiEmbedPayload };

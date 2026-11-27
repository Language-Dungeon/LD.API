import { Inject, Injectable } from "@nestjs/common";
import { AiThreadRepository } from "./ai-thread.repository";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";
import type { AiMessageDocument, AiThreadDocument } from "../schemas/ai-records";

const USER_TURN_SAMPLE = 40;
const THREAD_SAMPLE = 5;
const THREAD_TURN_LIMIT = 8;
const SUMMARY_CHAR_LIMIT = 220;

export interface AiThreadSummary {
  id: string;
  title: string;
  provider: string;
  runtime: string;
  model: string;
  messageCount: number;
  lastMessageAt: Date;
}

export interface AiMessageView {
  id: string;
  role: string;
  content: string;
  tokens: number;
  provider: string;
  model: string;
  latencyMs: number;
  embedIds: string[];
  createdAt?: Date;
}

@Injectable()
export class AiConversationService {
  constructor(
    private readonly threads: AiThreadRepository,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
  ) {}

  async create(input: { userId: string; provider: string; runtime: string; model: string }): Promise<AiThreadDocument> {
    return this.threads.create(input);
  }

  async list(userId: string, limit: number): Promise<AiThreadSummary[]> {
    const documents = await this.threads.list(userId, limit);

    return documents.map((document) => this.toSummary(document));
  }

  async require(userId: string, threadId: string): Promise<AiThreadDocument> {
    return this.threads.require(userId, threadId);
  }

  async find(userId: string, threadId: string): Promise<AiThreadDocument | null> {
    return this.threads.find(userId, threadId);
  }

  async messages(userId: string, threadId: string): Promise<AiMessageView[]> {
    const documents = await this.threads.messages(threadId, userId, this.config.limits.maxHistoryMessages);

    return documents.map((document) => this.toMessageView(document));
  }

  async history(userId: string, threadId: string, limit: number): Promise<{ role: string; content: string }[]> {
    return this.threads.history(threadId, userId, limit);
  }

  async recentThreads(userId: string, limit = THREAD_SAMPLE): Promise<AiThreadDocument[]> {
    return this.threads.recent(userId, limit);
  }

  async userTurns(userId: string, limit = USER_TURN_SAMPLE): Promise<{ role: string; content: string }[]> {
    return this.threads.userTurns(userId, limit);
  }

  async append(input: {
    userId: string;
    threadId: string;
    role: string;
    content: string;
    tokens: number;
    provider?: string;
    runtime?: string;
    model?: string;
    latencyMs?: number;
    status?: string;
  }): Promise<AiMessageDocument> {
    return this.threads.append(input);
  }

  async attachEmbeds(messageId: string, embedIds: readonly string[]): Promise<void> {
    return this.threads.attachEmbeds(messageId, embedIds);
  }

  async archive(userId: string, threadId: string): Promise<boolean> {
    return this.threads.archive(userId, threadId);
  }

  async sampleOtherThreads(
    userId: string,
    currentThreadId?: string,
  ): Promise<{ thread: AiThreadDocument; messages: { role: string; content: string }[] }[]> {
    const threads = await this.recentThreads(userId, THREAD_SAMPLE + 1);
    const sampled = threads.filter((thread) => thread.id !== currentThreadId).slice(0, THREAD_SAMPLE);

    return Promise.all(
      sampled.map(async (thread) => ({
        thread,
        messages: await this.history(userId, thread.id, THREAD_TURN_LIMIT),
      })),
    );
  }

  summarize(
    histories: { thread: { title: string; message_count: number; last_message_at: Date }; messages: { role: string; content: string }[] }[],
  ): { role: string; content: string }[] {
    const lines: string[] = [];

    for (const { thread, messages } of histories) {
      const userLines = messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.replace(/\s+/g, " ").slice(0, SUMMARY_CHAR_LIMIT));

      if (userLines.length === 0) continue;

      const last = new Date(thread.last_message_at).toISOString().slice(0, 10);
      lines.push(`- "${thread.title}" (${thread.message_count} messages, last ${last}): ${userLines.join(" | ")}`);
    }

    if (lines.length === 0) return [];

    return [{ role: "user", content: `Previous conversations summary:\n${lines.join("\n")}` }];
  }

  private toSummary(document: AiThreadDocument): AiThreadSummary {
    return {
      id: document.id,
      title: document.title,
      provider: document.provider,
      runtime: document.runtime,
      model: document.model,
      messageCount: document.message_count,
      lastMessageAt: document.last_message_at,
    };
  }

  private toMessageView(document: AiMessageDocument): AiMessageView {
    return {
      id: document.id,
      role: document.role,
      content: document.content,
      tokens: document.tokens,
      provider: document.provider,
      model: document.model,
      latencyMs: document.latency_ms,
      embedIds: document.embed_ids,
      createdAt: (document as unknown as { createdAt?: Date }).createdAt,
    };
  }
}

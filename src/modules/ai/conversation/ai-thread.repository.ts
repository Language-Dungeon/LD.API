import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AiMessage, AiThread } from "../schemas/ai.schemas";
import type { AiMessageDocument, AiThreadDocument } from "../schemas/ai-records";
import { AiException } from "../errors/ai-exception";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";
import { isObjectId } from "../schemas/ai-records";

export interface AiCreateThreadInput {
  userId: string;
  title?: string;
  provider: string;
  runtime: string;
  model: string;
}

export interface AiAppendMessageInput {
  userId: string;
  threadId: string;
  role: string;
  content: string;
  tokens: number;
  status?: string;
  provider?: string;
  runtime?: string;
  model?: string;
  latencyMs?: number;
}

const TITLE_MAX_LENGTH = 60;
const DEFAULT_TITLE = "Nowa rozmowa";
const ACTIVE = "active";
const ARCHIVED = "archived";

@Injectable()
export class AiThreadRepository {
  constructor(
    @InjectModel(AiThread.name) private readonly threads: Model<AiThread>,
    @InjectModel(AiMessage.name) private readonly messageModel: Model<AiMessage>,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
  ) {}

  async create(input: AiCreateThreadInput): Promise<AiThreadDocument> {
    try {
      return await this.threads.create({
        user_id: input.userId,
        title: input.title?.trim() || DEFAULT_TITLE,
        status: ACTIVE,
        provider: input.provider,
        runtime: input.runtime,
        model: input.model,
        last_message_at: new Date(),
      });
    } catch (error) {
      throw this.storageFailure("create-thread", error);
    }
  }

  async list(userId: string, limit: number): Promise<AiThreadDocument[]> {
    try {
      return await this.threads
        .find({ user_id: userId, status: ACTIVE })
        .sort({ last_message_at: -1 })
        .limit(this.bound(limit, this.config.limits.maxThreads))
        .lean<AiThreadDocument[]>();
    } catch (error) {
      throw this.storageFailure("list-threads", error);
    }
  }

  async recent(userId: string, limit: number): Promise<AiThreadDocument[]> {
    try {
      return await this.threads
        .find({ user_id: userId })
        .sort({ last_message_at: -1 })
        .limit(this.bound(limit, this.config.limits.maxThreads))
        .lean<AiThreadDocument[]>();
    } catch (error) {
      throw this.storageFailure("recent-threads", error);
    }
  }

  async find(userId: string, threadId: string): Promise<AiThreadDocument | null> {
    if (!isObjectId(threadId)) return null;

    try {
      return await this.threads.findOne({ _id: threadId, user_id: userId });
    } catch (error) {
      throw this.storageFailure("find-thread", error);
    }
  }

  async require(userId: string, threadId: string): Promise<AiThreadDocument> {
    const thread = await this.find(userId, threadId);
    if (!thread) {
      throw new AiException("AI_THREAD_NOT_FOUND", {
        details: { threadId, reason: isObjectId(threadId) ? "not-found-or-not-owned" : "malformed-id" },
      });
    }

    return thread;
  }

  async append(input: AiAppendMessageInput): Promise<AiMessageDocument> {
    if (!isObjectId(input.threadId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "threadId", value: input.threadId } });
    }

    try {
      const message = await this.messageModel.create({
        user_id: input.userId,
        thread_id: input.threadId,
        role: input.role,
        content: input.content,
        tokens: input.tokens,
        status: input.status ?? "complete",
        provider: input.provider ?? "",
        runtime: input.runtime ?? "",
        model: input.model ?? "",
        latency_ms: input.latencyMs ?? 0,
        embed_ids: [],
      });

      const createdAt = (message as unknown as { createdAt?: Date }).createdAt ?? new Date();

      await this.threads.updateOne(
        { _id: input.threadId, user_id: input.userId },
        {
          $inc: { message_count: 1, total_tokens: message.tokens },
          $set: {
            last_message_at: createdAt,
            ...(input.provider ? { provider: input.provider } : {}),
            ...(input.runtime ? { runtime: input.runtime } : {}),
            ...(input.model ? { model: input.model } : {}),
          },
        },
      );

      if (input.role === "user") await this.titleIfEmpty(input.threadId, input.userId, input.content);

      return message;
    } catch (error) {
      if (error instanceof AiException) throw error;
      throw this.storageFailure("append-message", error);
    }
  }

  async history(threadId: string, userId: string, limit: number): Promise<{ role: string; content: string }[]> {
    if (!isObjectId(threadId)) return [];

    try {
      const documents = await this.messageModel
        .find({ thread_id: threadId, user_id: userId, status: { $ne: "error" } })
        .sort({ created_at: -1, createdAt: -1 })
        .limit(this.bound(limit, this.config.limits.maxHistoryMessages))
        .select({ role: 1, content: 1 })
        .lean<{ role: string; content: string }[]>();

      return documents.reverse().map((document) => ({ role: document.role, content: document.content }));
    } catch (error) {
      throw this.storageFailure("history", error);
    }
  }

  async messages(threadId: string, userId: string, limit: number): Promise<AiMessageDocument[]> {
    if (!isObjectId(threadId)) return [];

    try {
      const documents = await this.messageModel
        .find({ thread_id: threadId, user_id: userId })
        .sort({ created_at: -1, createdAt: -1 })
        .limit(this.bound(limit, this.config.limits.maxHistoryMessages))
        .lean<AiMessageDocument[]>();

      return documents.reverse();
    } catch (error) {
      throw this.storageFailure("thread-messages", error);
    }
  }

  async userTurns(userId: string, limit: number): Promise<{ role: string; content: string }[]> {
    try {
      const documents = await this.messageModel
        .find({ user_id: userId, role: "user", status: { $ne: "error" } })
        .sort({ created_at: -1, createdAt: -1 })
        .limit(this.bound(limit, this.config.limits.maxHistoryMessages))
        .select({ role: 1, content: 1 })
        .lean<{ role: string; content: string }[]>();

      return documents.reverse().map((document) => ({ role: document.role, content: document.content }));
    } catch (error) {
      throw this.storageFailure("user-turns", error);
    }
  }

  async archive(userId: string, threadId: string): Promise<boolean> {
    if (!isObjectId(threadId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "threadId", value: threadId } });
    }

    try {
      const result = await this.threads.updateOne({ _id: threadId, user_id: userId }, { $set: { status: ARCHIVED } });
      if (result.matchedCount === 0) {
        throw new AiException("AI_THREAD_NOT_FOUND", { details: { threadId } });
      }

      return true;
    } catch (error) {
      if (error instanceof AiException) throw error;
      throw this.storageFailure("archive-thread", error);
    }
  }

  async attachEmbeds(messageId: string, embedIds: readonly string[]): Promise<void> {
    if (embedIds.length === 0 || !isObjectId(messageId)) return;

    try {
      await this.messageModel.updateOne({ _id: messageId }, { $addToSet: { embed_ids: { $each: [...embedIds] } } });
    } catch (error) {
      throw this.storageFailure("attach-embeds", error);
    }
  }

  private async titleIfEmpty(threadId: string, userId: string, content: string): Promise<void> {
    const title = this.deriveTitle(content);

    await this.threads.updateOne({ _id: threadId, user_id: userId, message_count: 0 }, { $set: { title } });
  }

  private deriveTitle(content: string): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length === 0) return DEFAULT_TITLE;

    const sentence = normalized.split(/[.!?\n]/)[0]?.trim() ?? normalized;

    return sentence.length > TITLE_MAX_LENGTH ? `${sentence.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : sentence;
  }

  private bound(limit: number, max: number): number {
    if (!Number.isFinite(limit)) return 1;

    return Math.min(Math.max(Math.trunc(limit), 1), max);
  }

  private storageFailure(operation: string, error: unknown): AiException {
    return new AiException("AI_PERSISTENCE_FAILED", {
      cause: error,
      details: { operation, reason: error instanceof Error ? error.message : String(error) },
    });
  }
}

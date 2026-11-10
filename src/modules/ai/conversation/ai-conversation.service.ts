import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AiMessage, AiThread, type AiMessageDocument, type AiThreadDocument } from "@schemas";
import { AI_THREAD_STATUSES, type AiMessageStatus, type AiRole, type AiRuntime, type IAiChatMessage } from "@types";

const TITLE_MAX_LENGTH = 60;

export interface CreateThreadInput {
  userId: string;
  title?: string;
  provider?: string;
  runtime?: AiRuntime;
  model?: string;
}

export interface AppendMessageInput {
  userId: string;
  threadId: string;
  role: AiRole;
  content: string;
  tokens?: number;
  status?: AiMessageStatus;
  provider?: string;
  runtime?: AiRuntime;
  model?: string;
  latencyMs?: number;
  embedIds?: string[];
}

@Injectable()
export class AiConversationService {
  constructor(
    @InjectModel(AiThread.name) private readonly thread: Model<AiThread>,
    @InjectModel(AiMessage.name) private readonly message: Model<AiMessage>,
  ) {}

  async createThread(input: CreateThreadInput): Promise<AiThreadDocument> {
    return this.thread.create({
      user_id: input.userId,
      title: input.title?.trim() || "Nowa rozmowa",
      status: AI_THREAD_STATUSES[0],
      provider: input.provider ?? "local",
      runtime: input.runtime ?? "local",
      model: input.model ?? "",
      last_message_at: new Date(),
    });
  }

  async listThreads(userId: string, limit = 20): Promise<AiThreadDocument[]> {
    return this.thread
      .find({ user_id: userId, status: AI_THREAD_STATUSES[0] })
      .sort({ last_message_at: -1 })
      .limit(Math.min(Math.max(limit, 1), 50))
      .lean<AiThreadDocument[]>();
  }

  async findThread(userId: string, threadId: string): Promise<AiThreadDocument | null> {
    if (!Types.ObjectId.isValid(threadId)) return null;
    return this.thread.findOne({ _id: threadId, user_id: userId });
  }

  async recentThreads(userId: string, limit = 5): Promise<AiThreadDocument[]> {
    return this.thread
      .find({ user_id: userId })
      .sort({ last_message_at: -1 })
      .limit(Math.min(Math.max(limit, 1), 20))
      .lean<AiThreadDocument[]>();
  }

  async appendMessage(input: AppendMessageInput): Promise<AiMessageDocument | null> {
    if (!Types.ObjectId.isValid(input.threadId)) return null;

    const created = await this.message.create({
      user_id: input.userId,
      thread_id: input.threadId,
      role: input.role,
      content: input.content,
      tokens: input.tokens ?? 0,
      status: input.status ?? "complete",
      provider: input.provider ?? "",
      runtime: input.runtime ?? "",
      model: input.model ?? "",
      latency_ms: input.latencyMs ?? 0,
      embed_ids: input.embedIds ?? [],
    });

    const created_at = (created as unknown as { createdAt?: Date }).createdAt ?? new Date();

    const update: Record<string, unknown> = {
      $inc: { message_count: 1, total_tokens: created.tokens },
      $set: {
        last_message_at: created_at,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.runtime ? { runtime: input.runtime } : {}),
        ...(input.model ? { model: input.model } : {}),
      },
    };

    const title = input.role === "user" ? this.deriveTitle(input.content) : undefined;
    if (title) {
      await this.thread.updateOne(
        { _id: input.threadId, user_id: input.userId, message_count: 0 },
        { $set: { title } },
      );
    }

    await this.thread.updateOne({ _id: input.threadId, user_id: input.userId }, update);

    return created;
  }

  async updateMessageContent(messageId: string, userId: string, content: string): Promise<void> {
    if (!Types.ObjectId.isValid(messageId)) return;

    await this.message.updateOne({ _id: messageId, user_id: userId }, { $set: { content, status: "complete" } });
  }

  async history(threadId: string, userId: string, limit = 20): Promise<IAiChatMessage[]> {
    if (!Types.ObjectId.isValid(threadId)) return [];

    const documents = await this.message
      .find({ thread_id: threadId, user_id: userId, status: { $ne: "error" } })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .select({ role: 1, content: 1 })
      .lean<{ role: AiRole; content: string }[]>();

    return documents.reverse().map((document) => ({ role: document.role, content: document.content }));
  }

  async threadMessages(threadId: string, userId: string, limit = 50): Promise<AiMessageDocument[]> {
    if (!Types.ObjectId.isValid(threadId)) return [];

    const documents = await this.message
      .find({ thread_id: threadId, user_id: userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .lean<AiMessageDocument[]>();

    return documents.reverse();
  }

  async userTurns(userId: string, limit = 40): Promise<IAiChatMessage[]> {
    const documents = await this.message
      .find({ user_id: userId, role: "user", status: { $ne: "error" } })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .select({ role: 1, content: 1 })
      .lean<{ role: AiRole; content: string }[]>();

    return documents.reverse().map((document) => ({ role: document.role, content: document.content }));
  }

  async archiveThread(userId: string, threadId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(threadId)) return false;

    const result = await this.thread.updateOne(
      { _id: threadId, user_id: userId },
      { $set: { status: AI_THREAD_STATUSES[1] } },
    );

    return result.modifiedCount > 0;
  }

  async attachEmbeds(messageId: string, embedIds: readonly string[]): Promise<void> {
    if (embedIds.length === 0 || !Types.ObjectId.isValid(messageId)) return;

    await this.message.updateOne({ _id: messageId }, { $addToSet: { embed_ids: { $each: [...embedIds] } } });
  }

  private deriveTitle(content: string): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (!normalized) return "Nowa rozmowa";

    const sentence = normalized.split(/[.!?\n]/)[0]?.trim() ?? normalized;
    const title = sentence.length > TITLE_MAX_LENGTH ? `${sentence.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : sentence;

    return title || "Nowa rozmowa";
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AiEmbed, AiEmbedEvent } from "../schemas/ai.schemas";
import type { AiEmbedDocument, AiEmbedEventDocument } from "../schemas/ai-records";
import { isObjectId } from "../schemas/ai-records";
import { AiException } from "../errors/ai-exception";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";

export const AI_EMBED_KINDS = ["game", "flashcards"] as const;
export type AiEmbedKind = (typeof AI_EMBED_KINDS)[number];

export interface AiEmbedPayload {
  kind: AiEmbedKind;
  title: string;
  props: Record<string, unknown>;
}

export interface AiCreateEmbedInput {
  userId: string;
  threadId: string;
  messageId: string;
  kind: AiEmbedKind;
  title: string;
  props: Record<string, unknown>;
}

export interface AiEmbedView {
  id: string;
  kind: string;
  title: string;
  props: Record<string, unknown>;
  revision: number;
  messageId?: string;
}

const MAX_EVENTS_PER_EMBED = 50;
const TITLE_LIMIT = 120;

@Injectable()
export class AiEmbedRepository {
  constructor(
    @InjectModel(AiEmbed.name) private readonly embeds: Model<AiEmbed>,
    @InjectModel(AiEmbedEvent.name) private readonly eventModel: Model<AiEmbedEvent>,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
  ) {}

  static isKind(value: unknown): value is AiEmbedKind {
    return typeof value === "string" && (AI_EMBED_KINDS as readonly string[]).includes(value);
  }

  static normalize(payload: unknown): AiEmbedPayload | null {
    if (typeof payload !== "object" || payload === null) return null;

    const candidate = payload as Partial<AiEmbedPayload>;
    if (!AiEmbedRepository.isKind(candidate.kind)) return null;

    const props = typeof candidate.props === "object" && candidate.props !== null ? candidate.props : {};
    if (candidate.kind === "flashcards" && !Array.isArray((props as { cards?: unknown }).cards)) return null;
    if (candidate.kind === "game" && !Array.isArray((props as { items?: unknown }).items)) return null;

    return {
      kind: candidate.kind,
      title: typeof candidate.title === "string" ? candidate.title.slice(0, TITLE_LIMIT) : candidate.kind,
      props,
    };
  }

  async create(input: AiCreateEmbedInput): Promise<AiEmbedDocument> {
    if (!isObjectId(input.threadId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "threadId", value: input.threadId } });
    }

    try {
      return await this.embeds.create({
        user_id: input.userId,
        thread_id: input.threadId,
        message_id: input.messageId,
        kind: input.kind,
        title: input.title,
        props: input.props,
        revision: 1,
        last_event_at: new Date(),
      });
    } catch (error) {
      throw this.storageFailure("create-embed", error);
    }
  }

  async listForThread(userId: string, threadId: string): Promise<AiEmbedView[]> {
    if (!isObjectId(threadId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "threadId", value: threadId } });
    }

    try {
      const documents = await this.embeds
        .find({ user_id: userId, thread_id: threadId })
        .sort({ createdAt: -1 })
        .limit(this.config.limits.maxEmbeds)
        .lean<AiEmbedDocument[]>();

      return documents.map((document) => this.toView(document));
    } catch (error) {
      throw this.storageFailure("list-embeds", error);
    }
  }

  async require(userId: string, embedId: string): Promise<AiEmbedView> {
    const view = await this.find(userId, embedId);
    if (!view) {
      throw new AiException("AI_EMBED_NOT_FOUND", {
        details: { embedId, reason: isObjectId(embedId) ? "not-found-or-not-owned" : "malformed-id" },
      });
    }

    return view;
  }

  async find(userId: string, embedId: string): Promise<AiEmbedView | null> {
    if (!isObjectId(embedId)) return null;

    try {
      const document = await this.embeds.findOne({ _id: embedId, user_id: userId }).lean<AiEmbedDocument>();

      return document ? this.toView(document) : null;
    } catch (error) {
      throw this.storageFailure("find-embed", error);
    }
  }

  async recordEvent(
    userId: string,
    embedId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<{ revision: number }> {
    if (!isObjectId(embedId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "embedId", value: embedId } });
    }

    try {
      const updated = await this.embeds.findOneAndUpdate(
        { _id: embedId, user_id: userId },
        { $inc: { revision: 1 }, $set: { last_event_at: new Date() } },
        { new: true },
      );

      if (!updated) throw new AiException("AI_EMBED_NOT_FOUND", { details: { embedId } });

      await this.eventModel.create({ user_id: userId, embed_id: embedId, type, payload });
      await this.trimEvents(embedId);

      return { revision: updated.revision };
    } catch (error) {
      if (error instanceof AiException) throw error;
      throw this.storageFailure("record-embed-event", error);
    }
  }

  async events(userId: string, embedId: string): Promise<AiEmbedEventDocument[]> {
    if (!isObjectId(embedId)) {
      throw new AiException("AI_ID_INVALID", { details: { field: "embedId", value: embedId } });
    }

    const exists = await this.embeds.exists({ _id: embedId, user_id: userId });
    if (!exists) throw new AiException("AI_EMBED_NOT_FOUND", { details: { embedId } });

    return this.eventModel
      .find({ embed_id: embedId })
      .sort({ createdAt: -1 })
      .limit(MAX_EVENTS_PER_EMBED)
      .lean<AiEmbedEventDocument[]>();
  }

  private async trimEvents(embedId: string): Promise<void> {
    const overflow = await this.eventModel.countDocuments({ embed_id: embedId });
    if (overflow <= MAX_EVENTS_PER_EMBED) return;

    const stale = await this.eventModel
      .find({ embed_id: embedId })
      .sort({ createdAt: 1 })
      .limit(overflow - MAX_EVENTS_PER_EMBED)
      .select({ _id: 1 })
      .lean<{ _id: unknown }[]>();

    await this.eventModel.deleteMany({ _id: { $in: stale.map((document) => document._id) } });
  }

  private toView(document: AiEmbedDocument): AiEmbedView {
    return {
      id: document.id,
      kind: document.kind,
      title: document.title,
      props: document.props,
      revision: document.revision,
      messageId: document.message_id,
    };
  }

  private storageFailure(operation: string, error: unknown): AiException {
    return new AiException("AI_PERSISTENCE_FAILED", {
      cause: error,
      details: { operation, reason: error instanceof Error ? error.message : String(error) },
    });
  }
}

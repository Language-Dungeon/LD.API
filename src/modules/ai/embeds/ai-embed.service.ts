import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AiEmbed, AiEmbedEvent, type AiEmbedDocument } from "@schemas";
import { AI_EMBED_KINDS, type AiEmbedKind, type IAiEmbedPayload } from "@types";

const MAX_EVENTS_PER_EMBED = 50;

export interface CreateEmbedInput {
  userId: string;
  threadId: string;
  messageId: string;
  kind: AiEmbedKind;
  title?: string;
  props: Record<string, unknown>;
}

@Injectable()
export class AiEmbedService {
  constructor(
    @InjectModel(AiEmbed.name) private readonly embed: Model<AiEmbed>,
    @InjectModel(AiEmbedEvent.name) private readonly event: Model<AiEmbedEvent>,
  ) {}

  static isKind(value: unknown): value is AiEmbedKind {
    return typeof value === "string" && (AI_EMBED_KINDS as readonly string[]).includes(value);
  }

  static normalize(payload: unknown): IAiEmbedPayload | null {
    if (typeof payload !== "object" || payload === null) return null;

    const candidate = payload as Partial<IAiEmbedPayload>;
    if (!AiEmbedService.isKind(candidate.kind)) return null;

    const props = typeof candidate.props === "object" && candidate.props !== null ? candidate.props : {};
    if (candidate.kind === "flashcards" && !Array.isArray((props as { cards?: unknown }).cards)) return null;
    if (candidate.kind === "game" && !Array.isArray((props as { items?: unknown }).items)) return null;

    return {
      kind: candidate.kind,
      title: typeof candidate.title === "string" ? candidate.title.slice(0, 120) : candidate.kind,
      props: props as Record<string, unknown>,
    };
  }

  async create(input: CreateEmbedInput): Promise<AiEmbedDocument> {
    return this.embed.create({
      user_id: input.userId,
      thread_id: input.threadId,
      message_id: input.messageId,
      kind: input.kind,
      title: input.title ?? input.kind,
      props: input.props,
      revision: 1,
      last_event_at: new Date(),
    });
  }

  async listForThread(userId: string, threadId: string): Promise<AiEmbedDocument[]> {
    return this.embed.find({ user_id: userId, thread_id: threadId }).sort({ createdAt: -1 }).lean<AiEmbedDocument[]>();
  }

  async find(userId: string, embedId: string): Promise<AiEmbedDocument | null> {
    return this.embed.findOne({ _id: embedId, user_id: userId }).lean<AiEmbedDocument>();
  }

  async recordEvent(
    userId: string,
    embedId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<{ revision: number } | null> {
    const embed = await this.embed.findOne({ _id: embedId, user_id: userId });
    if (!embed) return null;

    await this.event.create({ user_id: userId, embed_id: embedId, type, payload });

    embed.revision += 1;
    embed.last_event_at = new Date();
    await embed.save();

    const overflow = await this.event.countDocuments({ embed_id: embedId });
    if (overflow > MAX_EVENTS_PER_EMBED) {
      const stale = await this.event
        .find({ embed_id: embedId })
        .sort({ createdAt: 1 })
        .limit(overflow - MAX_EVENTS_PER_EMBED)
        .select({ _id: 1 })
        .lean<{ _id: unknown }[]>();

      await this.event.deleteMany({ _id: { $in: stale.map((document) => document._id) } });
    }

    return { revision: embed.revision };
  }

  async events(userId: string, embedId: string): Promise<AiEmbedEvent[] | null> {
    const exists = await this.embed.exists({ _id: embedId, user_id: userId });
    if (!exists) return null;

    return this.event.find({ embed_id: embedId }).sort({ createdAt: -1 }).limit(MAX_EVENTS_PER_EMBED).lean();
  }
}

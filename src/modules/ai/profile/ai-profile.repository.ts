import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AiProfile } from "../schemas/ai.schemas";
import type { AiProfileDocument } from "../schemas/ai-records";
import { AiException } from "../errors/ai-exception";
import { AI_CEFR_LEVELS, levelIndex, type AiCefrLevel } from "./ai-level.types";

@Injectable()
export class AiProfileRepository {
  constructor(@InjectModel(AiProfile.name) private readonly model: Model<AiProfile>) {}

  async find(userId: string): Promise<AiProfileDocument | null> {
    try {
      return await this.model.findOne({ user_id: userId });
    } catch (error) {
      throw this.failure("find", userId, error);
    }
  }

  async findOrCreate(userId: string, level: AiCefrLevel): Promise<AiProfileDocument> {
    const existing = await this.find(userId);
    if (existing) return existing;

    try {
      return await this.model.create({
        user_id: userId,
        declared_level: level,
        effective_level: level,
        skills: {},
        last_recalculated_at: new Date(),
      });
    } catch (error) {
      const raced = await this.find(userId);
      if (raced) return raced;

      throw this.failure("create", userId, error);
    }
  }

  async save(document: AiProfileDocument): Promise<AiProfileDocument> {
    try {
      return await document.save();
    } catch (error) {
      throw this.failure("save", document.user_id, error);
    }
  }

  async observe(userId: string, level: AiCefrLevel, patch: Record<string, unknown>): Promise<AiProfileDocument> {
    try {
      const updated = await this.model.findOneAndUpdate(
        { user_id: userId },
        {
          $set: { ...patch, last_recalculated_at: new Date() },
          $inc: { signal_count: 1 },
          $setOnInsert: { declared_level: level, effective_level: level },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      if (!updated) throw new AiException("AI_PROFILE_UNAVAILABLE", { details: { userId } });

      return updated;
    } catch (error) {
      if (error instanceof AiException) throw error;
      throw this.failure("observe", userId, error);
    }
  }

  static levelOf(value: unknown): AiCefrLevel {
    const candidate = typeof value === "string" ? value : "";

    return (AI_CEFR_LEVELS as readonly string[]).includes(candidate) ? (candidate as AiCefrLevel) : AI_CEFR_LEVELS[1];
  }

  static effectiveLevel(declared: AiCefrLevel, effective: AiCefrLevel): AiCefrLevel {
    return levelIndex(declared) > levelIndex(effective) ? declared : effective;
  }

  private failure(operation: string, userId: string, error: unknown): AiException {
    return new AiException("AI_PROFILE_UNAVAILABLE", {
      cause: error,
      details: { operation, userId, reason: error instanceof Error ? error.message : String(error) },
    });
  }
}

export type { AiProfileDocument };

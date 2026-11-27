import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { AI_CEFR_LEVELS, AI_DEFAULT_LEVEL } from "../profile/ai-level.types";
import type { AiEmbedEventRecord, AiEmbedRecord, AiMessageRecord, AiProfileRecord, AiThreadRecord } from "./ai-records";

const { Mixed, String: MongooseString, Number: MongooseNumber, Date: MongooseDate } = mongoose.Schema.Types;

@Schema({ timestamps: true, collection: "ai_profiles" })
export class AiProfile implements AiProfileRecord {
  @Prop({ required: true, unique: true, index: true, type: MongooseString })
  user_id!: string;

  @Prop({ required: true, enum: AI_CEFR_LEVELS, default: AI_DEFAULT_LEVEL })
  declared_level!: string;

  @Prop({ required: true, enum: AI_CEFR_LEVELS, default: AI_DEFAULT_LEVEL })
  effective_level!: string;

  @Prop({ required: true, default: 0, min: 0, max: 1, type: MongooseNumber })
  confidence!: number;

  @Prop({ required: true, default: 0, type: MongooseNumber })
  signal_count!: number;

  @Prop({ required: true, default: () => ({}), type: Mixed })
  skills!: Record<string, number>;

  @Prop({ required: true, default: [], type: [Mixed] })
  weak_areas!: AiProfileRecord["weak_areas"];

  @Prop({ required: true, default: [], type: [MongooseString] })
  recurring_mistakes!: string[];

  @Prop({ required: true, default: [], type: [MongooseString] })
  goals!: string[];

  @Prop({ required: true, default: () => new Date(), type: MongooseDate })
  last_recalculated_at!: Date;
}

@Schema({ timestamps: true, collection: "ai_threads" })
export class AiThread implements AiThreadRecord {
  @Prop({ required: true, index: true, type: MongooseString })
  user_id!: string;

  @Prop({ required: true, default: "Nowa rozmowa", type: MongooseString })
  title!: string;

  @Prop({ required: true, default: "active", index: true, type: MongooseString })
  status!: string;

  @Prop({ required: true, default: "local", type: MongooseString })
  provider!: string;

  @Prop({ required: true, default: "local", type: MongooseString })
  runtime!: string;

  @Prop({ required: true, default: "", type: MongooseString })
  model!: string;

  @Prop({ required: true, default: 0, type: MongooseNumber })
  message_count!: number;

  @Prop({ required: true, default: () => new Date(), index: true, type: MongooseDate })
  last_message_at!: Date;

  @Prop({ required: true, default: 0, type: MongooseNumber })
  total_tokens!: number;
}

@Schema({ timestamps: true, collection: "ai_messages" })
export class AiMessage implements AiMessageRecord {
  @Prop({ required: true, index: true, type: MongooseString })
  user_id!: string;

  @Prop({ required: true, index: true, type: MongooseString })
  thread_id!: string;

  @Prop({ required: true, enum: ["system", "user", "assistant"], type: MongooseString })
  role!: string;

  @Prop({ required: true, type: MongooseString })
  content!: string;

  @Prop({ required: true, default: 0, type: MongooseNumber })
  tokens!: number;

  @Prop({ required: true, default: "complete", enum: ["complete", "streaming", "error"], type: MongooseString })
  status!: string;

  @Prop({ required: true, default: "", type: MongooseString })
  provider!: string;

  @Prop({ required: true, default: "", type: MongooseString })
  runtime!: string;

  @Prop({ required: true, default: "", type: MongooseString })
  model!: string;

  @Prop({ required: true, default: 0, type: MongooseNumber })
  latency_ms!: number;

  @Prop({ required: true, default: [], type: [MongooseString] })
  embed_ids!: string[];
}

@Schema({ timestamps: true, collection: "ai_embeds" })
export class AiEmbed implements AiEmbedRecord {
  @Prop({ required: true, index: true, type: MongooseString })
  user_id!: string;

  @Prop({ required: true, index: true, type: MongooseString })
  thread_id!: string;

  @Prop({ required: true, index: true, type: MongooseString })
  message_id!: string;

  @Prop({ required: true, enum: ["game", "flashcards"], type: MongooseString })
  kind!: string;

  @Prop({ required: true, default: "", type: MongooseString })
  title!: string;

  @Prop({ required: true, default: {}, type: Mixed })
  props!: Record<string, unknown>;

  @Prop({ required: true, default: 1, type: MongooseNumber })
  revision!: number;

  @Prop({ required: true, default: () => new Date(), type: MongooseDate })
  last_event_at!: Date;
}

@Schema({ timestamps: true, collection: "ai_embed_events" })
export class AiEmbedEvent implements AiEmbedEventRecord {
  @Prop({ required: true, index: true, type: MongooseString })
  user_id!: string;

  @Prop({ required: true, index: true, type: MongooseString })
  embed_id!: string;

  @Prop({ required: true, type: MongooseString })
  type!: string;

  @Prop({ required: true, default: {}, type: Mixed })
  payload!: Record<string, unknown>;
}

export const AiProfileSchema = SchemaFactory.createForClass(AiProfile);
export const AiThreadSchema = SchemaFactory.createForClass(AiThread);
export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);
export const AiEmbedSchema = SchemaFactory.createForClass(AiEmbed);
export const AiEmbedEventSchema = SchemaFactory.createForClass(AiEmbedEvent);

AiThreadSchema.index({ user_id: 1, last_message_at: -1 });
AiMessageSchema.index({ thread_id: 1, created_at: -1 });
AiMessageSchema.index({ user_id: 1, created_at: -1 });
AiEmbedSchema.index({ thread_id: 1, created_at: -1 });
AiEmbedEventSchema.index({ embed_id: 1, created_at: -1 });

export const AI_SCHEMAS = [
  { name: AiProfile.name, schema: AiProfileSchema },
  { name: AiThread.name, schema: AiThreadSchema },
  { name: AiMessage.name, schema: AiMessageSchema },
  { name: AiEmbed.name, schema: AiEmbedSchema },
  { name: AiEmbedEvent.name, schema: AiEmbedEventSchema },
] as const;

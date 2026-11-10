import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { AI_CEFR_LEVELS, type AiCefrLevel } from "@types";

export interface IAiProfileAttributes {
  user_id: string;
  declared_level: AiCefrLevel;
  effective_level: AiCefrLevel;
  confidence: number;
  signal_count: number;
  skills: Record<string, number>;
  weak_areas: { topic: string; skill: string; score: number; observations: number; last_seen_at: Date }[];
  recurring_mistakes: string[];
  goals: string[];
  last_recalculated_at: Date;
}

@Schema({ timestamps: true })
export class AiProfile implements IAiProfileAttributes {
  @Prop({ required: true, unique: true, index: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, enum: AI_CEFR_LEVELS, default: "A2" })
  declared_level!: AiCefrLevel;

  @Prop({ required: true, enum: AI_CEFR_LEVELS, default: "A2" })
  effective_level!: AiCefrLevel;

  @Prop({ required: true, default: 0, min: 0, max: 1, type: mongoose.Schema.Types.Number })
  confidence!: number;

  @Prop({ required: true, default: 0, type: mongoose.Schema.Types.Number })
  signal_count!: number;

  @Prop({
    required: true,
    default: () => ({ speaking: 0, listening: 0, reading: 0, writing: 0, grammar: 0, vocabulary: 0 }),
  })
  skills!: Record<string, number>;

  @Prop({ required: false, default: [], type: [mongoose.Schema.Types.Mixed] })
  weak_areas!: { topic: string; skill: string; score: number; observations: number; last_seen_at: Date }[];

  @Prop({ required: false, default: [], type: [mongoose.Schema.Types.String] })
  recurring_mistakes!: string[];

  @Prop({ required: false, default: [], type: [mongoose.Schema.Types.String] })
  goals!: string[];

  @Prop({ required: true, default: () => new Date(), type: mongoose.Schema.Types.Date })
  last_recalculated_at!: Date;
}

export type AiProfileDocument = HydratedDocument<AiProfile>;
export const AiProfileSchema = SchemaFactory.createForClass(AiProfile);
AiProfileSchema.index({ updatedAt: -1 });

export interface IAiThreadAttributes {
  user_id: string;
  title: string;
  status: string;
  provider: string;
  runtime: string;
  model: string;
  message_count: number;
  last_message_at: Date;
  total_tokens: number;
}

@Schema({ timestamps: true })
export class AiThread implements IAiThreadAttributes {
  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, default: "Nowa rozmowa", type: mongoose.Schema.Types.String })
  title!: string;

  @Prop({ required: true, default: "active", index: true, type: mongoose.Schema.Types.String })
  status!: string;

  @Prop({ required: true, default: "local", type: mongoose.Schema.Types.String })
  provider!: string;

  @Prop({ required: true, default: "local", type: mongoose.Schema.Types.String })
  runtime!: string;

  @Prop({ required: true, default: "", type: mongoose.Schema.Types.String })
  model!: string;

  @Prop({ required: true, default: 0, type: mongoose.Schema.Types.Number })
  message_count!: number;

  @Prop({ required: true, default: () => new Date(), index: true, type: mongoose.Schema.Types.Date })
  last_message_at!: Date;

  @Prop({ required: true, default: 0, type: mongoose.Schema.Types.Number })
  total_tokens!: number;
}

export type AiThreadDocument = HydratedDocument<AiThread>;
export const AiThreadSchema = SchemaFactory.createForClass(AiThread);
AiThreadSchema.index({ user_id: 1, last_message_at: -1 });

export interface IAiMessageAttributes {
  user_id: string;
  thread_id: string;
  role: string;
  content: string;
  tokens: number;
  status: string;
  provider: string;
  runtime: string;
  model: string;
  latency_ms: number;
  embed_ids: string[];
}

@Schema({ timestamps: true })
export class AiMessage implements IAiMessageAttributes {
  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  thread_id!: string;

  @Prop({ required: true, enum: ["system", "user", "assistant"], type: mongoose.Schema.Types.String })
  role!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  content!: string;

  @Prop({ required: true, default: 0, type: mongoose.Schema.Types.Number })
  tokens!: number;

  @Prop({ required: true, default: "complete", type: mongoose.Schema.Types.String })
  status!: string;

  @Prop({ required: false, default: null, type: mongoose.Schema.Types.String })
  provider!: string;

  @Prop({ required: false, default: null, type: mongoose.Schema.Types.String })
  runtime!: string;

  @Prop({ required: false, default: null, type: mongoose.Schema.Types.String })
  model!: string;

  @Prop({ required: true, default: 0, type: mongoose.Schema.Types.Number })
  latency_ms!: number;

  @Prop({ required: false, default: [], type: [mongoose.Schema.Types.String] })
  embed_ids!: string[];
}

export type AiMessageDocument = HydratedDocument<AiMessage>;
export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);
AiMessageSchema.index({ thread_id: 1, createdAt: -1 });
AiMessageSchema.index({ user_id: 1, createdAt: -1 });

export interface IAiEmbedAttributes {
  user_id: string;
  thread_id: string;
  message_id: string;
  kind: string;
  title: string;
  props: Record<string, unknown>;
  revision: number;
  last_event_at: Date;
}

@Schema({ timestamps: true })
export class AiEmbed implements IAiEmbedAttributes {
  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  thread_id!: string;

  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  message_id!: string;

  @Prop({ required: true, enum: ["game", "flashcards"], type: mongoose.Schema.Types.String })
  kind!: string;

  @Prop({ required: true, default: "", type: mongoose.Schema.Types.String })
  title!: string;

  @Prop({ required: true, default: {}, type: mongoose.Schema.Types.Mixed })
  props!: Record<string, unknown>;

  @Prop({ required: true, default: 1, type: mongoose.Schema.Types.Number })
  revision!: number;

  @Prop({ required: true, default: () => new Date(), type: mongoose.Schema.Types.Date })
  last_event_at!: Date;
}

export type AiEmbedDocument = HydratedDocument<AiEmbed>;
export const AiEmbedSchema = SchemaFactory.createForClass(AiEmbed);
AiEmbedSchema.index({ thread_id: 1, createdAt: -1 });

export interface IAiEmbedEventAttributes {
  user_id: string;
  embed_id: string;
  type: string;
  payload: Record<string, unknown>;
}

@Schema({ timestamps: true })
export class AiEmbedEvent implements IAiEmbedEventAttributes {
  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  user_id!: string;

  @Prop({ required: true, index: true, type: mongoose.Schema.Types.String })
  embed_id!: string;

  @Prop({ required: true, type: mongoose.Schema.Types.String })
  type!: string;

  @Prop({ required: true, default: {}, type: mongoose.Schema.Types.Mixed })
  payload!: Record<string, unknown>;
}

export type AiEmbedEventDocument = HydratedDocument<AiEmbedEvent>;
export const AiEmbedEventSchema = SchemaFactory.createForClass(AiEmbedEvent);
AiEmbedEventSchema.index({ embed_id: 1, createdAt: -1 });

export type ObjectIdLike = Types.ObjectId | string;

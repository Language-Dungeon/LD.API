import { HydratedDocument, Types } from "mongoose";

export type AiObjectId = Types.ObjectId | string;

export function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && new Types.ObjectId(value).toString() === value;
}

export type AiProfileDocument = HydratedDocument<AiProfileRecord>;
export type AiThreadDocument = HydratedDocument<AiThreadRecord>;
export type AiMessageDocument = HydratedDocument<AiMessageRecord>;
export type AiEmbedDocument = HydratedDocument<AiEmbedRecord>;
export type AiEmbedEventDocument = HydratedDocument<AiEmbedEventRecord>;

export interface AiWeakAreaRecord {
  topic: string;
  skill: string;
  score: number;
  observations: number;
  last_seen_at: Date;
}

export interface AiProfileRecord {
  user_id: string;
  declared_level: string;
  effective_level: string;
  confidence: number;
  signal_count: number;
  skills: Record<string, number>;
  weak_areas: AiWeakAreaRecord[];
  recurring_mistakes: string[];
  goals: string[];
  last_recalculated_at: Date;
}

export interface AiThreadRecord {
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

export interface AiMessageRecord {
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

export interface AiEmbedRecord {
  user_id: string;
  thread_id: string;
  message_id: string;
  kind: string;
  title: string;
  props: Record<string, unknown>;
  revision: number;
  last_event_at: Date;
}

export interface AiEmbedEventRecord {
  user_id: string;
  embed_id: string;
  type: string;
  payload: Record<string, unknown>;
}

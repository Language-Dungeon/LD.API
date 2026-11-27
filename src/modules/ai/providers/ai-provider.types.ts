export type AiRole = "system" | "user" | "assistant";

export type AiResponseFormat = "text" | "json";

export interface AiChatMessage {
  readonly role: AiRole;
  readonly content: string;
}

export interface AiUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface AiGenerateOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly stop?: readonly string[];
  readonly format?: AiResponseFormat;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly bypass?: boolean;
}

export interface AiCompletionResult {
  readonly content: string;
  readonly provider: string;
  readonly runtime: string;
  readonly model: string;
  readonly usage?: AiUsage;
  readonly latencyMs: number;
  readonly bypassed: boolean;
}

export interface AiStreamChunk {
  readonly delta: string;
  readonly done: boolean;
}

export interface AiCompletionGateway {
  readonly provider: string;
  readonly runtime: string;
  complete(messages: readonly AiChatMessage[], options?: AiGenerateOptions): Promise<AiCompletionResult>;
  stream(messages: readonly AiChatMessage[], options?: AiGenerateOptions): AsyncIterable<AiStreamChunk>;
}

export interface AiEmbeddingGateway {
  readonly provider: string;
  embed(texts: readonly string[]): Promise<number[][]>;
}

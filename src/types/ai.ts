export const AI_LOCAL_PROVIDERS = ["ollama", "lmstudio", "llamacpp", "vllm"] as const;
export type AiLocalProvider = (typeof AI_LOCAL_PROVIDERS)[number];

export const AI_CLOUD_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "groq",
  "mistral",
  "deepseek",
] as const;
export type AiCloudProvider = (typeof AI_CLOUD_PROVIDERS)[number];

export const AI_PROVIDERS = [...AI_LOCAL_PROVIDERS, ...AI_CLOUD_PROVIDERS] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_RUNTIMES = ["local", "cloud"] as const;
export type AiRuntime = (typeof AI_RUNTIMES)[number];

export const AI_WIRE_PROTOCOLS = ["ollama", "openai", "anthropic", "google"] as const;
export type AiWireProtocol = (typeof AI_WIRE_PROTOCOLS)[number];

export const AI_ROLES = ["system", "user", "assistant"] as const;
export type AiRole = (typeof AI_ROLES)[number];

export const AI_MESSAGE_STATUSES = ["complete", "streaming", "error"] as const;
export type AiMessageStatus = (typeof AI_MESSAGE_STATUSES)[number];

export const AI_THREAD_STATUSES = ["active", "archived"] as const;
export type AiThreadStatus = (typeof AI_THREAD_STATUSES)[number];

export const AI_EMBED_KINDS = ["game", "flashcards"] as const;
export type AiEmbedKind = (typeof AI_EMBED_KINDS)[number];

export const AI_RESPONSE_FORMATS = ["text", "json"] as const;
export type AiResponseFormat = (typeof AI_RESPONSE_FORMATS)[number];

export const AI_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type AiCefrLevel = (typeof AI_CEFR_LEVELS)[number];

export interface IAiLevelState {
  declared: AiCefrLevel;
  effective: AiCefrLevel;
  confidence: number;
  signalCount: number;
  recalculatedAt: Date;
}

export interface IAiSkillState {
  speaking: number;
  listening: number;
  reading: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

export interface IAiWeakArea {
  topic: string;
  skill: keyof IAiSkillState;
  score: number;
  observations: number;
  lastSeenAt: Date;
}

export interface IAiProviderInfo {
  provider: AiProvider;
  runtime: AiRuntime;
  protocol: AiWireProtocol;
  models: readonly string[];
  defaultModel: string;
  embedModel: string;
}

export interface IAiChatMessage {
  role: AiRole;
  content: string;
}

export interface IAiGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: readonly string[];
  format?: AiResponseFormat;
  timeoutMs?: number;
  signal?: AbortSignal;
  bypass?: boolean;
}

export interface IAiCompletionResult {
  content: string;
  provider: AiProvider;
  runtime: AiRuntime;
  model: string;
  usage?: IAiUsage;
  latencyMs: number;
  bypassed: boolean;
}

export interface IAiStreamChunk {
  delta: string;
  done: boolean;
}

export interface IAiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface IAiCompletionGateway {
  readonly provider: AiProvider;
  readonly runtime: AiRuntime;
  complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult>;
  stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk>;
}

export interface IAiEmbeddingGateway {
  readonly provider: AiProvider;
  embed(texts: readonly string[]): Promise<number[][]>;
}

export interface IAiLevelSnapshot {
  declared: AiCefrLevel;
  effective: AiCefrLevel;
  confidence: number;
  signalCount: number;
}

export interface IAiTrainingContext {
  level: IAiLevelSnapshot;
  skills: IAiSkillState;
  weakAreas: readonly IAiWeakArea[];
  recurringMistakes: readonly string[];
  goals: readonly string[];
  recentTurns: readonly IAiChatMessage[];
  summarizedTurns: number;
  threadsSampled: number;
  tokensEstimate: number;
}

export interface IAiPromptPlan {
  messages: IAiChatMessage[];
  context: IAiTrainingContext;
  bypass: boolean;
  runtime: AiRuntime;
  provider: AiProvider;
  model: string;
}

export interface IAiEmbedPayload {
  kind: AiEmbedKind;
  title: string;
  props: Record<string, unknown>;
}

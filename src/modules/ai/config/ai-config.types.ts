import type { AiProvider } from "./provider";

export interface AiConfig {
  localEnabled: boolean;
  cloudEnabled: boolean;
  forceLocal: boolean;
  bypass: boolean;
  bypassLocalOnly: boolean;
  failoverChain: readonly AiProvider[];
  request: {
    timeoutMs: number;
    maxOutputTokens: number;
    retries: number;
    retryBaseDelayMs: number;
    temperature: number;
    topP: number;
  };
  context: {
    maxTurns: number;
    summaryTurns: number;
    tokenBudget: number;
  };
  embeddings: {
    enabled: boolean;
    batchSize: number;
    cacheTtlMs: number;
    cacheKeyPrefix: string;
  };
  limits: {
    maxQuestionChars: number;
    maxTextChars: number;
    maxThreads: number;
    maxHistoryMessages: number;
    maxEmbeds: number;
  };
}

export interface AiProviderCredentials {
  baseUrl: string;
  apiKey: string;
  model: string;
  embedModel: string;
  embedModelConfigured: boolean;
}

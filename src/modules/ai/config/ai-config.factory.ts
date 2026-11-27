import type { ConfigService } from "@nestjs/config";
import type { Config } from "@types";
import type { AiConfig } from "./ai-config.types";
import { isAiProvider, type AiProvider } from "./provider";

const DEFAULTS = {
  requestTimeoutMs: 60_000,
  maxOutputTokens: 1024,
  retries: 2,
  retryBaseDelayMs: 250,
  temperature: 0.6,
  topP: 0.95,
  contextMaxTurns: 16,
  contextSummaryTurns: 6,
  contextTokenBudget: 4000,
  embedBatchSize: 32,
  embedCacheTtlMs: 604_800_000,
  maxQuestionChars: 8000,
  maxTextChars: 4000,
  maxThreads: 200,
  maxHistoryMessages: 200,
  maxEmbeds: 50,
} as const;

export const AI_EMBED_CACHE_KEY_PREFIX = "ai:embed";

export class AiConfigFactory {
  static from(config: ConfigService<Config>): AiConfig {
    return {
      localEnabled: flag(config, "AI_LOCAL_ENABLED", true),
      cloudEnabled: flag(config, "AI_CLOUD_ENABLED", true),
      forceLocal: flag(config, "AI_FORCE_LOCAL", false),
      bypass: flag(config, "AI_BYPASS", true),
      bypassLocalOnly: flag(config, "AI_BYPASS_LOCAL_ONLY", true),
      failoverChain: parseChain(config.get<string>("AI_FAILOVER_CHAIN")),
      request: {
        timeoutMs: number(config, "AI_REQUEST_TIMEOUT_MS", DEFAULTS.requestTimeoutMs, 1_000, 600_000),
        maxOutputTokens: number(config, "AI_MAX_OUTPUT_TOKENS", DEFAULTS.maxOutputTokens, 64, 32_768),
        retries: number(config, "AI_RETRY_COUNT", DEFAULTS.retries, 0, 5),
        retryBaseDelayMs: number(config, "AI_RETRY_BASE_DELAY_MS", DEFAULTS.retryBaseDelayMs, 0, 10_000),
        temperature: DEFAULTS.temperature,
        topP: DEFAULTS.topP,
      },
      context: {
        maxTurns: number(config, "AI_CONTEXT_MAX_TURNS", DEFAULTS.contextMaxTurns, 2, 64),
        summaryTurns: number(config, "AI_CONTEXT_SUMMARY_TURNS", DEFAULTS.contextSummaryTurns, 1, 32),
        tokenBudget: number(config, "AI_CONTEXT_TOKEN_BUDGET", DEFAULTS.contextTokenBudget, 256, 100_000),
      },
      embeddings: {
        enabled: flag(config, "AI_EMBED_ENABLED", true),
        batchSize: number(config, "AI_EMBED_BATCH_SIZE", DEFAULTS.embedBatchSize, 1, 128),
        cacheTtlMs: DEFAULTS.embedCacheTtlMs,
        cacheKeyPrefix: AI_EMBED_CACHE_KEY_PREFIX,
      },
      limits: {
        maxQuestionChars: DEFAULTS.maxQuestionChars,
        maxTextChars: DEFAULTS.maxTextChars,
        maxThreads: DEFAULTS.maxThreads,
        maxHistoryMessages: DEFAULTS.maxHistoryMessages,
        maxEmbeds: DEFAULTS.maxEmbeds,
      },
    };
  }
}

function flag(config: ConfigService<Config>, key: string, fallback: boolean): boolean {
  const value = config.get<unknown>(key as keyof Config);
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return fallback;
}

function number(config: ConfigService<Config>, key: string, fallback: number, min: number, max: number): number {
  const value = Number(config.get<unknown>(key as keyof Config));
  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function parseChain(value: unknown): AiProvider[] {
  if (typeof value !== "string" || value.trim() === "") return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(isAiProvider);
}

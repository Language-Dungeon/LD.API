export const AI_ERROR_CODES = [
  "AI_QUESTION_EMPTY",
  "AI_QUESTION_TOO_LONG",
  "AI_PROVIDER_DISABLED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_NOT_FOUND",
  "AI_PROVIDERS_EXHAUSTED",
  "AI_AUTH_MISSING",
  "AI_AUTH_REJECTED",
  "AI_UPSTREAM_REJECTED",
  "AI_UPSTREAM_RATE_LIMITED",
  "AI_UPSTREAM_TIMEOUT",
  "AI_UPSTREAM_UNREACHABLE",
  "AI_UPSTREAM_UNAUTHORIZED",
  "AI_UPSTREAM_MALFORMED",
  "AI_STREAM_EMPTY",
  "AI_STREAM_INTERRUPTED",
  "AI_EMBEDDINGS_DISABLED",
  "AI_EMBEDDINGS_UNAVAILABLE",
  "AI_EMBEDDINGS_MISMATCH",
  "AI_EMBED_KIND_UNKNOWN",
  "AI_EMBED_PAYLOAD_INVALID",
  "AI_EMBED_NOT_FOUND",
  "AI_THREAD_NOT_FOUND",
  "AI_MESSAGE_NOT_FOUND",
  "AI_ID_INVALID",
  "AI_PERSISTENCE_FAILED",
  "AI_PROFILE_UNAVAILABLE",
  "AI_CONFIG_INVALID",
  "AI_INTERNAL_ERROR",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export type AiErrorDomain = "input" | "provider" | "stream" | "embedding" | "storage" | "config" | "internal";

export type AiDiagnosticSeverity = "error" | "warning" | "info";

export interface AiErrorContext {
  readonly [key: string]: unknown;
}

export interface AiErrorDescriptor {
  readonly code: AiErrorCode;
  readonly domain: AiErrorDomain;
  readonly status: number;
  readonly message: string;
  readonly hint?: string;
  readonly transient: boolean;
}

export interface AiErrorPayload {
  readonly code: AiErrorCode;
  readonly message: string;
  readonly domain: AiErrorDomain;
  readonly hint?: string;
  readonly transient: boolean;
  readonly provider?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly traceId?: string;
}

import { descriptorOf } from "./ai-error-catalog";
import { AiException } from "./ai-exception";
import { AiErrorClassifier } from "./ai-error-classifier";
import type { AiErrorCode } from "./ai-error-codes";

export interface AiRetryPolicy {
  readonly retries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export interface AiAttemptFailure {
  readonly attempt: number;
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly detail: string;
}

export const RETRYABLE_CODES: readonly AiErrorCode[] = [
  "AI_UPSTREAM_TIMEOUT",
  "AI_UPSTREAM_UNREACHABLE",
  "AI_UPSTREAM_RATE_LIMITED",
  "AI_STREAM_INTERRUPTED",
  "AI_UPSTREAM_REJECTED",
];

export class AiErrorPolicy {
  static isRetryable(code: AiErrorCode): boolean {
    return RETRYABLE_CODES.includes(code);
  }

  static shouldRetry(error: unknown, attempt: number, policy: AiRetryPolicy): boolean {
    if (attempt >= policy.retries) return false;
    if (error instanceof AiException) return error.transient && AiErrorPolicy.isRetryable(error.code);

    const classification = AiErrorClassifier.classify(error);
    if (!classification) return false;

    return classification.transient && AiErrorPolicy.isRetryable(classification.code);
  }

  static delay(attempt: number, policy: AiRetryPolicy): number {
    const exponential = policy.baseDelayMs * 2 ** attempt;
    const jitter = Math.random() * policy.baseDelayMs;

    return Math.min(policy.maxDelayMs, Math.round(exponential + jitter));
  }

  static attemptFailure(error: unknown, attempt: number, provider?: string): AiAttemptFailure {
    const classification = AiErrorClassifier.classify(error);
    const code = classification?.code ?? "AI_INTERNAL_ERROR";
    const descriptor = descriptorOf(code);

    return {
      attempt,
      code,
      status: classification?.providerStatus ?? classification?.httpStatus,
      detail: `${provider ? `${provider} ` : ""}${classification?.detail ?? descriptor.message}`,
    };
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiException("AI_UPSTREAM_TIMEOUT", { details: { reason: "aborted" } }));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AiException("AI_UPSTREAM_TIMEOUT", { details: { reason: "aborted" } }));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

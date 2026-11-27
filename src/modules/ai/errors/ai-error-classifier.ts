import { descriptorOf, isAiErrorCode } from "./ai-error-catalog";
import { AiException } from "./ai-exception";
import { fingerprint } from "./ai-redaction";
import type { AiErrorCode } from "./ai-error-codes";

export interface AiErrorClassification {
  readonly code: AiErrorCode;
  readonly httpStatus?: number;
  readonly providerStatus?: number;
  readonly detail: string;
  readonly transient: boolean;
}

const TIMEOUT_CODES = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"]);
const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_SOCKET",
  "EAI_AGAIN",
]);

export class AiErrorClassifier {
  static statusToCode(status: number): AiErrorCode {
    if (status === 401) return "AI_AUTH_REJECTED";
    if (status === 403) return "AI_UPSTREAM_UNAUTHORIZED";
    if (status === 408) return "AI_UPSTREAM_TIMEOUT";
    if (status === 429) return "AI_UPSTREAM_RATE_LIMITED";
    if (status >= 500) return "AI_UPSTREAM_REJECTED";

    return "AI_UPSTREAM_REJECTED";
  }

  static networkToCode(code: string | undefined): AiErrorCode {
    if (!code) return "AI_UPSTREAM_UNREACHABLE";
    if (TIMEOUT_CODES.has(code)) return "AI_UPSTREAM_TIMEOUT";
    if (UNREACHABLE_CODES.has(code)) return "AI_UPSTREAM_UNREACHABLE";

    return "AI_UPSTREAM_UNREACHABLE";
  }

  static classify(error: unknown): AiErrorClassification | null {
    if (error instanceof AiException) {
      return {
        code: error.code,
        httpStatus: error.getStatus(),
        detail: error.message,
        transient: error.transient,
      };
    }

    const candidate = error as { code?: unknown; name?: unknown; message?: unknown; status?: unknown } | null;
    if (!candidate) return null;

    if (isAiErrorCode(candidate.code)) {
      const descriptor = descriptorOf(candidate.code);

      return {
        code: candidate.code,
        httpStatus: descriptor.status,
        detail: descriptor.message,
        transient: descriptor.transient,
      };
    }

    if (typeof candidate.status === "number") {
      const code = AiErrorClassifier.statusToCode(candidate.status);

      return {
        code,
        providerStatus: candidate.status,
        detail: typeof candidate.message === "string" ? candidate.message : descriptorOf(code).message,
        transient: descriptorOf(code).transient,
      };
    }

    if (typeof candidate.code === "string" && /^[A-Z0-9_]+$/.test(candidate.code)) {
      const code = AiErrorClassifier.networkToCode(candidate.code);

      return {
        code,
        detail: typeof candidate.message === "string" ? candidate.message : candidate.code,
        transient: true,
      };
    }

    if (candidate.name === "AbortError") {
      return {
        code: "AI_UPSTREAM_TIMEOUT",
        detail: "The request was aborted before the provider answered.",
        transient: true,
      };
    }

    return null;
  }

  static describe(error: unknown, provider?: string): string {
    const classification = AiErrorClassifier.classify(error);
    if (!classification) return error instanceof Error ? error.message : String(error);

    const status = classification.providerStatus ? ` (HTTP ${classification.providerStatus})` : "";
    const owner = provider ? `${provider}: ` : "";

    return `${owner}${classification.code}${status} [${fingerprint(classification.detail)}]`;
  }
}

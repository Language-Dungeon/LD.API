import type { AiHttpClient, AiHttpRequest } from "./ai-http.client";
import type { AiConfig } from "../config/ai-config.types";

export interface AiTransportContext {
  readonly client: AiHttpClient;
  readonly provider: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export function requestOptions(
  config: AiConfig,
  context: AiTransportContext,
): Omit<AiHttpRequest, "url" | "method" | "headers" | "body"> {
  return {
    provider: context.provider,
    timeoutMs: context.timeoutMs ?? config.request.timeoutMs,
    signal: context.signal,
    retries: config.request.retries,
    retryBaseDelayMs: config.request.retryBaseDelayMs,
  };
}

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

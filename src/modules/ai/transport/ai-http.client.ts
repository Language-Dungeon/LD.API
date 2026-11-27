import { AiException } from "../errors/ai-exception";
import type { AiErrorCode } from "../errors/ai-error-codes";

export interface AiHttpRequest {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly headers: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly provider: string;
  readonly retries: number;
  readonly retryBaseDelayMs: number;
}

export interface AiHttpResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly latencyMs: number;
  readonly attempts: number;
}

export interface AiStreamResponse {
  readonly body: AsyncIterable<string>;
  readonly status: number;
  readonly latencyMs: number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const DETAIL_LIMIT = 1024;
const USER_AGENT = "LD.API/ai-module";

export class AiHttpClient {
  async request<T>(request: AiHttpRequest): Promise<AiHttpResponse<T>> {
    const startedAt = performance.now();
    let attempts = 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= request.retries; attempt++) {
      attempts = attempt + 1;

      try {
        const response = await this.send(request);
        const text = await response.text();

        if (!response.ok) {
          const failure = new AiHttpStatusFailure(request.provider, response.status, text);

          if (RETRYABLE_STATUS.has(response.status) && attempt < request.retries) {
            lastError = failure;
            await this.backoff(request, attempt);
            continue;
          }

          throw failure.toException(request.url);
        }

        return {
          data: this.decode<T>(text, request.provider, request.url),
          status: response.status,
          latencyMs: Math.round(performance.now() - startedAt),
          attempts,
        };
      } catch (error) {
        if (error instanceof AiException && !this.retryable(error)) throw error;

        lastError = error;
        if (attempt >= request.retries) break;

        await this.backoff(request, attempt);
      }
    }

    throw this.toException(lastError, request.provider, request.url);
  }

  async stream(request: AiHttpRequest): Promise<AiStreamResponse> {
    const startedAt = performance.now();
    const response = await this.send(request);

    if (!response.ok) {
      const detail = await this.readDetail(response);
      throw new AiHttpStatusFailure(request.provider, response.status, detail).toException(request.url);
    }

    if (!response.body) {
      throw new AiException("AI_STREAM_EMPTY", {
        provider: request.provider,
        details: { url: request.url, status: response.status },
      });
    }

    return {
      body: this.iterate(response.body, request.provider),
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  }

  private async send(request: AiHttpRequest): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new AiTimeoutMarker()), request.timeoutMs);
    const onAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      return await fetch(request.url, {
        method: request.method,
        headers: {
          "content-type": "application/json",
          accept: request.body === undefined ? "application/json" : "application/json, text/event-stream",
          "user-agent": USER_AGENT,
          ...request.headers,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof AiTimeoutMarker) {
        throw new AiException("AI_UPSTREAM_TIMEOUT", {
          provider: request.provider,
          details: { url: request.url, timeoutMs: request.timeoutMs },
        });
      }

      if (request.signal?.aborted) {
        throw new AiException("AI_UPSTREAM_TIMEOUT", {
          provider: request.provider,
          details: { url: request.url, reason: "aborted-by-caller" },
        });
      }

      throw this.toException(error, request.provider, request.url);
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }

  private async *iterate(body: ReadableStream<Uint8Array>, provider: string): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield decoder.decode(value, { stream: true });
      }
    } catch (error) {
      throw this.toException(error, provider, "stream");
    } finally {
      reader.releaseLock();
    }
  }

  private decode<T>(text: string, provider: string, url: string): T {
    if (text.trim().length === 0) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AiException("AI_UPSTREAM_MALFORMED", {
        provider,
        details: { url, bodyPreview: text.slice(0, DETAIL_LIMIT) },
      });
    }
  }

  private async readDetail(response: Response): Promise<string> {
    try {
      return (await response.text()).slice(0, DETAIL_LIMIT);
    } catch {
      return response.statusText;
    }
  }

  private retryable(error: unknown): boolean {
    return error instanceof AiException ? error.transient : true;
  }

  private backoff(request: AiHttpRequest, attempt: number): Promise<void> {
    const delay = Math.min(5_000, request.retryBaseDelayMs * 2 ** attempt);

    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private toException(error: unknown, provider: string, url: string): AiException {
    if (error instanceof AiException) return error;
    if (error instanceof AiHttpStatusFailure) return error.toException(url);

    const candidate = error as { code?: string; message?: string } | null;
    const code = this.networkCode(candidate?.code);

    return new AiException(code, {
      provider,
      details: { url, reason: candidate?.message ?? String(error), errno: candidate?.code },
    });
  }

  private networkCode(code: string | undefined): AiErrorCode {
    if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT") {
      return "AI_UPSTREAM_TIMEOUT";
    }

    return "AI_UPSTREAM_UNREACHABLE";
  }
}

class AiTimeoutMarker extends Error {
  constructor() {
    super("timeout");
    this.name = "AiTimeout";
  }
}

class AiHttpStatusFailure extends Error {
  constructor(
    private readonly provider: string,
    private readonly status: number,
    private readonly detail: string,
  ) {
    super(`${provider} responded with HTTP ${status}`);
    this.name = "AiHttpStatusFailure";
  }

  toException(url: string): AiException {
    return new AiException(this.code(), {
      provider: this.provider,
      details: {
        url,
        status: this.status,
        responsePreview: this.detail.slice(0, DETAIL_LIMIT),
        providerMessage: this.providerMessage(),
      },
    });
  }

  private code(): AiErrorCode {
    if (this.status === 401) return "AI_AUTH_REJECTED";
    if (this.status === 403) return "AI_UPSTREAM_UNAUTHORIZED";
    if (this.status === 404) return "AI_UPSTREAM_MALFORMED";
    if (this.status === 408) return "AI_UPSTREAM_TIMEOUT";
    if (this.status === 429) return "AI_UPSTREAM_RATE_LIMITED";
    if (this.status >= 500) return "AI_UPSTREAM_REJECTED";

    return "AI_UPSTREAM_REJECTED";
  }

  private providerMessage(): string | undefined {
    try {
      const parsed = JSON.parse(this.detail) as { error?: { message?: string } | string; message?: string };
      if (typeof parsed.error === "string") return parsed.error;
      if (parsed.error?.message) return parsed.error.message;
      if (parsed.message) return parsed.message;
    } catch {
      return this.detail.slice(0, 200) || undefined;
    }

    return undefined;
  }
}

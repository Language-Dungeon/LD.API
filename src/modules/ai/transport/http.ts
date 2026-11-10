import { BadGatewayException, GatewayTimeoutException, HttpException } from "@nestjs/common";

export interface JsonRequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxRetries?: number;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ProviderHttpError extends BadGatewayException {
  constructor(
    readonly providerName: string,
    readonly statusCode: number,
    readonly detail: string,
  ) {
    super(`${providerName} responded with ${statusCode}: ${detail}`);
  }
}

function composeSignal(timeoutMs: number, external?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  const onAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", onAbort, { once: true });
  }

  const dispose = () => {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  };

  return { signal: controller.signal, dispose };
}

async function readDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 2048);
  } catch {
    return response.statusText;
  }
}

export async function requestJson<T>(url: string, provider: string, options: JsonRequestOptions = {}): Promise<T> {
  const { method = "POST", headers = {}, body, timeoutMs = 60_000, signal, maxRetries = 2 } = options;

  for (let attempt = 0; ; attempt++) {
    const composed = composeSignal(timeoutMs, signal);

    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: composed.signal,
      });

      if (!response.ok) {
        const detail = await readDetail(response);

        if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }

        throw new ProviderHttpError(provider, response.status, detail);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (signal?.aborted) throw error;
      if (composed.signal.reason instanceof Error && composed.signal.reason.message === "timeout") {
        throw new GatewayTimeoutException(`${provider} timed out after ${timeoutMs}ms`);
      }
      if (attempt >= maxRetries) throw new BadGatewayException(`${provider} request failed: ${String(error)}`);
      await sleep(250 * 2 ** attempt);
    } finally {
      composed.dispose();
    }
  }
}

export interface StreamRequestOptions {
  headers?: Record<string, string>;
  body: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function requestStream(url: string, provider: string, options: StreamRequestOptions): Promise<Response> {
  const composed = composeSignal(options.timeoutMs ?? 300_000, options.signal);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream", ...options.headers },
      body: JSON.stringify(options.body),
      signal: composed.signal,
    });

    if (!response.ok) {
      const detail = await readDetail(response);
      composed.dispose();
      throw new ProviderHttpError(provider, response.status, detail);
    }

    return response;
  } catch (error) {
    composed.dispose();
    if (error instanceof HttpException) throw error;
    throw new BadGatewayException(`${provider} stream failed: ${String(error)}`);
  }
}

export async function* iterateBody(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

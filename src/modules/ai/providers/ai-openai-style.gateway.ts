import { AiException } from "../errors/ai-exception";
import { joinUrl } from "../transport/ai-transport";
import { AiSseDecoder, safeJsonParse } from "../transport/ai-sse.decoder";
import { AiBaseGateway, type AiGatewayDependencies } from "./ai-base.gateway";
import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk, AiUsage } from "./ai-provider.types";

export const BYPASS_HEADERS: Readonly<Record<string, string>> = {
  "x-bypass": "1",
  "x-abacus-bypass": "1",
  "x-provider-priority": "local",
  "x-no-telemetry": "1",
};

export function withBypass(headers: Record<string, string>, bypass: boolean): Record<string, string> {
  return bypass ? { ...headers, ...BYPASS_HEADERS } : headers;
}

export function emptyStream(provider: string): AiException {
  return new AiException("AI_STREAM_EMPTY", { provider });
}

export function usageOf(promptTokens?: number, completionTokens?: number, totalTokens?: number): AiUsage | undefined {
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;

  const prompt = promptTokens ?? 0;
  const completion = completionTokens ?? 0;

  return { promptTokens: prompt, completionTokens: completion, totalTokens: totalTokens ?? prompt + completion };
}

export abstract class OpenAiStyleGateway extends AiBaseGateway {
  constructor(deps: AiGatewayDependencies) {
    super(deps);
  }

  protected headers(bypass: boolean): Record<string, string> {
    const headers: Record<string, string> =
      this.runtime === "local" ? {} : { authorization: `Bearer ${this.deps.credentials.apiKey}` };

    return withBypass(headers, bypass);
  }

  async complete(messages: readonly AiChatMessage[], options?: AiGenerateOptions): Promise<AiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await this.http.request<{
      choices?: { message?: { content?: string | null } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }>({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "chat/completions"),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: this.chatBody(messages, resolved, false),
    });

    const usage = usageOf(
      response.data.usage?.prompt_tokens,
      response.data.usage?.completion_tokens,
      response.data.usage?.total_tokens,
    );

    return this.result(response.data.choices?.[0]?.message?.content ?? "", startedAt, {
      bypass: resolved.bypass,
      usage,
    });
  }

  async *stream(messages: readonly AiChatMessage[], options?: AiGenerateOptions): AsyncIterable<AiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await this.http.stream({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "chat/completions"),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: this.chatBody(messages, resolved, true),
    });

    const decoder = new AiSseDecoder();
    let emitted = false;

    for await (const chunk of response.body) {
      for (const event of decoder.push(chunk)) {
        if (event.data === "[DONE]") {
          yield { delta: "", done: true };
          return;
        }

        const parsed = safeJsonParse<{ choices?: { delta?: { content?: string } }[] }>(event.data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          emitted = true;
          yield { delta, done: false };
        }
      }
    }

    for (const event of decoder.flush()) {
      const parsed = safeJsonParse<{ choices?: { delta?: { content?: string } }[] }>(event.data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) {
        emitted = true;
        yield { delta, done: false };
      }
    }

    if (!emitted) throw emptyStream(this.provider);
    yield { delta: "", done: true };
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.supportsEmbeddings) return [];

    const response = await this.http.request<{ data?: { embedding: number[]; index: number }[] }>({
      ...this.httpOptions(this.resolve()),
      url: joinUrl(this.baseUrl, "embeddings"),
      method: "POST",
      headers: this.headers(this.bypass),
      body: { model: this.embedModel, input: texts },
    });

    return (response.data.data ?? []).sort((left, right) => left.index - right.index).map((item) => item.embedding);
  }

  protected chatBody(
    messages: readonly AiChatMessage[],
    resolved: ReturnType<AiBaseGateway["resolve"]>,
    stream: boolean,
  ): Record<string, unknown> {
    return {
      model: resolved.model,
      messages,
      temperature: resolved.temperature,
      top_p: resolved.topP,
      max_tokens: resolved.maxTokens,
      stop: resolved.stop,
      stream,
      ...(resolved.format === "json" && !stream ? { response_format: { type: "json_object" } } : {}),
    };
  }
}

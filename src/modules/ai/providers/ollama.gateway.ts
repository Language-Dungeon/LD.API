import { joinUrl } from "../transport/ai-transport";
import { AiJsonLineDecoder, safeJsonParse } from "../transport/ai-sse.decoder";
import { emptyStream, usageOf, withBypass } from "./ai-openai-style.gateway";
import { OpenAiStyleGateway } from "./ai-openai-style.gateway";
import type { AiBaseGateway, AiGatewayDependencies } from "./ai-base.gateway";
import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk } from "./ai-provider.types";

interface OllamaChatResponse {
  message?: { content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings?: number[][];
  embedding?: number[];
}

export class OllamaGateway extends OpenAiStyleGateway {
  readonly provider = "ollama";
  readonly runtime = "local";

  constructor(deps: AiGatewayDependencies) {
    super(deps);
  }

  override async complete(
    messages: readonly AiChatMessage[],
    options?: AiGenerateOptions,
  ): Promise<AiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await this.http.request<OllamaChatResponse>({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "api/chat"),
      method: "POST",
      headers: this.headers(true),
      body: this.chatBody(messages, resolved, false),
    });

    const usage = usageOf(
      response.data.prompt_eval_count,
      response.data.eval_count,
      response.data.prompt_eval_count === undefined
        ? undefined
        : (response.data.prompt_eval_count ?? 0) + (response.data.eval_count ?? 0),
    );

    return this.result(response.data.message?.content ?? "", startedAt, { bypass: true, usage });
  }

  override async *stream(
    messages: readonly AiChatMessage[],
    options?: AiGenerateOptions,
  ): AsyncIterable<AiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await this.http.stream({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "api/chat"),
      method: "POST",
      headers: this.headers(true),
      body: this.chatBody(messages, resolved, true),
    });

    const decoder = new AiJsonLineDecoder();
    let emitted = false;

    const consume = (line: string): boolean => {
      const parsed = safeJsonParse<OllamaChatResponse>(line);
      if (!parsed) return false;

      const delta = parsed.message?.content;
      if (delta) emitted = true;

      return parsed.done === true;
    };

    for await (const chunk of response.body) {
      for (const line of decoder.push(chunk)) {
        if (consume(line)) {
          yield { delta: "", done: true };
          return;
        }
      }
    }

    for (const line of decoder.flush()) {
      if (consume(line)) break;
    }

    if (!emitted) throw emptyStream(this.provider);
    yield { delta: "", done: true };
  }

  override async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.supportsEmbeddings) return [];

    const response = await this.http.request<OllamaEmbedResponse>({
      ...this.httpOptions(this.resolve()),
      url: joinUrl(this.baseUrl, "api/embed"),
      method: "POST",
      headers: this.headers(true),
      body: { model: this.embedModel, input: texts },
    });

    if (response.data.embeddings) return response.data.embeddings;
    return response.data.embedding ? [response.data.embedding] : [];
  }

  protected override headers(bypass: boolean): Record<string, string> {
    return withBypass({}, bypass);
  }

  protected override chatBody(
    messages: readonly AiChatMessage[],
    resolved: ReturnType<AiBaseGateway["resolve"]>,
    stream: boolean,
  ): Record<string, unknown> {
    return {
      model: resolved.model,
      messages,
      stream,
      keep_alive: "10m",
      ...(resolved.format === "json" && !stream ? { format: "json" } : {}),
      options: {
        temperature: resolved.temperature,
        top_p: resolved.topP,
        num_predict: resolved.maxTokens,
        stop: resolved.stop,
      },
    };
  }
}

import { joinUrl } from "../transport/ai-transport";
import { AiSseDecoder, safeJsonParse } from "../transport/ai-sse.decoder";
import { OpenAiStyleGateway, emptyStream, usageOf, withBypass } from "./ai-openai-style.gateway";
import type { AiBaseGateway, AiGatewayDependencies } from "./ai-base.gateway";
import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk } from "./ai-provider.types";

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface AnthropicStreamEvent {
  type?: string;
  delta?: { type?: string; text?: string };
}

export class AnthropicGateway extends OpenAiStyleGateway {
  readonly provider = "anthropic";
  readonly runtime = "cloud";

  constructor(deps: AiGatewayDependencies) {
    super(deps);
  }

  override async complete(
    messages: readonly AiChatMessage[],
    options?: AiGenerateOptions,
  ): Promise<AiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await this.http.request<AnthropicResponse>({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "messages"),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: this.payload(messages, resolved),
    });

    const content = (response.data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    const usage = usageOf(response.data.usage?.input_tokens, response.data.usage?.output_tokens);

    return this.result(content, startedAt, { bypass: resolved.bypass, usage });
  }

  override async *stream(
    messages: readonly AiChatMessage[],
    options?: AiGenerateOptions,
  ): AsyncIterable<AiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await this.http.stream({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, "messages"),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: { ...this.payload(messages, resolved), stream: true },
    });

    const decoder = new AiSseDecoder();
    let emitted = false;

    for await (const chunk of response.body) {
      for (const event of decoder.push(chunk)) {
        const parsed = safeJsonParse<AnthropicStreamEvent>(event.data);
        if (!parsed) continue;

        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          emitted = true;
          yield { delta: parsed.delta.text, done: false };
        }

        if (parsed.type === "message_stop") {
          yield { delta: "", done: true };
          return;
        }
      }
    }

    if (!emitted) throw emptyStream(this.provider);
    yield { delta: "", done: true };
  }

  override async embed(): Promise<number[][]> {
    return [];
  }

  protected override headers(bypass: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      "x-api-key": this.deps.credentials.apiKey,
      "anthropic-version": "2023-06-01",
    };

    return withBypass(headers, bypass);
  }

  private payload(messages: readonly AiChatMessage[], resolved: ReturnType<AiBaseGateway["resolve"]>) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    return {
      model: resolved.model,
      max_tokens: resolved.maxTokens,
      temperature: resolved.temperature,
      top_p: resolved.topP,
      stop_sequences: resolved.stop,
      system: system.length > 0 ? system : undefined,
      messages: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content })),
    };
  }
}

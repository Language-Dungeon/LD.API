import { joinUrl } from "../transport/ai-transport";
import { AiSseDecoder, safeJsonParse } from "../transport/ai-sse.decoder";
import { OpenAiStyleGateway, emptyStream, usageOf, withBypass } from "./ai-openai-style.gateway";
import type { AiBaseGateway, AiGatewayDependencies } from "./ai-base.gateway";
import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk } from "./ai-provider.types";

interface GoogleResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

interface GoogleEmbedResponse {
  embeddings?: { values: number[] }[];
}

export class GoogleGateway extends OpenAiStyleGateway {
  readonly provider = "google";
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

    const response = await this.http.request<GoogleResponse>({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, `models/${resolved.model}:generateContent`),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: this.payload(messages, resolved),
    });

    const content = (response.data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
    const usage = usageOf(
      response.data.usageMetadata?.promptTokenCount,
      response.data.usageMetadata?.candidatesTokenCount,
      response.data.usageMetadata?.totalTokenCount,
    );

    return this.result(content, startedAt, { bypass: resolved.bypass, usage });
  }

  override async *stream(
    messages: readonly AiChatMessage[],
    options?: AiGenerateOptions,
  ): AsyncIterable<AiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await this.http.stream({
      ...this.httpOptions(resolved),
      url: joinUrl(this.baseUrl, `models/${resolved.model}:streamGenerateContent?alt=sse`),
      method: "POST",
      headers: this.headers(resolved.bypass),
      body: this.payload(messages, resolved),
    });

    const decoder = new AiSseDecoder();
    let emitted = false;

    for await (const chunk of response.body) {
      for (const event of decoder.push(chunk)) {
        const parsed = safeJsonParse<GoogleResponse>(event.data);
        const delta = (parsed?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
        if (delta) {
          emitted = true;
          yield { delta, done: false };
        }
      }
    }

    if (!emitted) throw emptyStream(this.provider);
    yield { delta: "", done: true };
  }

  override async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.supportsEmbeddings) return [];

    const response = await this.http.request<GoogleEmbedResponse>({
      ...this.httpOptions(this.resolve()),
      url: joinUrl(this.baseUrl, `models/${this.embedModel}:batchEmbedContents`),
      method: "POST",
      headers: this.headers(this.bypass),
      body: {
        requests: texts.map((text) => ({
          model: `models/${this.embedModel}`,
          content: { parts: [{ text }] },
        })),
      },
    });

    return (response.data.embeddings ?? []).map((item) => item.values);
  }

  protected override headers(bypass: boolean): Record<string, string> {
    return withBypass({ "x-goog-api-key": this.deps.credentials.apiKey }, bypass);
  }

  private payload(messages: readonly AiChatMessage[], resolved: ReturnType<AiBaseGateway["resolve"]>) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    return {
      ...(system.length > 0 ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      generationConfig: {
        temperature: resolved.temperature,
        topP: resolved.topP,
        maxOutputTokens: resolved.maxTokens,
        stopSequences: resolved.stop,
        ...(resolved.format === "json" ? { responseMimeType: "application/json" } : {}),
      },
    };
  }
}

import type { ConfigService } from "@nestjs/config";
import {
  type IAiCompletionResult,
  type AiProvider,
  type AiRuntime,
  type AiWireProtocol,
  type IAiChatMessage,
  type IAiCompletionGateway,
  type IAiEmbeddingGateway,
  type IAiGenerateOptions,
  type IAiProviderInfo,
  type IAiStreamChunk,
  type Config,
} from "@types";
import { LoggerService } from "@modules/logger";
import { SseDecoder } from "../transport/sse";
import { iterateBody, requestJson, requestStream } from "../transport/http";

const BYPASS_HEADERS: Record<string, string> = {
  "x-bypass": "1",
  "x-abacus-bypass": "1",
  "x-provider-priority": "local",
  "x-no-telemetry": "1",
};

const LOCAL_ENDPOINT_FALLBACK: Record<AiProvider, string> = {
  ollama: "http://127.0.0.1:11434",
  lmstudio: "http://127.0.0.1:1234/v1",
  llamacpp: "http://127.0.0.1:8080/v1",
  vllm: "http://127.0.0.1:8000/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  deepseek: "https://api.deepseek.com/v1",
};

const RUNTIME: Record<AiProvider, AiRuntime> = {
  ollama: "local",
  lmstudio: "local",
  llamacpp: "local",
  vllm: "local",
  openai: "cloud",
  anthropic: "cloud",
  google: "cloud",
  openrouter: "cloud",
  groq: "cloud",
  mistral: "cloud",
  deepseek: "cloud",
};

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

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface OpenAiEmbedResponse {
  data?: { embedding: number[]; index: number }[];
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface GoogleResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

interface GoogleEmbedResponse {
  embeddings?: { values: number[] }[];
}

export abstract class BaseAiGateway implements IAiCompletionGateway, IAiEmbeddingGateway {
  abstract readonly provider: AiProvider;
  abstract readonly protocol: AiWireProtocol;
  abstract readonly model: string;
  abstract readonly embedModel: string;
  abstract readonly apiKey: string;
  abstract readonly baseUrl: string;

  runtime: AiRuntime;

  constructor(protected readonly config: ConfigService<Config>) {
    this.runtime = "local";
  }

  get info(): IAiProviderInfo {
    return {
      provider: this.provider,
      runtime: this.runtime,
      protocol: this.protocol,
      models: [this.model],
      defaultModel: this.model,
      embedModel: this.embedModel,
    };
  }

  get isLocal(): boolean {
    return this.runtime === "local";
  }

  get available(): boolean {
    return this.isLocal ? this.baseUrl.length > 0 : this.apiKey.length > 0;
  }

  get bypass(): boolean {
    return this.isLocal ? true : this.bypassFlag;
  }

  protected get bypassFlag(): boolean {
    return this.config.get<boolean>("AI_BYPASS") === true;
  }

  protected get timeoutMs(): number {
    return this.config.get<number>("AI_REQUEST_TIMEOUT_MS") ?? 60_000;
  }

  protected get maxTokens(): number {
    return this.config.get<number>("AI_MAX_OUTPUT_TOKENS") ?? 1024;
  }

  protected headers(bypass: boolean): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.protocol === "anthropic") {
      headers["x-api-key"] = this.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      if (bypass) headers["anthropic-beta"] = "cache-control-2024-07-31";
    } else if (this.protocol === "google") {
      headers["x-goog-api-key"] = this.apiKey;
    } else if (!this.isLocal) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    if (bypass) Object.assign(headers, BYPASS_HEADERS);
    return headers;
  }

  abstract complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult>;
  abstract stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk>;
  abstract embed(texts: readonly string[]): Promise<number[][]>;

  protected resolve(options?: IAiGenerateOptions) {
    return {
      model: this.model,
      timeoutMs: options?.timeoutMs ?? this.timeoutMs,
      maxTokens: options?.maxTokens ?? this.maxTokens,
      temperature: options?.temperature ?? 0.6,
      topP: options?.topP ?? 0.95,
      stop: options?.stop,
      format: options?.format ?? "text",
      signal: options?.signal,
      bypass: options?.bypass ?? this.bypass,
    };
  }

  protected result(
    content: string,
    options: { bypass: boolean; model?: string; latencyMs: number; usage?: IAiCompletionResult["usage"] },
  ): IAiCompletionResult {
    return {
      content,
      provider: this.provider,
      runtime: this.runtime,
      model: options.model ?? this.model,
      usage: options.usage,
      latencyMs: options.latencyMs,
      bypassed: options.bypass,
    };
  }

  protected get log(): LoggerService {
    return new LoggerService(`AI:${this.provider}`, this.config);
  }
}

export class OpenAiCompatibleGateway extends BaseAiGateway {
  readonly protocol = "openai" as const;
  readonly provider: AiProvider;
  readonly model: string;
  readonly embedModel: string;
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(
    config: ConfigService<Config>,
    provider: AiProvider,
    prefix: string,
    defaultModel: string,
    defaultEmbedModel: string,
  ) {
    super(config);

    this.provider = provider;
    this.runtime = RUNTIME[provider];
    this.model = this.string(`${prefix}_MODEL`) ?? defaultModel;
    this.embedModel = this.string(`${prefix}_EMBED_MODEL`) ?? defaultEmbedModel;
    this.apiKey = this.string(`${prefix}_API_KEY`) ?? "";
    this.baseUrl = (this.string(`${prefix}_URL`) ?? LOCAL_ENDPOINT_FALLBACK[provider]).replace(/\/+$/, "");
  }

  private string(key: string): string | undefined {
    return this.config.get<string>(key as keyof Config);
  }

  async complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const body = {
      model: resolved.model,
      messages,
      temperature: resolved.temperature,
      top_p: resolved.topP,
      max_tokens: resolved.maxTokens,
      stop: resolved.stop,
      stream: false,
      ...(resolved.format === "json" ? { response_format: { type: "json_object" } } : {}),
    };

    const response = await requestJson<OpenAiChatResponse>(`${this.baseUrl}/chat/completions`, this.provider, {
      headers: this.headers(resolved.bypass),
      body,
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? 0,
          completionTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
        }
      : undefined;

    return this.result(content, {
      bypass: resolved.bypass,
      latencyMs: Math.round(performance.now() - startedAt),
      usage,
    });
  }

  async *stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await requestStream(`${this.baseUrl}/chat/completions`, this.provider, {
      headers: this.headers(resolved.bypass),
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
      body: {
        model: resolved.model,
        messages,
        temperature: resolved.temperature,
        top_p: resolved.topP,
        max_tokens: resolved.maxTokens,
        stop: resolved.stop,
        stream: true,
      },
    });

    if (!response.body) return;

    const decoder = new SseDecoder();

    for await (const chunk of iterateBody(response.body)) {
      for (const message of decoder.push(chunk)) {
        if (message.data === "[DONE]") {
          yield { delta: "", done: true };
          return;
        }

        const parsed = safeParse<{ choices?: { delta?: { content?: string } }[] }>(message.data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) yield { delta, done: false };
      }
    }

    for (const message of decoder.flush()) {
      const parsed = safeParse<{ choices?: { delta?: { content?: string } }[] }>(message.data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (delta) yield { delta, done: false };
    }

    yield { delta: "", done: true };
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.embedModel) return [];

    const response = await requestJson<OpenAiEmbedResponse>(`${this.baseUrl}/embeddings`, this.provider, {
      headers: this.headers(this.bypass),
      body: { model: this.embedModel, input: texts },
      timeoutMs: this.timeoutMs,
    });

    const data = response.data ?? [];
    return data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}

export class OllamaGateway extends BaseAiGateway {
  readonly provider = "ollama" as const;
  readonly protocol = "ollama" as const;
  readonly model: string;
  readonly embedModel: string;
  readonly apiKey = "";
  readonly baseUrl: string;

  constructor(config: ConfigService<Config>) {
    super(config);

    this.model = config.get<string>("AI_OLLAMA_MODEL") ?? "llama3.2";
    this.embedModel = config.get<string>("AI_OLLAMA_EMBED_MODEL") ?? "nomic-embed-text";
    this.baseUrl = (config.get<string>("AI_OLLAMA_URL") ?? LOCAL_ENDPOINT_FALLBACK.ollama).replace(/\/+$/, "");
  }

  async complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await requestJson<OllamaChatResponse>(`${this.baseUrl}/api/chat`, this.provider, {
      headers: this.headers(true),
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
      body: {
        model: resolved.model,
        messages,
        stream: false,
        keep_alive: "10m",
        ...(resolved.format === "json" ? { format: "json" } : {}),
        options: {
          temperature: resolved.temperature,
          top_p: resolved.topP,
          num_predict: resolved.maxTokens,
          stop: resolved.stop,
        },
      },
    });

    const usage = response.prompt_eval_count
      ? {
          promptTokens: response.prompt_eval_count,
          completionTokens: response.eval_count ?? 0,
          totalTokens: response.prompt_eval_count + (response.eval_count ?? 0),
        }
      : undefined;

    return this.result(response.message?.content ?? "", {
      bypass: true,
      latencyMs: Math.round(performance.now() - startedAt),
      usage,
    });
  }

  async *stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await requestStream(`${this.baseUrl}/api/chat`, this.provider, {
      headers: this.headers(true),
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
      body: {
        model: resolved.model,
        messages,
        stream: true,
        keep_alive: "10m",
        options: {
          temperature: resolved.temperature,
          top_p: resolved.topP,
          num_predict: resolved.maxTokens,
          stop: resolved.stop,
        },
      },
    });

    if (!response.body) return;

    for await (const chunk of iterateBody(response.body)) {
      for (const line of chunk.split("\n")) {
        const parsed = safeParse<OllamaChatResponse>(line.trim());
        if (!parsed) continue;

        const delta = parsed.message?.content;
        if (delta) yield { delta, done: false };
        if (parsed.done) {
          yield { delta: "", done: true };
          return;
        }
      }
    }

    yield { delta: "", done: true };
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.embedModel) return [];

    const response = await requestJson<OllamaEmbedResponse>(`${this.baseUrl}/api/embed`, this.provider, {
      headers: this.headers(true),
      body: { model: this.embedModel, input: texts },
      timeoutMs: this.timeoutMs,
    });

    if (response.embeddings) return response.embeddings;
    return response.embedding ? [response.embedding] : [];
  }
}

export class AnthropicGateway extends BaseAiGateway {
  readonly provider = "anthropic" as const;
  readonly protocol = "anthropic" as const;
  readonly model: string;
  readonly embedModel = "";
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(config: ConfigService<Config>) {
    super(config);

    this.model = config.get<string>("AI_ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-latest";
    this.apiKey = config.get<string>("AI_ANTHROPIC_API_KEY") ?? "";
    this.baseUrl = (config.get<string>("AI_ANTHROPIC_URL") ?? LOCAL_ENDPOINT_FALLBACK.anthropic).replace(/\/+$/, "");
  }

  private payload(messages: readonly IAiChatMessage[], resolved: ReturnType<BaseAiGateway["resolve"]>) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    return {
      model: resolved.model,
      max_tokens: resolved.maxTokens,
      temperature: resolved.temperature,
      top_p: resolved.topP,
      stop_sequences: resolved.stop,
      system: system || undefined,
      messages: conversation,
    };
  }

  async complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await requestJson<AnthropicResponse>(`${this.baseUrl}/messages`, this.provider, {
      headers: this.headers(resolved.bypass),
      body: this.payload(messages, resolved),
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
    });

    const content = (response.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    const usage = response.usage
      ? {
          promptTokens: response.usage.input_tokens ?? 0,
          completionTokens: response.usage.output_tokens ?? 0,
          totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
        }
      : undefined;

    return this.result(content, {
      bypass: resolved.bypass,
      latencyMs: Math.round(performance.now() - startedAt),
      usage,
    });
  }

  async *stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await requestStream(`${this.baseUrl}/messages`, this.provider, {
      headers: this.headers(resolved.bypass),
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
      body: { ...this.payload(messages, resolved), stream: true },
    });

    if (!response.body) return;

    const decoder = new SseDecoder();

    for await (const chunk of iterateBody(response.body)) {
      for (const message of decoder.push(chunk)) {
        const parsed = safeParse<{ type?: string; delta?: { type?: string; text?: string } }>(message.data);
        if (!parsed) continue;

        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          yield { delta: parsed.delta.text, done: false };
        }

        if (parsed.type === "message_stop") {
          yield { delta: "", done: true };
          return;
        }
      }
    }

    yield { delta: "", done: true };
  }

  async embed(): Promise<number[][]> {
    return [];
  }
}

export class GoogleGateway extends BaseAiGateway {
  readonly provider = "google" as const;
  readonly protocol = "google" as const;
  readonly model: string;
  readonly embedModel: string;
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor(config: ConfigService<Config>) {
    super(config);

    this.model = config.get<string>("AI_GOOGLE_MODEL") ?? "gemini-2.0-flash";
    this.embedModel = config.get<string>("AI_GOOGLE_EMBED_MODEL") ?? "text-embedding-004";
    this.apiKey = config.get<string>("AI_GOOGLE_API_KEY") ?? "";
    this.baseUrl = (config.get<string>("AI_GOOGLE_URL") ?? LOCAL_ENDPOINT_FALLBACK.google).replace(/\/+$/, "");
  }

  private payload(messages: readonly IAiChatMessage[], resolved: ReturnType<BaseAiGateway["resolve"]>) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
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

  async complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult> {
    const resolved = this.resolve(options);
    const startedAt = performance.now();

    const response = await requestJson<GoogleResponse>(
      `${this.baseUrl}/models/${resolved.model}:generateContent`,
      this.provider,
      {
        headers: this.headers(resolved.bypass),
        body: this.payload(messages, resolved),
        timeoutMs: resolved.timeoutMs,
        signal: resolved.signal,
      },
    );

    const content = (response.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
    const usage = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount ?? 0,
          completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: response.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined;

    return this.result(content, {
      bypass: resolved.bypass,
      latencyMs: Math.round(performance.now() - startedAt),
      usage,
    });
  }

  async *stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk> {
    const resolved = this.resolve(options);

    const response = await requestStream(
      `${this.baseUrl}/models/${resolved.model}:streamGenerateContent?alt=sse`,
      this.provider,
      {
        headers: this.headers(resolved.bypass),
        timeoutMs: resolved.timeoutMs,
        signal: resolved.signal,
        body: this.payload(messages, resolved),
      },
    );

    if (!response.body) return;

    const decoder = new SseDecoder();

    for await (const chunk of iterateBody(response.body)) {
      for (const message of decoder.push(chunk)) {
        const parsed = safeParse<GoogleResponse>(message.data);
        const delta = (parsed?.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
        if (delta) yield { delta, done: false };
      }
    }

    yield { delta: "", done: true };
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (!this.embedModel) return [];

    const response = await requestJson<GoogleEmbedResponse>(
      `${this.baseUrl}/models/${this.embedModel}:batchEmbedContents`,
      this.provider,
      {
        headers: this.headers(this.bypass),
        body: {
          requests: texts.map((text) => ({
            model: `models/${this.embedModel}`,
            content: { parts: [{ text }] },
          })),
        },
        timeoutMs: this.timeoutMs,
      },
    );

    return (response.embeddings ?? []).map((item) => item.values);
  }
}

function safeParse<T>(value: string): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function buildGateway(config: ConfigService<Config>, provider: AiProvider): BaseAiGateway {
  switch (provider) {
    case "ollama":
      return new OllamaGateway(config);
    case "lmstudio":
      return new OpenAiCompatibleGateway(config, "lmstudio", "LMSTUDIO", "local-model", "nomic-embed-text");
    case "llamacpp":
      return new OpenAiCompatibleGateway(config, "llamacpp", "LLAMACPP", "local-model", "");
    case "vllm":
      return new OpenAiCompatibleGateway(config, "vllm", "VLLM", "local-model", "");
    case "openai":
      return new OpenAiCompatibleGateway(config, "openai", "OPENAI", "gpt-4o-mini", "text-embedding-3-small");
    case "openrouter":
      return new OpenAiCompatibleGateway(config, "openrouter", "OPENROUTER", "meta-llama/llama-3.1-8b-instruct", "");
    case "groq":
      return new OpenAiCompatibleGateway(config, "groq", "GROQ", "llama-3.1-8b-instant", "");
    case "mistral":
      return new OpenAiCompatibleGateway(config, "mistral", "MISTRAL", "mistral-small-latest", "mistral-embed");
    case "deepseek":
      return new OpenAiCompatibleGateway(config, "deepseek", "DEEPSEEK", "deepseek-chat", "");
    case "anthropic":
      return new AnthropicGateway(config);
    case "google":
      return new GoogleGateway(config);
  }
}

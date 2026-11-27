import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk, AiUsage } from "./ai-provider.types";
import type { AiConfig, AiProviderCredentials } from "../config/ai-config.types";
import { AiHttpClient } from "../transport/ai-http.client";
import type { AiWireProtocol } from "../config/provider";

export interface AiResolvedOptions {
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly topP: number;
  readonly stop?: readonly string[];
  readonly format: "text" | "json";
  readonly signal?: AbortSignal;
  readonly bypass: boolean;
}

export interface AiGatewayDependencies {
  readonly config: AiConfig;
  readonly http: AiHttpClient;
  readonly credentials: AiProviderCredentials;
  readonly protocol: AiWireProtocol;
  readonly bypass: boolean;
}

export abstract class AiBaseGateway {
  abstract readonly provider: string;
  abstract readonly runtime: string;

  constructor(protected readonly deps: AiGatewayDependencies) {}

  get protocol(): AiWireProtocol {
    return this.deps.protocol;
  }

  get model(): string {
    return this.deps.credentials.model;
  }

  get embedModel(): string {
    return this.deps.credentials.embedModel;
  }

  get baseUrl(): string {
    return this.deps.credentials.baseUrl;
  }

  get supportsEmbeddings(): boolean {
    return this.embedModel.length > 0;
  }

  get bypass(): boolean {
    return this.deps.bypass;
  }

  protected get http(): AiHttpClient {
    return this.deps.http;
  }

  abstract complete(messages: readonly AiChatMessage[], options?: AiGenerateOptions): Promise<AiCompletionResult>;
  abstract stream(messages: readonly AiChatMessage[], options?: AiGenerateOptions): AsyncIterable<AiStreamChunk>;
  abstract embed(texts: readonly string[]): Promise<number[][]>;

  protected resolve(options?: AiGenerateOptions): AiResolvedOptions {
    return {
      model: this.model,
      timeoutMs: options?.timeoutMs ?? this.deps.config.request.timeoutMs,
      maxTokens: options?.maxTokens ?? this.deps.config.request.maxOutputTokens,
      temperature: options?.temperature ?? this.deps.config.request.temperature,
      topP: options?.topP ?? this.deps.config.request.topP,
      stop: options?.stop,
      format: options?.format ?? "text",
      signal: options?.signal,
      bypass: options?.bypass ?? this.bypass,
    };
  }

  protected result(
    content: string,
    startedAt: number,
    options: { bypass: boolean; usage?: AiUsage; model?: string },
  ): AiCompletionResult {
    return {
      content,
      provider: this.provider,
      runtime: this.runtime,
      model: options.model ?? this.model,
      usage: options.usage,
      latencyMs: Math.round(performance.now() - startedAt),
      bypassed: options.bypass,
    };
  }

  protected httpOptions(resolved: AiResolvedOptions) {
    return {
      provider: this.provider,
      timeoutMs: resolved.timeoutMs,
      signal: resolved.signal,
      retries: this.deps.config.request.retries,
      retryBaseDelayMs: this.deps.config.request.retryBaseDelayMs,
    };
  }
}

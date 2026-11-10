import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AI_CLOUD_PROVIDERS,
  AI_LOCAL_PROVIDERS,
  type AiProvider,
  type AiRuntime,
  type IAiChatMessage,
  type IAiCompletionGateway,
  type IAiCompletionResult,
  type IAiEmbeddingGateway,
  type IAiGenerateOptions,
  type IAiProviderInfo,
  type IAiStreamChunk,
  type Config,
} from "@types";
import { LoggerService } from "@modules/logger";
import { buildGateway, type BaseAiGateway } from "./gateway";

const FALLBACK_ORDER: AiProvider[] = ["ollama", "lmstudio", "llamacpp", "vllm"];

@Injectable()
export class AiGatewayService implements IAiCompletionGateway, IAiEmbeddingGateway {
  private readonly gateways = new Map<AiProvider, BaseAiGateway>();

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly logger: LoggerService,
  ) {}

  get provider(): AiProvider {
    return this.resolveProvider();
  }

  get runtime(): AiRuntime {
    return this.gateway(this.provider).runtime;
  }

  get model(): string {
    return this.gateway(this.provider).model;
  }

  list(): IAiProviderInfo[] {
    return (this.enabledProviders() ?? []).map((provider) => this.gateway(provider).info);
  }

  gateway(provider?: AiProvider): BaseAiGateway {
    const resolved = provider ?? this.resolveProvider();

    const cached = this.gateways.get(resolved);
    if (cached) return cached;

    const gateway = buildGateway(this.config, resolved);
    this.gateways.set(resolved, gateway);
    return gateway;
  }

  async complete(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): Promise<IAiCompletionResult> {
    return this.withFailover((gateway) => gateway.complete(messages, { ...options, bypass: options?.bypass ?? true }));
  }

  async *stream(messages: readonly IAiChatMessage[], options?: IAiGenerateOptions): AsyncIterable<IAiStreamChunk> {
    const candidates = this.candidates();
    let lastError: unknown;

    for (const provider of candidates) {
      const gateway = this.gateway(provider);

      try {
        for await (const chunk of gateway.stream(messages, { ...options, bypass: options?.bypass ?? true })) {
          yield chunk;
        }
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`AI stream failed on ${provider}: ${String(error)}`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("No AI provider available for streaming");
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    for (const provider of this.candidates(true)) {
      const gateway = this.gateway(provider);
      if (!gateway.embedModel) continue;

      try {
        const vectors = await gateway.embed(texts);
        if (vectors.length === texts.length) return vectors;
      } catch (error) {
        this.logger.warn(`AI embedding failed on ${provider}: ${String(error)}`);
      }
    }

    return [];
  }

  resolveProvider(): AiProvider {
    const configured = this.config.get<AiProvider>("AI_DEFAULT_PROVIDER") ?? "ollama";

    if (
      this.config.get<boolean>("AI_FORCE_LOCAL") === true &&
      !(AI_LOCAL_PROVIDERS as readonly AiProvider[]).includes(configured)
    ) {
      return FALLBACK_ORDER.find((provider) => this.gateway(provider).available) ?? "ollama";
    }

    return configured;
  }

  private async withFailover(
    run: (gateway: BaseAiGateway) => Promise<IAiCompletionResult>,
  ): Promise<IAiCompletionResult> {
    let lastError: unknown;

    for (const provider of this.candidates()) {
      try {
        return await run(this.gateway(provider));
      } catch (error) {
        lastError = error;
        this.logger.warn(`AI completion failed on ${provider}: ${String(error)}`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("No AI provider available");
  }

  private candidates(requireEmbeddings = false): AiProvider[] {
    const configured = this.config.get<string>("AI_FAILOVER_CHAIN") ?? "";
    const fromEnv = configured
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is AiProvider => value.length > 0);

    const preferred = this.resolveProvider();
    const chain = [preferred, ...fromEnv, ...FALLBACK_ORDER];
    const enabled = new Set<AiProvider>(this.enabledProviders());

    const seen = new Set<AiProvider>();
    const result: AiProvider[] = [];

    for (const provider of chain) {
      if (seen.has(provider) || !enabled.has(provider)) continue;

      const gateway = this.gateway(provider);
      if (!gateway.available) continue;
      if (requireEmbeddings && !gateway.embedModel) continue;

      seen.add(provider);
      result.push(provider);
    }

    return result.length > 0 ? result : [preferred];
  }

  private enabledProviders(): AiProvider[] {
    const localEnabled = this.config.get<boolean>("AI_LOCAL_ENABLED") !== false;
    const cloudEnabled = this.config.get<boolean>("AI_CLOUD_ENABLED") !== false;

    return [...(localEnabled ? AI_LOCAL_PROVIDERS : []), ...(cloudEnabled ? AI_CLOUD_PROVIDERS : [])] as AiProvider[];
  }
}

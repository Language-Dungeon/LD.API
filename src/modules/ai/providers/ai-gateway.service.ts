import { Inject, Injectable } from "@nestjs/common";
import { AiException } from "../errors/ai-exception";
import { AiErrorClassifier } from "../errors/ai-error-classifier";
import { AiIssueCollector } from "../errors/ai-diagnostics";
import { safeHost } from "../errors/ai-redaction";
import type { AiErrorCode } from "../errors/ai-error-codes";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";
import { AI_PROVIDERS, isAiProvider, isLocalProvider, runtimeOf, type AiProvider } from "../config/provider";
import { AiEnv } from "../config/ai-env";
import { ConfigService } from "@nestjs/config";
import type { Config } from "@types";
import { AiGatewayRegistry } from "./ai-gateway.registry";
import type { AiBaseGateway } from "./ai-base.gateway";
import type { AiChatMessage, AiCompletionResult, AiGenerateOptions, AiStreamChunk } from "./ai-provider.types";
import type { AiProviderFailure, AiProviderInfo, AiProviderProbe, AiRoutePlan } from "./ai-provider-status";

const PROBE_TIMEOUT_MS = 4_000;
const PROBE_TOKENS = 8;

@Injectable()
export class AiGatewayService {
  constructor(
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
    private readonly source: ConfigService<Config>,
    private readonly registry: AiGatewayRegistry,
  ) {}

  get provider(): AiProvider {
    return this.preferred();
  }

  get runtime(): string {
    return runtimeOf(this.preferred());
  }

  get model(): string {
    return this.gateway(this.preferred()).model;
  }

  get hasEmbeddings(): boolean {
    return this.embeddingCandidates().length > 0;
  }

  gateway(provider?: AiProvider): AiBaseGateway {
    return this.registry.create(provider ?? this.preferred());
  }

  resolve(provider: unknown): AiBaseGateway {
    if (!isAiProvider(provider)) {
      throw new AiException("AI_PROVIDER_NOT_FOUND", {
        details: { provider: String(provider), supported: AI_PROVIDERS },
      });
    }

    const gateway = this.gateway(provider);
    if (!this.isEnabled(provider)) {
      throw new AiException("AI_PROVIDER_DISABLED", { provider });
    }
    if (!this.isAvailable(provider)) throw AiGatewayRegistry.unavailable(provider);

    return gateway;
  }

  list(): AiProviderInfo[] {
    return this.registry.all().map((gateway) => this.describe(gateway));
  }

  describe(gateway: AiBaseGateway): AiProviderInfo {
    const provider = gateway.provider as AiProvider;
    const credentials = AiEnv.credentials(this.source, provider);

    return {
      provider: gateway.provider,
      runtime: gateway.runtime,
      protocol: gateway.protocol,
      model: gateway.model,
      embedModel: gateway.embedModel,
      baseUrlHost: safeHost(gateway.baseUrl),
      hasApiKey: credentials.apiKey.length > 0,
      available: this.isAvailable(provider),
      enabled: this.isEnabled(provider),
      supportsEmbeddings: gateway.supportsEmbeddings,
    };
  }

  route(): AiRoutePlan {
    const preferred = this.preferred();
    const skipped: { provider: string; reason: string }[] = [];

    const chain = AI_PROVIDERS.filter((provider) => {
      if (!this.isEnabled(provider)) {
        skipped.push({ provider, reason: "disabled-by-config" });
        return false;
      }
      if (!this.isAvailable(provider)) {
        skipped.push({ provider, reason: isLocalProvider(provider) ? "missing-base-url" : "missing-api-key" });
        return false;
      }

      return true;
    });

    const ordered = [
      preferred,
      ...this.config.failoverChain,
      ...chain.filter(isLocalProvider),
      ...chain.filter((provider) => !isLocalProvider(provider)),
    ];

    const candidates = [...new Set(ordered)].filter((provider) => chain.includes(provider));

    return { preferred, candidates, chain, skipped };
  }

  async complete(messages: readonly AiChatMessage[], options?: AiGenerateOptions): Promise<AiCompletionResult> {
    return this.withFailover((gateway) => gateway.complete(messages, options));
  }

  async *stream(messages: readonly AiChatMessage[], options?: AiGenerateOptions): AsyncIterable<AiStreamChunk> {
    const failures: AiProviderFailure[] = [];

    for (const provider of this.candidates()) {
      const startedAt = performance.now();
      let emitted = false;

      try {
        for await (const chunk of this.gateway(provider).stream(messages, options)) {
          if (chunk.delta) emitted = true;
          yield chunk;
        }

        return;
      } catch (error) {
        const classification = AiErrorClassifier.classify(error);
        const code: AiErrorCode = classification?.code ?? "AI_INTERNAL_ERROR";

        if (
          emitted ||
          (code !== "AI_STREAM_EMPTY" && code !== "AI_UPSTREAM_UNREACHABLE" && code !== "AI_UPSTREAM_TIMEOUT")
        ) {
          throw error;
        }

        failures.push({
          provider,
          code,
          detail: AiErrorClassifier.describe(error, provider),
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }
    }

    throw this.exhausted("stream", failures);
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.config.embeddings.enabled) throw new AiException("AI_EMBEDDINGS_DISABLED");

    const failures: AiProviderFailure[] = [];

    for (const provider of this.embeddingCandidates()) {
      const startedAt = performance.now();

      try {
        const vectors = await this.gateway(provider).embed(texts);
        if (vectors.length === texts.length) return vectors;

        failures.push({
          provider,
          code: "AI_EMBEDDINGS_MISMATCH",
          detail: `expected ${texts.length} vectors, received ${vectors.length}`,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        failures.push({
          provider,
          code: AiErrorClassifier.classify(error)?.code ?? "AI_INTERNAL_ERROR",
          detail: AiErrorClassifier.describe(error, provider),
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }
    }

    throw new AiException("AI_EMBEDDINGS_UNAVAILABLE", { details: { attempts: failures } });
  }

  async probe(provider: AiProvider): Promise<AiProviderProbe> {
    const gateway = this.gateway(provider);
    const credentials = AiEnv.credentials(this.source, provider);
    const issues = new AiIssueCollector();

    if (!this.isEnabled(provider)) issues.error("AI_PROVIDER_DISABLED", { provider });
    if (!this.isAvailable(provider)) {
      issues.error(isLocalProvider(provider) ? "AI_PROVIDER_UNAVAILABLE" : "AI_AUTH_MISSING", { provider });
    }

    const base = {
      provider,
      runtime: gateway.runtime,
      model: gateway.model,
      configured: this.isAvailable(provider),
      enabled: this.isEnabled(provider),
      available: this.isAvailable(provider),
      supportsEmbeddings: gateway.supportsEmbeddings,
      baseUrlHost: safeHost(gateway.baseUrl),
      hasApiKey: credentials.apiKey.length > 0,
      apiKeyLength: credentials.apiKey.length,
    };

    if (issues.hasErrors()) {
      return { ...base, ok: false, issues: issues.all().map((issue) => issue.message) };
    }

    const startedAt = performance.now();

    try {
      await gateway.complete([{ role: "user", content: "ping" }], {
        maxTokens: PROBE_TOKENS,
        timeoutMs: Math.min(PROBE_TIMEOUT_MS, this.config.request.timeoutMs),
      });

      return { ...base, ok: true, latencyMs: Math.round(performance.now() - startedAt), issues: [] };
    } catch (error) {
      const classification = AiErrorClassifier.classify(error);
      issues.fromException(error, provider);

      return {
        ...base,
        ok: false,
        latencyMs: Math.round(performance.now() - startedAt),
        error: AiErrorClassifier.describe(error, provider),
        issues: [
          ...issues.all().map((issue) => issue.message),
          ...(classification?.providerStatus ? [`provider HTTP status ${classification.providerStatus}`] : []),
        ],
      };
    }
  }

  async probeAll(): Promise<AiProviderProbe[]> {
    const providers = AI_PROVIDERS.filter((provider) => this.isEnabled(provider));

    return Promise.all(providers.map((provider) => this.probe(provider)));
  }

  preferred(): AiProvider {
    const declared = AiEnv.defaultProvider(this.source);
    if (!this.config.forceLocal || isLocalProvider(declared)) return declared;

    const local = this.candidates().find((provider) => isLocalProvider(provider));

    return local ?? AI_PROVIDERS[0];
  }

  isEnabled(provider: AiProvider): boolean {
    return isLocalProvider(provider) ? this.config.localEnabled : this.config.cloudEnabled;
  }

  isAvailable(provider: AiProvider): boolean {
    const credentials = AiEnv.credentials(this.source, provider);

    return isLocalProvider(provider) ? credentials.baseUrl.length > 0 : credentials.apiKey.length > 0;
  }

  private candidates(): AiProvider[] {
    return this.route().candidates as AiProvider[];
  }

  private embeddingCandidates(): AiProvider[] {
    if (!this.config.embeddings.enabled) return [];

    return this.candidates().filter((provider) => this.gateway(provider).supportsEmbeddings);
  }

  private async withFailover(
    run: (gateway: AiBaseGateway) => Promise<AiCompletionResult>,
  ): Promise<AiCompletionResult> {
    const failures: AiProviderFailure[] = [];

    for (const provider of this.candidates()) {
      const startedAt = performance.now();

      try {
        return await run(this.gateway(provider));
      } catch (error) {
        failures.push({
          provider,
          code: AiErrorClassifier.classify(error)?.code ?? "AI_INTERNAL_ERROR",
          status: AiErrorClassifier.classify(error)?.providerStatus,
          detail: AiErrorClassifier.describe(error, provider),
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }
    }

    throw this.exhausted("completion", failures);
  }

  private exhausted(operation: string, failures: readonly AiProviderFailure[]): AiException {
    return new AiException("AI_PROVIDERS_EXHAUSTED", {
      details: { operation, attempts: failures, route: this.route() },
    });
  }
}

import { AiHttpClient } from "../transport/ai-http.client";
import type { AiConfig } from "../config/ai-config.types";
import { isLocalProvider, runtimeOf, type AiProvider } from "../config/provider";
import { AiEnv } from "../config/ai-env";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import { Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Config } from "@types";
import { AiException } from "../errors/ai-exception";
import { AiBaseGateway, type AiGatewayDependencies } from "./ai-base.gateway";
import { OpenAiStyleGateway } from "./ai-openai-style.gateway";
import { OllamaGateway } from "./ollama.gateway";
import { AnthropicGateway } from "./anthropic.gateway";
import { GoogleGateway } from "./google.gateway";

class OpenAiStyleConcreteGateway extends OpenAiStyleGateway {
  readonly provider: string;
  readonly runtime: string;

  constructor(provider: AiProvider, deps: AiGatewayDependencies) {
    super(deps);
    this.provider = provider;
    this.runtime = runtimeOf(provider);
  }
}

export class AiGatewayRegistry {
  private readonly cache = new Map<AiProvider, AiBaseGateway>();

  constructor(
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
    private readonly source: ConfigService<Config>,
    private readonly http: AiHttpClient,
  ) {}

  create(provider: AiProvider): AiBaseGateway {
    const cached = this.cache.get(provider);
    if (cached) return cached;

    const credentials = AiEnv.credentials(this.source, provider);
    const bypass = isLocalProvider(provider) ? true : this.config.bypass;

    const deps = {
      config: this.config,
      http: this.http,
      credentials,
      protocol: AiEnv.protocolOf(provider),
      bypass,
    };

    const gateway = this.build(provider, deps);
    this.cache.set(provider, gateway);

    return gateway;
  }

  all(): AiBaseGateway[] {
    return AiEnv.enabledProviders(this.config).map((provider) => this.create(provider));
  }

  private build(provider: AiProvider, deps: AiGatewayDependencies): AiBaseGateway {
    switch (provider) {
      case "ollama":
        return new OllamaGateway(deps);
      case "anthropic":
        return new AnthropicGateway(deps);
      case "google":
        return new GoogleGateway(deps);
      default:
        return new OpenAiStyleConcreteGateway(provider, deps);
    }
  }

  static unavailable(provider: AiProvider): AiException {
    const isLocal = isLocalProvider(provider);

    return new AiException(isLocal ? "AI_PROVIDER_UNAVAILABLE" : "AI_AUTH_MISSING", {
      provider,
      details: { requirement: isLocal ? "baseUrl" : "apiKey" },
    });
  }
}

import { AI_EMBED_CACHE_KEY_PREFIX } from "./ai-config.factory";
import { AI_CLOUD_PROVIDERS, AI_LOCAL_PROVIDERS, AI_PROVIDERS, type AiProvider } from "./provider";
import type { AiConfig, AiProviderCredentials } from "./ai-config.types";
import type { ConfigService } from "@nestjs/config";
import type { Config } from "@types";

interface ProviderDefinition {
  readonly prefix: string;
  readonly protocol: "ollama" | "openai" | "anthropic" | "google";
  readonly defaultUrl: string;
  readonly defaultModel: string;
  readonly defaultEmbedModel: string;
}

const DEFINITIONS: Record<AiProvider, ProviderDefinition> = {
  ollama: {
    prefix: "AI_OLLAMA",
    protocol: "ollama",
    defaultUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.2",
    defaultEmbedModel: "nomic-embed-text",
  },
  lmstudio: {
    prefix: "AI_LMSTUDIO",
    protocol: "openai",
    defaultUrl: "http://127.0.0.1:1234/v1",
    defaultModel: "local-model",
    defaultEmbedModel: "nomic-embed-text",
  },
  llamacpp: {
    prefix: "AI_LLAMACPP",
    protocol: "openai",
    defaultUrl: "http://127.0.0.1:8080/v1",
    defaultModel: "local-model",
    defaultEmbedModel: "",
  },
  vllm: {
    prefix: "AI_VLLM",
    protocol: "openai",
    defaultUrl: "http://127.0.0.1:8000/v1",
    defaultModel: "local-model",
    defaultEmbedModel: "",
  },
  openai: {
    prefix: "AI_OPENAI",
    protocol: "openai",
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small",
  },
  anthropic: {
    prefix: "AI_ANTHROPIC",
    protocol: "anthropic",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
    defaultEmbedModel: "",
  },
  google: {
    prefix: "AI_GOOGLE",
    protocol: "google",
    defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    defaultEmbedModel: "text-embedding-004",
  },
  openrouter: {
    prefix: "AI_OPENROUTER",
    protocol: "openai",
    defaultUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.1-8b-instruct",
    defaultEmbedModel: "",
  },
  groq: {
    prefix: "AI_GROQ",
    protocol: "openai",
    defaultUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-8b-instant",
    defaultEmbedModel: "",
  },
  mistral: {
    prefix: "AI_MISTRAL",
    protocol: "openai",
    defaultUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    defaultEmbedModel: "mistral-embed",
  },
  deepseek: {
    prefix: "AI_DEEPSEEK",
    protocol: "openai",
    defaultUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    defaultEmbedModel: "",
  },
};

const VALID_KEYS = [
  ...AI_PROVIDERS.flatMap((provider) => {
    const { prefix } = DEFINITIONS[provider];
    return [`${prefix}_URL`, `${prefix}_MODEL`, `${prefix}_EMBED_MODEL`, `${prefix}_API_KEY`];
  }),
  "AI_LOCAL_ENABLED",
  "AI_CLOUD_ENABLED",
  "AI_FORCE_LOCAL",
  "AI_BYPASS",
  "AI_BYPASS_LOCAL_ONLY",
  "AI_DEFAULT_PROVIDER",
  "AI_FAILOVER_CHAIN",
  "AI_REQUEST_TIMEOUT_MS",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_RETRY_COUNT",
  "AI_RETRY_BASE_DELAY_MS",
  "AI_CONTEXT_MAX_TURNS",
  "AI_CONTEXT_SUMMARY_TURNS",
  "AI_CONTEXT_TOKEN_BUDGET",
  "AI_EMBED_ENABLED",
  "AI_EMBED_BATCH_SIZE",
  AI_EMBED_CACHE_KEY_PREFIX.toUpperCase().replace(":", "_"),
];

export class AiEnv {
  static validKeys(): readonly string[] {
    return VALID_KEYS;
  }

  static protocolOf(provider: AiProvider): ProviderDefinition["protocol"] {
    return DEFINITIONS[provider].protocol;
  }

  static credentials(config: ConfigService<Config>, provider: AiProvider): AiProviderCredentials {
    const definition = DEFINITIONS[provider];
    const embedModel = text(config, `${definition.prefix}_EMBED_MODEL`) ?? definition.defaultEmbedModel;

    return {
      baseUrl: (text(config, `${definition.prefix}_URL`) ?? definition.defaultUrl).replace(/\/+$/, ""),
      apiKey: text(config, `${definition.prefix}_API_KEY`) ?? "",
      model: text(config, `${definition.prefix}_MODEL`) ?? definition.defaultModel,
      embedModel,
      embedModelConfigured: embedModel.length > 0,
    };
  }

  static configuredProviders(config: ConfigService<Config>): AiProvider[] {
    return AI_PROVIDERS.filter((provider) => {
      const { apiKey, baseUrl } = AiEnv.credentials(config, provider);
      const isLocal = (AI_LOCAL_PROVIDERS as readonly string[]).includes(provider);

      return isLocal ? baseUrl.length > 0 : apiKey.length > 0;
    });
  }

  static enabledProviders(config: AiConfig): AiProvider[] {
    return [...(config.localEnabled ? AI_LOCAL_PROVIDERS : []), ...(config.cloudEnabled ? AI_CLOUD_PROVIDERS : [])];
  }

  static defaultProvider(config: ConfigService<Config>): AiProvider {
    const declared = config.get<unknown>("AI_DEFAULT_PROVIDER");
    return isAiProviderValue(declared) ? declared : AI_PROVIDERS[0];
  }

  static describe(provider: AiProvider): ProviderDefinition {
    return DEFINITIONS[provider];
  }
}

function isAiProviderValue(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

function text(config: ConfigService<Config>, key: string): string | undefined {
  const value = config.get<unknown>(key as keyof Config);
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

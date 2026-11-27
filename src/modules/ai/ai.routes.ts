import Joi from "joi";

export const AI_ROUTES = {
  BASE: "ai",
  PROVIDERS: "providers",
  PROVIDER_DETAIL: "providers/:provider",
  HEALTH: "health",
  DIAGNOSTICS: "diagnostics",
  ERRORS: "errors",
  COMPLETE: "complete",
  STREAM: "stream",
  EMBED: "embed",
  THREADS: "threads",
  THREAD: ":threadId",
  THREAD_MESSAGES: ":threadId/messages",
  THREAD_ARCHIVE: ":threadId/archive",
  PROFILE: "profile",
  PROFILE_LEVEL: "profile/level",
  PROFILE_GOALS: "profile/goals",
  EMBEDS: "embeds",
  EMBED: ":embedId",
  EMBED_EVENTS: ":embedId/events",
} as const;

const providers = [
  "ollama",
  "lmstudio",
  "llamacpp",
  "vllm",
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "groq",
  "mistral",
  "deepseek",
] as const;

const providerSchema = (provider: string, url: string, model: string, embedModel: string, needsKey: boolean) => ({
  [`AI_${provider}_URL`]: Joi.string().uri().default(url),
  [`AI_${provider}_MODEL`]: Joi.string().default(model),
  [`AI_${provider}_EMBED_MODEL`]: Joi.string().allow("").default(embedModel),
  ...(needsKey ? { [`AI_${provider}_API_KEY`]: Joi.string().allow("").default("") } : {}),
});

const AI_ENV_VALIDATION = Joi.object({
  AI_LOCAL_ENABLED: Joi.boolean().default(true),
  AI_CLOUD_ENABLED: Joi.boolean().default(true),
  AI_FORCE_LOCAL: Joi.boolean().default(false),
  AI_BYPASS: Joi.boolean().default(true),
  AI_BYPASS_LOCAL_ONLY: Joi.boolean().default(true),
  AI_DEFAULT_PROVIDER: Joi.string()
    .valid(...providers)
    .default("ollama"),
  AI_FAILOVER_CHAIN: Joi.string().allow("").default(""),
  AI_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(600000).default(60000),
  AI_MAX_OUTPUT_TOKENS: Joi.number().integer().min(64).max(32768).default(1024),
  AI_RETRY_COUNT: Joi.number().integer().min(0).max(5).default(2),
  AI_RETRY_BASE_DELAY_MS: Joi.number().integer().min(0).max(10000).default(250),
  AI_CONTEXT_MAX_TURNS: Joi.number().integer().min(2).max(64).default(16),
  AI_CONTEXT_SUMMARY_TURNS: Joi.number().integer().min(1).max(32).default(6),
  AI_CONTEXT_TOKEN_BUDGET: Joi.number().integer().min(256).max(100000).default(4000),
  AI_EMBED_ENABLED: Joi.boolean().default(true),
  AI_EMBED_BATCH_SIZE: Joi.number().integer().min(1).max(128).default(32),

  ...providerSchema("OLLAMA", "http://127.0.0.1:11434", "llama3.2", "nomic-embed-text", false),
  ...providerSchema("LMSTUDIO", "http://127.0.0.1:1234/v1", "local-model", "nomic-embed-text", false),
  ...providerSchema("LLAMACPP", "http://127.0.0.1:8080/v1", "local-model", "", false),
  ...providerSchema("VLLM", "http://127.0.0.1:8000/v1", "local-model", "", false),
  ...providerSchema("OPENAI", "https://api.openai.com/v1", "gpt-4o-mini", "text-embedding-3-small", true),
  ...providerSchema("ANTHROPIC", "https://api.anthropic.com/v1", "claude-3-5-sonnet-latest", "", true),
  ...providerSchema("GOOGLE", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.0-flash", "text-embedding-004", true),
  ...providerSchema("OPENROUTER", "https://openrouter.ai/api/v1", "meta-llama/llama-3.1-8b-instruct", "", true),
  ...providerSchema("GROQ", "https://api.groq.com/openai/v1", "llama-3.1-8b-instant", "", true),
  ...providerSchema("MISTRAL", "https://api.mistral.ai/v1", "mistral-small-latest", "mistral-embed", true),
  ...providerSchema("DEEPSEEK", "https://api.deepseek.com/v1", "deepseek-chat", "", true),
}).unknown(true);

const AI_ENV_KEYS = Object.keys(AI_ENV_VALIDATION.describe().keys) as string[];

export const AiEnvironmentSchema: Record<string, Joi.Schema> = Object.fromEntries(
  AI_ENV_KEYS.map((key) => [key, Joi.any()]),
);

export function validateAiEnvironment(value: unknown): { value: unknown; error?: Joi.ValidationError } {
  return AI_ENV_VALIDATION.validate(value, { allowUnknown: true, abortEarly: false });
}

export const AI_ROUTE_LIST = Object.values(AI_ROUTES);

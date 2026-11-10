import type { AiProvider } from "./ai";

export interface Config {
  NODE_ENV: "production" | "dev";
  PORT_MAIN: number;
  WEBHOOK: string;
  PASSWORD_HASH_SECRET: string;
  EMAIL_HMAC_SECRET: string;
  ENCRYPTION_SECRET: string;

  DB_URI: string;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;

  REDIS_URI: string;
  REDIS_PORT: number;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;

  RESEND_API_KEY: string;

  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  COOKIE_SECRET: string;

  AUTH_BYPASS: boolean;

  AI_LOCAL_ENABLED: boolean;
  AI_CLOUD_ENABLED: boolean;
  AI_FORCE_LOCAL: boolean;
  AI_DEFAULT_PROVIDER: AiProvider;
  AI_DEFAULT_MODEL: string;
  AI_EMBED_MODEL: string;
  AI_MAX_OUTPUT_TOKENS: number;
  AI_REQUEST_TIMEOUT_MS: number;
  AI_CONTEXT_MAX_TURNS: number;
  AI_CONTEXT_SUMMARY_TURNS: number;
  AI_BYPASS_LOCAL_ONLY: boolean;
  AI_BYPASS: boolean;
  AI_FAILOVER_CHAIN: string;

  AI_OLLAMA_URL: string;
  AI_OLLAMA_MODEL: string;
  AI_OLLAMA_EMBED_MODEL: string;

  AI_LMSTUDIO_URL: string;
  AI_LMSTUDIO_MODEL: string;
  AI_LMSTUDIO_EMBED_MODEL: string;

  AI_LLAMACPP_URL: string;
  AI_LLAMACPP_MODEL: string;
  AI_LLAMACPP_EMBED_MODEL: string;

  AI_VLLM_URL: string;
  AI_VLLM_MODEL: string;
  AI_VLLM_EMBED_MODEL: string;

  AI_OPENAI_API_KEY: string;
  AI_OPENAI_URL: string;
  AI_OPENAI_MODEL: string;
  AI_OPENAI_EMBED_MODEL: string;

  AI_ANTHROPIC_API_KEY: string;
  AI_ANTHROPIC_URL: string;
  AI_ANTHROPIC_MODEL: string;

  AI_GOOGLE_API_KEY: string;
  AI_GOOGLE_URL: string;
  AI_GOOGLE_MODEL: string;
  AI_GOOGLE_EMBED_MODEL: string;

  AI_OPENROUTER_API_KEY: string;
  AI_OPENROUTER_URL: string;
  AI_OPENROUTER_MODEL: string;

  AI_GROQ_API_KEY: string;
  AI_GROQ_URL: string;
  AI_GROQ_MODEL: string;

  AI_MISTRAL_API_KEY: string;
  AI_MISTRAL_URL: string;
  AI_MISTRAL_MODEL: string;
  AI_MISTRAL_EMBED_MODEL: string;

  AI_DEEPSEEK_API_KEY: string;
  AI_DEEPSEEK_URL: string;
  AI_DEEPSEEK_MODEL: string;
  AUTH_BYPASS?: "true" | "false";
}

export const AI_LOCAL_PROVIDERS = ["ollama", "lmstudio", "llamacpp", "vllm"] as const;
export const AI_CLOUD_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "groq",
  "mistral",
  "deepseek",
] as const;

export const AI_PROVIDERS = [...AI_LOCAL_PROVIDERS, ...AI_CLOUD_PROVIDERS] as const;

export type AiLocalProvider = (typeof AI_LOCAL_PROVIDERS)[number];
export type AiCloudProvider = (typeof AI_CLOUD_PROVIDERS)[number];
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiRuntime = "local" | "cloud";
export type AiWireProtocol = "ollama" | "openai" | "anthropic" | "google";

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

export function isLocalProvider(provider: AiProvider): provider is AiLocalProvider {
  return (AI_LOCAL_PROVIDERS as readonly string[]).includes(provider);
}

export function runtimeOf(provider: AiProvider): AiRuntime {
  return isLocalProvider(provider) ? "local" : "cloud";
}

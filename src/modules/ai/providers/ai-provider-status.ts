export interface AiProviderInfo {
  readonly provider: string;
  readonly runtime: string;
  readonly protocol: string;
  readonly model: string;
  readonly embedModel: string;
  readonly baseUrlHost: string;
  readonly hasApiKey: boolean;
  readonly available: boolean;
  readonly enabled: boolean;
  readonly supportsEmbeddings: boolean;
}

export interface AiProviderFailure {
  readonly provider: string;
  readonly code: string;
  readonly status?: number;
  readonly detail: string;
  readonly elapsedMs: number;
}

export interface AiProviderProbe {
  readonly provider: string;
  readonly runtime: string;
  readonly model: string;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly available: boolean;
  readonly supportsEmbeddings: boolean;
  readonly baseUrlHost: string;
  readonly hasApiKey: boolean;
  readonly apiKeyLength: number;
  readonly latencyMs?: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly issues: readonly string[];
}

export interface AiRoutePlan {
  readonly preferred: string;
  readonly candidates: readonly string[];
  readonly chain: readonly string[];
  readonly skipped: readonly { provider: string; reason: string }[];
}

export interface AiHealthSnapshot {
  readonly ok: boolean;
  readonly provider: string;
  readonly runtime: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly bypassed: boolean;
  readonly checkedAt: string;
  readonly error?: { code: string; message: string; hint?: string };
}

export interface AiReadinessReport {
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly route: AiRoutePlan;
  readonly issues: readonly { code: string; severity: string; message: string; variable?: string }[];
}

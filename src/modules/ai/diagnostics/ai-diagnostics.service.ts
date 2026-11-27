import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Connection } from "mongoose";
import { getConnectionToken } from "@nestjs/mongoose";
import type { Config } from "@types";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";
import { AiEnv } from "../config/ai-env";
import { AiEnvFileReader, existingEnvFiles, type AiEnvFileReport } from "../config/ai-env-file";
import { AI_PROVIDERS, isLocalProvider, runtimeOf } from "../config/provider";
import { AiGatewayService } from "../providers/ai-gateway.service";
import type { AiProviderProbe } from "../providers/ai-provider-status";
import { AiIssueCollector, type AiDiagnosticIssue } from "../errors/ai-diagnostics";
import { AI_ERROR_CATALOG } from "../errors/ai-error-catalog";
import type { AiErrorCode } from "../errors/ai-error-codes";
import { maskSecret } from "../errors/ai-redaction";

export interface AiConfigurationReport {
  readonly envFile: AiEnvFileReport;
  readonly flags: Record<string, unknown>;
  readonly providers: readonly {
    provider: string;
    runtime: string;
    enabled: boolean;
    hasApiKey: boolean;
    apiKeyPreview: string;
    baseUrl: string;
    model: string;
    embedModel: string;
    supportsEmbeddings: boolean;
  }[];
  readonly issues: readonly AiDiagnosticIssue[];
}

export interface AiDatabaseReport {
  readonly connected: boolean;
  readonly readyState: number;
  readonly state: string;
  readonly database?: string;
  readonly error?: string;
}

export interface AiDiagnosticsReport {
  readonly ready: boolean;
  readonly checkedAt: string;
  readonly configuration: AiConfigurationReport;
  readonly route: ReturnType<AiGatewayService["route"]>;
  readonly providers: readonly AiProviderProbe[];
  readonly database: AiDatabaseReport;
  readonly errors: readonly {
    code: AiErrorCode;
    status: number;
    domain: string;
    transient: boolean;
    message: string;
  }[];
}

const READY_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

const DEPRECATED_KEYS = ["AI_DEFAULT_MODEL", "AI_EMBED_MODEL", "AI_BYPASS_LOCAL_ONLY"];

@Injectable()
export class AiDiagnosticsService {
  constructor(
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
    private readonly source: ConfigService<Config>,
    private readonly gateways: AiGatewayService,
    @Optional() @Inject(getConnectionToken()) private readonly connection?: Connection,
  ) {}

  async report(options: { probe?: boolean } = {}): Promise<AiDiagnosticsReport> {
    const configuration = this.configuration();
    const database = this.database();
    const providers = options.probe ? await this.gateways.probeAll() : [];

    const ready = !configuration.issues.some((issue) => issue.severity === "error") && database.connected;

    return {
      ready,
      checkedAt: new Date().toISOString(),
      configuration,
      route: this.gateways.route(),
      providers,
      database,
      errors: this.catalog(),
    };
  }

  configuration(): AiConfigurationReport {
    const issues = new AiIssueCollector();
    const envFile = AiEnvFileReader.read(
      process.cwd(),
      process.env.NODE_ENV === "production" ? ".env.production" : ".env",
    );
    const knownKeys = new Set(AiEnv.validKeys());
    const envKeys = new Set(envFile.entries.map((entry) => entry.key));
    const isProduction = this.source.get<string>("NODE_ENV") === "production";

    if (!envFile.exists) {
      issues.warning("AI_CONFIG_INVALID", {
        message: "No AI environment file was found; only process.env is in use.",
        variable: envFile.file ?? ".env",
      });
    }

    for (const key of knownKeys) {
      if (envKeys.has(key) || process.env[key] !== undefined) continue;

      issues.info("AI_CONFIG_INVALID", {
        message: `${key} is not set; the module default applies.`,
        variable: key,
      });
    }

    for (const entry of envFile.entries) {
      if (knownKeys.has(entry.key)) {
        if (entry.shadowed) {
          issues.warning("AI_CONFIG_INVALID", {
            message: `${entry.key} is declared more than once; the last declaration wins.`,
            variable: entry.key,
          });
        }

        if (entry.valueLength === 0 && !entry.key.endsWith("_API_KEY")) {
          issues.warning("AI_CONFIG_INVALID", {
            message: `${entry.key} is declared with an empty value.`,
            variable: entry.key,
          });
        }

        continue;
      }

      if (entry.key.startsWith("AI_")) {
        issues.warning("AI_CONFIG_INVALID", {
          message: `${entry.key} is not used by the AI module and is ignored.`,
          variable: entry.key,
        });
      }
    }

    for (const key of DEPRECATED_KEYS) {
      if (envKeys.has(key) || process.env[key] !== undefined) {
        issues.warning("AI_CONFIG_INVALID", {
          message: `${key} is deprecated and ignored; configure the value per provider instead.`,
          variable: key,
        });
      }
    }

    if (!this.config.localEnabled && !this.config.cloudEnabled) {
      issues.error("AI_PROVIDER_DISABLED", {
        message: "Both local and cloud providers are disabled.",
        variable: "AI_LOCAL_ENABLED / AI_CLOUD_ENABLED",
      });
    }

    const providers = AI_PROVIDERS.map((provider) => {
      const credentials = AiEnv.credentials(this.source, provider);
      const local = isLocalProvider(provider);
      const enabled = local ? this.config.localEnabled : this.config.cloudEnabled;
      const hasApiKey = credentials.apiKey.length > 0;

      if (local && credentials.baseUrl.length === 0) {
        issues.error("AI_PROVIDER_UNAVAILABLE", {
          message: `${provider} has no base URL configured.`,
          provider,
          variable: `AI_${provider.toUpperCase()}_URL`,
        });
      }

      if (!local && !hasApiKey) {
        issues.info("AI_AUTH_MISSING", {
          message: `${provider} has no API key; it is skipped by the failover chain.`,
          provider,
          variable: `AI_${provider.toUpperCase()}_API_KEY`,
        });
      }

      if (enabled && !local && !hasApiKey && this.gateways.preferred() === provider) {
        issues.error("AI_AUTH_MISSING", {
          message: `${provider} is the preferred provider but has no API key.`,
          provider,
          variable: `AI_${provider.toUpperCase()}_API_KEY`,
        });
      }

      return {
        provider,
        runtime: runtimeOf(provider),
        enabled,
        hasApiKey,
        apiKeyPreview: hasApiKey ? maskSecret(credentials.apiKey) : "",
        baseUrl: credentials.baseUrl,
        model: credentials.model,
        embedModel: credentials.embedModel,
        supportsEmbeddings: credentials.embedModel.length > 0,
      };
    });

    const preferred = this.gateways.preferred();
    const preferredInfo = providers.find((provider) => provider.provider === preferred);

    if (preferredInfo && !preferredInfo.enabled) {
      issues.error("AI_PROVIDER_DISABLED", {
        message: `The preferred provider ${preferred} is disabled.`,
        provider: preferred,
        variable: "AI_DEFAULT_PROVIDER",
      });
    }

    if (
      this.config.embeddings.enabled &&
      !providers.some((provider) => provider.supportsEmbeddings && provider.enabled)
    ) {
      issues.warning("AI_EMBEDDINGS_UNAVAILABLE", {
        message: "Embeddings are enabled but no enabled provider declares an embedding model.",
      });
    }

    if (
      this.config.forceLocal &&
      !isLocalProvider(preferred) &&
      !providers.some((provider) => provider.runtime === "local" && provider.baseUrl)
    ) {
      issues.warning("AI_PROVIDER_UNAVAILABLE", {
        message: "AI_FORCE_LOCAL is on but no local runtime is reachable by configuration.",
      });
    }

    if (isProduction && this.config.bypass) {
      issues.warning("AI_CONFIG_INVALID", {
        message: "AI_BYPASS is enabled in production; cloud providers receive bypass headers.",
        variable: "AI_BYPASS",
      });
    }

    const files = existingEnvFiles(process.cwd());
    if (isProduction && files.includes(".env") && !files.includes(".env.production")) {
      issues.warning("AI_CONFIG_INVALID", {
        message: "NODE_ENV=production but only .env exists; .env.production is not read.",
        variable: ".env.production",
      });
    }

    return {
      envFile,
      flags: {
        localEnabled: this.config.localEnabled,
        cloudEnabled: this.config.cloudEnabled,
        forceLocal: this.config.forceLocal,
        bypass: this.config.bypass,
        embeddingsEnabled: this.config.embeddings.enabled,
        failoverChain: this.config.failoverChain,
        request: this.config.request,
        context: this.config.context,
        limits: this.config.limits,
      },
      providers,
      issues: issues.all(),
    };
  }

  database(): AiDatabaseReport {
    if (!this.connection) {
      return {
        connected: false,
        readyState: 99,
        state: READY_STATES[99] ?? "unknown",
        error: "connection not provided",
      };
    }

    const readyState = this.connection.readyState;

    return {
      connected: readyState === 1,
      readyState,
      state: READY_STATES[readyState] ?? "unknown",
      database: this.connection.db?.databaseName,
      error: this.connection.readyState === 1 ? undefined : "the AI module cannot persist threads, messages or embeds",
    };
  }

  catalog() {
    return (Object.keys(AI_ERROR_CATALOG) as AiErrorCode[]).map((code) => {
      const descriptor = AI_ERROR_CATALOG[code];

      return {
        code,
        status: descriptor.status,
        domain: descriptor.domain,
        transient: descriptor.transient,
        message: descriptor.message,
      };
    });
  }
}

import { Injectable } from "@nestjs/common";
import { AiGatewayService } from "../providers/ai-gateway.service";
import { AiErrorClassifier } from "../errors/ai-error-classifier";
import { AiException } from "../errors/ai-exception";
import type { AiHealthSnapshot } from "../providers/ai-provider-status";

const HEALTH_PROMPT = "ping";
const HEALTH_TOKENS = 8;
const HEALTH_TIMEOUT_MS = 5_000;

@Injectable()
export class AiHealthService {
  constructor(private readonly gateways: AiGatewayService) {}

  async check(): Promise<AiHealthSnapshot> {
    const provider = this.gateways.provider;
    const runtime = this.gateways.runtime;
    const model = this.gateways.model;
    const startedAt = performance.now();

    try {
      const result = await this.gateways.complete([{ role: "user", content: HEALTH_PROMPT }], {
        maxTokens: HEALTH_TOKENS,
        timeoutMs: HEALTH_TIMEOUT_MS,
      });

      return {
        ok: true,
        provider: result.provider,
        runtime: result.runtime,
        model: result.model,
        latencyMs: Math.round(performance.now() - startedAt),
        bypassed: result.bypassed,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const classification = AiErrorClassifier.classify(error);
      const code = classification?.code ?? "AI_INTERNAL_ERROR";
      const descriptor = error instanceof AiException ? error.payload : null;

      return {
        ok: false,
        provider,
        runtime,
        model,
        latencyMs: Math.round(performance.now() - startedAt),
        bypassed: false,
        checkedAt: new Date().toISOString(),
        error: {
          code,
          message: descriptor?.message ?? (error instanceof Error ? error.message : String(error)),
          hint: descriptor?.hint,
        },
      };
    }
  }
}

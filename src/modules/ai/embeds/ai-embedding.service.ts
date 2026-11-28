import { createHash } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { CACHE_MANAGER, type Cache } from "@nestjs/cache-manager";
import { AiGatewayService } from "../providers/ai-gateway.service";
import { AiException } from "../errors/ai-exception";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import type { AiConfig } from "../config/ai-config.types";

interface CachedVector {
  provider: string;
  model: string;
  vectors: number[][];
}

@Injectable()
export class AiEmbeddingService {
  constructor(
    private readonly gateways: AiGatewayService,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache: Cache | undefined,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
  ) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.config.embeddings.enabled) throw new AiException("AI_EMBEDDINGS_DISABLED");
    if (!this.gateways.hasEmbeddings) {
      throw new AiException("AI_EMBEDDINGS_UNAVAILABLE", {
        details: { reason: "no-provider-with-embedding-model", route: this.gateways.route() },
      });
    }

    const results: number[][] = new Array(texts.length);
    const pending: { index: number; text: string; key: string }[] = [];
    const keys = texts.map((text) => this.key(text));
    const cached = await Promise.all(keys.map((key) => this.read(key)));

    texts.forEach((text, index) => {
      const vector = cached[index]?.vectors[0];

      if (vector && vector.length > 0) results[index] = vector;
      else pending.push({ index, text, key: keys[index] ?? this.key(text) });
    });

    for (let offset = 0; offset < pending.length; offset += this.config.embeddings.batchSize) {
      const batch = pending.slice(offset, offset + this.config.embeddings.batchSize);
      const vectors = await this.gateways.embed(batch.map((item) => item.text));

      if (vectors.length !== batch.length) {
        throw new AiException("AI_EMBEDDINGS_MISMATCH", {
          details: { expected: batch.length, received: vectors.length, provider: this.gateways.provider },
        });
      }

      await Promise.all(
        batch.map(async (item, batchIndex) => {
          const vector = vectors[batchIndex];
          if (!vector) return;

          results[item.index] = vector;
          await this.write(item.key, {
            provider: this.gateways.provider,
            model: this.gateways.model,
            vectors: [vector],
          });
        }),
      );
    }

    return results;
  }

  private async read(key: string): Promise<CachedVector | undefined> {
    if (!this.cache) return undefined;

    try {
      return await this.cache.get<CachedVector>(key);
    } catch {
      return undefined;
    }
  }

  private async write(key: string, value: CachedVector): Promise<void> {
    if (!this.cache) return;

    try {
      await this.cache.set(key, value, this.config.embeddings.cacheTtlMs);
    } catch {
      return undefined;
    }
  }

  private key(text: string): string {
    const hash = createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);

    return `${this.config.embeddings.cacheKeyPrefix}:${this.gateways.provider}:${hash}`;
  }
}

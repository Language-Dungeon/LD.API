import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER, type Cache } from "@nestjs/cache-manager";
import { AI_EMBED_CACHE_KEY, EXPIRES_IN_7_DAYS, type IAiEmbedCachePayload } from "@types";
import { AiGatewayService } from "../providers/ai-gateway.service";

const EMBED_BATCH = 32;
const CACHE_TTL_MS = EXPIRES_IN_7_DAYS * 1000;

@Injectable()
export class AiEmbeddingService {
  constructor(
    private readonly gateways: AiGatewayService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    const pending: { index: number; text: string; key: string }[] = [];

    const keys = texts.map((text) => this.key(text));
    const cached = await Promise.all(keys.map((key) => this.cache.get<IAiEmbedCachePayload>(key)));

    texts.forEach((text, index) => {
      const entry = cached[index];
      const vector = entry?.vectors[0];

      if (vector && vector.length > 0) results[index] = vector;
      else pending.push({ index, text, key: keys[index] ?? this.key(text) });
    });

    for (let offset = 0; offset < pending.length; offset += EMBED_BATCH) {
      const batch = pending.slice(offset, offset + EMBED_BATCH);
      const vectors = await this.gateways.embed(batch.map((item) => item.text));

      if (vectors.length !== batch.length) break;

      await Promise.all(
        batch.map(async (item, batchIndex) => {
          const vector = vectors[batchIndex];
          if (!vector) return;

          results[item.index] = vector;
          await this.cache.set<IAiEmbedCachePayload>(
            item.key,
            { provider: this.gateways.provider, model: this.gateways.model, vectors: [vector] },
            CACHE_TTL_MS,
          );
        }),
      );
    }

    return results.filter((vector): vector is number[] => Array.isArray(vector) && vector.length > 0);
  }

  private key(text: string): string {
    const hash = createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);
    return `${AI_EMBED_CACHE_KEY}:${this.gateways.provider}:${hash}`;
  }
}

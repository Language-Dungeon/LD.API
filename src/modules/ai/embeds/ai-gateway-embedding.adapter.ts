import { Injectable } from "@nestjs/common";
import type { IAiEmbeddingGateway } from "@types";
import { AiGatewayService } from "../providers/ai-gateway.service";

@Injectable()
export class AiGatewayEmbeddingAdapter implements IAiEmbeddingGateway {
  constructor(private readonly gateways: AiGatewayService) {}

  get provider() {
    return this.gateways.provider;
  }

  embed(texts: readonly string[]): Promise<number[][]> {
    return this.gateways.embed(texts);
  }
}

import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  type INestApplication,
} from "@nestjs/common";
import type { Response } from "express";
import { AiException } from "./ai-exception";
import type { AiErrorCode, AiErrorPayload } from "./ai-error-codes";
import { descriptorOf, isAiErrorCode } from "./ai-error-catalog";

interface ErrorResponseBody extends AiErrorPayload {
  readonly path?: string;
  readonly method?: string;
  readonly validation?: readonly string[];
}

const IGNORED_CODES = new Set(["AI_THREAD_NOT_FOUND", "AI_EMBED_NOT_FOUND", "AI_MESSAGE_NOT_FOUND"]);

@Catch()
export class AiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<{ url?: string; method?: string }>();

    if (response.headersSent) {
      response.end();
      return;
    }

    const body = this.toBody(exception, request.url, request.method);
    response.status(this.statusOf(exception)).json(body);
  }

  static install(app: INestApplication): void {
    app.useGlobalFilters(new AiExceptionFilter());
  }

  private toBody(exception: unknown, path?: string, method?: string): ErrorResponseBody {
    const traceId = randomUUID();

    if (exception instanceof AiException) {
      return { ...exception.payload, traceId: exception.payload.traceId ?? traceId, path, method };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const detail = exception.getResponse();
      const validation = typeof detail === "object" && detail !== null && "message" in detail ? detail.message : null;
      const code = this.codeForStatus(status);

      return {
        ...descriptorOf(code),
        code,
        traceId,
        path,
        method,
        validation: Array.isArray(validation) ? validation.map(String) : undefined,
        details: typeof detail === "string" ? { message: detail } : undefined,
      };
    }

    return {
      ...descriptorOf("AI_INTERNAL_ERROR"),
      code: "AI_INTERNAL_ERROR",
      traceId,
      path,
      method,
      details: { reason: exception instanceof Error ? exception.message : String(exception) },
    };
  }

  private statusOf(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private codeForStatus(status: number): AiErrorCode {
    if (status === 400 || status === 422) return "AI_ID_INVALID";
    if (status === 404) return "AI_THREAD_NOT_FOUND";
    if (status === 429) return "AI_UPSTREAM_RATE_LIMITED";
    if (status === 502) return "AI_UPSTREAM_MALFORMED";
    if (status === 503) return "AI_PROVIDERS_EXHAUSTED";
    if (status === 504) return "AI_UPSTREAM_TIMEOUT";
    if (status >= 400 && status < 500) return "AI_QUESTION_EMPTY";

    return "AI_INTERNAL_ERROR";
  }
}

export function isKnownAiCode(code: unknown): boolean {
  return isAiErrorCode(code) && !IGNORED_CODES.has(code);
}

import { HttpException } from "@nestjs/common";
import { descriptorOf } from "./ai-error-catalog";
import type { AiErrorCode, AiErrorContext, AiErrorPayload } from "./ai-error-codes";

export interface AiErrorOptions {
  readonly provider?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly traceId?: string;
}

export class AiException extends HttpException {
  readonly code: AiErrorCode;
  readonly provider?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly hint?: string;
  readonly transient: boolean;

  constructor(code: AiErrorCode, options: AiErrorOptions = {}) {
    const descriptor = descriptorOf(code);

    super(
      {
        code: descriptor.code,
        message: descriptor.message,
        domain: descriptor.domain,
        hint: descriptor.hint,
        transient: descriptor.transient,
        provider: options.provider,
        details: options.details,
        traceId: options.traceId,
      },
      descriptor.status,
      options.cause === undefined ? undefined : { cause: options.cause },
    );

    this.code = code;
    this.provider = options.provider;
    this.details = options.details;
    this.hint = descriptor.hint;
    this.transient = descriptor.transient;
  }

  get payload(): AiErrorPayload {
    const descriptor = descriptorOf(this.code);

    return {
      code: descriptor.code,
      message: descriptor.message,
      domain: descriptor.domain,
      hint: descriptor.hint,
      transient: descriptor.transient,
      provider: this.provider,
      details: this.details,
      traceId: (this.details?.traceId as string | undefined) ?? undefined,
    };
  }

  withTrace(traceId: string): AiException {
    return new AiException(this.code, {
      provider: this.provider,
      details: { ...this.details, traceId },
      cause: this,
      traceId,
    });
  }

  static is(error: unknown): error is AiException {
    return error instanceof AiException;
  }
}

export function aiError(code: AiErrorCode, context: AiErrorContext = {}): AiException {
  return new AiException(code, {
    provider: typeof context.provider === "string" ? context.provider : undefined,
    details: context.details as Readonly<Record<string, unknown>> | undefined,
    cause: context.cause,
  });
}

import type { LoggerService as NestLoggerService } from "@nestjs/common";
import { descriptorOf, isAiErrorCode } from "./ai-error-catalog";
import { AiException } from "./ai-exception";
import { AiErrorClassifier } from "./ai-error-classifier";
import type { AiErrorCode } from "./ai-error-codes";

type Level = "debug" | "info" | "warn" | "error";

export class AiLogger implements NestLoggerService {
  constructor(
    private readonly target: NestLoggerService,
    private readonly context = "AI",
  ) {}

  log(message: unknown, ...rest: unknown[]): void {
    this.target.log(this.line(message), ...rest);
  }

  error(message: unknown, ...rest: unknown[]): void {
    this.target.error(this.line(message), ...rest);
  }

  warn(message: unknown, ...rest: unknown[]): void {
    this.target.warn(this.line(message), ...rest);
  }

  debug(message: unknown, ...rest: unknown[]): void {
    this.target.log(this.line(message), ...rest);
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    this.target.log(this.line(message), ...rest);
  }

  failure(operation: string, error: unknown, provider?: string): AiErrorCode {
    const classification = AiErrorClassifier.classify(error);
    const code = classification?.code ?? "AI_INTERNAL_ERROR";

    this.write("error", `${operation} failed: ${AiErrorClassifier.describe(error, provider)}`, {
      provider,
      code,
      operation,
    });

    return code;
  }

  provider(provider: string, operation: string, message: string, level: Level = "warn"): void {
    this.write(level, `${operation}: ${message}`, { provider, operation });
  }

  private line(message: unknown): string {
    if (message instanceof AiException) return `${message.code}: ${message.message}`;
    if (message instanceof Error) return `${message.name}: ${message.message}`;

    return String(message);
  }

  private write(level: Level, message: string, context: Record<string, unknown>): void {
    const payload = JSON.stringify({ ...context, message });

    if (level === "error") this.target.error(payload);
    else if (level === "warn") this.target.warn(payload);
    else this.target.log(payload);
  }
}

export function describeCode(code: unknown): string {
  return isAiErrorCode(code) ? `${code}: ${descriptorOf(code).message}` : String(code);
}

import { AiException } from "./ai-exception";
import { descriptorOf } from "./ai-error-catalog";
import type { AiErrorCode } from "./ai-error-codes";

export interface AiDiagnosticIssue {
  readonly code: AiErrorCode;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly hint?: string;
  readonly variable?: string;
  readonly provider?: string;
}

type AiIssueOptions = Omit<AiDiagnosticIssue, "code" | "severity" | "message"> & { message?: string };

export class AiIssueCollector {
  private readonly issues: AiDiagnosticIssue[] = [];

  error(code: AiErrorCode, options: AiIssueOptions = {}): this {
    return this.add(code, "error", options);
  }

  warning(code: AiErrorCode, options: AiIssueOptions = {}): this {
    return this.add(code, "warning", options);
  }

  info(code: AiErrorCode, options: AiIssueOptions = {}): this {
    return this.add(code, "info", options);
  }

  fromException(error: unknown, provider?: string): this {
    if (error instanceof AiException) {
      return this.error(error.code, { provider: error.provider ?? provider, message: error.message });
    }

    return this.error("AI_INTERNAL_ERROR", {
      provider,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  hasErrors(): boolean {
    return this.issues.some((issue) => issue.severity === "error");
  }

  all(): AiDiagnosticIssue[] {
    return [...this.issues];
  }

  private add(code: AiErrorCode, severity: AiDiagnosticIssue["severity"], options: AiIssueOptions): this {
    const descriptor = descriptorOf(code);

    this.issues.push({
      code,
      severity,
      message: options.message || descriptor.message,
      hint: options.hint ?? descriptor.hint,
      variable: options.variable,
      provider: options.provider,
    });

    return this;
  }
}

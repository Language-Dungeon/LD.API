import { createHash } from "node:crypto";

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function maskSecret(value: string): string {
  if (value.length === 0) return "";
  if (value.length <= 8) return "*".repeat(value.length);

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

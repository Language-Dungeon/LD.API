export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;

  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: readonly { content: string }[]): number {
  return messages.reduce((total, message) => total + estimateTokens(message.content) + 4, 0);
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let normLeft = 0;
  let normRight = 0;

  for (let index = 0; index < length; index++) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;

    dot += a * b;
    normLeft += a * a;
    normRight += b * b;
  }

  if (normLeft === 0 || normRight === 0) return 0;

  return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight));
}

export function dedupeBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) continue;

    seen.add(value);
    result.push(item);
  }

  return result;
}

export function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  return Math.min(Math.floor(parsed), max);
}

export function trimToTokenBudget<T extends { content: string }>(messages: readonly T[], budget: number): T[] {
  const result: T[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!message) continue;

    const cost = estimateMessagesTokens([message]);
    if (used + cost > budget) break;

    used += cost;
    result.push(message);
  }

  return result.reverse();
}

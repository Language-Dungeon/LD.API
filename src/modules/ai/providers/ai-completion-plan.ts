export interface AiCompletionPlan {
  readonly system: string;
  readonly messages: readonly { role: string; content: string }[];
}

export interface AiStructuredResponse {
  readonly ok: boolean;
  readonly value: unknown;
  readonly error?: string;
}

export function parseJsonObject(raw: string): AiStructuredResponse {
  const candidate = extractCandidate(raw);
  if (!candidate) return { ok: false, value: null, error: "no JSON object found in the answer" };

  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (error) {
    return { ok: false, value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractCandidate(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) return fenced[1].trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  return raw.slice(start, end + 1);
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AiEnvFileEntry {
  readonly key: string;
  readonly line: number;
  readonly valueLength: number;
  readonly shadowed: boolean;
}

export interface AiEnvFileReport {
  readonly file: string | null;
  readonly exists: boolean;
  readonly entries: readonly AiEnvFileEntry[];
}

const ASSIGNMENT = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const VALUE_WRAPPERS = /^['"`]|['"`]$/g;

export class AiEnvFileReader {
  static read(cwd: string, fileName: string): AiEnvFileReport {
    const candidates = [fileName, ".env", ".env.example"];
    const file = candidates.find((candidate) => existsSync(join(cwd, candidate))) ?? null;

    if (!file) return { file: null, exists: false, entries: [] };

    const entries = parse(join(cwd, file));
    const lastLineByKey = new Map<string, number>();

    for (const entry of entries) lastLineByKey.set(entry.key, entry.line);

    return {
      file,
      exists: true,
      entries: entries.map((entry) => ({
        key: entry.key,
        line: entry.line,
        valueLength: entry.valueLength,
        shadowed: lastLineByKey.get(entry.key) !== entry.line,
      })),
    };
  }
}

function parse(path: string): AiEnvFileEntry[] {
  const content = readFileSync(path, "utf8");
  const entries: AiEnvFileEntry[] = [];

  content.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) return;

    const match = ASSIGNMENT.exec(raw);
    if (!match) return;

    const key = match[1];
    if (!key) return;

    entries.push({
      key,
      line: index + 1,
      valueLength: (match[2] ?? "").replace(VALUE_WRAPPERS, "").length,
      shadowed: false,
    });
  });

  return entries;
}

export function existingEnvFiles(cwd: string): string[] {
  try {
    return readdirSync(cwd).filter((name) => name === ".env" || name.startsWith(".env."));
  } catch {
    return [];
  }
}

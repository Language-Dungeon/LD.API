export interface AiSseEvent {
  readonly data: string;
  readonly event?: string;
  readonly id?: string;
}

const NEWLINE = /\r\n|\n|\r/g;

export class AiSseDecoder {
  private buffer = "";

  push(chunk: string): AiSseEvent[] {
    this.buffer += chunk.replace(NEWLINE, "\n");
    const events: AiSseEvent[] = [];

    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      const event = this.parse(block);
      if (event) events.push(event);

      boundary = this.buffer.indexOf("\n\n");
    }

    return events;
  }

  flush(): AiSseEvent[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest.length === 0) return [];

    const event = this.parse(rest);
    return event ? [event] : [];
  }

  private parse(block: string): AiSseEvent | null {
    if (block.trim().length === 0) return null;

    let event: string | undefined;
    let id: string | undefined;
    const data: string[] = [];

    for (const line of block.split("\n")) {
      if (line.length === 0 || line.startsWith(":")) continue;

      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");

      if (field === "data") data.push(value);
      else if (field === "event") event = value;
      else if (field === "id") id = value;
    }

    if (data.length === 0) return null;

    return { data: data.join("\n"), event, id };
  }
}

export class AiJsonLineDecoder {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk.replace(NEWLINE, "\n");

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    return lines.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";

    return rest.length > 0 ? [rest] : [];
  }
}

export function safeJsonParse<T>(value: string): T | null {
  if (value.trim().length === 0) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

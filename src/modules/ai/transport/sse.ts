export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
}

export class SseDecoder {
  private buffer = "";

  push(chunk: string): SseMessage[] {
    this.buffer += chunk;
    const messages: SseMessage[] = [];

    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      const message = this.parse(raw);
      if (message) messages.push(message);

      boundary = this.buffer.indexOf("\n\n");
    }

    return messages;
  }

  flush(): SseMessage[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (!rest) return [];

    const message = this.parse(rest);
    return message ? [message] : [];
  }

  private parse(raw: string): SseMessage | null {
    if (!raw.trim()) return null;

    let event: string | undefined;
    let id: string | undefined;
    const data: string[] = [];

    for (const line of raw.split("\n")) {
      if (!line || line.startsWith(":")) continue;

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

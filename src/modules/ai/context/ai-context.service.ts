import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IAiChatMessage, IAiTrainingContext, Config } from "@types";
import { AiConversationService } from "../conversation/ai-conversation.service";
import { AiLevelService } from "../profile/ai-level.service";
import { estimateMessagesTokens } from "../utils/text";

const USER_TURN_SAMPLE = 40;
const THREAD_SAMPLE = 5;
const THREAD_TURN_LIMIT = 8;
const SUMMARY_CHAR_LIMIT = 220;

@Injectable()
export class AiContextService {
  constructor(
    private readonly conversations: AiConversationService,
    private readonly levels: AiLevelService,
    private readonly config: ConfigService<Config>,
  ) {}

  async build(userId: string, currentThreadId?: string): Promise<IAiTrainingContext> {
    const maxTurns = this.config.get<number>("AI_CONTEXT_MAX_TURNS") ?? 16;

    const [level, skills, weakAreas, recurringMistakes, goals, userTurns, threads] = await Promise.all([
      this.levels.snapshot(userId),
      this.levels.skills(userId),
      this.levels.weakAreas(userId),
      this.levels.recurringMistakes(userId),
      this.levels.goals(userId),
      this.conversations.userTurns(userId, USER_TURN_SAMPLE),
      this.conversations.recentThreads(userId, THREAD_SAMPLE),
    ]);

    const sampled = threads.filter((thread) => thread.id !== currentThreadId).slice(0, THREAD_SAMPLE);
    const sampledHistories = await Promise.all(
      sampled.map(async (thread) => ({
        thread,
        messages: await this.conversations.history(thread.id, userId, THREAD_TURN_LIMIT),
      })),
    );

    const previousTurns = dedupe([
      ...sampledHistories.flatMap(({ messages }) => messages),
      ...userTurns.map((turn) => ({ role: turn.role, content: turn.content })),
    ]).slice(-maxTurns);

    const summarizedTurns = previousTurns.length + sampledHistories.length;
    const recentTurns: IAiChatMessage[] = [...this.summarize(sampledHistories), ...previousTurns.slice(-maxTurns)];

    return {
      level,
      skills,
      weakAreas: weakAreas.slice(0, 6),
      recurringMistakes,
      goals,
      recentTurns,
      summarizedTurns,
      threadsSampled: sampled.length,
      tokensEstimate: estimateMessagesTokens(recentTurns),
    };
  }

  async history(userId: string, threadId: string | undefined, maxTurns: number): Promise<IAiChatMessage[]> {
    if (!threadId) return [];
    return this.conversations.history(threadId, userId, maxTurns);
  }

  private summarize(
    histories: {
      thread: { title: string; message_count: number; last_message_at: Date };
      messages: IAiChatMessage[];
    }[],
  ): IAiChatMessage[] {
    const lines: string[] = [];

    for (const { thread, messages } of histories) {
      const userLines = messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.replace(/\s+/g, " ").slice(0, SUMMARY_CHAR_LIMIT));

      if (userLines.length === 0) continue;

      lines.push(
        `- "${thread.title}" (${thread.message_count} messages, last ${new Date(thread.last_message_at).toISOString().slice(0, 10)}): ${userLines.join(" | ")}`,
      );
    }

    if (lines.length === 0) return [];

    return [{ role: "user", content: `Previous conversations summary:\n${lines.join("\n")}` }];
  }
}

function dedupe(messages: IAiChatMessage[]): IAiChatMessage[] {
  const seen = new Set<string>();
  const result: IAiChatMessage[] = [];

  for (const message of messages) {
    const key = `${message.role}:${message.content.trim().slice(0, 160)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(message);
  }

  return result;
}

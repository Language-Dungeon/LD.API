import { Injectable } from "@nestjs/common";
import { AiConversationService } from "../conversation/ai-conversation.service";
import { AiLevelService } from "../profile/ai-level.service";
import { AI_MODULE_CONFIG } from "../config/ai-config.tokens";
import { Inject } from "@nestjs/common";
import type { AiConfig } from "../config/ai-config.types";
import type { AiTrainingContext } from "../profile/ai-level.types";
import { estimateMessagesTokens } from "../utils/ai-text.utils";

@Injectable()
export class AiContextService {
  constructor(
    private readonly conversations: AiConversationService,
    private readonly levels: AiLevelService,
    @Inject(AI_MODULE_CONFIG) private readonly config: AiConfig,
  ) {}

  async build(userId: string, currentThreadId?: string): Promise<AiTrainingContext> {
    const maxTurns = this.config.context.maxTurns;

    const [level, skills, weakAreas, recurringMistakes, goals, userTurns, sampled] = await Promise.all([
      this.levels.snapshot(userId),
      this.levels.skills(userId),
      this.levels.weakAreas(userId),
      this.levels.recurringMistakes(userId),
      this.levels.goals(userId),
      this.conversations.userTurns(userId),
      this.conversations.sampleOtherThreads(userId, currentThreadId),
    ]);

    const previousTurns = dedupe([
      ...sampled.flatMap(({ messages }) => messages),
      ...userTurns.map((turn) => ({ role: turn.role, content: turn.content })),
    ]).slice(-maxTurns);

    const recentTurns = [...this.conversations.summarize(sampled), ...previousTurns.slice(-maxTurns)];

    return {
      level,
      skills,
      weakAreas: weakAreas.slice(0, 6),
      recurringMistakes,
      goals,
      recentTurns,
      summarizedTurns: previousTurns.length + sampled.length,
      threadsSampled: sampled.length,
      tokensEstimate: estimateMessagesTokens(recentTurns),
    };
  }

  async history(
    userId: string,
    threadId: string | undefined,
    maxTurns: number,
  ): Promise<{ role: string; content: string }[]> {
    if (!threadId) return [];

    return this.conversations.history(userId, threadId, maxTurns);
  }
}

function dedupe(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  const seen = new Set<string>();
  const result: { role: string; content: string }[] = [];

  for (const message of messages) {
    const key = `${message.role}:${message.content.trim().slice(0, 160)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(message);
  }

  return result;
}

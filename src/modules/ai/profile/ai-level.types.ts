export const AI_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const AI_DEFAULT_LEVEL = AI_CEFR_LEVELS[1];

export type AiCefrLevel = (typeof AI_CEFR_LEVELS)[number];

export const AI_SKILL_KEYS = ["speaking", "listening", "reading", "writing", "grammar", "vocabulary"] as const;
export type AiSkillKey = (typeof AI_SKILL_KEYS)[number];

export interface AiSkillState {
  speaking: number;
  listening: number;
  reading: number;
  writing: number;
  grammar: number;
  vocabulary: number;
}

export interface AiWeakArea {
  topic: string;
  skill: AiSkillKey;
  score: number;
  observations: number;
  lastSeenAt: Date;
}

export interface AiLevelSnapshot {
  declared: AiCefrLevel;
  effective: AiCefrLevel;
  confidence: number;
  signalCount: number;
}

export interface AiTrainingContext {
  level: AiLevelSnapshot;
  skills: AiSkillState;
  weakAreas: readonly AiWeakArea[];
  recurringMistakes: readonly string[];
  goals: readonly string[];
  recentTurns: readonly { role: string; content: string }[];
  summarizedTurns: number;
  threadsSampled: number;
  tokensEstimate: number;
}

export interface AiPromptPlan {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  context: AiTrainingContext;
  bypass: boolean;
  runtime: string;
  provider: string;
  model: string;
}

export function isCefrLevel(value: unknown): value is AiCefrLevel {
  return typeof value === "string" && (AI_CEFR_LEVELS as readonly string[]).includes(value);
}

export function levelIndex(level: AiCefrLevel): number {
  return AI_CEFR_LEVELS.indexOf(level);
}

export function nextLevel(level: AiCefrLevel): AiCefrLevel | null {
  return AI_CEFR_LEVELS[levelIndex(level) + 1] ?? null;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;

  return Math.min(max, Math.max(min, value));
}

export function blend(current: number, next: number, weight: number): number {
  return clamp(current * (1 - weight) + next * weight, 0, 1);
}

export function emptySkills(): AiSkillState {
  return { speaking: 0, listening: 0, reading: 0, writing: 0, grammar: 0, vocabulary: 0 };
}

export function describeLevel(level: AiCefrLevel): string {
  const descriptions: Record<AiCefrLevel, string> = {
    A1: "absolute beginner, short simple sentences, everyday concrete words",
    A2: "elementary, simple connected sentences, familiar topics",
    B1: "intermediate, holds a conversation on familiar matters, explains opinions briefly",
    B2: "upper intermediate, fluent enough for discussion, reads complex texts in own field",
    C1: "advanced, flexible and effective language use for social and professional purposes",
    C2: "mastery, near-native precision, subtle meaning and idiomatic nuance",
  };

  return descriptions[level];
}

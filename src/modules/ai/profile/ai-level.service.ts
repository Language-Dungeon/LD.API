import { Injectable } from "@nestjs/common";
import { AiException } from "../errors/ai-exception";
import { AiProfileRepository } from "./ai-profile.repository";
import { analyzeText } from "./ai-level.heuristics";
import {
  AI_CEFR_LEVELS,
  AI_SKILL_KEYS,
  blend,
  clamp,
  emptySkills,
  isCefrLevel,
  levelIndex,
  type AiCefrLevel,
  type AiLevelSnapshot,
  type AiSkillKey,
  type AiSkillState,
  type AiWeakArea,
} from "./ai-level.types";

const MAX_WEAK_AREAS = 12;
const MAX_MISTAKES = 10;
const MAX_GOALS = 5;
const LEVEL_GUARD = 1;
const MIN_WORDS_FOR_SIGNAL = 3;

@Injectable()
export class AiLevelService {
  constructor(private readonly profiles: AiProfileRepository) {}

  async snapshot(userId: string): Promise<AiLevelSnapshot> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    return {
      declared: AiProfileRepository.levelOf(profile.declared_level),
      effective: AiProfileRepository.levelOf(profile.effective_level),
      confidence: Number(profile.confidence.toFixed(3)),
      signalCount: profile.signal_count,
    };
  }

  async setDeclaredLevel(userId: string, level: unknown): Promise<AiLevelSnapshot> {
    if (!isCefrLevel(level)) {
      throw new AiException("AI_QUESTION_EMPTY", {
        details: { field: "level", received: String(level), allowed: AI_CEFR_LEVELS },
      });
    }

    const profile = await this.profiles.findOrCreate(userId, level);
    const effective = AiProfileRepository.effectiveLevel(level, AiProfileRepository.levelOf(profile.effective_level));

    profile.declared_level = level;
    profile.effective_level = effective;

    await this.profiles.save(profile);

    return {
      declared: level,
      effective,
      confidence: Number(profile.confidence.toFixed(3)),
      signalCount: profile.signal_count,
    };
  }

  async setGoals(userId: string, goals: readonly string[]): Promise<AiLevelSnapshot> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    profile.goals = goals
      .map((goal) => goal.trim())
      .filter((goal) => goal.length > 0)
      .slice(0, MAX_GOALS);

    await this.profiles.save(profile);

    return this.snapshot(userId);
  }

  async observeUserTurn(userId: string, text: string): Promise<AiLevelSnapshot> {
    const analysis = analyzeText(text);
    if (analysis.words < MIN_WORDS_FOR_SIGNAL) return this.snapshot(userId);

    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);
    const weight = clamp(0.08 + Math.min(analysis.words, 80) / 400, 0.08, 0.3);

    const skills = this.nextSkills(profile.skills, analysis.skills, weight);
    const level = this.nextLevel(profile, analysis.suggestedLevel, weight, analysis.words);
    const mistakes = this.nextMistakes(profile.recurring_mistakes, analysis.mistakes);
    const weakAreas = this.nextWeakAreas(profile.weak_areas ?? [], analysis.topics, analysis.mistakes);

    const updated = await this.profiles.observe(userId, AI_CEFR_LEVELS[1], {
      skills,
      confidence: level.confidence,
      effective_level: level.effective,
      recurring_mistakes: mistakes,
      weak_areas: weakAreas,
    });

    return {
      declared: AiProfileRepository.levelOf(updated.declared_level),
      effective: AiProfileRepository.levelOf(updated.effective_level),
      confidence: Number(updated.confidence.toFixed(3)),
      signalCount: updated.signal_count,
    };
  }

  async skills(userId: string): Promise<AiSkillState> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    return { ...emptySkills(), ...(profile.skills as Partial<AiSkillState>) };
  }

  async weakAreas(userId: string): Promise<AiWeakArea[]> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    return (profile.weak_areas ?? [])
      .map((area) => ({
        topic: area.topic,
        skill: area.skill as AiSkillKey,
        score: area.score,
        observations: area.observations,
        lastSeenAt: new Date(area.last_seen_at),
      }))
      .sort((left, right) => left.score - right.score || right.observations - left.observations);
  }

  async recurringMistakes(userId: string): Promise<string[]> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    return [...(profile.recurring_mistakes ?? [])];
  }

  async goals(userId: string): Promise<string[]> {
    const profile = await this.profiles.findOrCreate(userId, AI_CEFR_LEVELS[1]);

    return [...(profile.goals ?? [])];
  }

  private nextSkills(
    current: Record<string, number> | undefined,
    observed: AiSkillState,
    weight: number,
  ): Record<string, number> {
    const base = { ...emptySkills(), ...(current as Partial<AiSkillState> | undefined) };
    const next: Record<string, number> = { ...base };

    for (const key of AI_SKILL_KEYS) {
      const value = observed[key];
      if (value <= 0) continue;

      next[key] = Number(blend(base[key], value, weight).toFixed(4));
    }

    return next;
  }

  private nextLevel(
    profile: { effective_level: string; declared_level: string; confidence: number },
    suggested: AiCefrLevel,
    weight: number,
    words: number,
  ): { effective: AiCefrLevel; confidence: number } {
    const observedIndex = levelIndex(suggested);
    const currentIndex = levelIndex(AiProfileRepository.levelOf(profile.effective_level));
    const delta = observedIndex - currentIndex;

    const confidenceWeight = weight * clamp(words / 40, 0.2, 1);
    const confidence = Number(
      blend(profile.confidence, clamp(0.5 + delta * 0.2, 0.05, 0.95), confidenceWeight).toFixed(3),
    );

    const current = AiProfileRepository.levelOf(profile.effective_level);
    if (delta > LEVEL_GUARD && confidence < 0.6) return { effective: current, confidence };
    if (delta < -LEVEL_GUARD && confidence < 0.75) return { effective: current, confidence };

    const shift = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    const nextIndex = clamp(currentIndex + shift, 0, AI_CEFR_LEVELS.length - 1);
    const next = AI_CEFR_LEVELS[nextIndex];
    if (!next) return { effective: current, confidence };

    const declaredIndex = levelIndex(AiProfileRepository.levelOf(profile.declared_level));
    if (shift < 0 && nextIndex < declaredIndex) return { effective: current, confidence };

    return { effective: next, confidence };
  }

  private nextMistakes(current: readonly string[] | undefined, observed: readonly string[]): string[] {
    const counts = new Map<string, number>();

    for (const mistake of current ?? []) counts.set(mistake, 1);
    for (const mistake of observed) counts.set(mistake, (counts.get(mistake) ?? 0) + 1);

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, MAX_MISTAKES)
      .map(([mistake]) => mistake);
  }

  private nextWeakAreas(
    current: readonly { topic: string; skill: string; score: number; observations: number; last_seen_at: Date }[],
    topics: readonly string[],
    mistakes: readonly string[],
  ): { topic: string; skill: string; score: number; observations: number; last_seen_at: Date }[] {
    const now = new Date();
    const areas = new Map(current.map((area) => [area.topic, area]));

    const register = (topic: string, skill: AiSkillKey, penalty: number) => {
      const existing = areas.get(topic);
      const score = existing ? clamp(existing.score * 0.8 + (1 - penalty) * 0.2, 0, 1) : clamp(1 - penalty, 0, 1);

      areas.set(topic, {
        topic,
        skill,
        score: Number(score.toFixed(4)),
        observations: (existing?.observations ?? 0) + 1,
        last_seen_at: now,
      });
    };

    for (const topic of topics) register(topic, "grammar", 0.35);
    for (const mistake of mistakes) register(mistake, "grammar", 0.45);

    return [...areas.values()]
      .sort((left, right) => left.score - right.score || right.observations - left.observations)
      .slice(0, MAX_WEAK_AREAS);
  }
}

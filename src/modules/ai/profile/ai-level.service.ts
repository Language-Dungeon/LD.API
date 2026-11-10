import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AiProfile, type AiProfileDocument } from "@schemas";
import { AI_CEFR_LEVELS, type AiCefrLevel, type IAiLevelSnapshot, type IAiSkillState, type IAiWeakArea } from "@types";
import { analyzeText, blend, clamp, DEFAULT_SKILLS, levelIndex, SKILL_KEYS, type SkillKey } from "./level-heuristics";

export { SKILL_KEYS, type SkillKey };

const MAX_WEAK_AREAS = 12;
const MAX_MISTAKES = 10;
const MAX_GOALS = 5;
const LEVEL_GUARD = 1;

@Injectable()
export class AiLevelService {
  constructor(@InjectModel(AiProfile.name) private readonly profile: Model<AiProfile>) {}

  async snapshot(userId: string): Promise<IAiLevelSnapshot> {
    const profile = await this.getOrCreate(userId);
    return this.toSnapshot(profile);
  }

  async setDeclaredLevel(userId: string, level: AiCefrLevel): Promise<IAiLevelSnapshot> {
    const profile = await this.getOrCreate(userId);

    profile.declared_level = level;
    if (levelIndex(level) > levelIndex(profile.effective_level)) {
      profile.effective_level = level;
      profile.confidence = blend(profile.confidence, 0.5, 0.4);
    }

    await profile.save();
    return this.toSnapshot(profile);
  }

  async setGoals(userId: string, goals: readonly string[]): Promise<IAiLevelSnapshot> {
    const profile = await this.getOrCreate(userId);

    profile.goals = goals
      .map((goal) => goal.trim())
      .filter(Boolean)
      .slice(0, MAX_GOALS);
    await profile.save();

    return this.toSnapshot(profile);
  }

  async observeUserTurn(userId: string, text: string): Promise<IAiLevelSnapshot> {
    const analysis = analyzeText(text);
    if (analysis.words < 3) return this.snapshot(userId);

    const profile = await this.getOrCreate(userId);
    const weight = clamp(0.08 + Math.min(analysis.words, 80) / 400, 0.08, 0.3);

    this.applySkills(profile, analysis.skills, weight);
    this.applyLevel(profile, analysis.suggestedLevel, weight, analysis.words);
    this.applyMistakes(profile, analysis.mistakes);
    this.applyWeakAreas(profile, analysis.topics, analysis.mistakes);

    profile.signal_count += 1;
    profile.last_recalculated_at = new Date();

    await profile.save();
    return this.toSnapshot(profile);
  }

  async skills(userId: string): Promise<IAiSkillState> {
    const profile = await this.getOrCreate(userId);
    const stored = profile.skills as Record<string, number>;

    return {
      speaking: stored.speaking ?? 0,
      listening: stored.listening ?? 0,
      reading: stored.reading ?? 0,
      writing: stored.writing ?? 0,
      grammar: stored.grammar ?? 0,
      vocabulary: stored.vocabulary ?? 0,
    };
  }

  async weakAreas(userId: string): Promise<IAiWeakArea[]> {
    const profile = await this.getOrCreate(userId);

    return (profile.weak_areas ?? [])
      .map((area) => ({
        topic: area.topic,
        skill: area.skill as keyof IAiSkillState,
        score: area.score,
        observations: area.observations,
        lastSeenAt: new Date(area.last_seen_at),
      }))
      .sort((a, b) => a.score - b.score || b.observations - a.observations);
  }

  async recurringMistakes(userId: string): Promise<string[]> {
    const profile = await this.getOrCreate(userId);
    return [...(profile.recurring_mistakes ?? [])];
  }

  async goals(userId: string): Promise<string[]> {
    const profile = await this.getOrCreate(userId);
    return [...(profile.goals ?? [])];
  }

  private toSnapshot(profile: AiProfileDocument): IAiLevelSnapshot {
    return {
      declared: profile.declared_level,
      effective: profile.effective_level,
      confidence: Number(profile.confidence.toFixed(3)),
      signalCount: profile.signal_count,
    };
  }

  private async getOrCreate(userId: string): Promise<AiProfileDocument> {
    const existing = await this.profile.findOne({ user_id: userId });
    if (existing) return existing;

    return this.profile.create({
      user_id: userId,
      declared_level: AI_CEFR_LEVELS[1],
      effective_level: AI_CEFR_LEVELS[1],
      skills: { ...DEFAULT_SKILLS },
    });
  }

  private applySkills(profile: AiProfileDocument, observed: Record<SkillKey, number>, weight: number) {
    const current = { ...DEFAULT_SKILLS, ...(profile.skills as Record<SkillKey, number>) };
    const next = { ...current };

    for (const key of Object.keys(DEFAULT_SKILLS) as SkillKey[]) {
      const value = observed[key] ?? 0;
      if (value <= 0) continue;

      next[key] = Number(blend(current[key], value, weight).toFixed(4));
    }

    profile.skills = next;
  }

  private applyLevel(profile: AiProfileDocument, suggested: AiCefrLevel, weight: number, words: number) {
    const observedIndex = levelIndex(suggested);
    const currentIndex = levelIndex(profile.effective_level);
    const delta = observedIndex - currentIndex;

    const confidenceWeight = weight * clamp(words / 40, 0.2, 1);
    profile.confidence = Number(
      blend(profile.confidence, clamp(0.5 + delta * 0.2, 0.05, 0.95), confidenceWeight).toFixed(3),
    );

    if (delta > LEVEL_GUARD && profile.confidence < 0.6) return;
    if (delta < -LEVEL_GUARD && profile.confidence < 0.75) return;

    const shift = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    const nextIndex = clamp(currentIndex + shift, 0, AI_CEFR_LEVELS.length - 1);
    const nextLevel = AI_CEFR_LEVELS[nextIndex];
    if (!nextLevel) return;

    const declaredIndex = levelIndex(profile.declared_level);
    if (shift < 0 && nextIndex < declaredIndex) return;

    profile.effective_level = nextLevel;
  }

  private applyMistakes(profile: AiProfileDocument, mistakes: readonly string[]) {
    if (mistakes.length === 0) return;

    const counts = new Map<string, number>();
    for (const mistake of profile.recurring_mistakes ?? []) counts.set(mistake, 1);
    for (const mistake of mistakes) counts.set(mistake, (counts.get(mistake) ?? 0) + 1);

    profile.recurring_mistakes = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_MISTAKES)
      .map(([mistake]) => mistake);
  }

  private applyWeakAreas(profile: AiProfileDocument, topics: readonly string[], mistakes: readonly string[]) {
    const now = new Date();
    const areas = new Map((profile.weak_areas ?? []).map((area) => [area.topic, area]));

    const register = (topic: string, skill: SkillKey, penalty: number) => {
      const current = areas.get(topic);
      const score = current ? clamp(current.score * 0.8 + (1 - penalty) * 0.2, 0, 1) : clamp(1 - penalty, 0, 1);

      areas.set(topic, {
        topic,
        skill,
        score: Number(score.toFixed(4)),
        observations: (current?.observations ?? 0) + 1,
        last_seen_at: now,
      });
    };

    for (const topic of topics) register(topic, "grammar", 0.35);
    for (const mistake of mistakes) register(mistake, "grammar", 0.45);

    profile.weak_areas = [...areas.values()]
      .sort((a, b) => a.score - b.score || b.observations - a.observations)
      .slice(0, MAX_WEAK_AREAS);
  }
}

export function describeLevel(level: AiCefrLevel): string {
  const map: Record<AiCefrLevel, string> = {
    A1: "absolute beginner, short simple sentences, everyday concrete words",
    A2: "elementary, simple connected sentences, familiar topics",
    B1: "intermediate, can hold a conversation on familiar matters, explain opinions briefly",
    B2: "upper intermediate, fluent enough for discussion, understands complex texts on own field",
    C1: "advanced, flexible and effective language use for social and professional purposes",
    C2: "mastery, near-native precision, subtle meaning and idiomatic nuance",
  };

  return map[level];
}

export function nextLevel(level: AiCefrLevel): AiCefrLevel | null {
  const index = levelIndex(level);
  return AI_CEFR_LEVELS[index + 1] ?? null;
}

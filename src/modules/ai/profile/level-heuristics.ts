import { AI_CEFR_LEVELS, type AiCefrLevel } from "@types";

export const CEFR_ORDER = AI_CEFR_LEVELS;

export const SKILL_KEYS = ["speaking", "listening", "reading", "writing", "grammar", "vocabulary"] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export const DEFAULT_SKILLS: Record<SkillKey, number> = {
  speaking: 0,
  listening: 0,
  reading: 0,
  writing: 0,
  grammar: 0,
  vocabulary: 0,
};

const A1_MARKERS = [
  " is ",
  " are ",
  " have ",
  " like ",
  " want ",
  " hello ",
  " my name ",
  " i am ",
  " to be ",
  " very ",
  " good ",
  " bad ",
];

const B2_MARKERS = [
  " however ",
  " therefore ",
  " although ",
  " nevertheless ",
  " furthermore ",
  " whereas ",
  " in terms of ",
  " on the other hand ",
  " as a result ",
  " consequently ",
];

const C1_MARKERS = [
  " notwithstanding ",
  " albeit ",
  " insofar as ",
  " whereby ",
  " whilst ",
  " albeit ",
  " thus far ",
  " arguably ",
];

const MISTAKE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bi\s+(am|is|are)\s+\w+ing\b/i, label: "present-continuous-with-i-am" },
  { pattern: /\b(didn'?t|don'?t|doesn'?t)\s+\w+ed\b/i, label: "double-past-after-auxiliary" },
  { pattern: /\bmore\s+\w+er\b/i, label: "double-comparative" },
  { pattern: /\b(he|she|it)\s+(have|do|go)\b/i, label: "third-person-agreement" },
  { pattern: /\b(peoples|informations|advices|equipments)\b/i, label: "uncountable-plural" },
  { pattern: /\b(explain me|say me|discuss about|married with)\b/i, label: "preposition-collocation" },
  { pattern: /\b(teh|recieve|seperate|definately|occured)\b/i, label: "spelling" },
  { pattern: /\ba\s+[aeiou]\w+/i, label: "article-before-vowel" },
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  "past-simple": ["yesterday", "last week", "ago", "in 2019", "previous"],
  "present-perfect": ["have been", "has been", "already", "yet", "since", "ever"],
  "future-forms": ["will", "going to", "tomorrow", "next week"],
  conditionals: ["if i", "would", "could", "unless", "provided that"],
  "modal-verbs": ["must", "should", "might", "may", "ought"],
  prepositions: ["in", "on", "at", "by", "with", "about"],
  articles: ["the", "a", "an"],
  phrasal: ["up", "out", "off", "down", "over"],
};

export interface TextAnalysis {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  uniqueRatio: number;
  levelScore: number;
  suggestedLevel: AiCefrLevel;
  mistakes: string[];
  topics: string[];
  skills: Record<SkillKey, number>;
}

export function analyzeText(text: string): TextAnalysis {
  const normalized = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const words = text.match(/[\p{L}'-]+/gu) ?? [];
  const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);

  const unique = new Set(words.map((word) => word.toLowerCase()));
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : words.length;

  const uniqueRatio = words.length > 0 ? unique.size / words.length : 0;
  const averageWordLength = words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;

  const a1Hits = A1_MARKERS.filter((marker) => normalized.includes(marker)).length;
  const b2Hits = B2_MARKERS.filter((marker) => normalized.includes(marker)).length;
  const c1Hits = C1_MARKERS.filter((marker) => normalized.includes(marker)).length;

  const levelScore = clamp(
    (avgSentenceLength - 6) / 4 +
      (uniqueRatio - 0.4) * 4 +
      (averageWordLength - 3.6) * 2 +
      b2Hits * 0.6 +
      c1Hits * 1.1 -
      a1Hits * 0.35,
    0,
    5,
  );

  const mistakes = MISTAKE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  const topics = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(` ${keyword} `)))
    .map(([topic]) => topic);

  const wordAccuracy = words.length > 0 ? clamp(1 - mistakes.length / Math.max(4, words.length / 12), 0, 1) : 0;
  const writing = clamp(levelScore / 5, 0, 1);
  const grammar = clamp(wordAccuracy - mistakes.length * 0.05, 0, 1);
  const vocabulary = clamp(uniqueRatio, 0, 1);

  return {
    words: words.length,
    sentences: sentences.length,
    avgSentenceLength,
    uniqueRatio,
    levelScore,
    suggestedLevel: levelFromScore(levelScore),
    mistakes,
    topics,
    skills: {
      speaking: 0,
      listening: 0,
      reading: 0,
      writing,
      grammar,
      vocabulary,
    },
  };
}

export function levelFromScore(score: number): AiCefrLevel {
  const index = Math.round(clamp(score, 0, CEFR_ORDER.length - 1));
  return CEFR_ORDER[index] ?? CEFR_ORDER[0];
}

export function levelIndex(level: AiCefrLevel): number {
  return CEFR_ORDER.indexOf(level);
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function blend(current: number, next: number, weight: number): number {
  return clamp(current * (1 - weight) + next * weight, 0, 1);
}

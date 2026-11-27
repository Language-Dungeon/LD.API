import {
  AI_CEFR_LEVELS,
  clamp,
  emptySkills,
  type AiCefrLevel,
  type AiSkillKey,
  type AiSkillState,
} from "./ai-level.types";

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

export interface AiTextAnalysis {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  uniqueRatio: number;
  levelScore: number;
  suggestedLevel: AiCefrLevel;
  mistakes: string[];
  topics: string[];
  skills: AiSkillState;
}

export function analyzeText(text: string): AiTextAnalysis {
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
      ...emptySkills(),
      writing: clamp(levelScore / 5, 0, 1),
      grammar: clamp(wordAccuracy - mistakes.length * 0.05, 0, 1),
      vocabulary: clamp(uniqueRatio, 0, 1),
    },
  };
}

export function levelFromScore(score: number): AiCefrLevel {
  return AI_CEFR_LEVELS[Math.round(clamp(score, 0, AI_CEFR_LEVELS.length - 1))] ?? AI_CEFR_LEVELS[0];
}

export function skillsFromRecord(value: Record<string, number> | undefined): AiSkillState {
  const base = emptySkills();

  for (const key of Object.keys(base) as AiSkillKey[]) base[key] = value?.[key] ?? 0;

  return base;
}

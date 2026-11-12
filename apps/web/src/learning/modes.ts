export type LearningMode = "early" | "junior" | "teen" | "adult" | "senior";

export interface ModeConfig {
  options: number;
  vocabularyItems: number;
  mathQuestions: number;
  review: number;
  speechRate: number;
  textScale: number;
  autoSpeak: boolean;
  freeText: boolean;
}

export const AGE_BANDS = [
  "5-9",
  "10-14",
  "15-19",
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
  "70-74",
  "75-79",
  "80+",
] as const;

export const MODES: Record<LearningMode, ModeConfig> = {
  early: { options: 2, vocabularyItems: 4, mathQuestions: 4, review: 0, speechRate: 0.8, textScale: 1.2, autoSpeak: true, freeText: false },
  junior: { options: 3, vocabularyItems: 6, mathQuestions: 6, review: 2, speechRate: 0.9, textScale: 1.1, autoSpeak: true, freeText: false },
  teen: { options: 4, vocabularyItems: 6, mathQuestions: 6, review: 3, speechRate: 1, textScale: 1, autoSpeak: false, freeText: true },
  adult: { options: 4, vocabularyItems: 6, mathQuestions: 6, review: 3, speechRate: 1, textScale: 1, autoSpeak: false, freeText: true },
  senior: { options: 3, vocabularyItems: 6, mathQuestions: 5, review: 2, speechRate: 0.85, textScale: 1.25, autoSpeak: true, freeText: true },
};

export function bandStart(ageBand: string): number {
  return Number.parseInt(ageBand, 10);
}

export function modeOf(ageBand: string | null): LearningMode {
  if (!ageBand) return "adult";
  const start = bandStart(ageBand);
  if (start < 10) return "early";
  if (start < 15) return "junior";
  if (start < 20) return "teen";
  if (start < 60) return "adult";
  return "senior";
}

export function bandLimits(ageBand: string): [string, string | null] {
  const [from = ageBand, to] = ageBand.replace("+", "").split("-");
  return [from, to ?? null];
}

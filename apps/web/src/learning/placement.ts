export const PLACEMENT_QUESTIONS = 5;

export interface PlacementAnswer {
  level: number;
  correct: boolean;
}

export function nextLevel(level: number, correct: boolean, top: number): number {
  return Math.min(top, Math.max(1, level + (correct ? 1 : -1)));
}

export function placementResult(answers: PlacementAnswer[], finalLevel: number): number {
  const best = Math.max(0, ...answers.filter((answer) => answer.correct).map((answer) => answer.level));
  return Math.max(1, Math.min(finalLevel, best));
}

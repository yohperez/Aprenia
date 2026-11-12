import type { Messages } from "../i18n/es";
import type { Concept, Lesson, MathSpec } from "../lib/types";
import type { ModeConfig } from "./modes";

export type Visual =
  | { type: "picture"; image: string }
  | { type: "count"; image: string; count: number }
  | { type: "add"; image: string; a: number; b: number };

export interface Choice {
  id: string;
  label: string;
  image?: string;
}

export interface LearnStep {
  kind: "learn";
  key: string;
  itemId: string;
  visual: Visual;
  word: string;
  speech: string;
}

export interface QuestionStep {
  kind: "question";
  key: string;
  itemId: string;
  prompt: string;
  speech: string;
  visual: Visual | null;
  layout: "pictures" | "words" | "numbers";
  choices: Choice[];
  answer: string;
  answerLabel: string;
}

export type Step = LearnStep | QuestionStep;

export interface BuildContext {
  concepts: Map<string, Concept>;
  messages: Messages;
  mode: ModeConfig;
  format: (value: number) => string;
  random?: () => number;
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
}

function pickDistractors<T>(pool: readonly T[], answer: T, count: number, random: () => number): T[] {
  return shuffle(
    pool.filter((item) => item !== answer),
    random,
  ).slice(0, Math.max(0, count - 1));
}

function vocabularyItems(lesson: Lesson, context: BuildContext): Concept[] {
  return lesson.items
    .map((id) => context.concepts.get(id))
    .filter((concept): concept is Concept => Boolean(concept));
}

function learnWord(concept: Concept): LearnStep {
  return {
    kind: "learn",
    key: `learn-${concept.id}`,
    itemId: concept.id,
    visual: { type: "picture", image: concept.image },
    word: concept.word,
    speech: concept.word,
  };
}

function pickPicture(
  concept: Concept,
  pool: Concept[],
  context: BuildContext,
  random: () => number,
): QuestionStep {
  const options = shuffle([concept, ...pickDistractors(pool, concept, context.mode.options, random)], random);
  const prompt = context.messages.pickImage(concept.word);
  return {
    kind: "question",
    key: `picture-${concept.id}`,
    itemId: concept.id,
    prompt,
    speech: prompt,
    visual: null,
    layout: "pictures",
    choices: options.map((option) => ({ id: option.id, label: option.word, image: option.image })),
    answer: concept.id,
    answerLabel: concept.word,
  };
}

function pickWord(
  concept: Concept,
  pool: Concept[],
  context: BuildContext,
  random: () => number,
): QuestionStep {
  const options = shuffle([concept, ...pickDistractors(pool, concept, context.mode.options, random)], random);
  return {
    kind: "question",
    key: `word-${concept.id}`,
    itemId: concept.id,
    prompt: context.messages.pickWord,
    speech: context.messages.pickWord,
    visual: { type: "picture", image: concept.image },
    layout: "words",
    choices: options.map((option) => ({ id: option.id, label: option.word })),
    answer: concept.id,
    answerLabel: concept.word,
  };
}

function buildVocabulary(lesson: Lesson, context: BuildContext, random: () => number): Step[] {
  const pool = vocabularyItems(lesson, context);
  const items = pool.slice(0, context.mode.vocabularyItems);
  const steps: Step[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const pair = items.slice(index, index + 2);
    pair.forEach((concept) => steps.push(learnWord(concept)));
    const [first, second] = pair;
    if (first) steps.push(pickPicture(first, items, context, random));
    if (second) steps.push(pickWord(second, items, context, random));
  }
  shuffle(items, random)
    .slice(0, context.mode.review)
    .forEach((concept, index) => {
      const step =
        index % 2 === 0
          ? pickWord(concept, items, context, random)
          : pickPicture(concept, items, context, random);
      steps.push({ ...step, key: `review-${step.key}` });
    });
  return steps;
}

function randomInt(low: number, high: number, random: () => number): number {
  return low + Math.floor(random() * (high - low + 1));
}

function numberChoices(
  answer: number,
  low: number,
  high: number,
  context: BuildContext,
  random: () => number,
): Choice[] {
  const range = Array.from({ length: high - low + 1 }, (_, index) => low + index);
  const near = range.sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer) || random() - 0.5);
  const options = shuffle(
    [answer, ...near.filter((value) => value !== answer).slice(0, context.mode.options - 1)],
    random,
  );
  return options.sort((a, b) => a - b).map((value) => ({ id: String(value), label: context.format(value) }));
}

function mathExercise(
  spec: MathSpec,
  context: BuildContext,
  random: () => number,
): { itemId: string; visual: Visual; answer: number } {
  const objectImage = context.concepts.get(spec.object)?.image ?? spec.object;
  if (spec.op === "add") {
    const total = randomInt(Math.max(2, spec.min), spec.max, random);
    const a = randomInt(1, total - 1, random);
    const b = total - a;
    return { itemId: `add-${a}-${b}`, visual: { type: "add", image: objectImage, a, b }, answer: total };
  }
  const count = randomInt(Math.max(1, spec.min), spec.max, random);
  return { itemId: `count-${count}`, visual: { type: "count", image: objectImage, count }, answer: count };
}

function mathQuestion(
  spec: MathSpec,
  context: BuildContext,
  random: () => number,
  key: string,
): QuestionStep {
  const exercise = mathExercise(spec, context, random);
  const prompt = spec.op === "add" ? context.messages.addPrompt : context.messages.countPrompt;
  const low = spec.op === "add" ? Math.max(2, spec.min) : Math.max(1, spec.min);
  return {
    kind: "question",
    key,
    itemId: exercise.itemId,
    prompt,
    speech: prompt,
    visual: exercise.visual,
    layout: "numbers",
    choices: numberChoices(exercise.answer, low, spec.max, context, random),
    answer: String(exercise.answer),
    answerLabel: context.format(exercise.answer),
  };
}

function buildMath(lesson: Lesson, context: BuildContext, random: () => number): Step[] {
  const spec = lesson.math;
  if (!spec) return [];
  const examples: Step[] = [0, 1].map((index) => {
    const exercise = mathExercise(spec, context, random);
    const word = context.format(exercise.answer);
    return {
      kind: "learn",
      key: `example-${index}`,
      itemId: exercise.itemId,
      visual: exercise.visual,
      word,
      speech: word,
    };
  });
  const questions = Array.from({ length: context.mode.mathQuestions }, (_, index) =>
    mathQuestion(spec, context, random, `math-${index}`),
  );
  return [...examples, ...questions];
}

export function buildLesson(lesson: Lesson, context: BuildContext): Step[] {
  const random = context.random ?? Math.random;
  return lesson.kind === "math"
    ? buildMath(lesson, context, random)
    : buildVocabulary(lesson, context, random);
}

export function buildPlacementQuestion(
  lesson: Lesson,
  context: BuildContext,
  index: number,
): QuestionStep | null {
  const random = context.random ?? Math.random;
  if (lesson.kind === "math" && lesson.math)
    return mathQuestion(lesson.math, context, random, `placement-${index}`);
  const items = vocabularyItems(lesson, context);
  const concept = shuffle(items, random)[0];
  if (!concept) return null;
  const step =
    random() < 0.5 ? pickPicture(concept, items, context, random) : pickWord(concept, items, context, random);
  return { ...step, key: `placement-${index}` };
}

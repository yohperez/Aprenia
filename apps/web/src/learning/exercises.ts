import type { Messages } from "../i18n/es";
import type { Concept, Lesson, MathStepId, Question, Statement } from "../lib/types";
import { makeExercise, numberOptions, type MathExercise } from "./maths";
import type { ModeConfig } from "./modes";

export type Visual =
  | { type: "picture"; image: string }
  | { type: "count"; image: string; count: number }
  | { type: "add"; image: string; a: number; b: number }
  | { type: "sub"; image: string; a: number; b: number }
  | { type: "expr"; text: string }
  | { type: "text"; text: string; image?: string };

export interface Choice {
  id: string;
  label: string;
  image?: string;
  speech?: string;
  audioId?: string;
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
  layout: "pictures" | "words" | "numbers" | "options" | "binary";
  choices: Choice[];
  answer: string;
  answerLabel: string;
  adaptive?: boolean;
}

export interface MathSlot {
  kind: "slot";
  key: string;
}

export type Step = LearnStep | QuestionStep;
export type QueueItem = Step | MathSlot;

export interface BuildContext {
  concepts: Map<string, Concept>;
  questions: Map<string, Question>;
  statements: Map<string, Statement>;
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
    choices: options.map((option) => ({
      id: option.id,
      label: option.word,
      image: option.image,
      audioId: option.id,
    })),
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
    choices: options.map((option) => ({ id: option.id, label: option.word, audioId: option.id })),
    answer: concept.id,
    answerLabel: concept.word,
  };
}

function buildVocabulary(lesson: Lesson, context: BuildContext, random: () => number): Step[] {
  const items = vocabularyItems(lesson, context).slice(0, context.mode.vocabularyItems);
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

function quizStep(question: Question, context: BuildContext, random: () => number): QuestionStep {
  const indices = question.options.map((_, index) => index);
  const kept = shuffle(
    [question.answer, ...pickDistractors(indices, question.answer, context.mode.options, random)],
    random,
  );
  const image = question.concept ? context.concepts.get(question.concept)?.image : undefined;
  const answerLabel = question.options[question.answer] ?? "";
  return {
    kind: "question",
    key: `quiz-${question.id}`,
    itemId: question.id,
    prompt: question.prompt,
    speech: question.prompt,
    visual: image ? { type: "picture", image } : null,
    layout: "options",
    choices: kept.map((index) => ({ id: String(index), label: question.options[index] ?? "" })),
    answer: String(question.answer),
    answerLabel,
  };
}

function safetyStep(statement: Statement, context: BuildContext): QuestionStep {
  const m = context.messages;
  return {
    kind: "question",
    key: `safety-${statement.id}`,
    itemId: statement.id,
    prompt: m.safetyPrompt,
    speech: `${statement.text}. ${m.safetyPrompt}`,
    visual: { type: "text", text: statement.text },
    layout: "binary",
    choices: [
      { id: "safe", label: m.safe },
      { id: "unsafe", label: m.unsafe },
    ],
    answer: statement.safe ? "safe" : "unsafe",
    answerLabel: statement.safe ? m.safe : m.unsafe,
  };
}

function listed<T>(ids: string[], source: Map<string, T>): T[] {
  return ids.map((id) => source.get(id)).filter((item): item is T => item !== undefined);
}

function mathImage(lesson: Lesson, context: BuildContext): string {
  const object = lesson.math?.object ?? "";
  return context.concepts.get(object)?.image ?? object;
}

export function mathQuestion(
  lesson: Lesson,
  step: MathStepId,
  context: BuildContext,
  key: string,
  random: () => number = context.random ?? Math.random,
): QuestionStep {
  const exercise: MathExercise = makeExercise(step, mathImage(lesson, context), {
    messages: context.messages,
    format: context.format,
    random,
  });
  const values = exercise.options ?? numberOptions(exercise.answer, context.mode.options, random);
  return {
    kind: "question",
    key,
    itemId: exercise.itemId,
    prompt: exercise.prompt,
    speech: exercise.speech,
    visual: exercise.visual,
    layout: "numbers",
    choices: values.map((value) => ({ id: String(value), label: context.format(value) })),
    answer: String(exercise.answer),
    answerLabel: context.format(exercise.answer),
    adaptive: true,
  };
}

function workedExample(lesson: Lesson, context: BuildContext, random: () => number): LearnStep | null {
  const first = lesson.math?.steps[0];
  if (!first) return null;
  const exercise = makeExercise(first, mathImage(lesson, context), {
    messages: context.messages,
    format: context.format,
    random,
  });
  return {
    kind: "learn",
    key: "example",
    itemId: exercise.itemId,
    visual: exercise.worked.visual,
    word: context.format(exercise.answer),
    speech: exercise.worked.speech,
  };
}

export function buildLesson(lesson: Lesson, context: BuildContext): QueueItem[] {
  const random = context.random ?? Math.random;
  if (lesson.kind === "quiz") {
    return shuffle(listed(lesson.items, context.questions), random)
      .slice(0, context.mode.vocabularyItems)
      .map((question) => quizStep(question, context, random));
  }
  if (lesson.kind === "safety") {
    return shuffle(listed(lesson.items, context.statements), random)
      .slice(0, context.mode.vocabularyItems)
      .map((statement) => safetyStep(statement, context));
  }
  if (lesson.kind === "math") {
    const example = workedExample(lesson, context, random);
    const firstStep = lesson.math?.steps[0];
    const slots: QueueItem[] = Array.from({ length: context.mode.mathQuestions }, (_, index) => ({
      kind: "slot",
      key: `math-${index}`,
    }));
    if (firstStep) slots[0] = mathQuestion(lesson, firstStep, context, "math-0", random);
    return example ? [example, ...slots] : slots;
  }
  return buildVocabulary(lesson, context, random);
}

export function buildPlacementQuestion(
  lesson: Lesson,
  context: BuildContext,
  index: number,
): QuestionStep | null {
  const random = context.random ?? Math.random;
  const key = `placement-${index}`;
  if (lesson.kind === "math" && lesson.math?.steps.length) {
    const steps = lesson.math.steps;
    const step = steps[Math.floor(random() * steps.length)] ?? steps[0];
    return step ? mathQuestion(lesson, step, context, key, random) : null;
  }
  if (lesson.kind === "quiz") {
    const question = shuffle(listed(lesson.items, context.questions), random)[0];
    return question ? { ...quizStep(question, context, random), key } : null;
  }
  if (lesson.kind === "safety") {
    const statement = shuffle(listed(lesson.items, context.statements), random)[0];
    return statement ? { ...safetyStep(statement, context), key } : null;
  }
  const items = vocabularyItems(lesson, context);
  const concept = shuffle(items, random)[0];
  if (!concept) return null;
  const step =
    random() < 0.5 ? pickPicture(concept, items, context, random) : pickWord(concept, items, context, random);
  return { ...step, key };
}

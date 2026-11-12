import { formatNumber, t } from "../i18n";
import { conceptMap } from "../lib/content";
import type { Pack } from "../lib/types";
import { mode } from "../state";
import type { BuildContext } from "./exercises";

export function contextFor(source: Pack): BuildContext {
  return {
    concepts: conceptMap(source),
    questions: new Map(source.questions.map((question) => [question.id, question])),
    statements: new Map(source.statements.map((statement) => [statement.id, statement])),
    messages: t.value,
    mode: mode.value,
    format: formatNumber,
  };
}

export function pickRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

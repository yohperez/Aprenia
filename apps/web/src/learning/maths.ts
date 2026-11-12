import type { Messages } from "../i18n/es";
import type { MathStepId } from "../lib/types";
import type { Visual } from "./exercises";

export interface MathExercise {
  itemId: string;
  visual: Visual | null;
  prompt: string;
  speech: string;
  answer: number;
  options?: number[];
  worked: { visual: Visual; speech: string };
}

interface MathContext {
  messages: Messages;
  format: (value: number) => string;
  random: () => number;
}

const PERCENTS = [10, 25, 50] as const;

export function randomInt(low: number, high: number, random: () => number): number {
  return low + Math.floor(random() * (high - low + 1));
}

function expression(
  op: "add" | "sub" | "mul" | "div",
  a: number,
  b: number,
  answer: number,
  context: MathContext,
): MathExercise {
  const { messages: m, format } = context;
  const symbols = { add: "+", sub: "−", mul: "×", div: "÷" };
  const shown = `${format(a)} ${symbols[op]} ${format(b)}`;
  const spoken = `${format(a)} ${m.spoken[op]} ${format(b)}`;
  return {
    itemId: `${op}-${a}-${b}`,
    visual: { type: "expr", text: `${shown} = ?` },
    prompt: m.exprPrompt,
    speech: `${m.exprPrompt} ${spoken}`,
    answer,
    worked: {
      visual: { type: "expr", text: `${shown} = ${format(answer)}` },
      speech: `${spoken} ${m.spoken.equals} ${format(answer)}`,
    },
  };
}

function textual(itemId: string, prompt: string, answer: number, context: MathContext): MathExercise {
  return {
    itemId,
    visual: null,
    prompt,
    speech: prompt,
    answer,
    worked: {
      visual: { type: "text", text: prompt },
      speech: `${prompt} ${context.format(answer)}`,
    },
  };
}

function pictures(
  itemId: string,
  visual: Visual,
  prompt: string,
  answer: number,
  context: MathContext,
  spoken: string,
): MathExercise {
  return {
    itemId,
    visual,
    prompt,
    speech: prompt,
    answer,
    worked: { visual, speech: spoken || context.format(answer) },
  };
}

export function makeExercise(step: MathStepId, image: string, context: MathContext): MathExercise {
  const { messages: m, format, random } = context;
  const pick = (low: number, high: number) => randomInt(low, high, random);
  switch (step) {
    case "count5":
    case "count10": {
      const count = step === "count5" ? pick(1, 5) : pick(4, 10);
      return pictures(`count-${count}`, { type: "count", image, count }, m.countPrompt, count, context, "");
    }
    case "compare": {
      const a = pick(0, 20);
      let b = pick(0, 20);
      if (b === a) b = a === 20 ? 19 : a + 1;
      const bigger = Math.max(a, b);
      return {
        itemId: `cmp-${a}-${b}`,
        visual: null,
        prompt: m.comparePrompt,
        speech: `${m.comparePrompt} ${format(a)}, ${format(b)}`,
        answer: bigger,
        options: [Math.min(a, b), bigger],
        worked: {
          visual: { type: "expr", text: `${format(bigger)} > ${format(Math.min(a, b))}` },
          speech: `${m.comparePrompt} ${format(bigger)}`,
        },
      };
    }
    case "add10": {
      const a = pick(1, 6);
      const b = pick(1, 10 - a);
      const spoken = `${format(a)} ${m.spoken.add} ${format(b)} ${m.spoken.equals} ${format(a + b)}`;
      return pictures(`add-${a}-${b}`, { type: "add", image, a, b }, m.addPrompt, a + b, context, spoken);
    }
    case "sub10": {
      const a = pick(3, 10);
      const b = pick(1, a - 1);
      const spoken = `${format(a)} ${m.spoken.sub} ${format(b)} ${m.spoken.equals} ${format(a - b)}`;
      return pictures(`sub-${a}-${b}`, { type: "sub", image, a, b }, m.subPrompt, a - b, context, spoken);
    }
    case "add20": {
      const a = pick(4, 15);
      const b = pick(Math.max(2, 11 - a), 20 - a);
      return expression("add", a, b, a + b, context);
    }
    case "sub20": {
      const a = pick(11, 20);
      const b = pick(2, a - 2);
      return expression("sub", a, b, a - b, context);
    }
    case "add100": {
      const a = pick(12, 80);
      const b = pick(8, 100 - a);
      return expression("add", a, b, a + b, context);
    }
    case "sub100": {
      const a = pick(25, 100);
      const b = pick(8, a - 5);
      return expression("sub", a, b, a - b, context);
    }
    case "missing20":
    case "missing100": {
      const top = step === "missing20" ? 20 : 100;
      const total = pick(step === "missing20" ? 6 : 25, top);
      const a = pick(1, total - 1);
      const shown = `${format(a)} + ? = ${format(total)}`;
      return {
        itemId: `mis-${a}-${total}`,
        visual: { type: "expr", text: shown },
        prompt: m.missingPrompt,
        speech: `${m.missingPrompt} ${format(a)} ${m.spoken.add} ${m.spoken.what} ${m.spoken.equals} ${format(total)}`,
        answer: total - a,
        worked: {
          visual: { type: "expr", text: `${format(a)} + ${format(total - a)} = ${format(total)}` },
          speech: `${format(a)} ${m.spoken.add} ${format(total - a)} ${m.spoken.equals} ${format(total)}`,
        },
      };
    }
    case "mul5":
    case "mul10": {
      const a = step === "mul5" ? pick(2, 5) : pick(2, 10);
      const b = pick(2, 10);
      return expression("mul", a, b, a * b, context);
    }
    case "div": {
      const b = pick(2, 10);
      const quotient = pick(2, 10);
      return expression("div", b * quotient, b, quotient, context);
    }
    case "half": {
      const n = pick(2, 50) * 2;
      return textual(`half-${n}`, m.halfPrompt(format(n)), n / 2, context);
    }
    case "percent": {
      const percent = PERCENTS[pick(0, PERCENTS.length - 1)] ?? 10;
      const unit = 100 / percent;
      const n = unit * pick(1, Math.floor(200 / unit));
      return textual(
        `pct-${percent}-${n}`,
        m.percentPrompt(format(percent), format(n)),
        (percent * n) / 100,
        context,
      );
    }
    case "problem": {
      if (random() < 0.5) {
        const a = pick(3, 30);
        const b = pick(2, Math.min(20, 50 - a));
        return textual(`prob-${a}-${b}`, m.problemAdd(format(a), format(b)), a + b, context);
      }
      const a = pick(6, 50);
      const b = pick(1, a - 1);
      return textual(`take-${a}-${b}`, m.problemTake(format(a), format(b)), a - b, context);
    }
  }
}

export function numberOptions(answer: number, count: number, random: () => number): number[] {
  const spread = answer >= 20 ? [1, 2, 10, 5, 3] : [1, 2, 3, 4];
  const candidates = spread
    .flatMap((delta) => [answer - delta, answer + delta])
    .filter((value) => value >= 0 && value !== answer);
  const unique = [...new Set(candidates)];
  const picked: number[] = [];
  while (picked.length < count - 1 && unique.length) {
    const index = Math.floor(random() * Math.min(unique.length, 4));
    picked.push(...unique.splice(index, 1));
  }
  return [answer, ...picked].sort((a, b) => a - b);
}

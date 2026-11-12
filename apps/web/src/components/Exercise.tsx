import { useEffect, useRef } from "preact/hooks";
import { formatNumber, t } from "../i18n";
import type { LearnStep, QuestionStep, Visual } from "../learning/exercises";
import { say, shouldAutoSpeak } from "../lib/voice";
import { Icon } from "./Icon";
import { Picture } from "./Picture";
import { SpeakButton } from "./Speak";

function Repeat({ image, count }: { image: string; count: number }) {
  return (
    <span class="group">
      {Array.from({ length: count }, (_, index) => (
        <Picture key={index} name={image} size="s" />
      ))}
    </span>
  );
}

export function VisualView({ visual, label }: { visual: Visual; label: string }) {
  if (visual.type === "picture") {
    return (
      <div class="visual">
        <Picture name={visual.image} label={label} size="xl" />
      </div>
    );
  }
  if (visual.type === "count") {
    return (
      <div class="visual visual-math" role="img" aria-label={label}>
        <Repeat image={visual.image} count={visual.count} />
      </div>
    );
  }
  return (
    <div class="visual visual-math" role="img" aria-label={label}>
      <Repeat image={visual.image} count={visual.a} />
      <span class="operator" aria-hidden="true">
        +
      </span>
      <Repeat image={visual.image} count={visual.b} />
    </div>
  );
}

function visualLabel(visual: Visual, fallback: string): string {
  if (visual.type === "add") return `${formatNumber(visual.a)} + ${formatNumber(visual.b)}`;
  if (visual.type === "count") return formatNumber(visual.count);
  return fallback;
}

export function LearnView({ step, onNext }: { step: LearnStep; onNext: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
    if (shouldAutoSpeak()) say(step.speech, step.itemId);
  }, [step.key]);
  return (
    <>
      <section class="exercise learn">
        <p class="muted">{t.value.learnPrompt}</p>
        <VisualView visual={step.visual} label={step.word} />
        <div class="learn-word">
          <span class="word">{step.word}</span>
          <SpeakButton text={step.speech} itemId={step.itemId} large />
        </div>
      </section>
      <footer class="action-bar">
        <button ref={button} type="button" class="button primary wide" onClick={onNext}>
          {t.value.next}
        </button>
      </footer>
    </>
  );
}

interface QuestionViewProps {
  step: QuestionStep;
  selected: string | null;
  reveal: boolean;
  onAnswer: (choiceId: string) => void;
}

export function QuestionView({ step, selected, reveal, onAnswer }: QuestionViewProps) {
  useEffect(() => {
    if (shouldAutoSpeak()) say(step.speech);
  }, [step.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = Number.parseInt(event.key, 10) - 1;
      const choice = step.choices[index];
      if (choice && selected === null) onAnswer(choice.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, selected, onAnswer]);

  const titleId = `prompt-${step.key}`;
  return (
    <section class="exercise question" aria-labelledby={titleId}>
      <div class="prompt">
        <h2 id={titleId}>{step.prompt}</h2>
        <SpeakButton text={step.speech} />
      </div>
      {step.visual && <VisualView visual={step.visual} label={visualLabel(step.visual, step.answerLabel)} />}
      <div class={`choices choices-${step.layout}`} role="group" aria-labelledby={titleId}>
        {step.choices.map((choice, index) => {
          const isAnswer = choice.id === step.answer;
          const isSelected = choice.id === selected;
          const state = reveal
            ? isAnswer
              ? "is-correct"
              : isSelected
                ? "is-wrong"
                : ""
            : isSelected
              ? "is-selected"
              : "";
          return (
            <button
              key={choice.id}
              type="button"
              class={`choice ${state}`}
              disabled={selected !== null}
              aria-label={choice.label}
              onClick={() => onAnswer(choice.id)}
            >
              <span class="choice-key" aria-hidden="true">
                {index + 1}
              </span>
              {choice.image ? (
                <Picture name={choice.image} size="l" />
              ) : (
                <span class="choice-label">{choice.label}</span>
              )}
              {reveal && isAnswer && (
                <span class="choice-mark">
                  <Icon name="check" size={20} />
                </span>
              )}
              {reveal && isSelected && !isAnswer && (
                <span class="choice-mark">
                  <Icon name="cross" size={20} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

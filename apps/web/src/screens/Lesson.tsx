import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Redirect } from "../components/Common";
import { LearnView, QuestionView } from "../components/Exercise";
import { Icon } from "../components/Icon";
import { Picture } from "../components/Picture";
import { SpeakButton } from "../components/Speak";
import { TutorSheet } from "../components/Tutor";
import { formatNumber, t } from "../i18n";
import { saveLesson, saveSubject } from "../lib/account";
import { announce } from "../lib/announce";
import { lessonsOf } from "../lib/content";
import type { Lesson, Pack } from "../lib/types";
import { say, shouldAutoSpeak } from "../lib/voice";
import { contextFor, pickRandom } from "../learning/context";
import { buildLesson, mathQuestion, shuffle, type QueueItem, type QuestionStep } from "../learning/exercises";
import { openLevel, PASS_SCORE } from "../learning/progress";
import { progress } from "../state";

const RETRY_SUFFIX = ":retry";

function Feedback({
  step,
  correct,
  praise,
  onNext,
}: {
  step: QuestionStep;
  correct: boolean;
  praise: string;
  onNext: () => void;
}) {
  const m = t.value;
  const button = useRef<HTMLButtonElement>(null);
  const answerImage = step.choices.find((choice) => choice.id === step.answer)?.image;
  useEffect(() => button.current?.focus(), []);
  return (
    <div class={correct ? "feedback is-good" : "feedback is-bad"}>
      <div class="feedback-inner">
        <p class="feedback-title">
          <Icon name={correct ? "check" : "cross"} size={28} />
          <strong>{correct ? praise : m.wrong}</strong>
        </p>
        {!correct && (
          <div class="feedback-answer">
            {answerImage && <Picture name={answerImage} size="s" />}
            <span>{step.answerLabel}</span>
            <SpeakButton text={step.answerLabel} itemId={step.itemId} />
          </div>
        )}
        {!correct && <p class="small">{m.keepGoing}</p>}
        <button ref={button} type="button" class="button wide on-feedback" onClick={onNext}>
          {m.next}
        </button>
      </div>
    </div>
  );
}

function stars(score: number): number {
  if (score >= 100) return 3;
  if (score >= 80) return 2;
  return score >= PASS_SCORE ? 1 : 0;
}

function LessonDone({
  source,
  lesson,
  score,
  onRepeat,
}: {
  source: Pack;
  lesson: Lesson;
  score: number;
  onRepeat: () => void;
}) {
  const m = t.value;
  const passed = score >= PASS_SCORE;
  const next = lessonsOf(source, lesson.subject).find((item) => item.level === lesson.level + 1);
  const title = passed ? m.lessonDone : m.keepGoing;
  const summary = m.score(formatNumber(score));
  const earned = stars(score);
  useEffect(() => {
    announce(`${title} ${summary}`);
    if (shouldAutoSpeak()) say(`${title} ${summary}`);
  }, []);
  return (
    <main class="screen center done" id="main">
      <div class="stars" aria-hidden="true">
        {[1, 2, 3].map((value) => (
          <span key={value} class={value <= earned ? "star is-on" : "star"}>
            <Icon name="star" size={48} />
          </span>
        ))}
      </div>
      <h1>{title}</h1>
      <p class="lead">{summary}</p>
      <div class="stack wide">
        {passed && next && (
          <a class="button primary wide" href={`#/lesson/${next.id}`}>
            {m.nextLesson}
          </a>
        )}
        <button type="button" class={passed ? "button ghost wide" : "button primary wide"} onClick={onRepeat}>
          {m.repeatLesson}
        </button>
        <a class="button ghost wide" href={`#/path/${lesson.subject}`}>
          {m.backToPath}
        </a>
      </div>
    </main>
  );
}

function LessonRun({ source, lesson, onRepeat }: { source: Pack; lesson: Lesson; onRepeat: () => void }) {
  const m = t.value;
  const context = useMemo(() => contextFor(source), []);
  const initial = useMemo(() => buildLesson(lesson, context), []);
  const totalQuestions = initial.filter((step) => step.kind !== "learn").length;
  const steps = lesson.math?.steps ?? [];
  const [queue, setQueue] = useState<QueueItem[]>(initial);
  const [ladder, setLadder] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [firstTry, setFirstTry] = useState(0);
  const [praise, setPraise] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const step = queue[index];

  const finish = () => {
    const value = totalQuestions ? Math.round((firstTry / totalQuestions) * 100) : 100;
    saveLesson(lesson.id, value);
    const subject = progress.value.subjects[lesson.subject];
    if (subject) {
      const reached = openLevel(subject.level, lessonsOf(source, lesson.subject), progress.value);
      if (reached > subject.level) saveSubject(lesson.subject, reached, subject.placement);
    }
    setScore(value);
  };

  const advance = () => {
    setSelected(null);
    const next = index + 1;
    if (next >= queue.length) {
      finish();
      return;
    }
    const upcoming = queue[next];
    const stepId = steps[ladder];
    if (upcoming?.kind === "slot" && stepId) {
      const question = mathQuestion(lesson, stepId, context, upcoming.key);
      setQueue((items) => items.map((item, position) => (position === next ? question : item)));
    }
    setIndex(next);
  };

  const answer = (choiceId: string) => {
    if (!step || step.kind !== "question" || selected !== null) return;
    setSelected(choiceId);
    const retry = step.key.endsWith(RETRY_SUFFIX);
    const correct = choiceId === step.answer;
    if (step.adaptive)
      setLadder((value) => Math.max(0, Math.min(steps.length - 1, value + (correct ? 1 : -1))));
    if (correct) {
      if (!retry) setFirstTry((value) => value + 1);
      const line = pickRandom(m.praise) ?? "";
      setPraise(line);
      announce(line);
      if (shouldAutoSpeak()) say(line, { queue: true });
      return;
    }
    if (!retry && !step.adaptive) {
      const choices = step.layout === "numbers" ? step.choices : shuffle(step.choices);
      setQueue((items) => [...items, { ...step, key: `${step.key}${RETRY_SUFFIX}`, choices }]);
    }
    const text = `${m.wrong} ${step.answerLabel}`;
    announce(text);
    if (shouldAutoSpeak()) say(text, { queue: true });
  };

  if (score !== null) return <LessonDone source={source} lesson={lesson} score={score} onRepeat={onRepeat} />;
  if (!step || step.kind === "slot") return null;
  const done = Math.round((index / queue.length) * 100);
  const name = m.lessons[lesson.id] ?? lesson.id;

  return (
    <main class="screen lesson" id="main">
      <div class="lesson-bar">
        <a class="icon-button" href={`#/path/${lesson.subject}`} aria-label={m.quit}>
          <Icon name="close" />
        </a>
        <div
          class="meter"
          role="progressbar"
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={done}
        >
          <span style={{ inlineSize: `${done}%` }} />
        </div>
        <button type="button" class="button ghost small" onClick={() => setHelpOpen(true)}>
          <Icon name="help" size={20} />
          <span>{m.help}</span>
        </button>
      </div>
      {step.kind === "learn" ? (
        <LearnView key={step.key} step={step} onNext={advance} />
      ) : (
        <QuestionView
          key={step.key}
          step={step}
          selected={selected}
          reveal={selected !== null}
          onAnswer={answer}
        />
      )}
      {step.kind === "question" && selected !== null && (
        <Feedback step={step} correct={selected === step.answer} praise={praise} onNext={advance} />
      )}
      <TutorSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        lessonId={lesson.id}
        itemId={step.itemId}
      />
    </main>
  );
}

export function LessonScreen({ source, lessonId }: { source: Pack; lessonId: string }) {
  const [attempt, setAttempt] = useState(0);
  const lesson = source.lessons.find((item) => item.id === lessonId);
  if (!lesson) return <Redirect to="subjects" />;
  if (!progress.value.subjects[lesson.subject]) return <Redirect to={`know/${lesson.subject}`} />;
  return (
    <LessonRun
      key={`${lessonId}-${attempt}`}
      source={source}
      lesson={lesson}
      onRepeat={() => setAttempt((value) => value + 1)}
    />
  );
}

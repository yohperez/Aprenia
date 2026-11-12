import { useEffect, useMemo, useState } from "preact/hooks";
import { QuestionView } from "../components/Exercise";
import { Screen } from "../components/Common";
import { formatNumber, t } from "../i18n";
import { saveSubject } from "../lib/account";
import { lessonsOf, maxLevel } from "../lib/content";
import type { Pack } from "../lib/types";
import { say, shouldAutoSpeak } from "../lib/voice";
import { contextFor } from "../learning/context";
import { buildPlacementQuestion } from "../learning/exercises";
import { nextLevel, PLACEMENT_QUESTIONS, placementResult, type PlacementAnswer } from "../learning/placement";
import { mode, navigate } from "../state";

const ADVANCE_DELAY_MS = 450;

function PlacementResult({ subjectId, level }: { subjectId: string; level: number }) {
  const m = t.value;
  const title = m.placementResult(formatNumber(level));
  useEffect(() => {
    if (shouldAutoSpeak()) say(title);
  }, [title]);
  return (
    <Screen title={title}>
      <button type="button" class="button primary big wide" onClick={() => navigate(`path/${subjectId}`)}>
        {m.startLesson}
      </button>
    </Screen>
  );
}

export function PlacementScreen({ source, subjectId }: { source: Pack; subjectId: string }) {
  const m = t.value;
  const lessons = lessonsOf(source, subjectId);
  const top = maxLevel(source, subjectId);
  const [level, setLevel] = useState(() => Math.min(top, mode.value.placementStart));
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const question = useMemo(() => {
    const lesson = lessons.find((item) => item.level === level) ?? lessons[0];
    return lesson ? buildPlacementQuestion(lesson, contextFor(source), answers.length) : null;
  }, [answers.length, level]);

  if (result !== null) return <PlacementResult subjectId={subjectId} level={result} />;
  if (!question) return null;

  const answer = (choiceId: string) => {
    if (selected !== null) return;
    setSelected(choiceId);
    const correct = choiceId === question.answer;
    const recorded = [...answers, { level, correct }];
    const following = nextLevel(level, correct, top);
    setTimeout(() => {
      setSelected(null);
      if (recorded.length >= PLACEMENT_QUESTIONS) {
        const placed = placementResult(recorded, following);
        saveSubject(subjectId, placed, "test");
        setResult(placed);
      } else {
        setLevel(following);
      }
      setAnswers(recorded);
    }, ADVANCE_DELAY_MS);
  };

  return (
    <Screen title={m.placementTitle} back={`know/${subjectId}`}>
      <p class="muted">
        {m.placementQuestion(formatNumber(answers.length + 1), formatNumber(PLACEMENT_QUESTIONS))}
      </p>
      <ol class="dots" aria-hidden="true">
        {Array.from({ length: PLACEMENT_QUESTIONS }, (_, index) => (
          <li
            key={index}
            class={
              index < answers.length ? "dot is-done" : index === answers.length ? "dot is-current" : "dot"
            }
          />
        ))}
      </ol>
      <QuestionView key={question.key} step={question} selected={selected} reveal={false} onAnswer={answer} />
    </Screen>
  );
}

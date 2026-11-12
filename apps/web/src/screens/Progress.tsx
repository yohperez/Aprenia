import { useState } from "preact/hooks";
import { ErrorText, Redirect, Screen, useAction } from "../components/Common";
import { Dialog } from "../components/Dialog";
import { Picture } from "../components/Picture";
import { formatNumber, t } from "../i18n";
import { deleteEverything } from "../lib/account";
import { lessonsOf } from "../lib/content";
import type { Pack } from "../lib/types";
import { openLevel } from "../learning/progress";
import { progress, session } from "../state";

export function ProgressScreen({ source }: { source: Pack }) {
  const m = t.value;
  const [confirming, setConfirming] = useState(false);
  const removal = useAction(deleteEverything);
  const current = session.value;
  if (!current) return <Redirect to="signin" />;
  const live = source.subjects.filter((subject) => subject.status === "live");
  const started = live.some((subject) => progress.value.subjects[subject.id]);
  return (
    <Screen title={m.progressTitle} back="subjects">
      {!started && <p class="lead">{m.progressEmpty}</p>}
      <ul class="stack" role="list">
        {live.map((subject) => {
          const lessons = lessonsOf(source, subject.id);
          const entry = progress.value.subjects[subject.id];
          const done = lessons.filter((lesson) => progress.value.lessons[lesson.id]?.completed).length;
          const summary = m.lessonsDone(formatNumber(done), formatNumber(lessons.length));
          return (
            <li key={subject.id} class="tile progress-card">
              <div class="progress-head">
                <Picture name={subject.image} size="m" />
                <div class="progress-text">
                  <strong>{m.subjects[subject.id] ?? subject.id}</strong>
                  <span class="muted">
                    {entry
                      ? m.level(formatNumber(openLevel(entry.level, lessons, progress.value)))
                      : m.notStarted}
                  </span>
                </div>
              </div>
              <div
                class="meter"
                role="progressbar"
                aria-label={summary}
                aria-valuemin={0}
                aria-valuemax={lessons.length}
                aria-valuenow={done}
              >
                <span style={{ inlineSize: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
              </div>
              <p class="small">{summary}</p>
              <a class="button ghost" href={`#/${entry ? "path" : "know"}/${subject.id}`}>
                {m.openPath}
              </a>
            </li>
          );
        })}
      </ul>
      <div class="stack">
        {current.words && (
          <a class="button ghost wide" href="#/words/review">
            {m.showWords}
          </a>
        )}
        <div class="row">
          <a class="button ghost" href="#/age">
            {m.changeAge}
          </a>
          <a class="button ghost" href="#/goal">
            {m.changeGoal}
          </a>
        </div>
        <button type="button" class="button danger wide" onClick={() => setConfirming(true)}>
          {m.deleteData}
        </button>
      </div>
      <Dialog title={m.deleteData} open={confirming} onClose={() => setConfirming(false)}>
        <p>{m.deleteConfirm}</p>
        <div class="row">
          <button type="button" class="button ghost" onClick={() => setConfirming(false)}>
            {m.cancel}
          </button>
          <button
            type="button"
            class="button danger"
            disabled={removal.busy}
            onClick={() => void removal.run()}
          >
            {m.deleteYes}
          </button>
        </div>
        <ErrorText message={removal.error} />
      </Dialog>
    </Screen>
  );
}

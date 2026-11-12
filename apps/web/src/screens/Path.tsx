import { useState } from "preact/hooks";
import { Redirect, Screen } from "../components/Common";
import { Icon } from "../components/Icon";
import { formatNumber, t } from "../i18n";
import { audioUrl } from "../lib/api";
import { lessonsOf } from "../lib/content";
import { read, write } from "../lib/storage";
import type { Lesson, Pack } from "../lib/types";
import { currentLesson, openLevel } from "../learning/progress";
import { progress, settings } from "../state";

function lessonAudio(source: Pack, lesson: Lesson): string[] {
  return lesson.items.filter((item) => source.audio[item]);
}

function DownloadVoices({ source, lessons }: { source: Pack; lessons: Lesson[] }) {
  const m = t.value;
  const key = `voices.${settings.value.locale}`;
  const items = [...new Set(lessons.flatMap((lesson) => lessonAudio(source, lesson)))];
  const [done, setDone] = useState<boolean>(() => read<string[]>(key, []).length >= items.length);
  const [busy, setBusy] = useState(false);
  if (!items.length) return null;
  const download = async () => {
    setBusy(true);
    const results = await Promise.allSettled(
      items.map((item) => fetch(audioUrl(settings.value.locale, item))),
    );
    const saved = items.filter((_, index) => results[index]?.status === "fulfilled");
    write(key, saved);
    setDone(saved.length >= items.length);
    setBusy(false);
  };
  return (
    <button type="button" class="button ghost" disabled={busy || done} onClick={() => void download()}>
      <Icon name={done ? "check" : "download"} /> {done ? m.downloaded : m.download}
    </button>
  );
}

export function PathScreen({ source, subjectId }: { source: Pack; subjectId: string }) {
  const m = t.value;
  const subject = progress.value.subjects[subjectId];
  if (!subject) return <Redirect to={`know/${subjectId}`} />;
  const lessons = lessonsOf(source, subjectId);
  const open = openLevel(subject.level, lessons, progress.value);
  const current = currentLesson(subject.level, lessons, progress.value);
  return (
    <Screen title={m.subjects[subjectId] ?? subjectId} back="subjects">
      <p class="lead">{m.level(formatNumber(open))}</p>
      <ol class="path">
        {lessons.map((lesson) => {
          const entry = progress.value.lessons[lesson.id];
          const locked = lesson.level > open;
          const state = locked
            ? "locked"
            : entry?.completed
              ? "done"
              : current?.id === lesson.id
                ? "current"
                : "open";
          const name = m.lessons[lesson.id] ?? lesson.id;
          return (
            <li key={lesson.id} class={`path-step is-${state}`}>
              <span class="path-dot" aria-hidden="true">
                {state === "done" ? (
                  <Icon name="check" />
                ) : locked ? (
                  <Icon name="lock" size={20} />
                ) : (
                  formatNumber(lesson.level)
                )}
              </span>
              <div class="path-body">
                <strong>{name}</strong>
                {locked && <span class="muted small">{m.locked}</span>}
                {entry?.completed && (
                  <span class="muted small">{m.score(formatNumber(entry.best_score))}</span>
                )}
                {!locked && (
                  <a
                    class={state === "current" ? "button primary" : "button ghost"}
                    href={`#/lesson/${lesson.id}`}
                    aria-label={`${entry?.completed ? m.review : m.startLesson}: ${name}`}
                  >
                    {entry?.completed ? m.review : m.startLesson}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div class="note">
        <Icon name="check" size={20} />
        <span>{m.savedOffline}</span>
      </div>
      <DownloadVoices source={source} lessons={lessons} />
    </Screen>
  );
}

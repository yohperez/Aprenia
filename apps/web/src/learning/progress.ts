import type { Lesson, LessonProgress, ProgressSnapshot, SubjectProgress } from "../lib/types";
import type { ProgressState } from "../state";

export const PASS_SCORE = 50;

export function mergeLesson(local: LessonProgress | undefined, remote: LessonProgress): LessonProgress {
  if (!local) return remote;
  return {
    lesson_id: remote.lesson_id,
    completed: local.completed || remote.completed,
    best_score: Math.max(local.best_score, remote.best_score),
    attempts: Math.max(local.attempts, remote.attempts),
    updated_at: local.updated_at > remote.updated_at ? local.updated_at : remote.updated_at,
  };
}

export function mergeSubject(local: SubjectProgress | undefined, remote: SubjectProgress): SubjectProgress {
  if (!local) return remote;
  return local.updated_at >= remote.updated_at ? local : remote;
}

export function mergeSnapshot(state: ProgressState, snapshot: ProgressSnapshot): ProgressState {
  const subjects = { ...state.subjects };
  const lessons = { ...state.lessons };
  for (const item of snapshot.subjects)
    subjects[item.subject_id] = mergeSubject(subjects[item.subject_id], item);
  for (const item of snapshot.lessons) lessons[item.lesson_id] = mergeLesson(lessons[item.lesson_id], item);
  return { subjects, lessons, pending: state.pending };
}

export function recordAttempt(
  previous: LessonProgress | undefined,
  lessonId: string,
  score: number,
  now: string,
): LessonProgress {
  return {
    lesson_id: lessonId,
    completed: (previous?.completed ?? false) || score >= PASS_SCORE,
    best_score: Math.max(previous?.best_score ?? 0, score),
    attempts: (previous?.attempts ?? 0) + 1,
    updated_at: now,
  };
}

export function openLevel(subjectLevel: number, lessons: Lesson[], state: ProgressState): number {
  const top = Math.max(1, ...lessons.map((lesson) => lesson.level));
  const finished = lessons
    .filter((lesson) => state.lessons[lesson.id]?.completed)
    .map((lesson) => lesson.level + 1);
  return Math.min(top, Math.max(subjectLevel, ...finished));
}

export function currentLesson(
  subjectLevel: number,
  lessons: Lesson[],
  state: ProgressState,
): Lesson | undefined {
  const open = openLevel(subjectLevel, lessons, state);
  return (
    lessons.find(
      (lesson) =>
        lesson.level >= subjectLevel && lesson.level <= open && !state.lessons[lesson.id]?.completed,
    ) ?? lessons.find((lesson) => lesson.level === open)
  );
}

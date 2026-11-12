import { batch } from "@preact/signals";
import { mergeSnapshot, recordAttempt } from "../learning/progress";
import {
  navigate,
  nextStep,
  online,
  profile,
  progress,
  session,
  settings,
  type LocalProfile,
} from "../state";
import { api, ApiError } from "./api";
import { loadPack } from "./content";
import type { ActiveLocale } from "./locale";
import { clearAll } from "./storage";
import type { Placement, ProgressSnapshot } from "./types";

const SYNC_DELAY_MS = 800;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

const emptyProfile = (): LocalProfile => ({ ageBand: null, goal: null, dirty: false });

export async function startAsGuest(): Promise<void> {
  const result = await api.createGuest(settings.value.locale);
  batch(() => {
    session.value = { token: result.token, accountId: result.account_id, words: result.recovery_words };
    profile.value = emptyProfile();
    progress.value = { subjects: {}, lessons: {}, pending: [] };
  });
  navigate("words");
}

export async function recoverAccount(words: number[]): Promise<void> {
  const result = await api.recover(words);
  const snapshot = await api.readProgress(result.token);
  batch(() => {
    session.value = { token: result.token, accountId: result.account_id, words };
    applySnapshot(snapshot, true);
  });
  navigate(nextStep());
}

function applySnapshot(snapshot: ProgressSnapshot, replaceProfile: boolean): void {
  if (replaceProfile || !profile.value.dirty) {
    profile.value = { ageBand: snapshot.profile.age_band, goal: snapshot.profile.goal, dirty: false };
  }
  progress.value = mergeSnapshot(progress.value, snapshot);
}

export function updateProfile(changes: Partial<Omit<LocalProfile, "dirty">>): void {
  profile.value = { ...profile.value, ...changes, dirty: true };
  scheduleSync();
}

export function changeLocale(locale: ActiveLocale): void {
  if (settings.value.locale === locale) return;
  settings.value = { ...settings.value, locale };
  void loadPack(locale);
  if (session.value) updateProfile({});
}

function markPending(key: string): string[] {
  return progress.value.pending.includes(key) ? progress.value.pending : [...progress.value.pending, key];
}

export function saveSubject(subjectId: string, level: number, placement: Placement): void {
  const now = new Date().toISOString();
  progress.value = {
    ...progress.value,
    subjects: {
      ...progress.value.subjects,
      [subjectId]: { subject_id: subjectId, level, placement, updated_at: now },
    },
    pending: markPending(`subject:${subjectId}`),
  };
  scheduleSync();
}

export function saveLesson(lessonId: string, score: number): void {
  const now = new Date().toISOString();
  const entry = recordAttempt(progress.value.lessons[lessonId], lessonId, score, now);
  progress.value = {
    ...progress.value,
    lessons: { ...progress.value.lessons, [lessonId]: entry },
    pending: markPending(`lesson:${lessonId}`),
  };
  scheduleSync();
}

export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void sync(), SYNC_DELAY_MS);
}

export async function sync(): Promise<void> {
  const current = session.value;
  if (!current || !online.value || syncing) return;
  syncing = true;
  try {
    if (profile.value.dirty) {
      const sent = profile.value;
      await api.updateProfile(current.token, {
        locale: settings.value.locale,
        age_band: sent.ageBand,
        goal: sent.goal,
      });
      if (profile.value === sent) profile.value = { ...sent, dirty: false };
    }
    const pending = progress.value.pending;
    if (pending.length) {
      const subjects = pending
        .filter((key) => key.startsWith("subject:"))
        .map((key) => progress.value.subjects[key.slice(8)])
        .filter((item) => item !== undefined);
      const lessons = pending
        .filter((key) => key.startsWith("lesson:"))
        .map((key) => progress.value.lessons[key.slice(7)])
        .filter((item) => item !== undefined);
      const snapshot = await api.writeProgress(current.token, subjects, lessons);
      const remaining = progress.value.pending.filter((key) => !pending.includes(key));
      progress.value = { ...mergeSnapshot(progress.value, snapshot), pending: remaining };
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) forgetDevice();
  } finally {
    syncing = false;
  }
}

export function forgetDevice(): void {
  clearAll();
  batch(() => {
    session.value = null;
    profile.value = emptyProfile();
    progress.value = { subjects: {}, lessons: {}, pending: [] };
  });
  settings.value = { ...settings.value };
  void loadPack(settings.value.locale);
  navigate("");
}

export async function deleteEverything(): Promise<void> {
  const current = session.value;
  if (current && online.value) {
    try {
      await api.deleteAccount(current.token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  }
  forgetDevice();
}

export function errorMessageKey(
  error: unknown,
): "needInternet" | "tooMany" | "recoverWrong" | "somethingFailed" {
  if (!online.value || error instanceof TypeError) return "needInternet";
  if (error instanceof ApiError && error.status === 429) return "tooMany";
  if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return "recoverWrong";
  return "somethingFailed";
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void sync());
}

import { computed, effect, signal } from "@preact/signals";
import { detectLocale, isRtl, type ActiveLocale } from "./lib/locale";
import { read, write } from "./lib/storage";
import type { Goal, LessonProgress, Pack, SubjectProgress } from "./lib/types";
import { MODES, modeOf } from "./learning/modes";

export interface Settings {
  locale: ActiveLocale;
  colorBlind: boolean;
  readAloud: boolean;
}

export interface Session {
  token: string;
  accountId: string;
  words: number[] | null;
}

export interface LocalProfile {
  ageBand: string | null;
  goal: Goal | null;
  dirty: boolean;
}

export interface ProgressState {
  subjects: Record<string, SubjectProgress>;
  lessons: Record<string, LessonProgress>;
  pending: string[];
}

export type Dialog = "info" | "language" | "signin" | null;

const browserLanguages =
  typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);

export const settings = signal<Settings>(
  read("settings", { locale: detectLocale(browserLanguages), colorBlind: false, readAloud: false }),
);
export const session = signal<Session | null>(read("session", null));
export const profile = signal<LocalProfile>(read("profile", { ageBand: null, goal: null, dirty: false }));
export const progress = signal<ProgressState>(read("progress", { subjects: {}, lessons: {}, pending: [] }));
const storedPack = read<{ pack: Pack } | null>(`pack.${settings.value.locale}`, null)?.pack;
export const pack = signal<Pack | null>(
  storedPack && Array.isArray(storedPack.questions) ? storedPack : null,
);
export const online = signal(typeof navigator === "undefined" ? true : navigator.onLine);
export const dialog = signal<Dialog>(null);
export const route = signal<string[]>(parseHash());

export const mode = computed(() => MODES[modeOf(profile.value.ageBand)]);

export function parseHash(): string[] {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

export function navigate(path: string): void {
  const target = `#/${path.replace(/^\//, "")}`;
  if (location.hash === target) route.value = parseHash();
  else location.hash = target;
}

export function nextStep(): string {
  if (!session.value) return "signin";
  if (!profile.value.ageBand) return "age";
  if (!profile.value.goal) return "goal";
  return "subjects";
}

effect(() => write("settings", settings.value));
effect(() => write("session", session.value));
effect(() => write("profile", profile.value));
effect(() => write("progress", progress.value));

effect(() => {
  const root = document.documentElement;
  root.lang = settings.value.locale;
  root.dir = isRtl(settings.value.locale) ? "rtl" : "ltr";
  root.dataset.vision = settings.value.colorBlind ? "cb" : "normal";
  root.style.setProperty("--scale", String(mode.value.textScale));
});

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    route.value = parseHash();
    window.scrollTo(0, 0);
  });
  window.addEventListener("online", () => (online.value = true));
  window.addEventListener("offline", () => (online.value = false));
}

import { signal } from "@preact/signals";
import { pack, settings } from "../state";
import { api, imageUrl } from "./api";
import type { ActiveLocale } from "./locale";
import { read, write } from "./storage";
import type { Concept, Lesson, Pack } from "./types";

interface StoredPack {
  pack: Pack;
  etag: string | null;
}

export type PackStatus = "idle" | "loading" | "ready" | "failed";

export const packStatus = signal<PackStatus>(pack.value ? "ready" : "idle");

export function isCurrentPack(source: Pack | null | undefined): source is Pack {
  return Boolean(source && Array.isArray(source.questions) && Array.isArray(source.policies));
}
const dataUrls = new Map<string, string>();

export async function loadPack(locale: ActiveLocale): Promise<void> {
  const saved = read<StoredPack | null>(`pack.${locale}`, null);
  const stored = saved && isCurrentPack(saved.pack) ? saved : null;
  if (stored) {
    pack.value = stored.pack;
    packStatus.value = "ready";
  } else {
    packStatus.value = "loading";
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (!stored) packStatus.value = "failed";
    return;
  }
  try {
    const result = await api.fetchPack(locale, stored?.etag ?? null);
    if (result.status === "fresh" && settings.value.locale === locale) {
      write(`pack.${locale}`, { pack: result.pack, etag: result.etag });
      dataUrls.clear();
      pack.value = result.pack;
    }
    packStatus.value = "ready";
  } catch {
    if (!stored) packStatus.value = "failed";
  }
}

export function pictureSource(name: string): string {
  const cached = dataUrls.get(name);
  if (cached) return cached;
  const svg = pack.value?.images[name];
  if (!svg) return imageUrl(name);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  dataUrls.set(name, url);
  return url;
}

export function conceptMap(source: Pack): Map<string, Concept> {
  return new Map(source.concepts.map((concept) => [concept.id, concept]));
}

export function lessonsOf(source: Pack, subjectId: string): Lesson[] {
  return source.lessons
    .filter((lesson) => lesson.subject === subjectId && lesson.status !== "soon")
    .sort((a, b) => a.level - b.level);
}

export function upcomingLessonsOf(source: Pack, subjectId: string): Lesson[] {
  return source.lessons
    .filter((lesson) => lesson.subject === subjectId && lesson.status === "soon")
    .sort((a, b) => a.level - b.level);
}

export function maxLevel(source: Pack, subjectId: string): number {
  return Math.max(1, ...lessonsOf(source, subjectId).map((lesson) => lesson.level));
}

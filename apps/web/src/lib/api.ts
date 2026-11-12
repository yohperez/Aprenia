import type {
  GuestResponse,
  Locale,
  Pack,
  Profile,
  ProgressSnapshot,
  SessionResponse,
  SubjectProgress,
  LessonProgress,
  TutorRequest,
  TutorResponse,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(API_URL + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 12000),
  });
  if (!response.ok) throw new ApiError(response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type PackResult = { status: "fresh"; pack: Pack; etag: string | null } | { status: "unchanged" };

export const api = {
  createGuest: (locale: Locale) =>
    request<GuestResponse>("/v1/accounts/guest", { method: "POST", body: { locale }, timeoutMs: 45000 }),
  recover: (words: number[]) =>
    request<SessionResponse>("/v1/accounts/recover", { method: "POST", body: { words }, timeoutMs: 45000 }),
  updateProfile: (token: string, changes: Partial<Profile>) =>
    request<Profile>("/v1/me", { method: "PATCH", body: changes, token }),
  deleteAccount: (token: string) => request<void>("/v1/me", { method: "DELETE", token }),
  readProgress: (token: string) => request<ProgressSnapshot>("/v1/progress", { token, timeoutMs: 45000 }),
  writeProgress: (token: string, subjects: SubjectProgress[], lessons: LessonProgress[]) =>
    request<ProgressSnapshot>("/v1/progress", { method: "PUT", body: { subjects, lessons }, token }),
  askTutor: (token: string, body: TutorRequest) =>
    request<TutorResponse>("/v1/tutor", { method: "POST", body, token, timeoutMs: 25000 }),
  async fetchPack(locale: Locale, etag: string | null): Promise<PackResult> {
    const response = await fetch(`${API_URL}/v1/packs/${locale}`, {
      headers: etag ? { "If-None-Match": etag } : {},
      cache: "no-cache",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 304) return { status: "unchanged" };
    if (!response.ok) throw new ApiError(response.status);
    return { status: "fresh", pack: (await response.json()) as Pack, etag: response.headers.get("ETag") };
  },
};

export function imageUrl(name: string): string {
  return `${API_URL}/v1/images/${name}.svg`;
}

export function audioUrl(locale: Locale, itemId: string): string {
  return `${API_URL}/v1/audio/${locale}/${itemId}`;
}

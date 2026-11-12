import { signal } from "@preact/signals";

const NOTICE_MS = 2600;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

export const announcement = signal("");
export const notice = signal("");

export function announce(text: string): void {
  announcement.value = "";
  requestAnimationFrame(() => (announcement.value = text));
}

export function notify(text: string): void {
  notice.value = text;
  announce(text);
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (notice.value = ""), NOTICE_MS);
}

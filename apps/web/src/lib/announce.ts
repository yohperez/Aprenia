import { signal } from "@preact/signals";

export const announcement = signal("");

export function announce(text: string): void {
  announcement.value = "";
  requestAnimationFrame(() => (announcement.value = text));
}

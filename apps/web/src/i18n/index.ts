import { computed } from "@preact/signals";
import { settings } from "../state";
import { ar } from "./ar";
import { en } from "./en";
import { es, type Messages } from "./es";
import type { ActiveLocale } from "../lib/locale";

export const ACTIVE_LOCALES: { code: ActiveLocale; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "ar", name: "العربية" },
  { code: "en", name: "English" },
];

export const SOON_LOCALES = [
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "fa", name: "فارسی" },
  { code: "ps", name: "پښتو" },
  { code: "ur", name: "اردو" },
];

const catalogs: Record<ActiveLocale, Messages> = { es, ar, en };

export const t = computed(() => catalogs[settings.value.locale]);

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(settings.value.locale).format(value);
}

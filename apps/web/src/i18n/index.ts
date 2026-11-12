import { computed } from "@preact/signals";
import { settings } from "../state";
import { ar } from "./ar";
import { es, type Messages } from "./es";
import type { ActiveLocale } from "../lib/locale";

export const ACTIVE_LOCALES: { code: ActiveLocale; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "ar", name: "العربية" },
];

export const SOON_LOCALES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "fa", name: "فارسی" },
  { code: "ps", name: "پښتو" },
  { code: "ur", name: "اردو" },
];

const catalogs: Record<ActiveLocale, Messages> = { es, ar };

export const t = computed(() => catalogs[settings.value.locale]);

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(settings.value.locale).format(value);
}

export type ActiveLocale = "es" | "ar" | "en";

export function detectLocale(languages: readonly string[]): ActiveLocale {
  return languages.some((language) => language.toLowerCase().startsWith("ar")) ? "ar" : "es";
}

export function isRtl(locale: ActiveLocale): boolean {
  return locale === "ar";
}

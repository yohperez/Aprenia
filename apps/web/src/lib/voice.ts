import { mode, pack, settings } from "../state";
import { audioUrl } from "./api";
import type { Locale } from "./types";

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const FALLBACK_LANG: Record<string, string> = { es: "es-ES", ar: "ar-SA" };
const SILENT_MARKS = /[¡!¿?؟！？«»"“”„()[\]{}*#~|<>]/g;
const BLANKS = /_{2,}/g;
const EMOJI = /\p{Extended_Pictographic}/gu;
const RESTART_DELAY_MS = 60;
let voices: SpeechSynthesisVoice[] = [];
let player: HTMLAudioElement | null = null;
let current: SpeechSynthesisUtterance | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let backlog: Array<() => void> = [];

export interface SayOptions {
  itemId?: string;
  queue?: boolean;
}

function loadVoices(): void {
  if (synth) voices = synth.getVoices();
}

if (synth) {
  loadVoices();
  synth.addEventListener("voiceschanged", loadVoices);
}

export function speakable(text: string): string {
  return text
    .replace(BLANKS, ", ")
    .replace(EMOJI, "")
    .replace(SILENT_MARKS, "")
    .replace(/\s+([,.:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const FEMALE =
  /elvira|helena|laura|sabina|dalia|ximena|abril|elena|lucia|paloma|paulina|m[oó]nica|marisol|isabela|esperanza|camila|valentina|salom[eé]|zariyah|salma|hoda|fatima|laila|layla|noura|mouna|rana|iman|amany|reem|sana|amina|female|mujer|google/i;
const MALE =
  /pablo|[aá]lvaro|jorge|juan|ra[uú]l|diego|carlos|gerardo|tom[aá]s|naayf|hamed|majed|shakir|taim|moaz|omar|bassel|hamdan|jamal|rami|saleh|tarik|hedi|ismael|zaid|laith|\bmale\b|hombre/i;

function voiceScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (FEMALE.test(voice.name) && !MALE.test(voice.name)) score += 4;
  if (MALE.test(voice.name)) score -= 4;
  const natural = /natural|neural|online/i.test(voice.name);
  if (natural && navigator.onLine) score += 2;
  if (natural && !navigator.onLine) score -= 3;
  if (voice.localService) score += 1;
  return score;
}

function voiceFor(locale: Locale): SpeechSynthesisVoice | null {
  const matches = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(locale));
  return [...matches].sort((a, b) => voiceScore(b) - voiceScore(a))[0] ?? null;
}

function hasFemaleVoice(voice: SpeechSynthesisVoice | null): boolean {
  return voice !== null && FEMALE.test(voice.name) && !MALE.test(voice.name);
}

export function hasVoice(locale: Locale): boolean {
  return voiceFor(locale) !== null;
}

export function stopSpeaking(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  backlog = [];
  synth?.cancel();
  if (player) {
    player.pause();
    player = null;
  }
}

function playRecorded(locale: Locale, itemId: string): void {
  player = new Audio(audioUrl(locale, itemId));
  player.play().catch(() => undefined);
}

function speakNow(text: string, locale: Locale, voice: SpeechSynthesisVoice | null): void {
  if (!synth) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? FALLBACK_LANG[locale] ?? locale;
  if (voice) utterance.voice = voice;
  utterance.rate = mode.value.speechRate;
  current = utterance;
  utterance.onend = () => {
    if (current === utterance) current = null;
  };
  synth.resume();
  synth.speak(utterance);
}

export function say(raw: string, options: SayOptions = {}): void {
  if (!settings.value.sound) return;
  const text = speakable(raw);
  if (!text) return;
  const locale = settings.value.locale;
  const voice = voiceFor(locale);
  const recorded = options.itemId && pack.value?.audio[options.itemId] ? options.itemId : null;
  if (recorded && !hasFemaleVoice(voice)) {
    stopSpeaking();
    playRecorded(locale, recorded);
    return;
  }
  if (!synth) return;
  const job = () => speakNow(text, locale, voice);
  if (options.queue) {
    if (pendingTimer) backlog.push(job);
    else job();
    return;
  }
  const busy = synth.speaking || synth.pending;
  stopSpeaking();
  if (!busy) {
    job();
    return;
  }
  backlog = [job];
  pendingTimer = setTimeout(flush, RESTART_DELAY_MS);
}

function flush(): void {
  pendingTimer = null;
  const jobs = backlog;
  backlog = [];
  jobs.forEach((job) => job());
}

export function shouldAutoSpeak(): boolean {
  return settings.value.sound && mode.value.autoSpeak;
}

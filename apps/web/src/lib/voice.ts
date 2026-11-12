import { mode, pack, settings } from "../state";
import { audioUrl } from "./api";
import type { Locale } from "./types";

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const FALLBACK_LANG: Record<string, string> = { es: "es-ES", ar: "ar-SA" };
let voices: SpeechSynthesisVoice[] = [];
let player: HTMLAudioElement | null = null;

function loadVoices(): void {
  if (synth) voices = synth.getVoices();
}

if (synth) {
  loadVoices();
  synth.addEventListener("voiceschanged", loadVoices);
}

function voiceFor(locale: Locale): SpeechSynthesisVoice | null {
  const matches = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(locale));
  return matches.find((voice) => voice.localService) ?? matches[0] ?? null;
}

export function stopSpeaking(): void {
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

export function say(text: string, itemId?: string): void {
  const locale = settings.value.locale;
  const recorded = itemId && pack.value?.audio[itemId] ? itemId : null;
  stopSpeaking();
  const voice = voiceFor(locale);
  if (!voice && recorded) {
    playRecorded(locale, recorded);
    return;
  }
  if (!synth) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? FALLBACK_LANG[locale] ?? locale;
  if (voice) utterance.voice = voice;
  utterance.rate = mode.value.speechRate;
  synth.speak(utterance);
}

export function shouldAutoSpeak(): boolean {
  return settings.value.readAloud || mode.value.autoSpeak;
}

import { useEffect } from "preact/hooks";
import { t } from "../i18n";
import { say, shouldAutoSpeak } from "../lib/voice";
import { settings } from "../state";
import { Icon } from "./Icon";

interface SpeakButtonProps {
  text: string;
  itemId?: string;
  large?: boolean;
}

export function SpeakButton({ text, itemId, large = false }: SpeakButtonProps) {
  return (
    <button
      type="button"
      class={large ? "speak speak-large" : "speak"}
      onClick={() => say(text, itemId)}
      aria-label={`${t.value.listen}: ${text}`}
    >
      <Icon name="speaker" size={large ? 32 : 24} />
    </button>
  );
}

export function useReadAloud(text: string | null, itemId?: string, always = false): void {
  useEffect(() => {
    if (!text) return;
    if (always ? shouldAutoSpeak() : settings.value.readAloud) say(text, itemId);
  }, [text, itemId, always]);
}

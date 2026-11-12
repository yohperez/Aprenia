import { useEffect, useState } from "preact/hooks";
import { t } from "../i18n";
import { errorMessageKey } from "../lib/account";
import { announce } from "../lib/announce";
import { api } from "../lib/api";
import type { TutorIntent } from "../lib/types";
import { say, shouldAutoSpeak } from "../lib/voice";
import { mode, online, session, settings } from "../state";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { SpeakButton } from "./Speak";

interface Reply {
  text: string;
  ok: boolean;
  policies: { id: string; title: string }[];
}

interface TutorSheetProps {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  itemId: string;
}

const INTENTS: TutorIntent[] = ["explain", "example", "slower"];

export function TutorSheet({ open, onClose, lessonId, itemId }: TutorSheetProps) {
  const m = t.value;
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [question, setQuestion] = useState("");
  const labels: Record<TutorIntent, string> = {
    explain: m.helpExplain,
    example: m.helpExample,
    slower: m.helpSlower,
  };

  useEffect(() => setReply(null), [itemId]);

  const show = (next: Reply) => {
    setReply(next);
    announce(next.text);
    if (shouldAutoSpeak()) say(next.text);
  };

  const ask = async (request: { intent?: TutorIntent; question?: string }) => {
    const current = session.value;
    if (!current || !online.value) {
      show({ text: m.needInternet, ok: false, policies: [] });
      return;
    }
    setBusy(true);
    try {
      const response = await api.askTutor(current.token, {
        locale: settings.value.locale,
        lesson_id: lessonId,
        item_id: itemId,
        ...request,
      });
      const ok = response.status === "ok" && Boolean(response.answer);
      show({
        text: ok ? (response.answer as string) : (m.tutor[response.status] ?? m.somethingFailed),
        ok,
        policies: response.policies,
      });
      if (ok) setQuestion("");
    } catch (error) {
      const key = errorMessageKey(error);
      show({ text: key === "recoverWrong" ? m.somethingFailed : m[key], ok: false, policies: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={m.help} open={open} onClose={onClose}>
      <p class="ai-label">
        <Icon name="info" size={18} />
        <span>{m.aiLabel}</span>
      </p>
      <div class="preset-row">
        {INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            class="button ghost"
            disabled={busy}
            onClick={() => void ask({ intent })}
          >
            {labels[intent]}
          </button>
        ))}
      </div>
      {mode.value.freeText && (
        <form
          class="ask"
          onSubmit={(event) => {
            event.preventDefault();
            const text = question.trim();
            if (text) void ask({ question: text });
          }}
        >
          <label for="tutor-question">{m.helpAsk}</label>
          <textarea
            id="tutor-question"
            dir="auto"
            rows={2}
            maxLength={300}
            value={question}
            onInput={(event) => setQuestion(event.currentTarget.value)}
          />
          <button type="submit" class="button primary" disabled={busy || !question.trim()}>
            {m.helpSend}
          </button>
        </form>
      )}
      {busy && (
        <p class="muted" aria-busy="true">
          {m.thinking}
        </p>
      )}
      {reply && !busy && (
        <div class={reply.ok ? "bubble" : "bubble is-note"}>
          <p dir="auto">{reply.text}</p>
          <SpeakButton text={reply.text} />
          {reply.policies.length > 0 && (
            <details>
              <summary>{m.rulesApplied}</summary>
              <ul>
                {reply.policies.map((policy) => (
                  <li key={policy.id}>{policy.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}

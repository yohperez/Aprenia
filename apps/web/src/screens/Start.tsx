import { useState } from "preact/hooks";
import { ErrorText, Redirect, Screen, useAction } from "../components/Common";
import { Icon } from "../components/Icon";
import { Picture } from "../components/Picture";
import { useReadAloud } from "../components/Speak";
import { t } from "../i18n";
import { recoverAccount, startAsGuest } from "../lib/account";
import type { Concept } from "../lib/types";
import { say } from "../lib/voice";
import { navigate, nextStep, pack, session } from "../state";

const RECOVERY_LENGTH = 6;

export function Home() {
  const m = t.value;
  const signedIn = Boolean(session.value);
  const guest = useAction(startAsGuest);
  useReadAloud(`Yara. ${m.tagline}`);
  return (
    <main class="screen home" id="main">
      <h1 class="home-logo">
        <img
          src="/brand/logo.webp"
          alt="Yara"
          width="200"
          height="212"
          decoding="async"
          fetchpriority="high"
        />
      </h1>
      <p class="tagline">{m.tagline}</p>
      <div class="home-actions">
        <button
          type="button"
          class="button primary big wide"
          disabled={guest.busy}
          onClick={() => (signedIn ? navigate(nextStep()) : void guest.run())}
        >
          {signedIn ? m.continueLearning : m.start}
        </button>
        {!signedIn && (
          <a class="button ghost wide" href="#/recover">
            {m.haveWords}
          </a>
        )}
      </div>
      <ErrorText message={guest.error} />
    </main>
  );
}

export function SignIn() {
  const m = t.value;
  const guest = useAction(startAsGuest);
  if (session.value) return <Redirect to={nextStep()} />;
  return (
    <Screen title={m.signInTitle} back="">
      <div class="stack">
        <button type="button" class="tile tile-action" disabled={guest.busy} onClick={() => void guest.run()}>
          <strong>{m.guest}</strong>
          <span class="muted">{m.guestHint}</span>
        </button>
        <a class="tile tile-action" href="#/recover">
          <strong>{m.recover}</strong>
        </a>
        <button type="button" class="tile tile-action" disabled>
          <strong>{m.email}</strong>
          <span class="badge">{m.soon}</span>
        </button>
        <ErrorText message={guest.error} />
      </div>
    </Screen>
  );
}

function wordsOf(indices: number[], concepts: Concept[]): Concept[] {
  return indices.map((index) => concepts[index]).filter((concept): concept is Concept => Boolean(concept));
}

export function Words({ review = false }: { review?: boolean }) {
  const m = t.value;
  const current = session.value;
  const source = pack.value;
  if (!current?.words || !source) return <Redirect to={current ? nextStep() : "signin"} />;
  const words = wordsOf(current.words, source.concepts);
  return (
    <Screen title={m.wordsTitle} back={review ? "progress" : undefined}>
      <p class="lead">{m.wordsHint}</p>
      <ol class="word-grid">
        {words.map((concept, index) => (
          <li key={`${concept.id}-${index}`}>
            <button type="button" class="word-card" onClick={() => say(concept.word, { itemId: concept.id })}>
              <span class="word-index">{index + 1}</span>
              <Picture name={concept.image} size="l" />
              <span class="word-text">{concept.word}</span>
            </button>
          </li>
        ))}
      </ol>
      <div class="stack">
        <button
          type="button"
          class="button ghost wide"
          onClick={() => say(words.map((word) => word.word).join(", "))}
        >
          <Icon name="speaker" /> {m.listenAll}
        </button>
        <button
          type="button"
          class="button primary wide"
          onClick={() => navigate(review ? "progress" : nextStep())}
        >
          {review ? m.back : m.wordsSaved}
        </button>
      </div>
    </Screen>
  );
}

export function Recover() {
  const m = t.value;
  const source = pack.value;
  const [picked, setPicked] = useState<number[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const recover = useAction(recoverAccount);
  if (session.value) return <Redirect to={nextStep()} />;
  if (!source) return null;
  const categories = [...new Set(source.concepts.map((concept) => concept.category))];
  const active = category ?? categories[0] ?? "";
  const pick = (index: number, concept: Concept) => {
    if (picked.length >= RECOVERY_LENGTH) return;
    setPicked([...picked, index]);
    say(concept.word, { itemId: concept.id });
  };
  return (
    <Screen title={m.recoverTitle} back="signin">
      <ol class="slots" aria-live="polite">
        {Array.from({ length: RECOVERY_LENGTH }, (_, slot) => {
          const concept = picked[slot] === undefined ? undefined : source.concepts[picked[slot] as number];
          return (
            <li key={slot} class={concept ? "slot filled" : "slot"}>
              {concept ? (
                <Picture name={concept.image} label={concept.word} size="s" />
              ) : (
                <span>{slot + 1}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div class="row">
        <button
          type="button"
          class="button ghost"
          disabled={!picked.length}
          onClick={() => setPicked(picked.slice(0, -1))}
        >
          {m.removeLast}
        </button>
        <button
          type="button"
          class="button primary"
          disabled={picked.length !== RECOVERY_LENGTH || recover.busy}
          onClick={() => void recover.run(picked)}
        >
          {m.recoverAction}
        </button>
      </div>
      <ErrorText message={recover.error} />
      <div class="tabs" role="group" aria-label={m.recoverTitle}>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            class="tab"
            aria-pressed={name === active}
            onClick={() => setCategory(name)}
          >
            {m.categories[name as keyof typeof m.categories] ?? name}
          </button>
        ))}
      </div>
      <div class="concept-grid">
        {source.concepts.map((concept, index) =>
          concept.category === active ? (
            <button
              key={concept.id}
              type="button"
              class="concept"
              disabled={picked.length >= RECOVERY_LENGTH}
              onClick={() => pick(index, concept)}
            >
              <Picture name={concept.image} size="m" />
              <span>{concept.word}</span>
            </button>
          ) : null,
        )}
      </div>
    </Screen>
  );
}

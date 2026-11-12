import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { t } from "../i18n";
import { errorMessageKey } from "../lib/account";
import { navigate } from "../state";
import { Icon } from "./Icon";
import { useReadAloud } from "./Speak";

export function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to), [to]);
  return null;
}

export function Screen({
  title,
  back,
  children,
}: {
  title: string;
  back?: string;
  children: ComponentChildren;
}) {
  useReadAloud(title);
  return (
    <main class="screen" id="main">
      <div class="screen-head">
        {back !== undefined && (
          <a class="icon-button back" href={`#/${back}`} aria-label={t.value.back}>
            <Icon name="back" />
          </a>
        )}
        <h1>{title}</h1>
      </div>
      {children}
    </main>
  );
}

export function Loading() {
  return (
    <main class="screen center" aria-busy="true">
      <span class="spinner" aria-hidden="true" />
      <p>{t.value.loading}</p>
    </main>
  );
}

export function useAction<T extends unknown[]>(action: (...args: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (...args: T) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action(...args);
    } catch (caught) {
      setError(t.value[errorMessageKey(caught)]);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p class="error" role="alert">
      {message}
    </p>
  ) : null;
}

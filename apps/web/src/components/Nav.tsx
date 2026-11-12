import { ACTIVE_LOCALES, SOON_LOCALES, t } from "../i18n";
import { changeLocale } from "../lib/account";
import { say } from "../lib/voice";
import { dialog, session, settings } from "../state";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { SpeakButton } from "./Speak";

function toggleColorBlind(): void {
  settings.value = { ...settings.value, colorBlind: !settings.value.colorBlind };
}

function toggleReadAloud(): void {
  const readAloud = !settings.value.readAloud;
  settings.value = { ...settings.value, readAloud };
  if (readAloud) say(t.value.readAloudOn);
}

export function Nav() {
  const m = t.value;
  const { colorBlind, readAloud, locale } = settings.value;
  return (
    <header class="nav">
      <a class="nav-brand" href="#/">
        Yara
      </a>
      <div class="nav-actions">
        <button
          type="button"
          class="icon-button"
          onClick={() => (dialog.value = "info")}
          aria-label={m.info}
          title={m.info}
        >
          <Icon name="info" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-pressed={colorBlind}
          onClick={toggleColorBlind}
          aria-label={m.colorBlind}
          title={m.colorBlind}
        >
          <Icon name="eye" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-pressed={readAloud}
          onClick={toggleReadAloud}
          aria-label={m.readAloud}
          title={m.readAloud}
        >
          <Icon name={readAloud ? "speaker" : "mute"} />
        </button>
        <button
          type="button"
          class="icon-button lang-button"
          onClick={() => (dialog.value = "language")}
          aria-label={m.language}
          title={m.language}
        >
          <Icon name="globe" size={20} />
          <span aria-hidden="true">{locale.toUpperCase()}</span>
        </button>
        {session.value ? (
          <a class="nav-account" href="#/progress" aria-label={m.myProgress} title={m.myProgress}>
            <Icon name="user" />
          </a>
        ) : (
          <a class="nav-signin" href="#/signin">
            {m.signIn}
          </a>
        )}
      </div>
    </header>
  );
}

export function InfoDialog() {
  const m = t.value;
  return (
    <Dialog title={m.infoTitle} open={dialog.value === "info"} onClose={() => (dialog.value = null)}>
      <div class="stack">
        {m.infoBody.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <SpeakButton text={m.infoBody.join(" ")} />
        <p class="muted small">{m.credits}</p>
      </div>
    </Dialog>
  );
}

export function LanguageDialog() {
  const m = t.value;
  const close = () => (dialog.value = null);
  return (
    <Dialog title={m.language} open={dialog.value === "language"} onClose={close}>
      <ul class="option-list" role="list">
        {ACTIVE_LOCALES.map((option) => (
          <li key={option.code}>
            <button
              type="button"
              class="option"
              lang={option.code}
              aria-current={settings.value.locale === option.code ? "true" : undefined}
              onClick={() => {
                changeLocale(option.code);
                close();
              }}
            >
              <span>{option.name}</span>
              {settings.value.locale === option.code && <Icon name="check" />}
            </button>
          </li>
        ))}
        {SOON_LOCALES.map((option) => (
          <li key={option.code}>
            <button type="button" class="option" lang={option.code} disabled>
              <span>{option.name}</span>
              <span class="badge">{m.soon}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

import { useEffect } from "preact/hooks";
import { Screen } from "../components/Common";
import { t } from "../i18n";
import type { Pack } from "../lib/types";

const SECTIONS = ["privacy", "minors", "ai", "links", "norms", "notice"] as const;
type Section = (typeof SECTIONS)[number];

export function Legal({ source, section }: { source: Pack | null; section: string | undefined }) {
  const m = t.value;
  useEffect(() => {
    if (section) document.getElementById(`legal-${section}`)?.scrollIntoView();
  }, [section]);
  return (
    <Screen title={m.legalTitle} back="">
      {SECTIONS.map((key: Section) => {
        const block = m.legal[key];
        return (
          <section key={key} id={`legal-${key}`} class="tile legal" aria-labelledby={`legal-title-${key}`}>
            <h2 id={`legal-title-${key}`}>{block.title}</h2>
            {block.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {key === "norms" && source && (
              <ul class="norms" role="list">
                {source.policies.map((policy) => (
                  <li key={policy.id}>
                    <a href={policy.url} target="_blank" rel="noopener noreferrer" lang="en">
                      {policy.title}
                    </a>
                    <span class="muted small" lang="en">
                      {policy.source}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </Screen>
  );
}

export function Footer() {
  const m = t.value;
  const links: [string, string][] = [
    ["privacy", m.footer.privacy],
    ["minors", m.footer.minors],
    ["ai", m.footer.ai],
    ["norms", m.footer.norms],
    ["notice", m.footer.legal],
  ];
  return (
    <footer class="site-footer">
      <nav aria-label={m.legalTitle}>
        <ul role="list">
          {links.map(([key, label]) => (
            <li key={key}>
              <a href={`#/legal/${key}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <p class="small">{m.credits}</p>
    </footer>
  );
}

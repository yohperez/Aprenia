import { useEffect } from "preact/hooks";
import { Icon } from "../components/Icon";
import { useReadAloud } from "../components/Speak";
import { t } from "../i18n";
import type { Pack } from "../lib/types";

const SECTIONS = ["privacy", "minors", "ai", "links", "norms", "notice"] as const;
type Section = (typeof SECTIONS)[number];

function isSection(value: string | undefined): value is Section {
  return SECTIONS.includes(value as Section);
}

export function Legal({ source, section }: { source: Pack | null; section: string | undefined }) {
  const m = t.value;
  const active: Section = isSection(section) ? section : "privacy";
  const block = m.legal[active];
  useReadAloud(block.title);
  useEffect(() => window.scrollTo(0, 0), [active]);
  return (
    <main class="legal-page" id="main">
      <div class="legal-inner">
        <a class="icon-button back" href="#/" aria-label={m.back}>
          <Icon name="back" />
        </a>
        <p class="muted">{m.legalTitle}</p>
        <h1>{block.title}</h1>
        <nav class="legal-tabs" aria-label={m.legalTitle}>
          {SECTIONS.map((key) => (
            <a
              key={key}
              href={`#/legal/${key}`}
              class="tab"
              aria-current={key === active ? "page" : undefined}
            >
              {m.legal[key].title}
            </a>
          ))}
        </nav>
        <section class="legal-body" aria-labelledby="legal-heading">
          <h2 id="legal-heading" class="sr-only">
            {block.title}
          </h2>
          {block.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {active === "norms" && source && (
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
      </div>
    </main>
  );
}

export function Footer() {
  const m = t.value;
  const links: [Section, string][] = [
    ["privacy", m.footer.privacy],
    ["minors", m.footer.minors],
    ["ai", m.footer.ai],
    ["links", m.legal.links.title],
    ["norms", m.footer.norms],
    ["notice", m.footer.legal],
  ];
  return (
    <footer class="site-footer">
      <div class="footer-inner">
        <p class="footer-brand">Yara</p>
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
      </div>
    </footer>
  );
}

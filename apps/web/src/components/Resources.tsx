import { t } from "../i18n";
import type { Pack } from "../lib/types";
import { modeOf } from "../learning/modes";
import { profile, settings } from "../state";
import { Icon } from "./Icon";

export function FreeVideos({ source, subjectId }: { source: Pack; subjectId: string }) {
  const m = t.value;
  if (profile.value.goal !== "free_training") return null;
  const links = source.resources.filter((resource) => resource.subject === subjectId);
  if (!links.length) return null;
  const minor = ["early", "junior", "teen"].includes(modeOf(profile.value.ageBand));
  return (
    <section class="tile resources" aria-labelledby={`resources-${subjectId}`}>
      <h2 id={`resources-${subjectId}`}>{m.resourcesTitle}</h2>
      <p class="muted small">
        {m.resourcesHint} {minor ? m.resourcesMinor : ""}
      </p>
      <ul class="stack" role="list">
        {links.map((link) => (
          <li key={link.id}>
            <a class="resource" href={link.url} target="_blank" rel="noopener noreferrer">
              <Icon name="play" size={20} />
              <span dir="auto">{link.title}</span>
              {link.locale !== settings.value.locale && <span class="badge">{m.inEnglish}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

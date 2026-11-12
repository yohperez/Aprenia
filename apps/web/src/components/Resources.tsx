import { t } from "../i18n";
import type { Pack, Resource } from "../lib/types";
import { modeOf } from "../learning/modes";
import { profile, settings } from "../state";
import { Icon } from "./Icon";

function LinkList({ links }: { links: Resource[] }) {
  const m = t.value;
  return (
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
  );
}

function Hint() {
  const m = t.value;
  const minor = ["early", "junior", "teen"].includes(modeOf(profile.value.ageBand));
  return (
    <p class="muted small">
      {m.resourcesHint} {minor ? m.resourcesMinor : ""}
    </p>
  );
}

export function FreeVideos({ source, subjectId }: { source: Pack; subjectId: string }) {
  const m = t.value;
  if (profile.value.goal !== "free_training") return null;
  const links = source.resources.filter((resource) => resource.subject === subjectId);
  if (!links.length) return null;
  return (
    <section class="tile resources" aria-labelledby={`resources-${subjectId}`}>
      <h2 id={`resources-${subjectId}`}>{m.resourcesTitle}</h2>
      <Hint />
      <LinkList links={links} />
    </section>
  );
}

export function AllFreeVideos({ source }: { source: Pack }) {
  const m = t.value;
  if (profile.value.goal !== "free_training") return null;
  const subjects = source.subjects.filter(
    (subject) =>
      subject.status === "live" && source.resources.some((resource) => resource.subject === subject.id),
  );
  if (!subjects.length) return null;
  return (
    <section class="tile resources" aria-labelledby="resources-all">
      <h2 id="resources-all">{m.resourcesTitle}</h2>
      <Hint />
      {subjects.map((subject) => (
        <div key={subject.id} class="resource-group">
          <h3>{m.subjects[subject.id] ?? subject.id}</h3>
          <LinkList links={source.resources.filter((resource) => resource.subject === subject.id)} />
        </div>
      ))}
    </section>
  );
}

import { Redirect, Screen } from "../components/Common";
import { Picture } from "../components/Picture";
import { t } from "../i18n";
import { saveSubject, updateProfile } from "../lib/account";
import type { Goal, Subject } from "../lib/types";
import { AGE_BANDS, bandLimits } from "../learning/modes";
import { say } from "../lib/voice";
import { afterGoal, navigate, pack, profile, settings, subjectsHome, subjectStart } from "../state";

const GOALS: Goal[] = ["learn_new", "learn_tech", "free_training", "resume_studies"];
const GOAL_SUBJECTS: Record<Goal, string[]> = {
  learn_new: ["language", "math"],
  learn_tech: ["technology", "math", "language"],
  free_training: ["language", "math"],
  resume_studies: ["math", "language"],
};

function speakIfEnabled(text: string): void {
  if (settings.value.readAloud) say(text);
}

export function AgeScreen() {
  const m = t.value;
  return (
    <Screen title={m.ageTitle}>
      <div class="age-grid">
        {AGE_BANDS.map((band) => {
          const [from, to] = bandLimits(band);
          const label = m.ageBand(from, to);
          return (
            <button
              key={band}
              type="button"
              class="age"
              aria-label={label}
              aria-pressed={profile.value.ageBand === band}
              onClick={() => {
                speakIfEnabled(label);
                updateProfile({ ageBand: band });
                navigate(profile.value.goal ? afterGoal() : "goal");
              }}
            >
              <span dir="ltr">{to ? `${from}-${to}` : `${from}+`}</span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}

export function GoalScreen() {
  const m = t.value;
  if (!profile.value.ageBand) return <Redirect to="age" />;
  return (
    <Screen title={m.goalTitle} back="age">
      <div class="stack">
        {GOALS.map((goal) => (
          <button
            key={goal}
            type="button"
            class="tile tile-action"
            aria-pressed={profile.value.goal === goal}
            onClick={() => {
              speakIfEnabled(m.goals[goal]);
              updateProfile({ goal });
              navigate(afterGoal());
            }}
          >
            <strong>{m.goals[goal]}</strong>
          </button>
        ))}
      </div>
    </Screen>
  );
}

function orderSubjects(subjects: Subject[], goal: Goal | null): Subject[] {
  const preferred = goal ? GOAL_SUBJECTS[goal] : [];
  const rank = (subject: Subject) => {
    const position = preferred.indexOf(subject.id);
    return (subject.status === "live" ? 0 : 100) + (position === -1 ? 50 : position);
  };
  return [...subjects].sort((a, b) => rank(a) - rank(b));
}

export function Subjects() {
  const m = t.value;
  const source = pack.value;
  if (!profile.value.ageBand) return <Redirect to="age" />;
  if (!source) return null;
  const subjects = orderSubjects(source.subjects, profile.value.goal);
  const recommended = subjects.find((subject) => subject.status === "live")?.id;
  return (
    <Screen title={m.subjectsTitle} back="goal">
      <div class="subject-grid">
        {subjects.map((subject) => {
          const name = m.subjects[subject.id] ?? subject.id;
          const live = subject.status === "live";
          return (
            <button
              key={subject.id}
              type="button"
              class={live ? "subject" : "subject is-soon"}
              disabled={!live}
              onClick={() => {
                speakIfEnabled(name);
                navigate(subjectStart(subject.id));
              }}
            >
              <Picture name={subject.image} size="l" />
              <strong>{name}</strong>
              {!live && <span class="badge">{m.soon}</span>}
              {live && subject.id === recommended && <span class="badge badge-sun">{m.forYou}</span>}
            </button>
          );
        })}
      </div>
    </Screen>
  );
}

export function Know({ subjectId }: { subjectId: string }) {
  const m = t.value;
  const name = m.subjects[subjectId] ?? subjectId;
  return (
    <Screen title={m.knowTitle(name)} back={subjectsHome()}>
      <div class="stack">
        <button type="button" class="tile tile-action" onClick={() => navigate(`placement/${subjectId}`)}>
          <strong>{m.knowYes}</strong>
          <span class="muted">{m.knowYesHint}</span>
        </button>
        <button
          type="button"
          class="tile tile-action"
          onClick={() => {
            saveSubject(subjectId, 1, "zero");
            navigate(`path/${subjectId}`);
          }}
        >
          <strong>{m.knowNo}</strong>
          <span class="muted">{m.knowNoHint}</span>
        </button>
      </div>
    </Screen>
  );
}

import { useEffect } from "preact/hooks";
import { Loading, Redirect } from "./components/Common";
import { InfoDialog, LanguageDialog, Nav } from "./components/Nav";
import { t } from "./i18n";
import { sync } from "./lib/account";
import { announcement } from "./lib/announce";
import { loadPack, packStatus } from "./lib/content";
import type { Pack } from "./lib/types";
import { LessonScreen } from "./screens/Lesson";
import { AgeScreen, GoalScreen, Know, Subjects } from "./screens/Onboarding";
import { PathScreen } from "./screens/Path";
import { PlacementScreen } from "./screens/Placement";
import { ProgressScreen } from "./screens/Progress";
import { Footer, Legal } from "./screens/Legal";
import { Home, Recover, SignIn, Words } from "./screens/Start";
import { online, pack, route, session, settings } from "./state";

const PUBLIC_ROUTES = new Set(["", "signin", "recover"]);

function screenFor(name: string, param: string | undefined, source: Pack) {
  switch (name) {
    case "words":
      return <Words review={param === "review"} />;
    case "age":
      return <AgeScreen />;
    case "goal":
      return <GoalScreen />;
    case "subjects":
      return <Subjects />;
    case "know":
      return param ? <Know subjectId={param} /> : <Redirect to="subjects" />;
    case "placement":
      return param ? (
        <PlacementScreen key={param} source={source} subjectId={param} />
      ) : (
        <Redirect to="subjects" />
      );
    case "path":
      return param ? <PathScreen source={source} subjectId={param} /> : <Redirect to="subjects" />;
    case "lesson":
      return param ? (
        <LessonScreen key={param} source={source} lessonId={param} />
      ) : (
        <Redirect to="subjects" />
      );
    case "progress":
      return <ProgressScreen source={source} />;
    default:
      return <Redirect to="" />;
  }
}

function Content() {
  const [name = "", param] = route.value;
  const source = pack.value;
  if (name === "") return <Home />;
  if (name === "signin") return <SignIn />;
  if (name === "legal") return <Legal source={source} section={param} />;
  if (!source) {
    return packStatus.value === "failed" ? (
      <main class="screen center" id="main">
        <p class="error">{t.value.needInternet}</p>
      </main>
    ) : (
      <Loading />
    );
  }
  if (name === "recover") return <Recover />;
  if (!session.value && !PUBLIC_ROUTES.has(name)) return <Redirect to="signin" />;
  return screenFor(name, param, source);
}

export function App() {
  useEffect(() => {
    void loadPack(settings.value.locale);
    void sync();
  }, []);
  return (
    <>
      <Nav />
      {!online.value && (
        <p class="offline" role="status">
          {t.value.offline}
        </p>
      )}
      <Content />
      {route.value[0] !== "lesson" && <Footer />}
      <InfoDialog />
      <LanguageDialog />
      <p class="sr-only" aria-live="polite">
        {announcement.value}
      </p>
    </>
  );
}

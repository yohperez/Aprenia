export type Locale = "es" | "en" | "fr" | "pt" | "ar" | "fa" | "ps" | "ur";
export type Goal = "learn_new" | "learn_tech" | "free_training" | "resume_studies";
export type Placement = "test" | "zero";
export type TutorIntent = "explain" | "example" | "slower";
export type TutorStatus =
  "ok" | "off_topic" | "blocked" | "escalated" | "limit" | "unavailable" | "disabled" | "not_allowed";

export interface Profile {
  locale: Locale;
  age_band: string | null;
  goal: Goal | null;
}

export interface SessionResponse {
  account_id: string;
  token: string;
  profile: Profile;
}

export interface GuestResponse extends SessionResponse {
  recovery_words: number[];
}

export interface SubjectProgress {
  subject_id: string;
  level: number;
  placement: Placement;
  updated_at: string;
}

export interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  best_score: number;
  attempts: number;
  updated_at: string;
}

export interface ProgressSnapshot {
  profile: Profile;
  subjects: SubjectProgress[];
  lessons: LessonProgress[];
}

export type MathStepId =
  | "count5"
  | "count10"
  | "compare"
  | "add10"
  | "sub10"
  | "add20"
  | "sub20"
  | "missing20"
  | "add100"
  | "sub100"
  | "missing100"
  | "mul5"
  | "mul10"
  | "div"
  | "half"
  | "percent"
  | "problem";

export interface MathSpec {
  steps: MathStepId[];
  object: string;
}

export interface Lesson {
  id: string;
  subject: string;
  level: number;
  kind: "vocabulary" | "math" | "safety" | "quiz";
  status: "live" | "soon";
  items: string[];
  math?: MathSpec;
}

export interface Statement {
  id: string;
  set: string;
  safe: boolean;
  text: string;
}

export interface Question {
  id: string;
  concept: string | null;
  answer: number;
  prompt: string;
  options: string[];
  locale: string;
}

export interface Resource {
  id: string;
  subject: string;
  kind: "channel" | "search";
  title: string;
  url: string;
  locale: string;
}

export interface Policy {
  id: string;
  title: string;
  source: string;
  url: string;
}

export interface Concept {
  id: string;
  category: string;
  image: string;
  word: string;
}

export interface Subject {
  id: string;
  status: "live" | "soon";
  image: string;
}

export interface Pack {
  version: string;
  locale: Locale;
  rtl: boolean;
  subjects: Subject[];
  lessons: Lesson[];
  concepts: Concept[];
  statements: Statement[];
  questions: Question[];
  resources: Resource[];
  policies: Policy[];
  images: Record<string, string>;
  audio: Record<string, string>;
}

export interface TutorRequest {
  locale: Locale;
  lesson_id: string;
  item_id: string;
  intent?: TutorIntent;
  question?: string;
}

export interface TutorResponse {
  status: TutorStatus;
  answer: string | null;
  policies: { id: string; title: string }[];
}

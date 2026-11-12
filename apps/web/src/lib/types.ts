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

export interface MathSpec {
  op: "count" | "add";
  min: number;
  max: number;
  object: string;
}

export interface Lesson {
  id: string;
  subject: string;
  level: number;
  kind: "vocabulary" | "math" | "safety";
  items: string[];
  math?: MathSpec;
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

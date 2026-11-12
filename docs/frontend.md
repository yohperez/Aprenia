# Yara web client

Decisions for `apps/web`. Work happens on feature branches (for example `skeleton-base`) and reaches `dev` and `main` only through pull requests.

## Goals

1. Fast on a cheap phone with a weak connection. No web fonts, no UI framework, Preact plus signals, one CSS file.
2. Works offline after the first visit. The content pack is stored on the device and the app shell is cached by a service worker.
3. Usable by people who cannot read yet, by blind users and by colour blind users.

## Visual design

### Colour tokens

| Token | Normal | Colour blind | Use |
| --- | --- | --- | --- |
| `--ink` | `#1b2a6b` | same | Text, primary buttons, wordmark |
| `--paper` | `#f4f6fb` | same | Page background |
| `--card` | `#ffffff` | same | Tiles and sheets |
| `--sun` | `#f5a524` | same | Highlight, focus ring, progress, current lesson |
| `--line` | `#d5dbeb` | same | Borders |
| `--muted` | `#4a5470` | same | Secondary text |
| `--good` | `#127247` | `#0b5fa5` | Correct answer |
| `--bad` | `#b42318` | `#a84300` | Wrong answer |

All text pairs reach at least 4.5:1 contrast, and borders and icons at least 3:1. Correct and wrong are never shown by colour alone: each also has an icon (check or cross) and a sentence.

### Type

System font stack with `Noto Sans Arabic` and `Segoe UI` fallbacks, so nothing is downloaded. The base size is 17px, multiplied by `--scale` (1, 1.1, 1.2 or 1.25 depending on the age mode). Scale: 14, 17, 21, 27, 34, and 64 for the home wordmark. Weights are 400 for body text, 700 for buttons and 800 for the wordmark.

### Spacing and shape

The spacing scale is 4, 8, 12, 16, 24, 32 and 48. The content column is at most 560px wide with a 16px gutter. Tiles have a 16px radius and buttons 14px. Touch targets are at least 48px, and 56px for main actions.

## Screens

```
Home                         Sign in                       Words (after guest)
+---------------------------+ +---------------------------+ +---------------------------+
| i  eye  spk  globe  Entrar| | <  Entrar en Yara         | | Tus 6 palabras            |
|                           | | [ Entrar como invitado ]  | | [img][img][img]           |
|           Yara            | | [ Volver con 6 palabras ] | | [img][img][img]           |
|   Aprende gratis, ...     | | [ Correo        Pronto ]  | | hint                      |
|      [  Empezar  ]        | |                           | | [ Ya las tengo ]          |
|   Tengo mis 6 palabras    | |                           | |                           |
+---------------------------+ +---------------------------+ +---------------------------+

Age (16 bands)               Goal (4)                      Subjects
+---------------------------+ +---------------------------+ +---------------------------+
| Cuantos anos tienes?      | | Que quieres hacer?        | | [img Lengua]  [img Mates] |
| [5-9] [10-14] [15-19]     | | [ Aprender algo nuevo ]   | | [Tecno Pronto][Hist Pronto]|
| [20-24] ...       [80+]   | | [ Aprender tecnologia ]   | | ...                       |
+---------------------------+ +---------------------------+ +---------------------------+

Know                         Path                          Lesson
+---------------------------+ +---------------------------+ +---------------------------+
| Sabes algo de Lengua?     | | Lengua  Nivel 2           | | x  [=====-----]   Ayuda   |
| [ Si, se algo ]  5 preg.  | |    (1) La comida   done   | |  Donde esta manzana? spk  |
| [ No, desde cero ]        | |    (2) Animales  current  | |  [img] [img]              |
|                           | |    (3) La casa    locked  | |  [img] [img]              |
+---------------------------+ +---------------------------+ +---[ feedback sheet ]------+
```

The progress screen lists each live subject with its level, finished lessons and best score, plus "show my 6 words" and "delete my data".

## Exercises

| Step | Shows | Answer | Tutor item id |
| --- | --- | --- | --- |
| Learn | Big picture, the word, listen button | Next | concept id |
| Pick picture | "Where is X?" spoken, 2 to 4 pictures | Tap a picture | concept id |
| Pick word | Picture, 2 to 4 words | Tap a word | concept id |
| Quiz | Question stored in the database, optional picture, 2 or 3 answers | Tap an answer | question id |
| Safety | A situation, "is it safe?" | Safe or not safe | statement id |
| Maths | Objects, an expression (`7 + 8 = ?`) or a short problem | Tap a number | `count-N`, `cmp-A-B`, `add-A-B`, `sub-A-B`, `mis-A-C`, `mul-A-B`, `div-A-B`, `half-N`, `pct-P-N`, `prob-A-B`, `take-A-B` |

- Tapping any option says it aloud, then checks it. A correct answer shows a green sheet with a praise line. A wrong answer shows a red sheet with the correct answer, and that question comes back once at the end.
- Maths lessons adapt. Each lesson has a ladder of steps (for example multiply by 2 to 5, then by 2 to 10). A right answer moves one step up, a wrong one moves one step down to an intermediate step.
- The score is the share of questions right on the first try. 50% or more finishes the lesson and opens the next one.
- The placement test has 5 questions and starts by age: level 1 for ages 5-9, 2 for 10-14, 4 for 15-59 and 3 for 60+. Right goes up a level, wrong goes down. "Start from zero" always starts at level 1.
- Coming soon lessons appear locked at the end of each path.
- With the goal "I need free training", the path also lists free YouTube links for that subject, in the learner's language or in English when there are none.

## Age modes

| Mode | Ages | Options | Vocabulary items | Speech rate | Text scale | Speaks automatically | Free text with the tutor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| early | 5-9 | 2 | 4 | 0.8 | 1.2 | yes | no |
| junior | 10-14 | 3 | 6 | 0.9 | 1.1 | yes | no |
| teen | 15-19 | 4 | 6 | 1 | 1 | no | yes |
| adult | 20-59 | 4 | 6 | 1 | 1 | no | yes |
| senior | 60+ | 3 | 6 | 0.85 | 1.25 | yes | yes |

## Voice

- The speaker button in the navbar turns all sound on or off. Sound is on by default. When it is off nothing plays: no automatic reading, no words on tap and no listen buttons (those show a short notice instead).
- The browser speech engine (Web Speech API) reads words, prompts and feedback. The app picks a female voice when the device has one (for example Microsoft Helena or Elvira, Google español, Microsoft Zariyah or Hoda for Arabic). Online neural voices are used only while there is a connection.
- When the device has no female voice and a recorded MP3 exists, it plays the recording made with Microsoft neural voices, which are also female (es-ES-ElviraNeural, ar-SA-ZariyahNeural). Otherwise it keeps the voice the device has.
- Punctuation that some engines read aloud (¡ ! ¿ ? ؟ « ») is removed before speaking.
- Ages 5 to 14 and 60 or more hear prompts and screen titles automatically; tapping an option always says it aloud.

## Accessibility

Target: WCAG 2.2 AA.

- `lang` and `dir` are set on `<html>`, and Arabic uses RTL through logical CSS properties.
- Every control is a real `<button>` or `<a>` with an accessible name. A picture option is named by its word.
- Feedback is announced through an `aria-live` region. Dialogs use `<dialog>` with focus trapping and Escape to close.
- The focus ring is visible: 3px `--sun` with an ink offset.
- Animations are turned off under `prefers-reduced-motion`.
- The keyboard works everywhere: keys 1 to 4 pick an option and Enter continues.

## Offline and data

- On entry the client downloads `/v1/packs/{locale}` (gzip, revalidated with an ETag) and stores it in `localStorage`.
- Pictures not in the pack, and audio, are cached by the service worker the first time they are used.
- Progress is saved locally first and synced with `PUT /v1/progress` when there is a connection.
- The tutor is the only feature that needs a connection, and it says so when there is none.

## Run locally

```bash
cd apps/api && uv sync && uv run alembic upgrade head && uv run python -m yara_api.cli seed
YARA_TUTOR_PROVIDER=fake uv run uvicorn yara_api.main:create_app --factory --port 8000
cd apps/web && pnpm install && pnpm dev
```

Vite proxies `/v1` to `http://localhost:8000` (`YARA_API_PROXY` overrides it). For a separate API host, build with `VITE_API_URL`. `pnpm build && pnpm preview` serves the production build with the service worker.

`python3 scripts/check_style.py` fails when a file has a code comment or a long dash.

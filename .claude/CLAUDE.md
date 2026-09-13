# FamilyFlix — A Netflix for the Family Movie Folder

## Project Overview

FamilyFlix is a desktop app that turns a folder of movie files into
something that feels like Netflix. It replaces an Excel sheet and a
loose folder structure (one folder per movie, containing the video file,
a subtitle file, and a poster image) with a browsable, searchable
library and a built-in player.

Built primarily for my parents to navigate easily. I maintain and
update the library; they just browse and watch.

Portfolio project by Carlos Rezai demonstrating fullstack engineering,
desktop app development, and Claude Code workflow.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Nx workspace
- **UI:** styled-components + a custom design system (built via Claude
  Design handoff — see `docs/handoff/`)
- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3`
- **Shell:** Electron
- **Video Playback:** a plain `<video>` element driven by our own
  `usePlayback` hook — no video.js, no react-player. Finalised in
  `docs/design-logs/10-video-player.md` Q2: the player's chrome and its
  subtitle overlay are entirely bespoke, so a library's skin and native
  cue rendering are both things to defeat rather than use, and jsdom can
  drive a bare element but not video.js
- **Playback component:** FFmpeg, bundled by the installer, behind
  `server/src/playback/`. Chromium reads MP4/WebM only, so every `.mkv`
  and `.avi` in the family folder is remuxed or transcoded on the way to
  the element. No uploaded `.dll` can change what a browser decodes —
  Settings' "codec pack" replaces this binary
- **Testing:** Vitest + @testing-library/react
- **Linting:** ESLint + Prettier + Husky

## No AI

FamilyFlix does not use AI anywhere — no recommendations, no smart
search, no generated summaries. This is a deliberate, permanent
decision, not a deferred feature. The app is intentionally simple: a
fast, local, searchable library and a reliable player. There is no
`ai/` directory in this project.

## Atomic Design

FamilyFlix strictly follows Atomic Design for all UI code. Every layer
maps to a rung on the ladder, and nothing skips a rung:

| Rung      | Folder        | Examples                               |
| --------- | ------------- | -------------------------------------- |
| Atoms     | `primitives/` | Button, Input, Text, Icon, Badge       |
| Molecules | `components/` | PosterCard, Modal, ProgressBar         |
| Organisms | `features/`   | LibraryGrid, MovieForm, PlayerControls |
| Templates | `layouts/`    | MainLayout                             |
| Pages     | `pages/`      | LibraryPage, MoviePage                 |

**Folder convention (every component, no exceptions):**

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx
└── ComponentName.styles.ts
```

This applies at every rung — a primitive like `Button/` and a feature
component like `MovieForm/` both follow the exact same three-file shape.

The same one-folder-per-unit rule extends beyond components: each `utils/`
helper lives in its own folder with its test — `gradientFromId/gradientFromId.ts`
beside `gradientFromId.test.ts` — and a feature's non-component modules (e.g. a
`view` mapper) get a folder too. Keep source and test co-located in that folder.

**The trigger is companion files, not files as such.** A unit gets its own
folder when it has files that must travel together — a test, and for components
a `.styles.ts`. The folder is what keeps those siblings co-located.

**Exception — single-file modules stay flat.** `tokens/` (`colors.ts`,
`spacing.ts`, …) and `types/` (`index.ts`) are single leaves of `as const` data
/ shared interfaces: no test, no styles, nothing to co-locate. They already sit
cohesively under their category folder, so wrapping each in a one-file folder is
pure ceremony — the mirror image of a redundant per-unit barrel. Keep them flat.
If a token ever needs a test, it graduates into a folder then (not before).

Folders do **not** carry their own `index.ts` barrel. Only the category
folders (`primitives/`, `components/`, `utils/`, `tokens/`) get an `index.ts`,
and it re-exports each unit directly from its file
(`export { Button } from './Button/Button'`), so imports read
`import { Button } from '@/primitives'` rather than reaching into individual
folders. A single category barrel is enough — don't add a redundant per-unit
barrel.

Never build a one-off styled `<div>` inline inside a feature when a
primitive or component for it already exists. Never add business logic
to a primitive or component — if a molecule starts needing data
fetching or domain knowledge, it has graduated into a feature.

## Folder Structure

familyflix/
├── .claude/
│ └── skills/
├── server/
│ └── src/
│ ├── routes/ ← HTTP layer only: parse request, call a domain module, return response
│ ├── library/ ← movie CRUD, SQLite queries, watch-state + resume-position logic
│ ├── media/ ← folder scanning, file copy into managed storage, subtitle detection, the Movie folder’s removal after a Delete
│ ├── import-export/ ← Excel/CSV parsing, row-to-folder matching, CSV export
│ ├── playback/ ← the Playback component, the path choice, streaming, subtitle parsing
│ │ ├── ffmpegBinary/ ← resolve the component: env var, then PATH, then absent
│ │ ├── probe/ ← ffprobe wrapper → MediaProbe (container, codecs, duration)
│ │ ├── mediaDuration/ ← an MP4’s own moov/mvhd, so a direct play needs no component
│ │ ├── choosePlaybackPath/ ← pure: MediaProbe → direct / remux / transcode / cannot-play + argv
│ │ ├── createPlayback/ ← the injected domain: videoFile, read, stream, subtitleFile, cues
│ │ ├── ffmpegComponent/ ← the injected seam: what this machine can be asked to do
│ │ ├── mediaFilePath/ ← the under-media-root check between a stored string and an open file
│ │ ├── capabilities/ ← Chromium native set ∪ `ffmpeg -decoders`
│ │ ├── parseSrt/ parseVtt/ parseAss/ parseSub/ ← pure, one format each
│ │ └── parseSubtitle/ ← dispatch on extension; the last place a format is known
│ ├── db/ ← SQLite connection + schema/migrations + the dev seed (`npm run db:seed`), shared by every domain module above
│ └── test-support/ ← test doubles shared across server tests, never imported by shipping code
├── src/
│ ├── App/ ← the router and the app-level providers every page renders inside
│ ├── assets/ ← images, fonts, icons (static)
│ ├── styles/ ← global CSS reset, themes
│ ├── tokens/ ← colors, spacing, typography, breakpoints
│ │ ├── colors.ts
│ │ ├── spacing.ts
│ │ ├── typography.ts
│ │ ├── breakpoints.ts
│ │ └── index.ts
│ ├── primitives/ ← dumb, reusable UI atoms (Button, Input, Text, Icon, Badge)
│ │ ├── index.ts ← barrel: re-exports every primitive (only barrel at this rung)
│ │ └── Button/
│ │ ├── Button.tsx
│ │ ├── Button.test.tsx
│ │ └── Button.styles.ts
│ ├── components/ ← composed primitives, no business logic (PosterCard, Modal, ProgressBar)
│ │ ├── index.ts ← barrel: re-exports every component (only barrel at this rung)
│ │ ├── Modal/ ← the scrimmed card every dialog is drawn on: portal, Escape/scrim/✕, focus in, Tab held, focus back
│ │ └── PosterCard/
│ │ ├── PosterCard.tsx
│ │ ├── PosterCard.test.tsx
│ │ └── PosterCard.styles.ts
│ ├── features/ ← business logic + UI co-located per domain
│ │ ├── library/ ← genre rows, browse grid
│ │ ├── search/ ← search-as-you-type, filters
│ │ ├── movie-detail/ ← the movie page: art, credits, the signals, the ⋯ menu and what it opens
│ │ │ ├── MovieDetail/ ← the organism: owns the hooks, renders the rest
│ │ │ ├── EditMenu/ ← the ⋯ menu: Edit details, and the Danger row that opens the Delete dialog
│ │ │ ├── DeleteMovieDialog/ ← the Delete dialog: Modal + the fixed copy + Delete movie / Cancel
│ │ │ ├── useDeleteMovie/ ← { deleting, deleteMovie }; back through useGoBack once the movie is gone
│ │ │ ├── useMovieDetail/ ← fetch one movie, or its not-found state
│ │ │ ├── useOptimisticEdit/ ← a signal flipped on screen first, put back if the save refuses
│ │ │ ├── CreditsRow/ MetaLine/ LoadingDetail/ ← the page’s own molecules
│ │ │ ├── detailView/ ← pure: a Movie → what the page shows
│ │ │ └── api/ ← saveRating, deleteMovie (one caller each, so they stay here)
│ │ ├── player/ ← built-in video player, subtitle handling, resume position
│ │ │ ├── Player/ ← the organism: owns the hooks, renders the rest
│ │ │ ├── PlayerControls/ ← the top and bottom chrome bars
│ │ │ ├── PlayerScrubber/ ← the seek bar
│ │ │ ├── VolumeSlider/ ← the volume bar (shares logic with the scrubber, not pixels)
│ │ │ ├── SubtitleOverlay/ ← the styled cue box, ours rather than ::cue
│ │ │ ├── PlayerNotice/ ← buffering / missing-file / cannot-play, in the play circle
│ │ │ ├── usePlayback/ ← element state ↔ React state, offset re-anchoring
│ │ │ ├── useWatchReporter/ ← tick, coalesce, finish
│ │ │ ├── useControlsVisibility/ ← 3s idle, hidden cursor
│ │ │ ├── usePlayerKeys/ ← the keyboard map, onto the buttons’ own handlers
│ │ │ ├── useFullscreen/ ← the whole surface up, never the bare element
│ │ │ ├── useDragScalar/ ← a pointer over a track → a 0–1 scalar
│ │ │ ├── cueAt/ ← pure: the line covering a position
│ │ │ ├── preferredSubtitle/ ← pure: default language, then track order
│ │ │ ├── volumePreference/ ← the level and mute, in localStorage
│ │ │ └── api/ ← fetchPlayback, fetchSubtitleCues, saveResume
│ │ ├── movie-form/ ← Add/Edit a movie: one form, manual file pickers
│ │ ├── import-export/ ← bulk Excel/CSV importer, CSV exporter
│ │ ├── settings/ ← the Maintainer's hub: SettingsHeader now, the grouped sections to come
│ │ └── collections/ ← playlists/collections (roadmap, not MVP)
│ ├── layouts/ ← page chrome
│ │ ├── chrome.styles.ts ← the furniture MainLayout and GenreLayout both extend
│ │ ├── MainLayout/ ← the Family's screens: logo, gear, scrolling body
│ │ ├── GenreLayout/ ← Back pill, heading slot, trailing controls, scrolling body
│ │ └── MaintainerLayout/ ← the Maintainer surface: bg2 sheet + centred column, no header row
│ ├── pages/ ← route-level views, composition only, no logic
│ ├── api/ ← wire calls two or more features share (one folder per call + its test, no barrel)
│ │ └── postValue/
│ │ ├── postValue.ts
│ │ └── postValue.test.ts
│ ├── hooks/ ← global shared hooks only (useMediaQuery, useTheme)
│ ├── types/ ← shared TypeScript interfaces
│ ├── utils/ ← pure helper functions (one folder per helper + its test)
│ │ ├── index.ts ← barrel: re-exports every helper
│ │ └── gradientFromId/
│ │ ├── gradientFromId.ts
│ │ └── gradientFromId.test.ts
│ └── test-support/ ← test doubles shared across features, never imported by shipping code
└── docs/
├── design-logs/
├── PRDs/
├── refactor-plans/
├── handoff/ ← canonical design prototype (spec, screens, brand)
├── ubiquitous-language.md
└── dev-journal.md

## Layer Responsibilities

| Layer           | Purpose             | Rule                                                        |
| --------------- | ------------------- | ----------------------------------------------------------- |
| `tokens/`       | Design constants    | No React, no logic — pure values                            |
| `primitives/`   | Atomic UI elements  | No business logic, no data fetching                         |
| `components/`   | Composed UI blocks  | No business logic, composed from primitives                 |
| `features/`     | Domain UI + logic   | Owns its own components, hooks, and types                   |
| `layouts/`      | Page chrome         | Structure only, no domain logic                             |
| `pages/`        | Route views         | Composition only — no logic, no styling                     |
| `hooks/`        | Global hooks        | Only hooks used across 2+ features                          |
| `utils/`        | Pure helpers        | No side effects, fully testable                             |
| `api/`          | Shared wire calls   | Only calls made by 2+ features; imported by path, no barrel |
| `App/`          | Router + providers  | The shell pages render inside — no domain logic             |
| `test-support/` | Shared test doubles | Never imported by shipping code                             |

`api/` earns its narrowness from the same rule that created it: **no feature
should be importing another's wire.** A call moves up here only when a second
feature asks for it — `saveFavorite` did, because the browse shelf and the movie
detail page both save the same heart; `fetchMovie` did when the player needed
the record the detail page reads; and `saveWatched` did when the player began
marking a film watched at the finish threshold that the detail page's toggle
already set by hand. `saveRating` has one caller and stays with the feature that
makes it, and so does the player's own `saveResume` — the player is the only
thing in the app that can know where a film is, which is the same rule read the
other way round. Either moves if and when that changes. One folder per call with
its test, imported by path (`@/api/postValue/postValue`), following
`test-support/`'s precedent — a barrel over a handful of functions nobody
imports as a set would be ceremony.

**The key principle:** `primitives/` and `components/` are reusable and
know nothing about the domain. `features/` owns its own UI, hooks, and
types and knows everything about its domain. `pages/` just composes
features into a route.

## Architectural Boundaries

- `src/utils/` — pure logic and utility functions
- `server/src/` is organized by domain (`library/`, `media/`,
  `import-export/`, `playback/`), not by I/O-purity — each domain folder
  owns its full responsibility, data access and logic together. There is
  no generic `services/` or `lib/` catch-all; if new backend logic
  doesn't fit one of those, that's a sign a new domain folder is needed,
  not a reason to add a miscellaneous one. `playback/` is that rule
  exercised rather than quoted: resolving the Playback component,
  choosing a playback path, running a conversion and parsing subtitles
  into cues fitted none of the three that existed, so a fourth domain was
  added instead of a `services/`. Subtitle _detection_ stays in
  `media/`; subtitle _parsing_ exists to feed the player and lives here.
  The domain is injected into the router the way `storage` already is —
  `createApiRouter(storage, mediaPath, playback)` — so the route layer
  never learns there is an FFmpeg. That rule is about **backend logic**; test doubles are not
  backend logic, which is why `server/src/test-support/` exists beside
  `db/` as the mirror of the frontend's rung — same one-line rule
  ("never imported by shipping code"), same one-folder-per-unit shape,
  same absence of a category barrel
- `db/` holds the SQLite connection, schema/migrations, and the dev
  seed (`db/seed/`) — shared infrastructure, not a domain itself. The
  seed is temporary scaffolding: the library has no other way to be
  filled until Add Movie and bulk import ship, and without it the
  browse home renders "Your library is empty", so no UI work on it can
  be checked by looking. It writes its fixtures through the ordinary
  `LibraryStorage` interface and marks them with a reserved video-path
  prefix, so a run is idempotent and can never delete a movie that
  arrived any other way. **The seed goes with bulk import**: the
  initiative's tracer-bullet commit deletes `db/seed/`, the `db:seed`
  script and every paragraph naming them, and the importer's own
  fixtures — a tiny sheet and folder tree under its tests — are how a
  dev library gets filled from then on
- `src/` never talks to SQLite directly
- `src/` never reads or writes the filesystem directly — all file
  access (folder scanning, copying video/subtitle/poster files) goes
  through `server/src/media/`

## Skills Location

All skills are in `.claude/skills/`. Read the relevant SKILL.md before
starting any task that matches its description.

## Desktop Build

FamilyFlix is an offline-first desktop app. This is the only target.

- **Shell:** Electron, wrapping the React frontend and bundling the
  Express server as a utility process
- **Storage:** SQLite via `better-sqlite3` — single-file database,
  no network, no cloud
- **Media storage:** on import, video/subtitle/poster files are copied
  into FamilyFlix's own managed media directory (inside the OS
  user-data directory). The app owns its copy; the original source
  folder is no longer the source of truth after import
- **No auth** — single-user household, single shared watch history,
  local-only
- **Packaging:** `electron-builder` for Windows installers; data and
  media live in the OS user-data directory so backups are trivial

## Movie Import — One Form, Manual Pickers

The Add Movie form is one screen at `/add` doing two jobs: it adds a
movie, and with `?movie=<id>` it edits one. Same fields, same encoding,
same save — only the heading, the button label and where a finished save
lands differ.

It collects title, year, director, cast (one comma-separated line),
description, genres (chips drawn from the **Genre pool**), a rating, and
three kinds of file: a video, a poster, and as many subtitle files as the
film has, each with its own language. **Title and video are the save
gate**; everything else is optional. `runtimeMinutes` is the one column
with no field — it is derived from the bytes after the copy, best-effort.

**The file fields are manual pickers, and only manual pickers.** There
are no mode tabs and no folder-path field. The reason is not preference:
a browser's `<input type="file">` yields a name and bytes and _never_ a
path, so a form running in Chromium cannot be given a folder to scan.
That is also why the app **copies** what it is given into the managed
media directory rather than referencing it where it lies — see
`docs/design-logs/11-add-movie.md`.

**Folder-path autofill belongs to bulk import**, which is where the
prototype actually designs it (`ImportFlow`'s root-path field) and where
its argument lives: a spreadsheet naming a thousand folders is the case
that needs a scanner, and Electron's native dialog is what can hand one
a real path. Do not build it into this form.

The save is one multipart request — `POST /api/movies` to add,
`PATCH /api/movies/:id` to amend — streamed with `busboy` so a 12 GB film
never sits in memory. On an edit, **a file the library already holds
travels as the relative path it already has, and only a freshly picked
file travels as bytes**, which is what makes a title-only edit carry no
file part at all.

## Bulk Import / Export

The existing library (Excel sheet + per-movie folders) gets migrated
once via a bulk importer:

- Reads the existing spreadsheet (name, year, genre, …)
- Matches each row to a folder (by movie name) and runs **folder-path
  autofill** over it — scanning that folder for a video, a poster and any
  subtitle files by extension (`.srt`, `.vtt`, `.ass`, `.sub` are all
  recognised), and filling the three kinds of slot the Add Movie form
  also has. This is the _only_ place autofill lives: it needs a real
  folder path, which a browser file picker cannot supply and Electron's
  native dialog can
- Imports each confident match **during the run** — reserve a Movie
  folder, copy the files in, add the movie — and shows the run in a
  progress console; the **Review step** at the end lists only what the
  run could not settle on its own, as **Problems** by kind (`no-folder`,
  `ambiguous`, `no-video`, `no-row`, `failed`, and the one soft kind,
  `missing-meta`), each with Resolve and Skip. Reviewing a thousand
  confident matches is a list nobody reads; Edit and Delete already
  exist for corrections — design log `13-bulk-import` Q16
- Consults nothing outside the spreadsheet and the folder: **no TMDB**,
  no network, `tmdbId` stays null. What a lookup would add is an
  **Enrichment** pass over an already-imported library — a later
  initiative with its own prototype, if ever — not part of bulk import
- Copies all matched media into managed storage as part of the run

An exporter writes the current library back out to CSV (title, year,
genre, watched status, etc.) for backup or for bulk-editing externally
and re-importing.

Both bulk import and single Add Movie are large-file operations (video
files are big) — neither should block the UI. Both need a visible
progress indicator, not a spinner.

## Watch Tracking

- Every movie has a watched / in-progress / unwatched state and a
  resume position (seconds into the file)
- The built-in player periodically reports playback position back to
  the database during playback, not just on close
- The browse grid visually distinguishes watched / in-progress /
  unwatched (e.g. progress bar or badge on the poster card)
- Single shared household profile — no per-person watch history

## Code Rules

- No `any` types — ever
- No business logic in components, primitives, or pages — extract to features or hooks
- All page components use default exports
- Every function in `src/utils/` must have a test
- No `console.log` in committed code
- All dates are ISO strings
- All file paths are stored as relative paths under the managed media
  directory, never absolute paths from the source machine
- Co-locate tests and styles with the file they belong to:
  `PosterCard.tsx` / `PosterCard.test.tsx` / `PosterCard.styles.ts`

## Ubiquitous Language

Single source of truth: `/docs/ubiquitous-language.md`
Read it before naming anything. Update it after every grill-me session.

## Data Model

Defined per feature through grill-me + write-a-prd.
Lives in `/docs/data-model.md` once established.

## Design Handoff — Built First

Unlike Horizon (where the design handoff came after features existed),
FamilyFlix starts with the Claude Design prototype. Before any feature
is built, three documents are handed to Claude Design together:
`README.md`, `CLAUDE.md`, and `docs/handoff/DESIGN_BRIEF.md`. The brief
is the product/UX spec — every screen, interaction, and visual
direction decision, resolved in advance via a grill-me session, so
Claude Design isn't inferring the product from engineering docs alone.
README.md and CLAUDE.md supply the engineering context: tech stack,
and — critically — the requirement that the prototype itself is built
using the same Atomic Design structure (`tokens/` → `primitives/` →
`components/` → `features/` → `layouts/` → `pages/`, see Atomic Design
above) that the real app will use. The prototype is not a flat set of
mockup screens; it's built the same way the production app will be
built, component by component, so it can be used directly as
implementation reference rather than redrawn into code later.

The resulting prototype lives in `docs/handoff/` and is the visual
source of truth for every subsequent `grill-me` and `build` cycle.
Implementation should match it, not invent a new look feature-by-
feature. If a feature needs something the prototype doesn't cover,
that's a sign the prototype needs revisiting before building, not a
license to improvise the design ad hoc.

## Local Tooling — never use `npx` (Windows)

This is a Windows machine. `npx <tool>` resolves through the `.cmd`
shim, which spawns `cmd.exe`, which allocates a **console window that
flashes on screen and steals mouse/keyboard focus**. During a `tdd` or
`build` run that is dozens of stolen focus events, which makes the
machine unusable while a skill runs unattended.

Measured: `npx prettier --version` spawns one `cmd.exe` plus an extra
`conhost.exe`; `node_modules/.bin/prettier --version` spawns neither.

Always call the binary directly instead:

| Instead of         | Run                              |
| ------------------ | -------------------------------- |
| `npx vitest run`   | `node_modules/.bin/vitest run`   |
| `npx tsc --noEmit` | `node_modules/.bin/tsc --noEmit` |
| `npx eslint src/`  | `node_modules/.bin/eslint src/`  |
| `npx prettier`     | `node_modules/.bin/prettier`     |
| `npx nx <target>`  | `node_modules/.bin/nx <target>`  |

The same rule applies to anything that spawns a tool on our behalf —
`.husky/pre-commit` calls `node_modules/.bin/lint-staged`, `.lintstagedrc`
calls `node node_modules/prettier/bin/prettier.cjs`, and
`.husky/commitTypecheck/run.ts` spawns `node` on
`node_modules/typescript/bin/tsc` with `shell: false`, all rather than a
bare command name and for exactly this reason. Don't "simplify" any of
them back.

## The commit gate

Two hooks, and the split between them is about _when the commit message
exists_:

- **`.husky/pre-commit`** runs `lint-staged`, which formats the staged
  files with Prettier.
- **`.husky/commit-msg`** runs the typecheck, because `pre-commit` fires
  before git has written the message — `COMMIT_EDITMSG` there still holds
  the _previous_ commit's.

The typecheck reads the subject and narrows on one type only. A `test:`
commit builds `tsconfig.app.json` and `tsconfig.server.json`; **every**
other commit builds the whole solution file. That is issue #111: a test
written against a module that does not exist yet cannot typecheck — which
is the entire point of the RED step — so RED commits used to be made with
`--no-verify`, which meant the one gate that would catch a real type error
in a test file was skipped on exactly the commits that add test files.
`npm run typecheck` was consequently red for six straight commits during
the player initiative before anybody noticed.

**Do not add `--no-verify` back to a RED commit.** It is no longer needed,
and it is the habit this gate exists to end.

The three tsconfig projects mean what their names say, and #111 is what
made that true: `app` is the frontend's shipping code, `server` the
backend's, and `spec` **all** the tests, frontend and backend both. Before
that, `tsconfig.server.json` included `server/**/*.ts` tests and all, so
there was no way to ask whether the backend's shipping code compiled
without also asking about its tests.

The decision itself is `.husky/commitTypecheck/`, a unit with its own
tests — most of them about what must _not_ relax the gate, since it
relaxes on the strength of a string the committer wrote.

### The other two focus stealers (measured 2026-08-12)

Calling the binaries directly is necessary but **not sufficient**. A full
`vitest run` spawns 43 `node` worker processes and zero console windows,
so the rule above is working — yet windows still flashed during every
`build` run, from two sources that have nothing to do with `npx`:

1. **Windows' default console host.** `HKCU\Console\%%Startup` was unset,
   which on Windows 11 means "Let Windows decide" → **Windows Terminal**.
   Any console program launched by a window-less GUI parent — VS Code's
   extension host, which is where the Claude Code panel and the built-in
   Git extension both live — then gets a real Windows Terminal window that
   opens, takes focus, and closes. Conhost honours the "create hidden"
   request; Windows Terminal does not. Both `DelegationConsole` and
   `DelegationTerminal` are now pinned to the conhost GUID
   `{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}` (Settings → System → For
   developers → Terminal → "Windows Console Host"). Every command Claude
   Code runs was one flash before this.
2. **The Nx daemon.** It watches the workspace and spawns visible
   `cmd.exe` children on file change, which conhost cannot hide because the
   parent asks for a window. `useDaemonProcess: false` in `nx.json` turns
   it off. We call `vitest`/`tsc`/`eslint` directly anyway, so the daemon
   was only ever caching a project graph we barely query.

Measured after both: **zero** visible windows across 45 seconds of source
edits, a 459-test run, `eslint`, and `tsc`. If flashing ever returns,
watch for new _visible_ windows (`MainWindowHandle -ne 0`) rather than for
new processes — most console spawns are legitimately invisible, and only
the visible ones steal focus.

## Development Workflow

0. `ui-design-handoff` → hand README.md + CLAUDE.md + docs/handoff/DESIGN_BRIEF.md to Claude Design; build the full prototype first, using the same Atomic Design structure as the real app; populates `docs/handoff/`, used as the reference for every feature below
1. `grill-me` → shared understanding + design-log entry + ubiquitous-language update
2. `write-a-prd` → reads design-log → GitHub issue + docs/PRDs/
3. `prd-to-plan` → phased plan on issue
4. `prd-to-issues` → individual issues
5. `tdd` → failing tests (stops at RED)
6. `build` → implement against the `docs/handoff/` prototype
   — `issue-loop` drives 5–6 across every buildable slice unattended, one
   subagent per step, and stops at the first HITL or docs-only issue
7. `request-refactor-plan` → create issue
8. `refactor` → clean up

## Commit Messages

```
<type>: [<initiative>] issue #<n> <description>
```

`<initiative>` is the PRD/feature initiative name (e.g. `movie-form`,
`import-export`) — not the issue title.

Examples:

```
feat: [movie-form] issue #99 the genre pool
fix: [player] issue #7 correct subtitle track offset
refactor: [library] issue #9 extract genre-row hook
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

**Keep the `<description>` short enough to fit on one line.** Long
descriptions get wrapped or mangled in commit history (this happened
during Horizon). If the description doesn't fit in roughly 60
characters, the issue is too broad — split it into smaller issues
rather than writing a longer commit message.

**Never write a closing keyword in a commit body for an issue the
commit does not close.** GitHub parses `close`, `closes`, `closed`,
`fix`, `fixes`, `fixed`, `resolve`, `resolves` and `resolved` followed
by `#n` anywhere in the message — including with a colon between them,
and including inside a sentence that is saying the opposite. Commit
`0c51aaf`'s body read "Follow-ups filed rather than **fixed: #39**",
and GitHub closed #39 on the spot with nothing shipped against it. #40
survived only because it came after an "and". When listing follow-ups,
write the bare number or the URL: "follow-ups filed as 39 and 40".

## Environment Variables

PORT=3001
VITE_API_BASE_URL=http://localhost:3001
FAMILYFLIX_DB_PATH= # entrypoint reads it and passes the path to createSqliteStorage; defaults to ./familyflix.db. `npm run db:seed` reads the same variable and the same default, so the seed always writes the database the dev server opens. Electron main sets this to app.getPath('userData')/familyflix.db.
FAMILYFLIX_MEDIA_PATH= # root directory for copied video/subtitle/poster files; defaults to ./media. `npm run db:seed` reads the same variable and the same default, so the fixture video behind every seeded movie lands in the directory the stream route reads. Electron main sets this to app.getPath('userData')/media.
FAMILYFLIX_FFMPEG_PATH= # absolute path to the ffmpeg binary of the Playback component; ffprobe is looked for beside it. Unset falls back to `ffmpeg`/`ffprobe` on PATH, and then to absent — a state, not an error: MP4s still direct-play and everything else answers `cannot-play`. The slot the installer fills and the maintainer's uploaded component replaces.
DEBUG_SQL= # set to "1" to enable better-sqlite3 query tracing via console.info. Off by default; never on in packaged builds.

## The prototype is the spec

For every feature below, the canonical design prototype in `docs/handoff/` is the goal.
The implementation target is a **1:1 translation** of that prototype into our codebase —
same layout, spacing, states, copy, and interaction.

- **1:1 means the UI surface, not the fake behavior.** The prototype simulates the backend
  (sample data, fake folder scans, `setTimeout` "installing", canned update checks).
  Reproduce the _surface_ exactly — every pixel, token, state, and transition — then wire
  the behavior to the real Express + SQLite layer. Never port the simulation itself.
- The prototype is the source of truth for _what the UI is_. Do not redesign, "improve," or
  reinterpret it while building. If something seems wrong, raise it in the grill-me session
  and amend the prototype first, then build to the amended prototype.
- Each prototype file maps 1:1 to a component (see `docs/handoff/COMPONENT-SPEC.md`):
  `prim.*` → `primitives/`, `mol.*` → `components/`, `feat.*` → `features/`,
  `page.*` → `pages/`. The component's `data-props` is its prop interface; the inline
  `var(--token)` values become styled-components reading the theme.
- Fidelity over convenience: match the prototype's pixels, tokens, and states first, then
  layer the real data behind the same surface.

## Features

> Status legend: ✅ Done · 🔜 Planned · 🧭 Roadmap · 🚫 Out of scope
> Every 🔜 item builds against its prototype in `docs/handoff/` — translate, don't redesign.

### Foundation

- ✅ **Nx + Vite + React workspace scaffold** — monorepo, tooling, lint/format.
- ✅ **Claude design handoff prototype** — full interactive design system, the build spec.
- ✅ **Library core** — movie model, SQLite schema, repository layer.
- 🔜 **Electron desktop shell** — main process, window, file-system access.

### Browse & discover (parent-facing)

- ✅ **Browse grid** — genre rows of poster cards on the home library screen.
- ✅ **Card carousel** — horizontal rows with prev/next arrows; capped at 15 cards, "View all" → genre page. Both variants ship: poster rows with the browse grid, `continue` with the Continue Watching row.
- ✅ **Movie detail page** — backdrop, poster, expandable synopsis, director + cast, primary actions.
- ✅ **Search + filter** — by title, genre, and rating.
- ✅ **Genre page** — every movie in one genre under its own header, uncapped; where "View all" lands, carrying the sort.
- ✅ **Sort** — recently added, A–Z, year, highest rated, unwatched first.
- ✅ **Ratings** — 5-star display with a half-star picker.
- ✅ **Favorites** — mark from card and detail; dedicated Favorites row.
- ✅ **Continue Watching row** — resume in-progress titles from the home screen, ordered by when the family last watched them.

### Playback

- ✅ **Built-in video player** — local playback, subtitle tracks, transport controls.
- ✅ **Watch tracking** — watched / in-progress / unwatched states and resume position.

### Maintainer tools

- ✅ **Add a movie** — manual file picker (video, poster, multiple subtitles with language).
- ✅ **Edit a movie** — amend metadata and files; a file the library already holds travels as its path, only a freshly picked one as bytes.
- ✅ **Delete a movie** — the ⋯ menu’s Danger row, the Delete dialog, `DELETE /api/movies/:id`, then the Movie folder under best-effort cleanup.
- 🔜 **Bulk import** — spreadsheet → folder matching → review of flagged rows.
- 🔜 **Import progress console** — scan + import phases, live activity log, cancel (Windows-installer style).
- 🔜 **Export** — write the library out to CSV / Excel.

### Settings hub

- 🔜 **Settings shell** — grouped Library / Playback / Storage / About sections.
- 🔜 **Codec manager** — view installed codecs and add codec packs.
- 🔜 **Subtitle preferences** — default subtitle language (auto-on toggle built but disabled until shipped).
- 🔜 **Storage** — managed media folder location and space used.
- 🔜 **Software update** — check for and install updates.

### System

- 🔜 **Snackbar system** — info / success / warning / error notifications.
- 🔜 **Back-to-top FAB** — appears on long scroll on the home screen.
- 🔜 **Desktop packaging** — Windows installer build.

### Roadmap

- 🧭 **Collections / playlists** — user-curated groupings.
- 🧭 **Auto-on subtitles** — enable the built, currently-disabled toggle.
- 🧭 **Backgroundable import** — leave the Import screen while a large scan runs, surfaced via snackbar.

### Out of scope

- 🚫 **User accounts / multi-profile** — FamilyFlix is offline, local-only, single shared library.

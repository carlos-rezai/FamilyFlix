# FamilyFlix — Design Brief

This document is the complete brief for the FamilyFlix prototype. It is
meant to be read on its own, in one pass, before any screens are
designed. It supplements (does not replace) `README.md` and
`CLAUDE.md` — read those first for tech stack, project philosophy, and
engineering conventions. This brief is about what to **design**, not
how to build it.

## How This Prototype Should Be Built

This prototype is not a flat set of mockup screens to be redrawn into
code later — it should be built **using the same component structure
the production app will use**, so it can be used directly as
implementation reference. That structure is Atomic Design, exactly as
defined in `CLAUDE.md`:

- **`tokens/`** — colors, spacing, typography, breakpoints. Pure
  design constants, defined first, before any component uses them.
- **`primitives/`** — atoms: Button, Input, Text, Icon, Badge. No
  domain knowledge.
- **`components/`** — molecules: PosterCard, Modal, ProgressBar.
  Composed from primitives, still no domain knowledge.
- **`features/`** — organisms: LibraryGrid, MovieForm, PlayerControls.
  This is where domain-specific UI lives.
- **`layouts/`** — templates: page chrome (e.g. MainLayout).
- **`pages/`** — the five screens themselves, composed from everything
  above.

Build from the bottom up: tokens first, then primitives, then
components, then the features and pages described in this brief. A
PosterCard, for example, should be a real, reusable component
assembled from primitives (Text, Badge, ProgressBar) — not a one-off
hand-drawn screen element that happens to look like a poster card.
Reuse the same Button, Input, and Text primitives everywhere a button,
input, or text appears across all five screens, rather than designing
each screen's buttons independently.

## What FamilyFlix Is

FamilyFlix is an offline desktop app that turns a personal movie
collection — currently an Excel sheet plus a folder per movie
(video + subtitle + poster) — into something that browses and feels
like a streaming service. It is built by an adult child (the
maintainer) for their parents (the day-to-day users).

**Two distinct audiences use this app, and they almost never overlap:**

- **The parents** — comfortable with computers, not power users, not
  accessibility-impaired. They only ever see the Browse, Movie Detail,
  and Player screens. Their entire job is: find something, watch it.
  Nothing about their experience should ever feel like "managing a
  database."
- **The maintainer** — adds movies, runs imports, fixes mismatches.
  They use Add Movie and Import. These are tools, not entertainment.

Every design decision below should be evaluated against whichever
audience owns that screen. Do not blend the two sensibilities.

## No AI, No Accounts, No Cloud

FamilyFlix does not use AI anywhere in the product (not in this
prototype, not ever — this is permanent, not a deferred feature). There
are no user accounts and no login — single shared household profile,
one watch history. There is no cloud sync; everything is local. Do not
design any UI implying any of these exist (no "Sign in," no "Ask AI,"
no multi-profile picker).

## The Five Screens

1. **Browse / Library** — the parents' home screen. Default landing
   screen for the whole app.
2. **Movie Detail** — a single movie's page, reached by clicking a
   poster. The decision point before playback.
3. **Player** — full-screen video playback.
4. **Add Movie** — maintainer tool. Add a single movie to the library.
5. **Import** — maintainer tool. Bulk-migrate the existing Excel sheet
   - folders into the library in one pass.

### Navigation

There is **no persistent sidebar or nav bar**. The default, unguarded
experience is Browse → Movie Detail → Player — nothing else is
reachable from here without deliberate action. Add Movie and Import are
reached only through a small, tucked-away maintainer affordance (e.g. a
gear/settings icon in a corner of the Browse screen) — present, but
not advertised, and not something a parent would stumble into by
accident.

---

## Screen 1: Browse / Library

This is the screen parents see most. It should feel calm, not dense.

**Header (persistent, always visible at the top):**

- A search box — searches movie titles (and ideally descriptions, if
  the data model supports it)
- A genre filter — a dropdown or similar control, filters by genre
- A sort control — a dropdown with four options:
  - **Recently Added** (default)
  - **Title (A–Z)**
  - **Year** (newest first)
  - **Unwatched First**
- The sort control is global — changing it reorders every row on the
  page at once, not per-row

**Body, top to bottom:**

1. **"Continue Watching" row** — shown only if at least one movie is
   in-progress. The first thing parents see if they have something to
   resume. Omitted entirely (no empty-state placeholder) if nothing is
   in progress.
2. **Genre rows** — one row per genre that has at least one movie.
   Rows are ordered by how many movies are in that genre, descending
   (the genre with the most movies appears first). A movie with
   multiple genres appears in every matching row. Within each row,
   movies are ordered by whatever the active global sort is.

**Poster Card (the tile used in every row):**

At rest, with no hover state, each card shows:

- The poster image
- The title
- A watched-state indicator:
  - **In progress** → a thin progress bar across the bottom edge of
    the poster
  - **Fully watched** → a small checkmark badge
  - **Unwatched** → no indicator at all

Do not show year or genre on the card itself — that information lives
on Movie Detail. Do not design any hover-only content; everything a
parent needs to decide "do I want this" must be visible without a
mouse-over.

**Density:** favor **larger posters, fewer per row**, over a dense
streaming-app grid. The goal is calm scanning, not maximum information
density. It's fine if this means more scrolling to see an entire row.

---

## Screen 2: Movie Detail

Reached by clicking any poster. This is the decision point before
committing to watch.

**Contents:**

- Large poster (or backdrop image)
- Title
- Year
- Genre(s)
- A single primary action button:
  - If in-progress: **"Resume — 23:14"** (or whatever the actual
    timestamp is)
  - If not started: **"Play"**
- A manual **"Mark as watched"** toggle — independent of automatic
  watch-tracking, lets the maintainer or a parent override the state
  directly
- A small, visually de-emphasized Edit/Delete affordance (e.g. a
  small icon or overflow menu) — present, but must not compete for
  attention with the Play button. This is not a parent-facing action;
  it should read as "maintenance," not as part of the primary flow.

---

## Screen 3: Player

Full-screen video playback.

**Control bar behavior:**

- Auto-hides after roughly 3 seconds of no mouse movement
- Reappears immediately on any mouse movement
- Includes an explicit, clearly visible **"← Back"** button (top-left,
  standard placement) — do not rely on Esc or window controls as the
  only way out
- Beyond Back and the subtitle toggle below, the remaining control set
  (volume, fullscreen, seek bar styling, etc.) should be designed in a
  way that's natural for a typical video-player control bar — exact
  feature availability will be finalized against whatever player
  library is used, so favor a standard, familiar control-bar layout
  over anything novel

**Subtitles:**

- On by default whenever a subtitle file exists for the movie
- If multiple subtitle languages exist, **English is the default
  active track**
- A subtitle on/off toggle lives in the control bar
- If no subtitle file exists at all for a movie, the toggle simply
  does not appear (not shown disabled, not shown with an explanatory
  message — its absence is self-explanatory)

---

## Screen 4: Add Movie

A maintainer tool — should read as a tool, not as a polished
parent-facing screen. Clarity and efficiency matter more than warmth
here.

**One form, two ways to fill the file fields:**

- **Folder-path autofill** — enter a folder path; the app scans it and
  attempts to find a video file, poster image, and any subtitle
  file(s), pre-filling those slots
- **Manual mode** — individual file pickers for video, poster, and
  subtitle(s) instead of a folder path

Both modes feed the exact same set of fields below — design this as
one form with a mode switch at the top, not two separate screens.

**Fields:**

- Title (text)
- Year (number/text)
- Genre — **multi-select** from a fixed, predefined list (not
  freeform text entry). Starting list for the prototype: Action,
  Comedy, Drama, Horror, Thriller, Sci-Fi, Romance, Documentary,
  Animation, Family, Adventure, Crime
- Video file (single file, via autofill or picker)
- Poster file (single image, via autofill or picker)
- Subtitle files — **a compact list, one row per file**, each row
  showing: filename (read-only), a language dropdown (pre-filled with
  a detected guess when possible, always editable), and a remove
  button. Zero, one, or several rows depending on how many subtitle
  files were found/added.

---

## Screen 5: Import

A maintainer tool for one-time bulk migration of the existing Excel
sheet + folder structure. Used rarely — optimize for trustworthiness
and clarity over polish.

**Flow:**

1. Maintainer points the importer at the spreadsheet (and the root
   folder containing all the per-movie subfolders)
2. The importer matches each spreadsheet row to a folder by name and
   runs the same autofill logic as Add Movie
3. **Review step is summary-first**, not a row-by-row checklist of
   everything:
   - A short summary: how many movies matched confidently and were
     accepted automatically, and how many need attention
   - Only the problem rows are shown for review — confident matches
     are not re-litigated one by one

**Four cases flagged as "needs attention":**

1. No folder found that matches the spreadsheet row at all
2. Multiple folders look like plausible matches (ambiguous)
3. A folder was matched but is missing one of the three expected files
   (video, subtitle, or poster)
4. The spreadsheet row itself has missing/blank metadata (e.g. no
   genre filled in)

**Resolving a flagged row:** each problem row opens into **the same
Add Movie form**, pre-filled with whatever the importer could guess,
plus a **Skip** option (don't import this one now, handle it later via
the regular Add Movie screen). Do not design a separate review-editing
UI — reuse the Add Movie form component for this.

---

## Visual Direction

**Mood:** dark, cinematic — the familiar streaming-app visual language
parents already recognize as "this is for picking a movie" — but
warmed up, not sterile. Dark backdrop with **warm accent colors** (soft
amber/cream tones), not the colder high-contrast look of a typical
streaming service.

**Spacing and scale:** generous throughout. Text and click targets
should read as noticeably larger and easier to hit than a typical
streaming app or SaaS product — comfort over density, everywhere,
consistently with the poster-grid density decision above.

**Typography — two tiers:**

- **Titles and major headings:** a serif or distinctive display
  typeface. Should evoke a cinema marquee or movie-poster feeling —
  this is the one place the app gets to have real visual personality.
- **Everything else (UI labels, buttons, metadata, genre tags, form
  fields, control labels):** a clean, highly legible sans-serif,
  chosen purely for clarity at a glance. No personality needed here —
  optimize for "never have to think about what this says."

**Tone difference between the two audiences:** Browse, Movie Detail,
and Player should fully express the warm-cinematic mood described
above. Add Movie and Import can be visually plainer and more
utilitarian — they are tools for the maintainer, not part of the
"watching a movie" experience, and shouldn't try to be beautiful at the
expense of being fast to use.

---

## What NOT to Design

- No AI features, AI copy, or "smart" anything, anywhere
- No login, sign-up, or account screens
- No multi-profile picker
- No persistent sidebar/nav bar
- No cloud-sync indicators or settings
- No hover-only content on poster cards
- Collections/playlists — out of scope for this prototype (roadmap
  feature, not part of the MVP being designed now)

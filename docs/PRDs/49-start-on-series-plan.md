# Plan: Start on Series, the household chooses the shelf FamilyFlix opens on

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/425

FamilyFlix always opens on the Movies tab. This initiative adds the **Start
tab**, a Display preference drawn as the same **Pill tabs** a parent presses at
the top of the library, and applies it on the **Launch entry** only: with
Series chosen, the first thing drawn is the Series tab, and Movies is never
drawn first and swapped. Every other way onto the library keeps its own
destination.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** None needs a
person in the loop:

- The prototype already lives in `docs/handoff/`, so amending it needs no
  Claude Design round. Its revision is phases 1 and 2, and lands before any
  build phase (log 49 Q19).
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`FamilyFlix.dc.html` is about 35k tokens, `COMPONENT-SPEC.md`
  about 22k): a phase greps for the section it amends and reads only that
  range, never the whole file. That is why the two prototype files are two
  phases, and why the launch is split into the hook (phase 6) and its wiring
  (phase 7).
- No test runs Electron. The wire is faked at `fetch` with `fakeResponse`, and
  the Launch entry is a memory router's first entry (`location.key ===
'default'`).
- The docs (the checklist's step 32 entry, the glossary rows, and CLAUDE.md
  only if its folder tree names a new unit, per log 49 Q20) are not a phase:
  they are ticked ✅ only after the refactor.

The phases are log 49's _Implementation Plan_ slices 1–3, each split in two or
more so no issue outgrows one context.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `GET /api/settings` gains `startTab`, `'movies'` when nothing is stored
    or the stored value is not a Library tab.
  - `POST /api/settings/start-tab { value }` → `200 { value }`, a
    **Single-signal write**; `400` unless `value` is one of `LIBRARY_TABS`,
    leaving the stored value unchanged.
  - A **Factory reset** empties the `settings` table, so the Start tab returns
    to Movies with no extra code.
- **Client routes**: unchanged. Bare `/` is still the Movies tab for the logo,
  _Back to library_ and `useGoBack`; `seriesTabPath()` (`/?tab=series`) is
  still the series Landing, a series delete's and the series add's Fresh home.
- **Schema**: no migration. The key `start-tab` in the existing `settings`
  table holds `'movies'` or `'series'`.
- **Key models** (shared types, both build targets):
  - `LIBRARY_TABS = ['movies', 'series'] as const` in `src/types/browse.ts`
    beside `MOVIE_SORTS`; `LibraryTab` derived from it; an `isLibraryTab`
    guard serves the route, the server read and the save's echo.
  - `DEFAULT_START_TAB: LibraryTab = 'movies'` and `Settings.startTab:
LibraryTab` in `src/types/settings.ts`.
  - `useDisplayPreference()` gains `startTab: LibraryTab | null` (`null` until
    the read lands) and `setStartTab(tab)`.
- **The launch rule**: the **Launch entry** is the router's first entry on
  bare `/` with no query. On it, the library reads `fetchSettings()` itself
  (not the provider's value, log 49 Q13), draws nothing until the read
  settles, and on `'series'` **replaces** (never pushes) onto `/?tab=series`.
  Movies or a refused read draws at once on `/`. Off the Launch entry nothing
  waits and nothing is read.
- **The setters' bargain**: every Display preference is shown at once, posted,
  the echo kept, put back on refusal, never rejecting (`useHeldValue<T>`).
- **Unchanged throughout**: the shell, the server's static serving and the
  handshake (PRD _Out of Scope_); `useSettings`; no snackbar for a Display
  row.

---

## Phase 1: Prototype, the _Start on_ row

**User stories**: 1–6, 11 (as spec)

### What to build

Amend `docs/handoff/page.SettingsPage.dc.html`: the Display group gains a
third row under _Fill in ratings from TMDB_, labelled _Start on_, with the
line _Which shelf FamilyFlix opens on. You can still switch between Movies
and Series at the top of the library._, and `mol.PillTabs` (`Movies`,
`Series`) on the right where the other rows draw their `Toggle`. Pressing a
pill presses it; no snackbar. The row is drawn whether or not the library
holds a series.

Amend `docs/handoff/COMPONENT-SPEC.md`'s settings page entry to list the row
and its use of `mol.PillTabs`.

Read only the Display group's range of the page and the settings entry of the
spec (grep for `Display` and `SettingsPage`).

### Acceptance criteria

- [ ] The Settings prototype draws _Start on_ third in the Display group, with
      its line and the two pills, Movies pressed by default.
- [ ] Pressing a pill presses it and shows no snackbar.
- [ ] COMPONENT-SPEC's settings page lists the row and `mol.PillTabs`.
- [ ] No other group or row of the prototype changes.

---

## Phase 2: Prototype, opening on the chosen tab

**User stories**: 13–16, 19 (as spec)

### What to build

Amend `docs/handoff/FamilyFlix.dc.html`: its Settings screen gains the same
_Start on_ row as phase 1, held in the prototype's state, and the prototype
opens on the chosen Library tab when it first draws the library. The logo
and _Back to library_ still open the Movies tab; switching tabs at the top of
the library works as before.

Read only the ranges that hold the Settings Display group, the library's tab
state and the prototype's initial screen (grep for them); never the whole
file.

### Acceptance criteria

- [ ] The full prototype's Settings screen draws the _Start on_ row as in
      phase 1.
- [ ] With Series chosen, the prototype's first library screen is the Series
      tab; with Movies, the Movies tab.
- [ ] The logo and _Back to library_ still land on the Movies tab.

---

## Phase 3: The Start tab on the wire

**User stories**: 8, 12, 23, 30–34

### What to build

The two tabs are spelled once: `LIBRARY_TABS`, `LibraryTab` and
`isLibraryTab` in the shared browse types, and the **Library tabs** take their
values from the list. `DEFAULT_START_TAB` and `Settings.startTab` join the
shared settings types.

On the server, the `library/settings` module stores the key `start-tab`
through a `setStartTab(tab)` over its existing upsert, and its settings read
answers `startTab`, reading nothing, or a stored value outside `LIBRARY_TABS`,
as Movies. `GET /api/settings` answers it; `POST /api/settings/start-tab` is
thin over the setter, the `tmdb-ratings` route's sibling.

Client fixtures that build a `Settings` gain `startTab` so the typecheck
passes; nothing in the UI reads it yet.

Demo: `POST /api/settings/start-tab { "value": "series" }`, then
`GET /api/settings` answers `startTab: "series"`; after a Factory reset it
answers `"movies"`.

### Acceptance criteria

- [ ] `LibraryTab` is derived from `LIBRARY_TABS`; the Library tabs' suites
      pass with their values taken from the list.
- [ ] The settings module defaults `startTab` to `movies`, round-trips
      `series`, and reads a hand-stored nonsense value as `movies`.
- [ ] `GET /api/settings` answers `startTab`.
- [ ] `POST /api/settings/start-tab` stores and echoes a Library tab, and
      answers `400` for a missing, non-string or unknown value, leaving the
      stored value unchanged.
- [ ] A Factory reset returns `startTab` to `movies`.
- [ ] The shipping projects typecheck.

---

## Phase 4: The Start tab held by the provider

**User stories**: 7, 10, 12, 35

### What to build

`DisplayPreferenceProvider`'s `useHeldFlag` becomes `useHeldValue<T>`, the one
bargain over any value, and the two existing flags use it with their
behaviour unchanged. A new `saveStartTab`, the twin of `saveTmdbRatings`,
posts `{ value }` to the route through `postValue`, keeps an echo that is a
Library tab, falls back to the sent value on a missing echo, and rejects on a
refusal.

`useDisplayPreference()` gains `startTab` (`null` until the provider's one
`fetchSettings` lands, then the stored tab) and `setStartTab(tab)`. Nothing
draws it yet.

### Acceptance criteria

- [ ] `saveStartTab` posts `{ value }` to `/api/settings/start-tab`, keeps a
      Library-tab echo, keeps the sent value on a missing or nonsense echo,
      and rejects on a refusal.
- [ ] `startTab` is `null` until the read lands, then the stored tab.
- [ ] `setStartTab` shows the new tab at once, keeps the echo, and puts the
      old tab back on a refusal, never rejecting.
- [ ] _Ultrawide margins_ and _Fill in ratings from TMDB_ behave as before over
      `useHeldValue`; their existing suites pass unchanged.

---

## Phase 5: The _Start on_ row

**User stories**: 1–6, 9, 11

### What to build

The Display group draws its third row, a 1:1 translation of phase 1's
prototype: _Start on_, its line, and `PillTabs` (`Movies`, `Series`) on the
right, read and written through `useDisplayPreference()`. The pills are not
drawn while `startTab` is `null` (**Blank until it lands**). Pressing a pill
calls `setStartTab`; a refusal puts the old pill back. No snackbar. The row is
drawn whether or not the library holds a series.

Demo: in Settings, press _Series_, reload the page, and _Series_ is still
pressed.

### Acceptance criteria

- [ ] The _Start on_ row and its line are drawn third in the Display group.
- [ ] No pills are drawn while the read is pending.
- [ ] The stored tab's pill is drawn pressed.
- [ ] Pressing the other pill posts it and presses it; a refused save presses
      the old pill again.
- [ ] No snackbar appears on either outcome.
- [ ] The row is drawn with an empty library.

---

## Phase 6: The Launch entry's decision

**User stories**: 17, 21, 24, 28, 29

### What to build

A deep module in the library feature, `useStartTab(): boolean`, answering
whether the browse home may draw. Off the **Launch entry** (a deep link,
`/?tab=movies`, a search query, a non-default location key) it answers `true`
at once and reads nothing. On it, it reads `fetchSettings()` once and answers
`false` until the read settles: on `'series'` it replaces onto
`seriesTabPath()` and then answers `true`; on `'movies'` or a refused read it
answers `true` with the URL untouched. Nothing composes it yet.

### Acceptance criteria

- [ ] Off the Launch entry the hook answers `true` at once and makes no read,
      for each of: a deep link, `/?tab=movies`, a search query, a non-default
      key.
- [ ] On the Launch entry it answers `false` until the read settles, then
      `true`.
- [ ] With Series stored it lands on `/?tab=series` by a replace, with no
      entry behind it.
- [ ] With Movies stored, or a refused read, it stays on `/`.
- [ ] It reads the settings route once per mount.

---

## Phase 7: The launch, gated

**User stories**: 13–16, 18–20, 22, 25–27

### What to build

A new organism in the library feature, `StartTabGate`, renders its children
only once `useStartTab()` answers `true`, and nothing before, the header
included. The library page composes it around its `MainLayout`; the page
stays composition only.

The library page and App tests that mount bare `/` now answer or refuse
`/api/settings`; they are updated to do so, not weakened.

Demo: with Series chosen, open FamilyFlix and the Series tab is the first
thing drawn, with no Movies row or pressed Movies pill before it. Press the
logo and the Movies tab draws at once.

### Acceptance criteria

- [ ] The gate renders nothing while the hook is pending and its children
      once it allows.
- [ ] With Series stored, the Series tab is the first body drawn at `/`, and
      no Movies row or pressed Movies pill appears at any point.
- [ ] With Movies stored, or a refused read, the Movies tab draws; a library
      that then fails to load shows its usual `RetryableFailure`.
- [ ] With Series stored and no series, the Series tab draws its own empty
      face.
- [ ] After opening on Series, Back from a series lands on the Series tab,
      and switching to Movies works as always.
- [ ] The logo, _Back to library_ and the movie page's Landing still land on
      the Movies tab; a series delete, the series add and the series page's
      no-history Back still land on the Series tab, with no wait.
- [ ] Every suite that mounts `/` answers or refuses `/api/settings` and
      passes.

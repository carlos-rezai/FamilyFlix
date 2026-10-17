# Plan: Add and sync — fill a hand-added title from TMDB after its save

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/391

Adding one film or show by hand means typing every field TMDB already knows.
This initiative gives the **Movie form**'s plain add, for both **Form kinds**,
the _Also fetch metadata and posters from TMDB_ box. Ticked, the save goes
through as always, and the form then lands on the **Enrichment flow** for the
new title, which is **Started on arrival**: it presses its own Start once,
under every rule the button has. Nothing changes on the server.

## Running the phases

**Phase 0 is HITL**: the prototype revision (log 45 Q17), made in Claude Design
before anything is built. `issue-loop` stops at it.

**Phases 1–3 run AFK under `issue-loop`**, in order. They are log 45's
_Implementation Plan_ slices 2–4. Phase 1 has no caller of its own: it is
proven by typing `/enrich?movie=<id>&start=1` by hand, and Phase 2 is its
first caller.

The docs (README, CLAUDE.md, the folder tree) are log 45's slice 5. They are
not a phase: they are ticked ✅ only after the refactor. The glossary already
carries **Add and sync** and **Started on arrival** since log 45.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new, none changed.
  - `POST /api/movies` and `POST /api/series` already answer the record with
    its `id`.
  - `POST /api/enrichment` already takes a `movieId` or a `seriesId` on the
    `single` scope, and the single run already re-attaches by title.
- **Client routes**:
  - `/enrich?movie=<id>&start=1` and `/enrich?series=<id>&start=1`: the flow
    Started on arrival. The parameter is always dropped by a **replace** to
    the same `enrichPath` without it, whether or not anything was started.
  - A ticked add leaves history as **Settings → the title's page → the
    flow**: `/add` replaced with `/movie/<id>` or `/series/<id>`, then the
    flow pushed. This is not a **Fresh home**. An unticked add keeps its
    Fresh home.
- **Schema**: none. No migration, no wire field.
- **Key models**:
  - `EnrichQuery`: `{ scope?: 'all'; movie?: string; series?: string; start?: true }`.
  - `EnrichmentRunState` gains `attaching: boolean`, `useImportRun`'s name:
    `true` from mount until the arrival read of the **Current enrichment
    run** answers (a held run, a `404` or a failure).
  - `EnrichCheckCardProps`: `{ checked; keySet; keyedHint; onToggle }`, in
    `src/components/` (graduated, `FieldDiff`'s precedent). The key-less hint
    stays the card's own.
  - `useKeyStored` in `src/hooks/`, its behaviour unchanged.
  - `useMovieForm` gains `enrich: boolean` and `toggleEnrich()`, `ImportFlow`'s
    names: `false` on mount, kept across a Form kind switch, drawn and read
    on the `add` job alone.
- **Boundaries**:
  - The form starts no Sync and posts nothing to enrichment. The flow's own
    `onStart` is the one place a start is decided: no key, offline, the `409`
    **Busy notice**.
  - Started on arrival never presses over a **Let-go line**: letting another
    title's review go is the maintainer's press.
  - The decision is made at most once per mount.
- **Unchanged throughout**: the **Save gate** (a title and a video, every
  episode's for a series), the form's Back and Cancel, the edit and Resolve
  jobs, the flow's three steps and every face of the review.

---

## Phase 0: The prototype revision (HITL)

**User stories**: 1–4, 7, 8, 10 (the drawn surface)

### What to build

The prototype amended first, per _The prototype is the spec_.
`feat.MovieForm.dc.html` draws the box on a plain add, on both kinds, between
the Files card and the actions, with _Add to library_ keeping its label.
`mol.EnrichCheckCard.dc.html` is the graduated card with `keyedHint` as a
prop. `FamilyFlix.dc.html` walks the ticked save onto the title's page and
the flow, Started on arrival. `feat.EnrichmentFlow` draws nothing new.

### Acceptance criteria

- [ ] `feat.MovieForm` draws the box on a film's and a series' plain add,
      between the Files card and the actions, and not on an edit or a Resolve.
- [ ] `mol.EnrichCheckCard` exists with `keyedHint` in its `data-props`, its
      pixels unchanged from Import setup's card.
- [ ] Both hints are drawn: the form's keyed sentence and the card's key-less
      one.
- [ ] `FamilyFlix.dc.html` routes a ticked save onto the title's page, then
      the flow.

---

## Phase 1: Started on arrival

**User stories**: 27–40

### What to build

The Enrichment flow learns to press its own Start. `enrichPath` writes
`start=1` beside `movie` or `series`. `useEnrichmentRun` exposes `attaching`.
When `start` is in the query, the flow waits until the EnrichmentSummary has
landed and `attaching` is `false`, then decides once. A run that already
belongs here was re-attached, so nothing is pressed. A **Waiting run** with
Decisions draws its Let-go line, and nothing is pressed. Otherwise the flow
calls its own `onStart` with setup's defaults: every field chip, and the
**Write targets** as setup offers them. That call already answers no key,
offline and the Busy notice. In every case the URL is then replaced without
`start`. Typing the URL by hand behaves the same: one rule, no special case
for the form.

### Acceptance criteria

- [ ] `enrichPath({ movie, start: true })` and `({ series, start: true })`
      write `start=1`. Every existing query reads back unchanged.
- [ ] `attaching` is `true` on mount and `false` once the arrival read
      answers, whether with a run, a `404` or a failure.
- [ ] With no run held, one `POST /api/enrichment` goes out with the single
      scope, the title's id and the defaults, and the URL is replaced without
      `start`.
- [ ] A run already this title's is re-attached with no POST, and the URL is
      replaced.
- [ ] A Waiting run with Decisions gets no POST and its Let-go line is drawn.
      The URL is replaced.
- [ ] A Waiting run with no Decisions gets one POST.
- [ ] With no key, `/settings` is pushed with _Add your TMDB key here first._
      and nothing is posted.
- [ ] Offline, nothing is posted and the offline banner is drawn.
- [ ] A `409` draws the Busy notice.
- [ ] Nothing is posted before both the summary and the arrival read have
      landed, and at most one POST goes out however often the flow
      re-renders.
- [ ] Stepping back onto the flow, or reloading it, starts no second Sync.
- [ ] Without `start`, the flow behaves exactly as today.

---

## Phase 2: The box on a film's add

**User stories**: 1, 3–5, 7–19, 22–26, 41–44

### What to build

The first caller. `EnrichCheckCard` graduates to `components/` with
`keyedHint`, re-exported from the barrel. Import setup and the Library
folders page pass the import's sentence. `useKeyStored` moves to `hooks/`.
The Movie form draws the card between the Files card and the actions on a
plain film add, with the form's sentence as its keyed hint. `useMovieForm`
holds `enrich`. After a successful save with the box ticked, the form
replaces `/add` with `moviePath(id)` and then pushes
`enrichPath({ movie: id, start: true })`, taking the `id` off `createMovie`'s
answer. An unticked save lands on its Fresh home as now. A refused save
navigates nowhere. Stop, a failed Sync or a skipped Decision leaves the saved
film as it was, plus whatever had already been fetched.

### Acceptance criteria

- [ ] The card is drawn on a plain film add and absent on an edit and a
      Resolve.
- [ ] It is off on mount, a real checkbox in the tab order, toggled by a
      press.
- [ ] The keyed hint reads _Runs straight after the save, over this title.
      Needs the internet._ With no key stored, the card draws its own
      key-less hint.
- [ ] _Add to library_ keeps its label whether the box is ticked or not.
- [ ] The Save gate is unchanged with the box ticked.
- [ ] A ticked save ends on `/enrich?movie=<id>&start=1`, and Back from there
      lands on `/movie/<id>`, never on `/add`.
- [ ] An unticked save lands on its Fresh home as now.
- [ ] A refused save navigates nowhere and keeps every field, and no Sync
      starts.
- [ ] Import setup and the Library folders page draw the import's sentence,
      with their suites still passing. The moved `EnrichCheckCard` and
      `useKeyStored` suites pass at their new paths.

---

## Phase 3: The series kind

**User stories**: 2, 6, 20, 21

### What to build

The same box and leaving over a show. The card is drawn on `?kind=series`'s
plain add, and `enrich` is kept across a switch on the **Kind tabs**. A
ticked series save replaces `/add` with `seriesPath(id)` and then pushes
`enrichPath({ series: id, start: true })`, taking the `id` off
`createSeries`' answer. The single-series run fetches seasons, episodes and
**Season posters**, and its review draws the **Seasons** section, as from the
series' ⋯ menu.

### Acceptance criteria

- [ ] The card is drawn on a plain series add and absent on a series edit and
      a Series Resolve.
- [ ] A ticked box stays ticked across Movie → Series → Movie.
- [ ] A ticked series save ends on `/enrich?series=<id>&start=1`, and Back
      from there lands on `/series/<id>`, never on `/add`.
- [ ] An unticked series save lands on `/?tab=series` as now.
- [ ] A refused series save navigates nowhere.

> **Initiative:** `single-title-sync`
> **Design log:** `docs/design-logs/33-single-title-sync.md`
> **Issue:** #285
> **Build order:** step 16, the first of the third chain (log 32 §4) — a `fix:`

## Problem Statement

I am the maintainer. I ran a library-wide **Sync** with TMDB and left it in
review, with a few **Decisions** still open. Later I opened one film's page and
chose _⟳ Fetch from TMDB_ from its ⋯ menu, because I wanted that one film
fetched. Instead of that film's setup, I got the whole library's review. The
screen I opened for one movie had been taken over by a different run, and
nothing I could see would get me to the film's own Sync.

If the library Sync is still _running_, the same thing happens in a second
way. I press Start for the film, the server says a Sync is busy, and the screen
quietly shows me the library run's progress, as if that were what I had asked
for.

The app cannot tell whose run it is holding. A **Single-title Sync** has no way
to say which film it is for.

## Solution

A **Single-title Sync** now knows which film it belongs to, and the flow
opened from a film's ⋯ menu re-attaches only to that film's run.

- Opened for a film, the **Enrichment flow** shows that film's run if one is
  current, whether it is running or in review. Otherwise it shows the film's
  setup, even when another run is current.
- When that other run is waiting in review and still has Decisions, the setup
  says so in one line under Start: _Starting lets go of the library sync
  waiting for review._, or _…another movie's sync…_ when the run is another
  film's. Pressing Start lets it go, as it always has.
- When another Sync is _running_, Start is refused and a warning notice says
  _A sync is already running._ The screen stays on the film's setup, and I can
  try again once the run finishes.
- Opened without a film (from Settings, or from Import's _Finish_), the flow
  behaves exactly as it does today and re-attaches to whatever run is current.

## User Stories

1. As the maintainer, I want _⟳ Fetch from TMDB_ on a film to open that film's
   Sync setup, so that I can fetch one film without walking through the whole
   library's review.
2. As the maintainer, I want a library Sync I left in review not to take over a
   film's flow, so that the screen I opened is the one I asked for.
3. As the maintainer, I want another film's Sync left in review not to take
   over this film's flow, so that each film's Sync belongs to its own film.
4. As the maintainer, I want the film's flow to re-attach to that same film's
   Sync while it is running, so that leaving and coming back shows me its
   progress.
5. As the maintainer, I want the film's flow to re-attach to that same film's
   finished review until I press _Sync again_, so that a Decision I left open
   is still there when I come back.
6. As the maintainer, I want one line under Start telling me that starting lets
   go of the library Sync waiting for review, so that I don't lose its open
   Decisions without knowing.
7. As the maintainer, I want that line to say _another movie's sync_ when the
   waiting run is a different film's, so that I know which kind of work I am
   letting go.
8. As the maintainer, I want no line when the waiting run has no Decisions
   left, so that I am not warned about losing nothing.
9. As the maintainer, I want no line when the current run is _running_ rather
   than in review, so that the one place that fact appears is the notice at
   Start.
10. As the maintainer, I want pressing Start while another Sync is running to
    show _A sync is already running._ as a warning, so that I know to wait
    rather than think something broke.
11. As the maintainer, I want that refusal to keep me on the film's setup with
    my chips and choices as I left them, so that I can press Start again later
    without setting it up twice.
12. As the maintainer, I want Start to hold the run when the `409` came from
    this same film's Sync already running, so that pressing Start twice shows
    me the run rather than a warning.
13. As the maintainer, I want the waiting line to disappear once my own run has
    started, so that the setup's words never describe a run that is already
    gone.
14. As the maintainer, I want Settings' _Sync metadata & posters_ to keep
    re-attaching to any current run, a single film's included, so that the
    library-wide entry point still shows me whatever is going on.
15. As the maintainer, I want Import's _Finish_ hand-off to keep working as it
    does, so that an import with _Also fetch from TMDB_ still lands in its
    Sync.
16. As the maintainer, I want Back, Finish and _Back to the movie_ to keep
    landing on the film, so that the **Back rule** is unchanged by the fix.
17. As the maintainer, I want any other failure at Start to stay as quiet as it
    is today, so that the fix adds one notice and no new error surfaces.
18. As the maintainer, I want a read that lands after I have started or
    cancelled not to put an old run back on screen, so that the screen never
    jumps to a stale snapshot.
19. As a developer, I want the run snapshot to carry the film's id, so that any
    later surface can ask whose run it is without a second read.

## Implementation Decisions

- **Type.** `EnrichmentRun` gains an optional `movieId`: the film a `single`
  run is for, absent on a library run (`missing` / `all`). `StartEnrichment`
  is unchanged; it already carries `movieId` for `single`.
- **Server — `createEnrichment.start` only.** It records `movieId` on the run
  it builds when the scope is `single`, and records none otherwise.
  `current()`'s clone carries it unchanged. `enrichmentBody`, `titlesFor`, the
  routes and their status codes are untouched. A run in `review` is still
  replaced by any start, and a `running` one still answers `busy` / `409`.
- **`useEnrichmentRun(movieId: string | null)`.** The hook takes the film the
  screen was opened for. A module-local `belongsHere(run, movieId)` sits beside
  `settled`. With no movie, every run belongs (today's rule). With a movie,
  only a `single` run whose `movieId` matches belongs. It is not its own
  folder, because it has one caller and no surface of its own.
  - **On mount:** a current run that belongs is held as `run`. One that does
    not belong and is in `review` becomes `waiting`. One that does not belong
    and is `running` is ignored, and the screen shows setup.
  - **On a `409` from start:** the current run is read and held only when it
    belongs. Otherwise `start` rejects with `EnrichmentBusyError`.
  - **`waiting: EnrichmentRun | null`** is returned beside `run`. It is cleared
    once the screen holds a run of its own: a successful start, or a `409` it
    does hold. The existing generation guard keeps a late mount read from
    setting either.
- **`letGoLine(waiting)` in `enrichmentView`**, beside `scopeDescription` and
  `enrichmentEstimate`. It is pure:
  - a `missing` or `all` run with Decisions → _Starting lets go of the library
    sync waiting for review._
  - a `single` run with Decisions → _Starting lets go of another movie's sync
    waiting for review._
  - no run, or no Decisions → `null`
- **`EnrichmentSetup`** gains `letGo: string | null` and draws it under the
  `StartRow` as a `LetGoNote`, styled like `SourceNote`. No prototype revision
  is needed, because the line uses the setup's existing note furniture (log 32).
- **`EnrichmentFlow`** passes the `movie` search param to `useEnrichmentRun`
  and `letGoLine(waiting)` to the setup. `onStart` answers an
  `EnrichmentBusyError` with a `warning` notice, _A sync is already running._,
  through `useSnackbar()`. This follows the precedent of `useTmdbKey`'s _Paste
  a key first._ Every other rejection is still swallowed.
- **Shipped as one vertical slice and one issue, a `fix:`.** The slice covers
  the type, the server record, the hook, the view, the setup line and the
  notice.

## Testing Decisions

- Tests exercise external behaviour only. The hook is tested through what it
  returns and what it calls on the wire, not through `belongsHere` directly,
  the way `settled` is tested today. The flow is tested through what the user
  sees: the step drawn, the line and the notice.
- **`createEnrichment.test.ts`:** a `single` start's snapshot and `current()`
  carry the `movieId`, and a library start carries none.
- **`useEnrichmentRun.test.ts`:** on mount and on a `409`, test three cases: a
  matching single run (held), another film's single run, and a library run.
  The last two are not held: the mount yields `waiting` when the run is in
  review, and the `409` rejects with `EnrichmentBusyError`. Opened without a
  movie, every run is held (today's rule, kept). `waiting` is cleared by a
  successful start. A `running` run that does not belong never becomes
  `waiting`.
- **`enrichmentView.test.ts`:** `letGoLine`'s four cases (a library run, a
  single run, a run with no Decisions, and `null`).
- **`EnrichmentSetup.test.tsx`:** the `LetGoNote` is drawn under Start when
  `letGo` is a string, and absent when `null`.
- **`EnrichmentFlow.test.tsx`:** the `?movie=` paths end to end. These are
  setup over a library review with the line, setup over another film's review,
  re-attaching to the same film's review, and Start over a running library Sync
  raising _A sync is already running._ while setup stays. The no-movie path
  still re-attaches to a single run.
- **Prior art.** `useImportRun.test.ts` and the existing
  `useEnrichmentRun.test.ts` for the mount, poll and generation tests;
  `importView.test.ts` / `enrichmentView.test.ts` for the pure words;
  `useTmdbKey`'s notice tests for the snackbar assertion. `makeEnrichmentRun`
  takes `movieId` as an override like any other field.

## Out of Scope

- A server-side refusal to replace another scope's review. Log 32 chose the
  line instead.
- A warning ahead of time about a _running_ Sync. The notice at Start is its
  one surface.
- A single-title Sync for a **Series**. The field stays `movieId`, not a title
  id.
- Re-attaching a library-opened flow only to library runs. Opened without a
  film, the flow re-attaches to any run, as today.
- Any change to `enrichmentBody`, the route, its status codes, or the Back rule.

## Further Notes

- Whose run it is now sits on the snapshot, so a later single-series Sync or a
  backgrounded Sync can ask the same question without a second read.
- The hook's mount now has two outcomes, `run` and `waiting`, kept apart by the
  generation guard it already has.
- New glossary terms, already in `docs/ubiquitous-language.md`: **Single-title
  Sync** and **Waiting run**. Say "let go" for what Start does to a Waiting
  run, never _Stop_ or _cancel_.

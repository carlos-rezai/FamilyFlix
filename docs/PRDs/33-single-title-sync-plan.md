# Plan: Single-title Sync — a film's Fetch from TMDB re-attaches only to that film's run

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/285

Today the **Enrichment flow** opened from a film's ⋯ menu re-attaches to any
**Current enrichment run**. A library Sync left in review takes over the
film's screen, and a `409` at Start shows a library run's progress as if it
were the film's. The run snapshot cannot say whose run it is.

This is build step 16, the first of the third chain (log 32 §4), and a `fix:`.
The PRD decides it ships as **one vertical slice and one issue**, and the plan
keeps that: the type, the server's record, the hook, the view, the setup line
and the notice all serve the same bug and are too small to split usefully.

## Running the phase

Phase 1 runs AFK under `issue-loop`. It needs no prototype revision: the
let-go line uses the setup's existing note furniture (log 32), and the notice
uses the Snackbar stack as it is.

## Architectural decisions

Durable decisions that apply across the phase:

- **Routes**: unchanged. `POST /api/enrichment` (`201`, `400`, `409` while a
  run is `running`, `412`), `GET /api/enrichment/current` (`404` for none),
  `POST …/current/cancel` and the four Decision writes keep their shapes and
  status codes. A start still replaces a run in `review`. The flow stays at
  `/enrich`, `?movie=<id>` for a **Single-title Sync** and `?scope=all` or
  nothing for a library one.
- **Schema**: no migration. The run lives in memory only.
- **Key models**:
  - `EnrichmentRun` gains an optional `movieId`: the film a `single` run is
    for, absent on a `missing` or `all` run. `StartEnrichment` is unchanged; it
    already carries `movieId` for `single`.
  - **Belongs here**: opened without a film, every run belongs (today's rule).
    Opened for a film, only a `single` run with that `movieId` belongs.
  - **Waiting run**: a run that does not belong, in `review`, found on mount.
    It is never a `running` run, and it is cleared once the screen holds a run
    of its own.
  - **Let-go line**: _Starting lets go of the library sync waiting for
    review._ for a library Waiting run with Decisions; _Starting lets go of
    another movie's sync waiting for review._ for another film's; nothing
    when there is no Waiting run or it has no Decisions. Say "let go", never
    _Stop_ or _cancel_.
  - **Busy notice**: _A sync is already running._, a `warning` through
    `useSnackbar()`, raised when Start's `409` comes from a run that does not
    belong.
- **Boundaries**: the server learns only to record the id. Whose run it is is
  decided in the client's hook, not by the route. The **Back rule** is
  untouched: Back, Finish and _Back to the movie_ land on the film.

---

## Phase 1: Whose run it is

**User stories**: 1–19

### What to build

A `single` start records its film's id on the run, and the snapshot and every
read of the current run carry it. A library start records none.

The flow's run hook takes the film the screen was opened for. On mount, a
current run that belongs is held as today. One that does not belong and is in
review becomes the Waiting run, and the screen shows the film's setup. One that
does not belong and is running is ignored, and the screen shows setup too. The
generation guard that already keeps a late read off the screen keeps a late
mount read from setting either the run or the Waiting run.

The setup draws the let-go line under Start, styled like the source note, when
the Waiting run has Decisions left. The line disappears once the screen holds
a run of its own.

At Start, a `409` is answered by reading the current run. A run that belongs
is held, so pressing Start twice on the same film shows its run. A run that
does not belong is refused: the flow raises the busy notice and stays on the
film's setup with its chips and choices as they were. Every other failure at
Start stays as quiet as it is today.

Opened without a film — from Settings' _Sync metadata & posters_ or from
Import's _Finish_ — the flow behaves exactly as today and re-attaches to any
current run, a single film's included.

### Acceptance criteria

- [ ] A `single` start's snapshot and `GET /api/enrichment/current` carry the
      film's `movieId`; a `missing` or `all` start's carry none.
- [ ] `/enrich?movie=<id>` over a library run in review shows the film's setup
      with _Starting lets go of the library sync waiting for review._ under
      Start.
- [ ] `/enrich?movie=<id>` over another film's run in review shows the film's
      setup with _Starting lets go of another movie's sync waiting for
      review._
- [ ] No line is drawn when the Waiting run has no Decisions, and no Waiting
      run ever comes from a `running` run.
- [ ] `/enrich?movie=<id>` re-attaches to that same film's run, running or in
      review, until _Sync again_.
- [ ] Pressing Start lets the Waiting run go, as it always has, and the line
      is gone once the film's own run is held.
- [ ] Start over another run that is running raises _A sync is already
      running._ as a `warning`, and the screen stays on the film's setup with
      its choices kept.
- [ ] Start's `409` from the same film's running Sync holds that run, with no
      notice.
- [ ] Any other failure at Start raises nothing new.
- [ ] A read landing after a start or a cancel never puts an old run, or an
      old Waiting run, back on screen.
- [ ] `/enrich` and `/enrich?scope=all` still re-attach to any current run, a
      single film's included; Import's _Finish_ hand-off still lands in its
      Sync.
- [ ] Back, Finish and _Back to the movie_ still land on the film.
- [ ] Tests cover the server record, the hook's three cases on mount and on a
      `409` (matching single run, another film's, a library run) plus the
      no-movie rule, the four let-go cases, the setup line drawn and absent,
      and the flow's `?movie=` paths end to end — through what is returned,
      called on the wire and seen, never through the predicate directly.

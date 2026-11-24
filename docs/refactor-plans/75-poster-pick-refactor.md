# Refactor plan: Poster pick, the Late reserve in the house's idiom, the spec's props, and the docs that close step 57

> Source initiative: `poster-pick`, issue 707 (step 57).
> Shipped by issues 708 to 712: two server slices RED and GREEN each, the
> prototype amended, the client slice RED and GREEN, and the walk and
> documents slice (`28121fe6` to `5b9c3cc6`).
> Design log: `docs/design-logs/75-poster-pick.md`.
> PRD: `docs/PRDs/75-poster-pick.md` (707). Plan:
> `docs/PRDs/75-poster-pick-plan.md`.
> Handoff: `docs/handoff/handoff-poster-pick/README.md`, history since
> 710 amended the prototype.
> This is the initiative's closing round. It ticks **Poster pick** and
> closes 707. Filed as issue #714.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`poster-pick` shipped every phase of its plan. `lateReserve` gives a title
with no usable **Media folder** one the first time an image has arrived,
through `recordMediaFolder` beside `mediaFolderOf`; `storeImage`,
`writeSeries` and `writeEpisodes` take the getter, the Frame still guard is
gone, and `chooseSeasonPoster` makes its own reserve, so `not-found` means
only that no run holds the season. On the page, `useEnrichmentRun` answers
`seasonRefused`, the review and the Flow pass it down as they pass
`seasonPhase`, and `SeasonChoices` draws the **Poster refusal** with no
choice pressed. The walk (712) passed its three checks in the shell.

At `5b9c3cc6` the full suite has **13242 tests passing across 931 files**
(one skipped), and `tsc -b --force` is clean. `eslint` over every file the
initiative added or changed reports **1 error and 0 warnings**: an empty
arrow in `EnrichmentReview.test.tsx` from issue 362, older than this
initiative.

The design held, and the code already follows the house in its larger
shapes: `recordMediaFolder`'s prepared statements sit keyed by kind like
`selectMediaFolder`'s, the line is a `Refusal` as the other features'
refusal lines are, and the late reserve stays in enrichment, where log 75
Q6 put it. What is left is small, and every finding below was checked
against the code at `5b9c3cc6`.

### 1. The Late reserve in the house's idiom

- **The getter memoises by hand.** `lateReserve` holds `answered` and
  assigns it, then returns it, on each of its two paths. The house's lazy,
  once-only value is `??=` over a function that settles it, as
  `createArtSweep`'s and `createQualitySweep`'s `running ??= run()` and
  `movieFormBody`'s `uploads.folder ??= resolveFolder(before)` are. The swap
  keeps every suite green (checked at `5b9c3cc6`: the late reserve's suite
  and the 22 `createEnrichment` suites, 254 tests).
- **Two call sites restate the title field by field.** `write` and
  `writeShow` build `{ id: movie.id, title: movie.title, year: movie.year }`
  (and the series' twin) for `lateReserve`, where the `Movie` and the
  `Series` in hand already are a `ReservedTitle`. `chooseSeasonPoster`'s
  literal stays: its fallbacks for a gone series are issue 713's to remove.
- **`recordMediaFolder` is described twice in two ways.** `Enrich` says it
  records _over whatever was recorded_, `LibraryStorage` _over a gone one_.
  Both mean the same write; one sentence should say it.

### 2. A suite's ragged header

- **The late reserve suite's header breaks its wrap.** One line, _a Sync
  with Poster and Backdrop off stores nothing and so reserves nothing_, runs
  to 87 columns where the paragraph wraps at 80, a phrase inserted without
  rewrapping.

### 3. The documents

- **`COMPONENT-SPEC.md`'s Seasons props are behind.** The paragraph ends on
  `{ seasons: SeasonChoice[], onChoose(season, path) }`, where the unit takes
  `seasonPhase` (log 69) and now `seasonRefused` too. The sentence 710 added
  also runs past the paragraph's width.
- **The release checklist has no smoke step for this initiative**, where
  the initiatives that changed what a Sync stores each added one (prior
  art: the Layout fill's step, and Sheet in sight's, `60c1c726`).
- **The build has no journal entry**, and the feature checklist's row reads
  ⬜ Planned with step 57 still 🔜 and its full description.

The README is untouched: no top-level folder or rule changes, and the
Media folder was always meant to be there (log 75 Q13). CLAUDE.md is
untouched for the same reason. The glossary already carries the log's rows.

### Found while planning, filed apart

Two edges change what is shown or what lands on disk, so they are issue
713, a `fix:` of their own, as plan 66 split issue 640 out:

- `useEnrichmentRun`'s refused seasons survive a cancel and a new start, so
  a fresh review of the same show draws an old Poster refusal.
- A Season choice on a series deleted while its review is open reserves a
  folder named `movie` (the `movieFolder` fallback for an empty title),
  stores the poster into it and answers `failed`, leaving an orphan; before
  log 75 it answered `not-found` and wrote nothing.

## Solution

One round in three groups, each commit leaving the suite green and the
typecheck clean:

1. **The Late reserve in the house's idiom**: `??=` over a settling
   function; the title handed whole; one sentence for `recordMediaFolder`.
2. **The suite's header rewrapped.**
3. **The documents**: the spec's props, the release checklist's step, the
   build's journal entry, and the entry and ticks that close step 57 and
   issue 707.

## Commits

Every commit is `refactor:` (or `docs:` where it says so), titled
`refactor: [poster-pick] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is added, weakened or changes its
claim: the suites already in place (`lateReserve`'s, the
`createEnrichment` suites with `.lateReserve` and `.seasonChoices` among
them, `enrich.mediaFolder`'s, the hook's, `SeasonChoices`') are the proof
that each move kept the behaviour.

### Group 1: the Late reserve in the house's idiom

1. **`lateReserve` memoises through `??=`.** The two answers move into one
   local function that settles the folder (the recorded one when
   `openFolder` opens it, else one reserved and recorded), and the getter is
   `answered ??= settle()`. Its docblock is unchanged: it still reserves at
   most once and nothing until asked, and still throws what `reserveFolder`
   throws, since a throwing `settle` leaves `answered` unset, as the hand
   memo did.

2. **The film and the show handed whole.** `write` passes the `Movie` and
   `writeShow` the `Series` to `lateReserve`, each a `ReservedTitle` as it
   stands; the restated literals go, and the comments above them stay.
   `chooseSeasonPoster` is not touched (issue 713).

3. **`recordMediaFolder` said once.** `Enrich`'s and `LibraryStorage`'s
   docblocks read the same sentence: the title's **Media folder** recorded
   late, over whatever was recorded, the **Late reserve**'s write. No code
   moves.

### Group 2: the suite's header

4. **The late reserve suite's header rewrapped** to the file's 80 columns,
   no word changed. Long `it` titles stay (Out of Scope).

### Group 3: the documents

5. **`docs:` `COMPONENT-SPEC.md`'s Seasons props.** The paragraph's
   closing props gain `seasonPhase(season)` and `seasonRefused(season)`
   after `onChoose(season, path)`, the unit's face, and the Poster refusal
   sentence is rewrapped to the paragraph's width with no word changed.

6. **`docs:` the release checklist knows the Poster pick.** One new step,
   after _A linked series add_ and over a show TMDB knows, added the same
   way by the Show folder pick under **Link** with no art: Sync it alone.
   Its poster, backdrop, Season posters and Stills land in one new folder
   under `%APPDATA%\FamilyFlix\media\`, nothing new appears in its Title
   folder beyond what the Layout fill adds, and its episodes still play from
   where they lie. Pressing a season's poster in the review replaces the
   held tile, with no snackbar.

7. **`docs:` the build's journal entry.** _2026-11-24: Poster pick, the
   build (issues 708 to 712)_, placed before this round's: what each slice
   shipped (the Late reserve for a show, the Frame still guard gone and the
   `not-found` case dropped; the same for a film; the prototype amended;
   `seasonRefused` and the line), the walk's three checks as 712's commit
   records them (the shell in its start shape over a scratch folder, the
   native folder dialog answered from the main process, the `icacls`
   deny-write standing in for a cut network), and the judgement calls a
   later session needs: the reserve asked inside each store's `try`, so a
   refused reserve is an image not stored; one reserve per title pass, and a
   fresh one per Season choice press. Its counts are the ones this plan
   records at `5b9c3cc6`.

8. **`docs:` step 57 is done.** The feature checklist's row reads ✅ Done;
   step 57 becomes one line and a link, as the steps before it (_57. ✅
   **Poster pick**: a synced title's art always lands, and a refused season
   poster says so ([log 75](design-logs/75-poster-pick.md))._), and the
   paragraph that introduced it goes. The dev journal gains this round's
   entry: counts before and after, what each group changed, where the round
   left the plan, and the follow-ups below. The commit's body closes 707.

## Decision Document

- **A lazy, once-only value is `??=` over the function that settles it.**
  The house's sweeps and the movie form's folder already read that way; a
  getter that assigns and returns on each path is the same memo spelled
  longer. A `settle` that throws assigns nothing, so the next ask tries
  again, exactly as the hand memo behaved.
- **A value that already has the shape is passed, not rebuilt.**
  `ReservedTitle` names the three fields the reserve reads, and `Movie` and
  `Series` carry them; the interface stays, as the unit's documented face.
- **A storage method has one description.** `Enrich` and `LibraryStorage`
  describe `recordMediaFolder` in one sentence, as they would any method
  they both declare; the glossary's **Late reserve** is the word for who
  calls it.
- **The spec follows the code.** `COMPONENT-SPEC.md` is a living document
  and names the unit's props as they are; the handoff README is its log's
  moment and stays as written.
- **Behaviour changes go to their own issue.** The two edges found while
  planning are issue 713, a `fix:` with its own RED tests; this round
  moves no behaviour, and its commit 2 leaves `chooseSeasonPoster` for 713.
- **Unchanged, as settled by log 75 or as built:** `lateReserve`'s place in
  enrichment and its signature; `recordMediaFolder` beside `mediaFolderOf`
  and its prepared statements keyed by kind; `storeImage` asking the
  getter inside its `try` and after the image arrived; one reserve per
  title pass; the hook's `refused` set beside `seasonPhase`, and its
  rejection to the caller; the Flow's catch and its comment; `Refusal` as
  the styled line's name and its raw px, as the rest of its styles file
  writes them; the copy; CLAUDE.md; the glossary; the README.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what comes
  out: the folders in the media root and the name recorded on the row
  after a Sync, the outcome a Season choice answers, what the hook answers
  for a season, the words and pressed marks on screen. It never checks how
  a getter memoises or how a docblock is wrapped.
- **No test changes its claim.** Group 1 moves no behaviour a suite can
  see, and the suites are the proof: `lateReserve.test.ts` pins reserving
  once, nothing until asked, and reserving over a gone folder, and
  `createEnrichment.lateReserve.test.ts` pins the one folder per pass for a
  show and a film. Commit 1's swap was run against them before planning
  and reverted. Prior art: sheet in sight's group 1 and header fit's groups
  1 to 4, which changed no test.
- **Groups 2 and 3 touch no shipping code.** The full suite and
  `tsc -b --force` close each group, and `eslint` over the touched files
  ends with no error or warning from this initiative.
- **No walk.** Nothing drawn, fetched or stored changes; 712's walk stands.
  The release checklist's new step is the next release's to run.

## Out of Scope

- **Issue 713**: the refused seasons that outlive a run, and the gone
  series' orphan folder. Each is a visible or on-disk change with its own
  test.
- **A shared refusal line.** `Refusal`, `ErrorLine`, `Failure` and
  `Unreachable` across five features are the same 13px danger sentence
  with different margins and elements. Each is its prototype's line, and a
  molecule for them all is older than this initiative and touches every
  one of them; a follow-up for the journal.
- **The empty arrow in `EnrichmentReview.test.tsx`** (issue 362), and the
  long `it` titles and comment lines in the initiative's suites.
- **The edit routes' own reserve-and-record** in `PATCH /movies/:id` and
  `PATCH /series/:id`: it records at the edit's commit and rolls back with
  it, a different rule from the Late reserve's (log 51), so `lateReserve`
  does not replace it.
- **The handoff README and the glossary's earlier sections**, their logs'
  moments.

## Further Notes

- Groups 1 and 2 are independent; group 1's commits are in any order.
  Group 3's commits 7 and 8 come last, since 8 records this round's
  counts. Issue 713 is independent of every commit here: commit 2 leaves
  `chooseSeasonPoster` alone, and 713 hands it the series whole when it
  lands.
- **Follow-ups for the journal**: issue 713; a shared refusal line, older
  than this step; and the next release runs the checklist's new Poster
  pick step on the installed app.
- Eight commits; the build was one new getter threaded through the Sync and
  one line on a card, and the round is the house's memo and the title in
  hand for that getter, one sentence for its storage write, and the
  documents a closing round always writes.

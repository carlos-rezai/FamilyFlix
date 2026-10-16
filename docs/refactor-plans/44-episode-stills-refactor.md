# Refactor plan: Episode stills — one reading of the still rule, one composition of a frameless Playback, and the docs that close the initiative

> Source initiative: `episode-stills`, issue 380 (step 27).
> Shipped by issues 382–385, RED then GREEN each: 382 `23a0434`/`c70a101`,
> 383 `41a309c`/`723997a`/`bffc8e5`, 384 `effcec0`/`95fc8e8`, 385
> `bd4b3ee`/`0c0a49c`/`003e2ac`.
> Design log: `docs/design-logs/44-episode-stills.md`. PRD:
> `docs/PRDs/44-episode-stills.md` (381). Plan:
> `docs/PRDs/44-episode-stills-plan.md`.
> This is the initiative's closing round. It ticks **Episode stills** and
> closes 380. Filed as issue 386.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`episode-stills` shipped every slice of log 44's implementation plan. The full
suite is green at `003e2ac`: 9589 tests across 571 files. `tsc -b --force` is
clean. `eslint` over every folder the initiative touched is clean.

The four slices were built one at a time by agents that each saw one slice.
The design held: the grab is in `playback/`, the store in `media/`, the rule
in a pure planner, the source server-side only. The seams show in smaller
places. Nothing below is a bug a household would see. Every finding was
checked against the code for this plan. They fall into four families:

- the still rule read twice;
- a domain that refers to itself, and a value rebuilt that already exists;
- one test composition written sixteen times;
- the documents, which still describe step 27 as planned and the Still as
  TMDB's alone.

### 1. The still rule is read twice

- **_A TMDB still replaces a held frame_ is decided in two places.**
  `planEpisode`'s private `planStill` answers `{ kind: 'tmdb' }` when the held
  source is `null` or `'frame'`. Then `writeEpisodes` decides again whether
  the write replaces something: it re-reads
  `stillSources.get(episode.id) === 'frame'`, checks `episode.stillPath !==
null`, and adds `episode.stillPath !== stored`. That last check can never be
  false, because a TMDB still is `.still.jpg` and a frame `.frame.jpg`. The
  pure planner already holds the episode and its held source, so it can say
  what the TMDB still replaces. The loop should only act on that.
- **The two kinds of still are told apart by two ternaries.** The stored name
  is `${stem}.${still.kind === 'tmdb' ? 'still' : 'frame'}.jpg` and the log
  line's mark is `still.kind === 'tmdb' ? '↓' : '▣'`. Both are facts about a
  kind. `createEnrichment` already keeps such facts in a table keyed by the
  union (`STOP_LINES: Readonly<Record<Stop, string>>`).
- **`planSeason`'s docblock quotes a rule that changed.** It says the Season
  poster follows _"The Still's rule: only under Poster, only when none is
  held, never replaced"_. Since log 44 a Still _is_ replaced (a frame by
  TMDB's) and is not always TMDB's. The Season poster's rule did not change,
  so the docblock should state the rule itself rather than borrow the
  Still's. The glossary's **Season plan** row borrows it the same way.

### 2. A domain that refers to itself, and a value rebuilt

- **`createPlayback` became self-referential.** `frame` needs `videoFile`, so
  the domain's literal turned into `const playback: Playback = { … }` with a
  trailing `return playback`, and `frame` calls `playback.videoFile(video)`.
  Every other shared step in the closure is a local the members read:
  `decide`, `lengthOf`, and now `durationOf`. `videoFile` should be one more,
  read by its member and by `frame`, and the literal returned as before.
- **`writeEpisodes` rebuilds a `StoredVideo` it already holds.** It passes
  `{ videoPath: episode.videoPath, videoFolderId: episode.videoFolderId }` to
  `playback.frame`. `Episode extends StoredVideo` (`src/types/series.ts`), and
  the routes, which hold a row, hand `videoFile` the row itself. The importer
  builds a `StoredVideo` only because it has no row yet.

### 3. One test composition written sixteen times

- **The frameless Playback.** Sixteen `createEnrichment` suites each compose
  `createPlayback(sandboxRoot('familyflix-no-frame-'), fixedSlot(null), () =>
null)` just to satisfy the new `playback` dependency. The two frame suites
  spread the same composition and override `frame`. This is what
  `offlineTmdb` exists for on the client's side: _"For the suites that
  compose the router for something else and must still hand it an
  `enrichment/` domain."_ `fixedSlot` is the same idea for the slot. A
  `test-support/` unit belongs beside them.
- **`routes.tmdb.test.ts`'s header is wrong.** It was edited to read
  `createEnrichment({ storage, client, playback })`, which drops `media`, and
  the line runs past the column.
- **The frame-upgrade suite strips the BOM its own way.** Issue 385's RED fix
  changed a literal `/^FEFF/` to `/^\s+/` with a comment. The one precedent,
  `writeBack.test.ts`, spells it `/^﻿/`, which strips the BOM and nothing
  else.

### 4. The library's writer spells _picked_ twice

`series/write` gives a still the series form saves the source `'picked'` in
two statements. The add's insert spells it `input.stillPath == null ? null :
'picked'`. The edit's update spells it `episode.stillPath === null ? null :
'picked'`. Both are one rule — a still saved by the form is picked, and none
has no source — and the edit's comment says it a third time. The edit's
`setEpisodeStill` statement also became a single quoted line past the column,
where the file's other multi-column statements are template literals across
lines.

### 5. The documents

- **CLAUDE.md** and the **README** still carry step 27 and its feature row as
  🔜, and the build order says step 27 _"is next"_. CLAUDE.md's folder tree
  has no `playback/frameArgs/`. The `createPlayback` line does not name
  `frame`. The `createEnrichment` line does not say it takes `playback`
  (`createImporter`'s precedent). The `db/` line stops at migration 13. The
  `library/series/` line's `enrich` does not name `stillSourcesOf`. The
  **Architectural Boundaries** paragraph on `enrichment/` does not say it
  reaches the Playback component only through the injected `Playback`.
- **The glossary** has log 44's five terms. Its **Still** row still reads
  _"An **Episode**'s 16:9 frame from TMDB"_, though a Still is now TMDB's, a
  Frame still or a picked one, by its **Still source**. The **Season plan**
  row borrows the Still's old rule (see 1).

## Solution

One reading of the still rule, in the pure planner. `planEpisode`'s TMDB plan
names the held frame it replaces, and `writeEpisodes` only acts on the plan.
The two kinds of still get a table, `STOP_LINES`' shape. `planSeason` states
its own rule.

`createPlayback` returns its literal again, with `videoFile` a local beside
`decide`. `writeEpisodes` hands `frame` the episode itself.

One test-support unit, `framelessPlayback`, composes the Playback the
enrichment suites need. It is `offlineTmdb`'s twin, and its `frame` can be
scripted for the two frame suites. Two test-file nits follow precedent.

`series/write` spells _picked_ once. The documents learn the feature shipped.

Nothing on the wire, in the schema, on screen or in a Sync's behaviour
changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [episode-stills] issue #386 …`, except where a commit is named
`test:` or `docs:`.

### Group 1 — the Sync's still, one rule

1. **`planEpisode` names what a TMDB still replaces.**
   - `StillPlan`'s TMDB variant becomes `{ kind: 'tmdb'; path; replaces }`.
     `replaces` is the held Frame still's stored path when the held source is
     `'frame'`, and `null` when nothing is held. `planStill` takes the
     episode's held path beside its held source to answer it.
   - `writeEpisodes` removes `still.replaces` after the episode's columns are
     written, as now, when it is not `null` and the TMDB still was stored.
     The second reading of `stillSources`, the `episode.stillPath !== null`
     check and the impossible `!== stored` check go.
   - Covered by `planEpisode.test.ts` (new rows: `replaces` is the frame's
     path under a held frame and `null` with nothing held) and by the
     frame-upgrade suite, which observes the frame file removed, kept after a
     failed image, and never touched under `'tmdb'` or `'picked'`.
2. **One table for the two kinds of still.**
   - `createEnrichment` keeps `STILL_KINDS: Readonly<Record<…, { suffix;
mark }>>` keyed by the plan's two kinds: `tmdb` → `still` and `↓`,
     `frame` → `frame` and `▣`. The stored name and the log line read it.
   - The key type is the plan's kind (`NonNullable<StillPlan>['kind']`),
     exported from `planEpisode` as `StillKind`, so a third kind would fail
     to compile here.
   - Covered by the frame suites' names and `▣` lines, and the series suite's
     `↓` lines.
3. **The episode is its own `StoredVideo`.** `writeEpisodes` hands
   `playback.frame` the episode. Covered by the frame suite, whose
   `framedVideos` reads `videoPath` off each call, and its Linked-video case.
4. **`planSeason` states its own rule.** Its docblock spells the Season
   poster's rule — only under Poster, only when none is held, never replaced,
   never a Decision — and names the TMDB Still as the rule it was modelled
   on, not as the rule it follows. `writeEpisodes`' docblock already names
   the fallback and stays.

### Group 2 — the playback domain

5. **`createPlayback` returns its literal again.**
   - `videoFile` becomes a local beside `decide`, `lengthOf` and `durationOf`,
     with the member's docblock comment kept where the interface carries it.
   - The literal reads `videoFile` as its member and `frame` reads it as a
     local. `const playback` and the trailing `return playback` go.
   - Covered by `createPlayback`'s suites, the frame suite and the linked-video
     suites.

### Group 3 — the tests

6. **`test: [episode-stills] issue #386 the frameless Playback`.**
   - `server/src/test-support/framelessPlayback/` exports
     `framelessPlayback(frame?)`: `createPlayback` over a fresh sandbox,
     `fixedSlot(null)` and no Library folders, with its `frame` replaced when
     one is handed. Its suite holds the two facts a caller relies on: `frame`
     answers `null` unscripted, and answers the scripted one when handed.
     Prior art: `offlineTmdb` and `fixedSlot`, each with its suite.
   - The sixteen enrichment suites' inline compositions and the two frame
     suites' spreads go through it. The `createPlayback`, `fixedSlot` and
     now-unused `sandboxRoot` imports go where nothing else reads them.
   - Route suites that already compose a real `playback` for the router keep
     handing it, since the router needs that one.
7. **`test: [episode-stills] issue #386 two test nits`.**
   - `routes.tmdb.test.ts`'s header names
     `createEnrichment({ storage, client, media, playback })` and is wrapped
     to the column.
   - The frame-upgrade suite strips the BOM as `/^﻿/`,
     `writeBack.test.ts`' spelling, and the comment goes.

### Group 4 — the library

8. **`series/write` spells _picked_ once.**
   - A private `pickedSource(stillPath)` answers `'picked'` for a path and
     `null` for none. The add's insert and the edit's update both read it,
     and the two comments become one docblock on it.
   - `setEpisodeStill` is written as a template literal across lines, like
     the file's other multi-column statements.
   - Covered by `routes.stillSource.test.ts` (picked on add and edit, a held
     source kept, a removed still clearing both) and `db.test.ts`.

### Group 5 — the docs that close the initiative

9. **`docs: [episode-stills] issue #386 the docs know episode stills shipped`.**
   - **CLAUDE.md**:
     - step 27 and the Browse & discover **Episode stills** row go ✅, and
       the build order says step 27 is done;
     - `playback/` gains `frameArgs/` (`FRAME_POINT` and the argv), and the
       `createPlayback` line names `frame` and the **Frame budget**;
     - `enrichment/createEnrichment/` names its `playback` dependency, and
       `planEpisode/` names the `StillPlan`;
     - `db/`'s migration list gains 14, `episodes.still_source`;
     - `library/series/`'s `enrich` names `stillSourcesOf`;
     - `test-support/` gains `framelessPlayback/`;
     - the **Architectural Boundaries** paragraph on `enrichment/` says it
       reaches the Playback component only through the injected `Playback`,
       `createImporter`'s precedent, so it is still not a second domain that
       knows there is an FFmpeg.
   - **README**: step 27 and the feature table row go ✅.
   - **Glossary**: **Still** reads as TMDB's, a **Frame still** or one
     picked in the series form, by its **Still source**. **Season plan**
     states its own rule.
10. **`docs: [episode-stills] issue #386 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 380 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **The still rule lives in `planEpisode`, whole.** It answers what to take
  (TMDB's, a frame, none) and, for TMDB's, what it replaces. `writeEpisodes`
  fetches or grabs, stores, writes, logs and removes, and decides nothing.
  `planSeason`'s split is the precedent: the plan says what is wanted, the
  pass does it.
- **`StillPlan`** becomes `{ kind: 'tmdb'; path: string; replaces: string |
null } | { kind: 'frame' } | null`. `StillKind` is its non-null kind,
  exported beside it. `planEpisode`'s signature does not change: it already
  receives the episode, whose `stillPath` is the held path.
- **`STILL_KINDS`** in `createEnrichment` keys the stored suffix and the log
  mark by `StillKind`, `STOP_LINES`' shape. The `.still.jpg` and `.frame.jpg`
  names and the `↓` and `▣` marks are unchanged.
- **`createPlayback`'s members read locals.** `videoFile` joins `decide`,
  `lengthOf` and `durationOf`. The `Playback` interface does not change.
- **The episode is the `StoredVideo`.** A caller that holds a row hands it
  to `videoFile` or `frame` as it is, and never rebuilds one from its fields.
- **`framelessPlayback(frame?)`** in `server/src/test-support/` is the one
  composition of a Playback that never takes a picture. It is a test double
  under the rung's rule: never imported by shipping code, its own folder and
  suite, no barrel.
- **`pickedSource`** is private to `series/write`. Who wrote a still stays
  the library writer's call: the form's routes do not name a source, as they
  do not today.
- **Nothing on the wire, in the schema, in `src/` or in a Sync's log text
  changes.**

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a returned plan, a stored file, a column, a log line, a response
body. It never asserts which helper ran. This round moves rules and
compositions, not behaviour, so almost every commit is carried by cases that
already exist.

- **The pure planner gets the new rows** (commit 1). `replaces` is part of
  `planEpisode`'s answer now, so its suite states it for a held frame and for
  nothing held. A held `'tmdb'` or `'picked'` still already answers `null`.
  Prior art: the suite's own still rows, and `planSeason.test.ts`.
- **The Sync's behaviour is already pinned.** The frame-still suite covers a
  frame for an unlisted episode and for one TMDB lists without a still, the
  Poster chip, a failed TMDB image, a `null` frame, a failed store, _Stop_,
  season 0, Unmatched and the Linked video. The frame-upgrade suite covers the
  replacement, its failure, no second grab, the untouched sources, the Sync
  gap and the Export. None of their cases changes in Group 1. A suite that has
  to change there is reading an implementation detail, and is fixed in the
  same commit with the reason in the body.
- **`createPlayback`'s suites do not change** in commit 5. The frame suite
  already covers a missing and an unreachable linked video through `frame`,
  and the linked-video route suites cover `videoFile` itself.
- **The new test double gets its suite** (commit 6), as `offlineTmdb` and
  `fixedSlot` have. The suites it replaces compositions in keep every case.
- **`series/write`'s rule** is pinned by `routes.stillSource.test.ts` and
  `db.test.ts`'s migration rows. No new case is needed.
- Every commit runs the full suite and `tsc -b --force`.

## Out of Scope

- **`lengthOf` and `durationOf` in `createPlayback`.** Both read _probe, then
  `mvhd`_. They differ on purpose: `read` already holds a probe and wants `0`
  for none, and `duration` and `frame` probe themselves and want `null`.
  Folding them would make `read` probe twice or `duration` lie with `0`.
- **Where `FRAME_BUDGET_MS` lives.** It sits in `createPlayback` beside
  `collectFrame`, the only reader, as `PROBE_TIMEOUT_MS` sits in `probe`.
  `FRAME_POINT` sits in `frameArgs` because the argv reads it. Both are
  spelled once.
- **Merging the two frame suites' harnesses.** `frameStill` and
  `frameUpgrade` each keep a `world()`, a `knowsTheShow()` and the same small
  readers. Every `createEnrichment` suite keeps its own `world()`, which is
  the established shape. A shared show fixture for the enrichment suites is a
  change to all of them, not to this initiative.
- **The importer's composition of `createEnrichment` in route suites.** Those
  suites already build a real `playback` for the router and hand the same one
  on. That is correct, and stays.
- Anything log 44 put out of scope: frames at import or on demand, season 0,
  a frame point of the household's choosing or a frame picker, black or
  credits detection, frames for films, writing stills to a Library folder, a
  client-side Still source or mark, an Export column.

## Further Notes

- Group 1 is the round's one real move. Each of its commits is covered
  before it changes, by the two frame suites written in 384 and 385.
- Unlike the last four initiatives, this one displaced no docblock. The new
  helpers (`planStill`, `tmdbStill`, `durationOf`, `collectFrame`) each sit
  above or below the function they serve, not between it and its docblock.
- Follow-ups this plan already sees, each for the journal, not this round:
  - one shared show fixture for the `createEnrichment` suites;
  - the follow-ups the TMDB ratings journal entry left open, unchanged by
    this initiative.

# Refactor plan: Single-title Sync — the log's names kept, one hold path, one spelling of a 409, and the docs that close it

> Source initiative: [`single-title-sync`, issue #285](https://github.com/carlos-rezai/FamilyFlix/issues/285)
> Shipped by issue 286 (`d60101d` RED, `e9fc99c` GREEN). Design log:
> `docs/design-logs/33-single-title-sync.md`. Plan:
> `docs/PRDs/33-single-title-sync-plan.md`.
> Filed as issue 287.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`single-title-sync` shipped as one `fix:` slice, as log 33 Q7 ruled. It added
`movieId` to `EnrichmentRun`, made `createEnrichment.start` record it on a
`single` run, gave `useEnrichmentRun` a `movieId` argument, a re-attach rule
and a `waiting` result, added `letGoLine` to `enrichmentView`, drew the line
under Start in `EnrichmentSetup`, and raised the busy notice from
`EnrichmentFlow.onStart`.

Every log-33 ruling was read against the code for this filing. Q1–Q7 hold in
behaviour. One was met differently from its letter and stays:

- **Q5's spread carries a second guard.** The log spells
  `options.scope === 'single' ? { movieId: options.movieId } : {}`. The build
  adds `&& options.movieId !== undefined`. `StartEnrichment.movieId` is
  optional, and the domain can be called without the route (its own suites
  do), so the guard keeps a `movieId: undefined` key off a snapshot.
  `enrichmentBody` already guarantees the id for `single` on the wire, so the
  guard never changes an answer there. It stays.

The slice is small, and so is what it left behind. The pattern earlier rounds
found holds in miniature: names that drifted from the log, a rule spelled
twice inside one function, a test helper copied a fifth time, a suite named
for less than it covers, and the paperwork.

### 1. Two names the log gave and the build changed

- Log 33 Q1 names the predicate `belongsHere(run, movieId)`, and the plan
  lists **Belongs here** among its key models. The build named it `belongs`.
- Log 33 Q4 names the styled line `LetGoNote`, styled like its sibling
  `SourceNote`. The build named it `LetGoLine`, which sits one letter's case
  away from the view function `letGoLine` that words it — the same
  `FileName` / `Filename` pair the export-options round renamed away.

### 2. The hold written twice in `start`

`useEnrichmentRun.start` ends both its success path and its `409` path with
the same `setRun(…)` and `setWaiting(null)`. The rule is one: whatever run
the screen now holds — the one started, or the current one that belongs
here — is held, and the Waiting run is let go.

### 3. Docblocks the slice outgrew

- The hook's own docblock still says the Current run is _read once on mount,
  so a screen opened again re-attaches to a run already going_ — with no word
  of the re-attach rule or the Waiting run, which are now half of what it
  does.
- `belongs`' docblock bolds **belongs here**, the convention for a glossary
  term, but the glossary has no such entry: the rule lives in the
  **Single-title Sync** row.
- `EnrichmentFlow`'s docblock breaks its last single-film sentence across a
  short line (_"Back and Finish both follow the"_).

### 4. A 409 spelled by hand, now nine times

`fakeResponse` answers a Response by status — `okResponse`, `createdResponse`,
`notFoundResponse(error)`, `serverErrorResponse`, `noContentResponse` — but
has no `409`. The slice added two more local spellings (the hook suite's
`busy`, the flow suite's `busyResponse`) beside the hook suite's existing
inline one and `enrichment/api`'s `conflictResponse`. `import-export` spells
the same response five more times (`conflictResponse` thrice, `busyResponse`
twice, one through `new Response`). Nine spellings of one fake, three names.

### 5. The new flow suite named for less than it covers

The slice's flow suite is `EnrichmentFlow.movie.test.tsx`, but the one-movie
suite already exists — it is `EnrichmentFlow.test.tsx` (_setup for one
movie_, _the single-title Sync_, _Back to the movie_). The new suite is about
whose run the flow holds, `?movie=` and no film alike, and its last describe
is the no-film case. Its describes read `EnrichmentFlow ?movie= — …`, where
every sibling suite reads `EnrichmentFlow — …`.

### 6. The docs the initiative owes

- **The dev journal.** No entry for the build and none for this round.
- **The glossary.** The code bolds **let-go line** and **busy notice**, and
  the plan lists both as key models, but neither has a row.
- **CLAUDE.md.** The folder tree's `useEnrichmentRun/` and `enrichmentView/`
  lines describe the hook and the view before the slice. Step 16 and its
  Browse & discover entry are 🔜.
- **README.** Step 16 and its status row are 🔜.

## Solution

Five groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry first, so it describes what
   shipped before this round changes anything.
1. **The comments.** Docblocks that say what the code does now. No behaviour
   changes.
2. **The code's tidies.** The log's two names, and one hold path in `start`.
3. **The tests' tidies.** One `conflictResponse` in `fakeResponse`, and the
   flow suite named for what it covers.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 285 and this issue.

That's eleven commits. No wire, schema, prototype or pixel changes.

## Commits

### Group 0: the record of what was built

1. **The journal's single-title-sync build entry.** A new top entry,
   _Single-title Sync (issue #286)_, using the earlier build entries'
   sections:
   - What shipped: the type, the server record, the hook's rule and
     `waiting`, `letGoLine`, the setup's line and the busy notice — one slice,
     one RED and one GREEN commit, as Q7 ruled.
   - The judgement calls the subagent made alone that the log didn't name:
     - the spread's second guard (kept, see the Problem Statement);
     - `belongs` and `LetGoLine` for the log's names (item 1);
     - the hold written twice (item 2);
     - two more hand-spelled `409`s (item 4);
     - the suite named `.movie` (item 5).
   - What was deliberately not built: everything log 33 rules out.
   - The test and file counts at the end of the build, measured at `e9fc99c`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the comments, nothing else

2. **The slice's docblocks say what is built.**
   - `useEnrichmentRun`'s docblock gains the rule: opened for a film it holds
     only that film's run, and a run in review that is not its own is the
     **Waiting run**, kept apart from the run by the same generation guard.
   - The predicate's docblock stops bolding _belongs here_, which is a
     phrase of the **Single-title Sync** row, not a term of its own.
   - `EnrichmentFlow`'s single-film paragraph is rewrapped to the measure.

   Comments only, no test.

### Group 2: the code's tidies

3. **`belongs` takes the log's name.** It becomes `belongsHere`, as log 33 Q1
   named it. Module-local, so the hook's suite passes unchanged.

4. **The let-go line's furniture takes the log's name.** In
   `EnrichmentSetup.styles`, `LetGoLine` becomes `LetGoNote`, after its
   sibling `SourceNote` and log 33 Q4, so the styled note and the
   `letGoLine` that words it are no longer one letter's case apart. Its
   docblock follows. `EnrichmentSetup`'s suite passes unchanged.

5. **One hold path in `start`.** The start's snapshot, or after a `409` the
   current run that belongs here, is read into one local. A `409` over a run
   that does not belong still rethrows `EnrichmentBusyError`, and any other
   rejection still rethrows. Then `setRun` and `setWaiting(null)` are written
   once. The hook's suite passes unchanged, both `409` describes included,
   which is the proof that nothing moved.

### Group 3: the tests' tidies

6. **`conflictResponse` in `fakeResponse`.** It gains
   `conflictResponse(error = 'A sync is already running')`, a `409` with
   `{ error }`, on `notFoundResponse(error)`'s precedent, and a leaf in
   `fakeResponse.test`. The enrichment feature's four spellings read through
   it: `api.test`'s local `conflictResponse`, the hook suite's inline object
   and its `busy`, and the flow suite's `busyResponse`. Test only; every
   suite passes unchanged.

   The default is the enrichment route's sentence, the newest caller, as
   `notFoundResponse`'s default is the API's most common one. Its docblock
   says so.

7. **`import-export`'s five read through it.** `api.test`, `ImportFlow.test`
   and `useImportRun.test` drop their local `conflictResponse`;
   `LibraryFolders.scan.test` and `useFolderScan.test` drop their
   `busyResponse`. Each passes the importer's own sentence. The one spelled
   through `new Response` is checked to read only `status` and `json()`
   before it moves; if it relies on a real `Response`, it stays and the
   journal says why. Test only; every suite passes unchanged.

8. **The flow suite named for what it covers.**
   `EnrichmentFlow.movie.test.tsx` becomes `EnrichmentFlow.whoseRun.test.tsx`
   with `git mv`, after the RED commit's own words. Its four describes read
   `EnrichmentFlow — …`, the siblings' form: _over a run that is not the
   film's_, _the film's own run_, _Start answered 409_, and _no film, every
   run re-attaches_. Its leaves are unchanged.

### Group 4: the docs that close the initiative

9. **The glossary.** Docs only.
   - **Let-go line** (new): the one line under a **Single-title Sync**'s
     Start while a **Waiting run** has Decisions — _Starting lets go of the
     library sync waiting for review._ or _…another movie's sync…_. Avoid:
     _warning_, _stop notice_.
   - **Busy notice** (new): _A sync is already running._, the `warning`
     Start raises when its `409` comes from a run that is not the film's.
     Avoid: _error_, _conflict toast_.
   - **Waiting run** and **Single-title Sync** read against the final code.
   - Dated notes and dialogue examples are left as history.

10. **CLAUDE.md and the README.** Docs only.
    - CLAUDE.md's folder tree:
      - `useEnrichmentRun/`'s line adds _opened for a film, only that film's
        run re-attaches; another's in review is the **Waiting run**_.
      - `enrichmentView/`'s line adds _the **let-go line**_.
    - CLAUDE.md: step 16 and the Browse & discover entry ✅.
    - README: step 16 and its status row ✅.

    Ticked here, in the refactor's docs, not when 286 closed.

11. **The journal's refactor entry, closing the initiative.** A new top
    entry, _Single-title Sync refactor (issue <this>)_: what each group
    changed, the test and file counts after the round against the build's,
    `tsc -b --force` and `eslint` clean, and what was left (see Out of
    Scope). Its commit closes 285 and this issue.

## Decision Document

- **Names follow the log where the log named them.** `belongsHere` and
  `LetGoNote` are log 33's own names; the build's are not wrong, but the log
  is the record a later reader searches.
- **`belongsHere` stays module-local in the hook**, not in its own folder:
  one caller, no surface of its own (Q1).
- **`LetGoNote` stays on `SourceNote`'s styles** with the `-10px` top margin
  that takes the Stack's gap back. No pixel moves.
- **`start`'s contract is unchanged**: resolves after holding a run; rejects
  with `EnrichmentBusyError` for a `409` over a run that does not belong
  here; rejects with anything else as it came. `EnrichmentFlow.onStart`'s
  catch is untouched.
- **`conflictResponse(error)` joins `fakeResponse`**, the shared Response
  builder by status. One name for the fake `409`, taken from the majority of
  the existing local names. Its default is the enrichment sentence.
- **The server is untouched.** `createEnrichment.start`'s spread, the route,
  `enrichmentBody` and every status code stay as built.
- **No type, wire or prototype change.** `EnrichmentRun.movieId?`,
  `StartEnrichment` and `EnrichmentSetupProps.letGo` keep their shapes.
- **One refactor issue closes the initiative.** The docs commits tick step
  16, on the rule that a feature is done only after its refactor.

## Testing Decisions

- **A good test here asserts what the screen, the wire or the hook's result
  shows**, never the predicate or a styled component's name. Every commit in
  Groups 1–2 is proven by suites that pass unchanged; none of them adds a
  leaf, because none of them changes behaviour.
- **The hook's suite** (`useEnrichmentRun.test`) is the proof for commits 3
  and 5: mount for a film over its own, another film's and a library run;
  the no-film rule; the `409` over a run that belongs and over one that does
  not; and the generation guard over a late mount read.
- **`EnrichmentSetup.test`'s let-go describe** is the proof for commit 4: the
  line under Start, in the source note's 13px faint sans, and absent for
  `null`.
- **`fakeResponse.test`** gains one leaf for `conflictResponse`: status
  `409`, `ok` false, and `json()` answering `{ error }` with the default and
  with a given sentence — `notFoundResponse`'s leaves are the prior art.
- **Commits 6–8 are test-only** and are proven by every touched suite
  passing unchanged, leaf count included.
- After the round: the full `vitest run`, `tsc -b --force` and
  `eslint src server electron .husky`, with the counts in the journal.

## Out of Scope

- **A `movieId` that changes while the flow stays mounted.** The mount
  effect re-reads on a new `movieId` but does not clear a run or Waiting run
  held for the old one. Nothing in the app navigates `/enrich?movie=a` to
  `/enrich?movie=b` without leaving the route, so it is unreachable today.
  The journal names it; it is not fixed here.
- **The flow suites' local `makeRun` builders** (`EnrichmentFlow.test`,
  `.library`, `.writeBack`) predate this initiative and are left; the new
  suite already uses `makeEnrichmentRun`.
- **Making `StartEnrichment` a union by scope**, so `movieId` is required for
  `single` and the spread's guard could go. A type change across the wire
  shape, not a tidy.
- Everything log 33 ruled out: a server-side refusal to replace another
  scope's review, a warning ahead of time for a _running_ Sync, a
  single-title Sync for a series, re-attaching a library flow only to library
  runs.

## Further Notes

- Commit subjects follow `refactor: [single-title-sync] issue #<this> …`,
  `test:` for commits 6–8 and `docs:` for 1 and 9–11. Commits 6–8 are
  `test:` commits on shipping code that already compiles, so the commit gate's
  narrowed typecheck is enough; `tsc -b --force` runs before commit 11.
- No closing keyword appears in a commit body for any issue but 285 and this
  one, and only in commit 11.

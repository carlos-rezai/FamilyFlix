# Refactor plan: Silent waits, the Busy row's lock stated once, the presses guarded where they are drawn, covered rows on the keyed timing, and the docs that close step 51

> Source initiative: `silent-waits`, issue 652 (step 51).
> Shipped by issues 653 to 661: eight slices, RED and GREEN each, and the
> walk and documents slice (`04af00ed` to `6544f21d`).
> Design log: `docs/design-logs/69-silent-waits.md`.
> PRD: `docs/PRDs/69-silent-waits.md` (652). Plan:
> `docs/PRDs/69-silent-waits-plan.md`.
> Handoff: `docs/handoff/handoff-loading-states/`, read as received; no
> prototype is amended.
> This is the initiative's closing round. It ticks **Silent waits** and
> closes 652. Filed as issue #662.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`silent-waits` shipped every phase of its plan. `onLoaderTiming` states the
**Loader timing** once; `useDelayedBusyByKey` times a row per key; the three
hooks that own a row's request answer `rowPhase(id)`; every row or card press
draws a **Busy row**, every bulk and start press a **Busy button**; the movie
form draws the **Form skeleton** while it reads; the **Show folder pick**
reads _Reading folder…_.

At `6544f21d` the full suite has **12673 tests across 871 files, all
passing** (one skipped), and `tsc -b --force` is clean (the build's journal
entry). `eslint` over the files the build touched reports **0 errors and 1
warning**, which the build added.

The design held. What is left is what eight slices built one after another
leave behind: one Busy row written out five times, a lock against a second
press that lives in the flows rather than where the lock is drawn, one
"covered rows" rule written twice, two naming styles for the same hook
results, props the hooks always answer made optional for older tests, a
handful of comments, and the documents. Every finding below was checked
against the code at `6544f21d`. They fall into six families.

### 1. The Busy row: one face, five copies

- **The lock is written by hand at five roots.** The Decision row's card,
  the Problem row's card, the **Folder row**, each **Season choice**'s card
  and the _＋ Add show folder_ row each compute `locked = busy !== 'idle'`
  and spell `inert={locked || undefined}` and `aria-busy={locked ||
undefined}` beside the `$busy` that the shared `busyRow` css reads. The
  shared helper paints the shown face; the lock that goes with it, the
  other half of the same glossary term, is copied.
- **The row loader's size is a literal five times.** Each site draws
  `LogoLoader size={18} inline`; the 18px is the handoff's _Inside a row_
  (table row 5), named nowhere.
- **Three rows track their press three ways.** Each of the Decision row,
  the Problem row and the Folder row declares a `Press` union, a
  `PRESS_LABELS` table, a `useState<Press | null>` and a wrapper that
  records the press before reporting it. The Problem row wraps through a
  generic `pressed(which, report)`; the Decision row and the Folder row
  write each wrapper inline, two of them as named `skip` and `search`
  closures. Each then repeats `busy === 'shown' && press !== null ?
<LogoLoader …/> : <slot/>`.

### 2. A second press is refused in the wrong place

- **The flows guard each press against its own lock.** `EnrichmentFlow`
  opens five row handlers with `if (rowPhase(id) !== 'idle') return`, its
  Season choice handler with the same on `seasonPhase`, _Skip all_ with
  `skippingAll`, and Start with `starting`. `ImportFlow` does the same for
  five row handlers, both bulk handlers (each checking both bulk phases)
  and _Start import_. `FolderListEditor` wraps each Folder row press in
  `if (idle)`; `LibraryFolders` wraps each scan in `if (!held)`. That is
  sixteen copies, each with its own comment, one of which says the guard is
  there _where `inert` is not honoured_.
- **Log 53 never needed them.** A **Busy button** refuses its own press
  (`Button` drops `onClick` while busy), so every dialog and form of step 36
  calls its hook bare. The start, scan and bulk guards above sit in front of
  a Busy button or a disabled one and can never fire. The row guards fire
  only where `inert` is not honoured (jsdom), because the row draws the lock
  but does not keep it.
- **The one real cross-lock lives in the flow.** While _Import all as
  guessed_ runs, the Import review's _Skip all_ is not busy and could send;
  `ImportFlow` stops it. `ImportReview` already half-knows this: its
  `skipManyFrom` refuses to move `skipFrom` while either bulk runs, then
  reports the press anyway.
- **The _＋ Add show folder_ row is locked by `inert` alone**, so in jsdom
  a second press would open a second dialog over a read in flight.

### 3. Covered rows: one rule, two copies

- **"A bulk press hands every row it covers `waiting`" is written twice.**
  `useEnrichmentRun` and `useImportRun` each hold a `covered` set beside
  their keyed timing and wrap `phaseOf` in an identical `rowPhase` that
  answers `waiting` for a covered id. `useImportRun` names the cover as
  `coverWhile(ids, send)`; `useEnrichmentRun` writes the same
  `setCovered` / `try` / `finally` inline in `skipMany`. The glossary's
  **Row phase** says the rule is the keyed timing's; the code says it is
  each run hook's.

### 4. Two styles for a hook's results

- **Every caller of `useDelayedBusy` before this build destructures it**:
  `{ phase: deleting, run }`, `{ phase: clearing, run: runClear }`.
  `useLibraryFolders` and `useFolderScan` kept that. The two run hooks
  instead keep the hook whole and pull its parts out on separate lines
  (`const starts = useDelayedBusy(); const timeStart = starts.run;`), five
  times, naming the runner `time*` where the rest of the app says `run*`,
  and return `starts.phase` and `bulk.phase` from objects named for neither.

### 5. Props the hooks always answer, made optional

- **Twelve props are optional with an `idle` default** although their one
  shipping caller always passes them: each row's `busy`; the reviews'
  `rowPhase`, `seasonPhase`, `skippingAll`, `importingAll`; the setups'
  `starting`; `SeriesFormFiles`' `readingShowFolder`. They were made
  optional so the suites written before the build needed no edit, which
  leaves `rowPhase?.(id) ?? 'idle'` at four call sites and docblocks ending
  _`idle` when left out_. `FolderListEditorProps` goes further: it `Omit`s
  `rowPhase` from `LibraryFoldersState` only to add it back optional. Log
  53's own props (`adding`, `saving`, `deleting`) are required.

### 6. Comments, a lint warning and the documents

- **Five docblock lines the build added run past 80 columns** (Prettier
  leaves comments alone): `Button`'s `label`, `EnrichmentReview`'s
  `rowPhase`, `ImportReview`'s `skippingAll` and `importingAll`, and
  `LoadingForm`'s `FIELD_ROWS`. `useEnrichmentRun`'s `search` docblock was
  cut short mid-sentence when its first line grew.
- **`useDelayedBusyByKey`'s docblock calls its callers "three run hooks"**;
  `useLibraryFolders` is not a **Run hook**.
- **`ImportReview`'s `skipFrom` comment says the key is `kind` or a group's
  title**; the code's key for the Kind filter is `KIND_SKIP`, the empty
  string.
- **`MovieForm.showFolderReading.test` declares a `READ` it never uses**,
  the one lint warning the build added.
- **The documents**: the feature checklist's row reads _Silent waits_, ⬜
  Planned, and step 51 is 🔜; the README's `hooks/` line names
  `useDelayedBusy` but not its keyed sibling; the glossary's **Busy row**
  says nothing of refusing a press, and its **Row phase** places the
  covered rows on each run hook. The journal's build entry names one
  follow-up: the walk's fetch wrapper as a `test-support/` script.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **The Busy row stated once**: its lock beside its shown face in the
   shared style, its loader's size named there, and one shared
   `useBusyRow` hook for the press a row remembers and refuses.
2. **Presses refused where they are drawn**: every row refuses a press
   while locked, as a Busy button does; the Import review owns its bulk
   cross-lock; the flows, the folder list and the scans call their hooks
   bare again, as log 53's dialogs do.
3. **Covered rows on the keyed timing**: `useDelayedBusyByKey` gains
   `cover`, and both run hooks answer its `phaseOf` as `rowPhase`.
4. **Hook results destructured** as every other caller does.
5. **Required props** where the hook always answers.
6. **Comments and the lint warning.**
7. **The documents**, closing step 51 and issue 652.

## Commits

Every commit is `refactor:` (or `docs:` / `test:` where it says so), titled
`refactor: [silent-waits] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is weakened: where a commit moves a
behaviour, a test pins it at its new home first.

### Group 1: the Busy row stated once

1. **The Busy row's lock beside its face.** The shared busy-row style gains
   `busyRowLock`, a styled-components `attrs` function that turns `$busy`
   into `inert` and `aria-busy` (both absent at `idle`, both present from
   `waiting`), its docblock saying the lock and the shown face are one
   **Busy row**. The Decision row's card, the Problem row's card, the Folder
   row's root, the Season choice's card and the _＋ Add show folder_ rows
   wrapper each take `.attrs(busyRowLock)`; the five call sites drop their
   hand-written `inert` and `aria-busy`, and the `locked` constant where
   nothing else reads it. The wrapper of _＋ Add show folder_ takes `$busy`
   for the lock alone, its button keeps it for the dim, as today. Every
   `inert` and `aria-busy` assertion stays green unchanged.

2. **The row loader's size, named.** The same style module exports
   `BUSY_ROW_LOADER_SIZE` (18), docblocked as the handoff's _Inside a row_.
   The five `LogoLoader size={18} inline` sites read it.

3. **`test:` `useBusyRow` pinned.** A new shared hook's suite, written
   before the hook (a RED commit, the build commit's pair): given a phase
   and a label table, `pressed(which, report)` returns a handler that
   records `which` and reports its arguments while `idle`, and reports
   nothing while `waiting` or `shown`; `label` is `null` at `idle` and
   `waiting`, the recorded press's label once `shown`, and `null` once
   `shown` if nothing was recorded.

4. **`useBusyRow`, the press a row remembers and refuses.** In the shared
   `hooks/` (two features use it), beside `useDelayedBusy`:
   `useBusyRow<P extends string>(busy, labels: Record<P, string>)` answers
   `{ pressed, label }`. Its docblock: a **Busy row** refuses a press while
   locked, as a **Busy button** does, and names which press it is working
   on. Unused by shipping code yet; the suite goes GREEN.

5. **The Decision row on `useBusyRow`.** A test first, in the row's busy
   suite: a row handed `waiting` reports no pick, search, apply, skip or
   keep-all when pressed. Then the row drops its `press` state and its
   `skip` and `search` closures; every press goes through `pressed`, and
   the kind dot's slot draws the loader when `label` is not `null`. Its
   `Press` union and `PRESS_LABELS` table stay its own (log 69 Q5: which
   press it was is the row's).

6. **The Problem row on `useBusyRow`.** The same test for its presses
   (_Import as_, a picked folder, _Take out_, _Apply choices_, _Skip_,
   _Keep all mine_), then its local `pressed` helper and `press` state go
   for the hook's.

7. **The Folder row on `useBusyRow`.** The same test for ✕ and _Bring
   back_, then its `press` state and two inline wrappers go for the hook's.
   `FolderListEditor` drops its `idle` constant and the `if (idle)` in
   front of each press; its `LibraryFolders.busyRows` flow test stays
   green.

8. **The Season choice and _＋ Add show folder_ refuse while locked.** Each
   has one press and one label, so neither takes the hook. A test first in
   each busy suite (a locked season's card reports no choice; a reading
   _＋ Add show folder_ reports no press), then `SeasonChoices` returns
   early from a press on a card whose phase is past `idle` (before moving
   `picked`), and `SeriesFormFiles` hands its button `onClick` only at
   `idle`, the shape `Button` uses.

### Group 2: presses refused where they are drawn

9. **`EnrichmentFlow` calls its row presses bare.** The guards in front of
   `dismiss`, `pick`, `apply`, `search` and `chooseSeasonPoster`, with their
   comments and their `rowPhase` / `seasonPhase` dependencies, go. The
   `EnrichmentFlow.busyPresses` and `busyRow` suites, which press a waiting
   row twice and count one request, stay green: the row now refuses.

10. **`EnrichmentFlow`'s Start and _Skip all_ bare.** The `starting` and
    `skippingAll` guards go: each sits in front of a **Busy button**, and
    the start on arrival calls `onStart` once, behind its `decided` ref.
    `busyStart` and `busyBulk` stay green.

11. **`test:` the Import review's bulk cross-lock.** In
    `ImportReview`'s own suite: while `importingAll` is past `idle`, a
    press on the Kind filter's _Skip all_, on _Keep all mine_ or on a
    group's _Skip all_ reports nothing; while `skippingAll` is past `idle`,
    _Import all as guessed_ reports nothing. RED.

12. **The Import review owns the cross-lock.** `ImportReview` reads
    `bulkBusy` (either bulk phase past `idle`); `skipManyFrom` returns
    before recording or reporting while it holds, and _Import all as
    guessed_ goes through the same check. GREEN.

13. **`ImportFlow` calls its presses bare.** The five row guards, the two
    bulk guards and the start guard go, with their comments and
    dependencies. `ImportFlow.busyPresses`, `busyBulk`, `busyGroupSkip` and
    `busyStart` stay green.

14. **`LibraryFolders`' scans bare.** The `if (!held)` in front of each
    `scan` goes: both buttons are disabled while `held`, the pressed one
    busy. `LibraryFolders.busyScan` and `useFolderScan.busy` stay green.

### Group 3: covered rows on the keyed timing

15. **`test:` `useDelayedBusyByKey` covers keys.** In its suite: during
    `cover(keys, work)` every covered key reads `waiting`; a covered key's
    own `run` reads its own phase; every key is released once `work`
    resolves and once it rejects, the result or error passed through; keys
    outside the cover stay `idle`. RED.

16. **`cover` on `useDelayedBusyByKey`.** A second piece of state, the
    covered keys, set before `work` and cleared in a `finally`; `phaseOf`
    answers a key's own phase, else `waiting` if covered, else `idle`. The
    docblock says a cover locks without timing: the bulk press's button
    carries the loader (log 69 Q10). GREEN.

17. **`useEnrichmentRun`'s _Skip all_ on `cover`.** `skipMany` becomes
    `cover(ids, async () => setRun(await runSkipAll(…)))`, so the run is set
    before the cover lifts, as today. The `covered` state and the
    `rowPhase` wrapper go; `rowPhase` is the keyed hook's `phaseOf`.
    `useEnrichmentRun.bulkPhases` stays green.

18. **`useImportRun`'s bulk presses on `cover`.** The same for `skipMany`
    and `importManyAsGuessed`; `coverWhile`, `covered` and the wrapper go.
    `useImportRun.bulkPhases` stays green.

### Group 4: hook results destructured

19. **`useEnrichmentRun` destructures its timings.**
    `{ phase: starting, run: runStart }`, `{ phase: skippingAll, run:
runSkipAll }`, `{ phaseOf: rowPhase, run: runRow, cover }` and
    `{ phaseOf: seasonPhaseOf, run: runSeason }`; the `starts`, `bulk`,
    `rows` and `seasons` objects and every `time*` name go, and the return
    object lists `starting` and `skippingAll` by shorthand.

20. **`useImportRun` destructures its timings.** The same, with
    `{ phase: importingAll, run: runImportAll }`.

### Group 5: required props

21. **Each row's `busy` is required.** The Decision row, the Problem row
    and the Folder row; their test renders that omitted it pass `'idle'`,
    and the reviews and `FolderListEditor` hand it as they do now.

22. **The reviews' phases are required.** `EnrichmentReview`'s `rowPhase`,
    `seasonPhase` and `skippingAll`; `SeasonChoices`' `seasonPhase`;
    `ImportReview`'s `rowPhase`, `skippingAll` and `importingAll`. The
    `?.(id) ?? 'idle'` reads and the defaults go; the suites rendering
    them pass an idle phase.

23. **`FolderListEditorProps` takes `rowPhase` as the hook answers it.**
    The `Omit` drops `'rowPhase'`, and the re-declared optional prop goes.

24. **The setups' and the files card's phases are required.**
    `EnrichmentSetup`'s and `ImportSetup`'s `starting`; `SeriesFormFiles`'
    `readingShowFolder`.

### Group 6: comments and the lint warning

25. **Docblocks.** The five long lines rewrapped; `search`'s docblock made
    whole; `useDelayedBusyByKey` names its callers as the hooks that own a
    row's request and documents `cover`; the _`idle` when left out_ tails
    gone with the defaults; the `skipFrom` comment names `KIND_SKIP`; each
    Busy row's docblock (the three rows, `SeasonChoices`) says it refuses a
    press while locked.

26. **`test:` the unused `READ` goes** from
    `MovieForm.showFolderReading.test`. `eslint` over the touched files is
    clean.

### Group 7: the documents

27. **`docs:` the glossary and the README.** **Busy row**: _refuses a press
    while locked, as a **Busy button** does_, and `useBusyRow` named.
    **Row phase**: a bulk press covers its rows on `useDelayedBusyByKey`'s
    `cover`. The README's `hooks/` line names `useDelayedBusyByKey` and
    `useBusyRow`.

28. **`docs:` step 51 is done.** The feature checklist's row reads ✅ and
    step 51 ✅, its _One timing_ bullet naming `cover` and `useBusyRow`;
    the dev journal gains this round's entry (counts before and after, what
    each group changed, the follow-up left alone). The commit closes 652.

## Decision Document

- **The Busy row is one unit of style and one of behaviour.** Its face and
  its lock live together in the shared busy-row style (`busyRow` for the
  shown face, `busyRowLock` for `inert` and `aria-busy`), as an `attrs`
  function, not a component: log 69 Q15 adds no `prim.*` or `mol.*`, and a
  molecule would want a `COMPONENT-SPEC.md` row and a prototype.
- **`useBusyRow` is a shared hook**, `src/hooks/` (enrichment and
  import-export both use it): `useBusyRow<P>(busy, labels)` answers
  `pressed(which, report)` and `label: string | null`. The label table
  stays each row's own; the phase stays the owning hook's (log 69 Q5, Q7).
  A single-press card (a Season choice, _＋ Add show folder_) refuses
  inline instead, as `Button` does.
- **A press is refused where its lock is drawn.** A Busy button refuses by
  dropping `onClick`; a Busy row by `useBusyRow`; the flows and pages call
  their hooks bare, as every dialog and form of log 53 does. The rows'
  refusal is what `inert` already does in Chromium; it adds nothing a user
  can see.
- **The Import review owns its bulk cross-lock**, `bulkBusy`, because it
  draws all three bulk buttons. No button changes face: the other bulk
  buttons are not drawn disabled, only refuse (a visible disabled face
  would be a product change, and log 53 Q9 reserves it for unavailable,
  not working).
- **`useDelayedBusyByKey` answers `phaseOf`, `run` and `cover`.**
  `cover<T>(keys, work)` holds every key at `waiting` while `work` runs,
  untimed, and passes its result or error through; a key's own run wins
  over its cover. The **Row phase** is `phaseOf` itself, in every hook.
  Log 69 Q8's two members keep their signatures.
- **A bulk press sets the run inside its cover**, so the rows unlock in the
  same render the run redraws them, as today.
- **Hook results are destructured at the call**, `run*` for a runner, the
  glossary's phase name for a phase, as `useDeleteMovie` and
  `useLibraryTitles` do.
- **A prop the hook always answers is required.** Optional props with an
  `idle` default stay only on `Button`, a primitive with callers that are
  never busy.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what the
  household would see or be able to press: whether a press reports, what
  is drawn at `waiting` and `shown`, how many requests a held route
  receives. It never checks which helper ran.
- **Every existing suite stays green unchanged** except where a commit says
  otherwise: the renders that pass a now-required prop (Group 5) and the
  unused `READ` (commit 26). The flow suites that press a waiting row twice
  are the proof that moving the refusal into the rows kept the behaviour.
- **New tests**: `useBusyRow`'s suite (prior art: `useDelayedBusy.test.ts`,
  `renderHook` with a rerendered phase); `cover` in
  `useDelayedBusyByKey.test.ts` (its own `deferred` helper and fake
  timers); a locked row reports no press, in `DecisionRow.busy`,
  `ProblemRow.busy`, `FolderRow.busy`, `SeasonChoices.busy` and the
  `MovieForm.showFolderReading` suite; the bulk cross-lock in
  `ImportReview`'s suite (prior art: `ImportFlow.busyGroupSkip.test.tsx`).
- **The style helper** has no suite of its own: the rows' `inert` and
  `aria-busy` assertions pin it through every caller.
- **No walk.** Nothing drawn changes; the build's walk stands. The full
  suite and `tsc -b --force` close each group.

## Out of Scope

- **Renaming `onLoaderTiming`.** An `on` prefix reads as an event prop
  elsewhere in the app, but log 69 Q8 named it and the glossary carries it;
  a rename wants a grill, not a refactor.
- **The walk's fetch wrapper as a `test-support/` script** (the journal's
  one follow-up). One walk used it, and `heldFetch` already serves the
  suites; it is built when a second walk needs it.
- **A molecule for the row loader** (log 69 Q15), a failure face for a
  refused row press (log 69 Q1), and drawing the other bulk buttons
  disabled.
- **The Show folder read's ad hoc `held` outcome** in `useShowFolderPick`:
  it is the shape of the second round trip that log 48's follow-up (the
  held series' title on the read) would remove, a grill of its own.
- **`useFolderScan.scan` without `useCallback`** and every long comment
  line the build did not add: older than this initiative.
- **`useMovieForm`'s `answered` by job identity**: it holds, `job` being
  memoised, and the Form skeleton suites pin it.

## Further Notes

- Groups 1 and 2 must land in order: a flow guard goes only after the row
  that replaces it refuses, so the suite stays green at every commit.
  Groups 3 to 6 are independent of each other.
- The commit count is high because every lock moves with its own test
  first; any adjacent pair may be squashed if a pair turns out trivial.

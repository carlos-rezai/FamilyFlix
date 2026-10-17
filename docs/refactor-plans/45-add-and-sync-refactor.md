# Refactor plan: Add and sync — one leaving for the add, one reader of the flow's query, each caller's own hint, and the docs that close the initiative

> Source initiative: `add-and-sync`, issue 391 (step 28).
> Shipped by issues 392–395: 392 the prototype revision `c47f6e5`, then RED
> and GREEN each — 393 `82d50c7`/`f7c8a14`, 394 `39d6ab5`/`eec3201`, 395
> `459fd1b`/`cd72732`.
> Design log: `docs/design-logs/45-add-and-sync.md`. PRD:
> `docs/PRDs/45-add-and-sync.md` (391). Plan:
> `docs/PRDs/45-add-and-sync-plan.md`.
> This is the initiative's closing round. It ticks **Add and sync** and
> closes 391. Filed as issue 396.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`add-and-sync` shipped every slice of log 45's implementation plan. The full
suite is green at `cd72732`: 9681 tests across 579 files. `tsc -b --force` is
clean. `eslint` over every folder the initiative touched reports no errors,
and its 14 warnings are all in a suite the initiative did not touch
(`loadFormRecord.test.ts`).

The three build slices were built one at a time by agents that each saw one
slice. The design held: the form starts no Sync, every start rule stays in
the flow's `onStart`, nothing moved on the server. The seams show in smaller
places. Nothing below is a bug a household would see, except one line of copy
(section 3). Every finding was checked against the code for this plan. They
fall into four families:

- the add's leaving written twice;
- the flow's query read by hand, and a rule re-spelled;
- the box's words, one of them off the prototype;
- the documents, which still describe step 28 as planned.

### 1. The add's leaving is written twice

- **Two copies of one leaving.** `useMovieForm`'s `save`, in its `add` case,
  holds two near-identical `.then` bodies, one for `createSeries` and one for
  `createMovie`. Each checks `showEnrich && enrich`, replaces `/add` with the
  title's page, pushes `enrichPath({ …, start: true })` and returns, or else
  pushes its kind's **Fresh home**. The only difference is the kind: its page
  (`moviePath` / `seriesPath`), its `enrichPath` key (`movie` / `series`) and
  its Fresh home (`/` / `seriesTabPath()`). Every other job's leaving is one
  short line (`goBack()`), and every job's **Landing** is already one pure
  function, `formLanding(job)`, in `formJob` beside `ADD_LANDING`. The add's
  leaving is a fact about the kind, the new id and the box. It belongs beside
  `formLanding` as a pure function with its own rows, not in two closures.
- **The Fresh homes live away from the add's Landing.** `FRESH_HOME` and
  `SERIES_FRESH_HOME` are constants in `useMovieForm`. `ADD_LANDING`'s own
  docblock, in `formJob`, contrasts itself with "the library, which is where a
  _finished_ add goes". The two halves of that sentence live in two files.
- **A stale comment.** The `add` case still opens with "Each kind's **Fresh
  home**, pushed", which is now true only with the box off.
- **The box's state is split.** `enrich` and `toggleEnrich` are declared
  under `showKindTabs`. `showEnrich` is declared fifteen lines later, under
  `kind`. Both flags read the same fact, `job.kind === 'add'`, in two
  separate expressions.

### 2. The flow's query is read by hand, and a rule is re-spelled

- **Four hand reads of a query one unit writes.** `enrichPath` writes
  `scope`, `movie`, `series` and now `start=1`. `EnrichmentFlow` reads them
  back with four `params.get('…')` literals, and `'1'` is now spelled in both
  files. The codebase's precedent for a query the app writes and reads is a
  pair: `parseLibraryQuery` / `parseGenreQuery` for the browse queries, and
  `formJob` reading the form's parameters through exported names. Closest of
  all, `movieFormPath` keeps its reader-side rule, `opensSeriesResolve`, in
  the same unit as the writer. The Enrichment flow's query has a writer and no
  reader.
- **The arrival drops `start` by editing the search params.** It copies
  `params`, deletes `start` and calls `setParams(next, { replace: true })`.
  Log 45 Q9 says it replaces the URL with "the same `enrichPath` minus
  `start`". The one writer of the route should write that URL too.
- **The press re-spells the Let-go line's rule.** The arrival presses when
  `run === null && (waiting === null || waiting.decisions.length === 0)`. The
  second half is word for word the first line of `letGoLine`, which answers
  `null` in exactly that case. Log 45 Q10 and the glossary state the rule as
  "never pressed over a **Let-go line**". The code should read the line, so
  the two can never drift apart.

### 3. The box's words

- **The Library folders page draws the import's hint, not its own.** The
  prototype has always given the page's group Scan its own keyed hint: _Runs
  straight after the scan, over everything it brings in. Needs the
  internet._ (`FamilyFlix.dc.html`, the Library folders model, before and
  after revision 392). Before this initiative the card had one hard-coded
  keyed hint, so the page could only draw the import's. That was a fidelity
  gap that `keyedHint` now makes free to close. Instead the build exported
  `IMPORT_ENRICH_HINT` from `ImportSetup.tsx` and imported it into
  `LibraryFolders.tsx`. That export is a component file handing a sentence to
  a sibling. The form's own hint, `ENRICH_HINT`, is a private constant in the
  caller, which is the shape "the keyed hint is the caller's" asks for.
- **The prototype names the same prop two ways.** The Import setup and
  Library folders models call it `keyedHint`, as `mol.EnrichCheckCard` does.
  The Movie form's model calls it `enrichHint`, and `feat.MovieForm.dc.html`
  binds `keyed-hint="{{ form.enrichHint }}"`.
- **Stale docblocks.**
  - `EnrichCheckCard` still says it is drawn "from `feat.ImportFlow.dc.html`".
    Since 392 it is `mol.EnrichCheckCard.dc.html` 1:1, and every other
    graduated molecule's docblock names its `mol.*` file (`FieldDiff`'s
    precedent).
  - The key-less hint's docblock points at `enrichHint`, the old prototype
    name.
  - `useKeyStored` still names two callers, "Import setup and … the Library
    folders page". It has three, and is now a global hook.
  - `enrichPath`'s docblock lists four routes and "four features". It now
    writes `&start=1` and has a fifth caller, the Movie form.

### 4. The documents

- **CLAUDE.md** and the **README** still carry step 28 and its feature row as
  🔜, with step 28's "to settle in the grill" text.
- CLAUDE.md's folder tree:
  - lists `EnrichCheckCard/` and `useKeyStored/` under
    `features/import-export/`, and neither under `components/` or `hooks/`;
  - its `enrichPath/` line stops at `?movie=<id>`;
  - the `movie-form/`, `formJob/`, `useMovieForm/`, `EnrichmentFlow/` and
    `useEnrichmentRun/` lines say nothing of the box, the add's leaving,
    **Started on arrival** or `attaching`.
- **The glossary** has log 45's two terms. Its **Fresh home** row already
  says "with **Add and sync** off". Its **Leaving** row still says every
  leaving is a **History step** "except the three **Fresh homes**". Add and
  sync's leaving is a third shape, a replace and then a push, and the row
  should say so.

## Solution

One pure function decides the add's leaving: `addLeaving(kind, id, sync)` in
`formJob`, beside `formLanding`, with the two Fresh homes moved beside
`ADD_LANDING`. The save's `add` case becomes one create chosen by kind and
one `.then` that follows the leaving.

The Enrichment flow's query gets its reader, `parseEnrichQuery`, in the same
unit as `enrichPath` and held to it by a round trip. The flow reads the query
once, drops `start` by writing `enrichPath` without it, and presses only when
`letGoLine(waiting)` is `null`.

Each `EnrichCheckCard` caller keeps its own keyed hint as a private constant.
The Library folders page draws the prototype's scan sentence. That is the
round's one visible change, a `fix:`. The prototype names the prop
`keyedHint` everywhere. Four docblocks catch up, and the documents learn the
feature shipped.

Nothing on the wire, on the server, in the schema, in the journey or in the
flow's start rules changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [add-and-sync] issue #396 …`, except where a commit is
named `fix:`, `test:` or `docs:`.

### Group 1 — the add's leaving, once

1. **`addLeaving` in `formJob`.**
   - `formJob` gains `addLeaving(kind, id, sync)` → `{ replace: string |
null; push: string }`:
     - with `sync` off, `{ replace: null, push }`, where `push` is the kind's
       Fresh home: `/` for a movie, `seriesTabPath()` for a series;
     - with `sync` on, `replace` is the title's page (`moviePath(id)` /
       `seriesPath(id)`) and `push` is
       `enrichPath({ movie | series: id, start: true })`.
   - `FRESH_HOME` and `SERIES_FRESH_HOME` move from `useMovieForm` into
     `formJob`, beside `ADD_LANDING`, as private constants. The docblock on
     `addLeaving` says what `ADD_LANDING`'s already implies: the Landing is
     where Back goes, and the leaving is where a finished add goes.
   - `formJob.test.ts` gains four rows: two kinds × the box, ids encoded
     through the path utils as everywhere else.
   - The hook does not read it yet. This commit only adds the function.
2. **The save follows the leaving.**
   - The `add` case becomes one create chosen by kind (`createSeries(values,
episodes, seasonPosters)` or `createMovie(values)`, both answering a
     record with an `id`) and one `.then` that reads
     `addLeaving(kind, id, showEnrich && enrich)`. It replaces with
     `replace` when that is not `null`, then pushes `push`.
   - The two duplicated bodies, their comments and the stale "Each kind's
     Fresh home, pushed" go. One comment says the add's leaving is
     `addLeaving`'s.
   - `showEnrich && enrich` stays as the argument. A gone record falls back
     to the add without being the `add` job, and the box was never drawn
     there.
   - Covered by `MovieForm.enrich.test.tsx` and
     `MovieForm.enrichSeries.test.tsx` (the replace then the push, the
     navigation types, a refused save going nowhere) and by `MovieForm.test.tsx`
     (each kind's Fresh home).
3. **The box's state in one place.**
   - One `plainAdd` local (`job.kind === 'add'`) is read by `showKindTabs`
     and `showEnrich`. `showEnrich`, `enrich` and `toggleEnrich` are declared
     together under one comment, the log's "off on every mount, kept across a
     switch of Form kind".
   - The result interface does not change. Covered by the same suites.

### Group 2 — the flow's query, read once

4. **`parseEnrichQuery` beside `enrichPath`.**
   - `enrichPath`'s unit exports `parseEnrichQuery(params)` → `EnrichQuery`,
     the writer's mirror. `movieFormPath` / `opensSeriesResolve` is the
     precedent for a reader-side rule in the writer's unit, and
     `parseLibraryQuery` for the name.
   - It reads:
     - `scope` only when it is `all`;
     - `movie` and `series` as given when present;
     - `start` only when it is `1`.
   - Everything else is ignored. An empty `?movie=` stays an id, as the flow
     reads it today. This is a refactor, not a new rule for hand-edited URLs.
   - It is re-exported from the `utils` barrel beside `enrichPath`.
   - `enrichPath.test.ts` gains the round trip: every shape `enrichPath`
     writes parses back to the query it was written from. It also gains the
     rows for an unknown parameter, a `scope` other than `all` and a `start`
     other than `1`.
5. **The flow reads its query once.**
   - `EnrichmentFlow` reads `parseEnrichQuery(params)` once. `movieId`,
     `seriesId`, the `scope=all` reads (`libraryScope`'s initial state and
     `fromImport`) and `startOnArrival` read its fields. The four
     `params.get` literals go.
   - Covered by every `EnrichmentFlow.*` suite: the library and `fromImport`
     suites for `scope`, the series and whose-run suites for the single
     title, `startOnArrival` for `start`.
6. **The arrival drops `start` through `enrichPath`.**
   - The replace becomes `navigate(enrichPath(query without start), {
replace: true })`, the URL log 45 Q9 names. `setParams` and the
     hand-built `URLSearchParams` go, and `useSearchParams` reads `params`
     alone again.
   - A parameter the flow does not read is no longer carried across the
     replace. Nothing writes one, so nothing observable changes. This commit
     body says so.
   - Covered by `EnrichmentFlow.startOnArrival.test.tsx`: the URL replaced
     without `start` for the film and the series, the navigation type, and no
     second Sync on a step back or a reload.
7. **The arrival reads the Let-go line.**
   - The press becomes `run === null && letGoLine(waiting) === null`. The
     comment and the flow's docblock say "never pressed over a **Let-go
     line**", the glossary's words.
   - Covered by the arrival suite: a Waiting run with Decisions is not
     pressed and its line is drawn, a Waiting run with none is pressed, and
     the title's own run is not pressed.

### Group 3 — the box's words

8. **`fix: [add-and-sync] issue #396 the scan's own hint`.**
   - The Library folders page passes its own keyed hint, the prototype's
     _Runs straight after the scan, over everything it brings in. Needs the
     internet._, as a private constant in `LibraryFolders`, the way the form
     keeps `ENRICH_HINT`.
   - `IMPORT_ENRICH_HINT` stops being exported from `ImportSetup` and becomes
     a private constant there, and `LibraryFolders` no longer imports from
     `ImportSetup` for it.
   - `LibraryFolders.scan.test.tsx` asserts the scan sentence in the same
     commit. `ImportSetup`, `ImportFlow` and the card's own suites keep the
     import's sentence.
   - The body cites `FamilyFlix.dc.html`'s Library folders model and says the
     gap predates the initiative (step 14). The card's single hard-coded
     hint is what kept it there.
9. **Four docblocks catch up.**
   - `EnrichCheckCard`: `mol.EnrichCheckCard.dc.html` 1:1, `FieldDiff`'s
     opening shape, its three callers named, and the key-less hint's
     docblock no longer pointing at `enrichHint`.
   - `useKeyStored`: the read the card's hint is chosen by, wherever it is
     drawn: Import setup, the Library folders page and the Movie form's plain
     add.
   - `enrichPath`: `&start=1` beside `movie` or `series`, **Started on
     arrival**, and the Movie form's **Add and sync** as its fifth caller;
     `parseEnrichQuery` named as its reader.
   - `useEnrichmentRun`'s `attaching`: why it exists — Started on arrival
     cannot decide before it knows whose run is held — in the shape
     `useImportRun`'s `attaching` docblock uses.
10. **`docs: [add-and-sync] issue #396 one name for the keyed hint`.**
    - `FamilyFlix.dc.html`'s Movie form model calls it `keyedHint`, and
      `feat.MovieForm.dc.html` binds `keyed-hint="{{ form.keyedHint }}"`,
      as the Import setup and Library folders models already do.
    - No pixel changes.

### Group 4 — the docs that close the initiative

11. **`docs: [add-and-sync] issue #396 the docs know add and sync shipped`.**
    - **CLAUDE.md**:
      - step 28 goes ✅. Its text becomes what shipped: the box on a plain
        add of either kind, off on every mount; a ticked save replaces
        `/add` with the title's page, then pushes the flow **Started on
        arrival**; never pressed over a Let-go line; nothing on the server.
        The build order's sentence names step 28 as done.
      - the Maintainer tools **Add and sync** row goes ✅.
      - the folder tree:
        - `components/` gains `EnrichCheckCard/` (graduated, `keyedHint` the
          caller's), and `features/import-export/`'s molecules line loses it;
        - `hooks/` gains `useKeyStored`, and `features/import-export/` loses
          it;
        - `enrichPath/` names `?series=<id>`, `&start=1` and
          `parseEnrichQuery`;
        - `movie-form/`, `formJob/` (`addLeaving`) and `useMovieForm/` (the
          box) name Add and sync;
        - `EnrichmentFlow/` names Started on arrival, and `useEnrichmentRun/`
          names `attaching`.
    - **README**: step 28 and its feature table row go ✅.
    - **Glossary**: the **Leaving** row names Add and sync's leaving as the
      one shape that is neither a History step nor a Fresh home, a replace
      onto the title's page and then a push onto the flow.
12. **`docs: [add-and-sync] issue #396 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 391 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **The add's leaving is `formJob`'s, whole.** `formLanding(job)` answers
  where Back goes, and `addLeaving(kind, id, sync)` answers where a finished
  add goes. Both are pure, live beside the job reader, and have rows in its
  suite. `useMovieForm` creates and navigates, and decides nothing about
  where. The other four jobs' leavings stay `goBack()`, since each is one line
  and a step.
- **`addLeaving`'s shape** is `{ replace: string | null; push: string }`.
  This is not a union of named cases. The hook only ever replaces when told,
  then pushes, and the two shapes the log names (Fresh home; title page then
  flow) are both instances of it.
- **The Fresh homes move to `formJob`** as private constants beside
  `ADD_LANDING`. `seriesTabPath` stays the series one's spelling.
- **`parseEnrichQuery` lives in `enrichPath`'s unit**, `movieFormPath`'s
  precedent for a writer and its reader-side rule together. It is not a new
  `utils/` folder. It returns `EnrichQuery`, the writer's own type, so a fifth
  parameter added to one and not the other fails the round-trip suite. It
  keeps today's reading exactly, including an empty id.
- **The flow writes its own URL through `enrichPath`.** Dropping `start` is
  `enrichPath` over the parsed query without `start`, replaced. No
  hand-edited `URLSearchParams` stays in the flow.
- **Started on arrival reads `letGoLine`.** The press rule is "no run here,
  and no Let-go line". The line's own rule (no Decisions, no line) is spelled
  once, in `enrichmentView`.
- **Each caller owns its keyed hint**, as a private constant: the form's,
  Import setup's (the import's sentence) and the Library folders page's (the
  scan's, per the prototype). Nothing exports a hint sentence. The key-less
  hint stays the card's.
- **The one behaviour change is copy**: the Library folders page's keyed hint
  reads _after the scan_. It ships as a `fix:` commit, because the prototype
  is the spec and the PRD's "the import's sentence on both" missed it.
- **Nothing on the wire, the server, the schema, the start rules or the
  journey changes.** `EnrichCheckCardProps`, `UseMovieFormResult`,
  `EnrichmentRunState` and `EnrichQuery` keep their shapes.

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a returned path, a URL, a navigation type, a request posted, a
sentence drawn. It never asserts which helper ran. This round moves rules,
not behaviour, so almost every commit is carried by cases that already exist.

- **The two pure units get rows** (commits 1 and 4).
  - `addLeaving`'s four rows sit in `formJob.test.ts`, beside
    `formLanding`'s.
  - `parseEnrichQuery`'s round trip and refusals sit in `enrichPath.test.ts`.
    The round trip is the guard that holds the reader to the writer, as
    `spellYearSpan`'s round trip holds the client to `yearSpan`.
  - Prior art: `formJob.test.ts`'s Landing rows, `parseLibraryQuery.test.ts`,
    and `movieFormPath.test.ts`'s `opensSeriesResolve` rows.
- **The journey is already pinned.**
  - `MovieForm.enrich.test.tsx` and `MovieForm.enrichSeries.test.tsx` cover
    the box drawn only on a plain add, off on mount, kept across a kind
    switch, the replace-then-push with its navigation types, a Fresh home
    with the box off, and a refused save going nowhere.
  - `EnrichmentFlow.startOnArrival.test.tsx` covers every case of log 45 Q10:
    the waits on the summary and the arrival read, once only, the URL
    replaced, and no second Sync on a step back or a reload.
  - None of these cases changes in Groups 1 and 2. A suite that has to change
    there is reading an implementation detail, and is fixed in the same
    commit with the reason in the body.
- **The fix changes one assertion** (commit 8). `LibraryFolders.scan.test.tsx`
  expects the scan sentence. Every other suite that asserts the import's
  sentence keeps it.
- Every commit runs the full suite and `tsc -b --force`, and `eslint` over the
  folders it touched.

## Out of Scope

- **`useQueryParamWriter` living in `features/search/`** while `movie-form`
  imports it. This cross-feature import predates the initiative. Moving it to
  `hooks/` is its own change.
- **Merging the two MovieForm enrich suites' harnesses.** Each keeps its own
  `fetch` table and fixtures. That is the established shape of the form's
  split suites (`seriesEdit`, `seriesResolve`, `seasonPosters`), and a shared
  form harness would change all of them.
- **A pure `arrivalPress` helper.** Once it reads `letGoLine`, the press is
  one line over two values the flow already holds. A unit for it would be
  ceremony.
- **The other jobs' leavings.** Each is `goBack()` and a step, so there is
  nothing to fold.
- **Reading an empty `?movie=` or `?series=` as absent.** That would change
  what a hand-edited URL does. `parseLibraryQuery`'s empty-is-absent rule is
  for a cleared search box, not for an id.
- Anything log 45 put out of scope: the box on an edit or a Resolve, a
  background Sync, a year read off the filename, a TMDB search before the
  save, a remembered tick.

## Further Notes

- Groups 1 and 2 are the round's real moves. Each is covered before it
  changes, by the three suites written in 393–395.
- Commit 8 is the only change a household could see. It is filed as a `fix:`
  inside the refactor because the fidelity gap only became cheap to close
  with this initiative's `keyedHint`. Closing it removes the
  `ImportSetup` → `LibraryFolders` export that section 3 names.
- Follow-ups this plan already sees, each for the journal, not this round:
  - `useQueryParamWriter` to `hooks/`;
  - the follow-ups the Episode stills journal entry left open, unchanged by
    this initiative.

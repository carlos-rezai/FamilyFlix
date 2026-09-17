# Refactor plan: Export — the endpoint that waited for it goes, the one GET named like a verb, and the docs that close the initiative

> Source initiative: [`export`, issue #136](https://github.com/carlos-rezai/FamilyFlix/issues/136)
> Shipped by issues 137–139. Design log: `docs/design-logs/14-export.md`.
> Filed as issue 141. The docs-and-glossary slice filed as 140 is folded in
> here as Group 0 and Group 4, on the precedent of 134 into 135, so the
> initiative has one closing issue rather than two and ticks ✅ when this one
> closes.

## Problem Statement

Export was a small initiative — three build slices, one new server unit, one
amended reader, two routes, one new prop on `Modal`, one icon, and a feature
with four new units — and the third driven by `issue-loop`. It works: a press
on the third row of the Settings hub lands `family-library.csv` or
`family-library.xlsx` in Downloads with every movie A–Z, an untouched export
fed back to Bulk import adds nothing, and #139's forty edge tests were green on
arrival. The maintainer's one instruction was the scope — _translate the
prototype 1:1 into the codebase, in its naming and conventions_ — and a
read-through against the prototype finds the surface is the prototype's: the
same pixels, tokens, copy and states, every literal the prototype's own. What
the read-through finds instead is the debt the earlier rounds taught us to
expect, at a third of the size: one name that breaks a convention and is
already being renamed at the import, one endpoint the glossary said to delete
"when export ships", one hole in a sentence the prototype never had to draw,
one docblock that says more than the code does, and test blocks split where
the build was.

### 1. The one GET that is not a `fetch`, and the alias that says so

Every wire call in the app that reads is a `fetch*` — `fetchMovie`,
`fetchPlayback`, `fetchSubtitleCues`, `fetchHomePayload`, `fetchGenrePool`,
`fetchProblem`, `fetchCurrentImport`, and now `fetchExportSummary`. The one
exception is its neighbour: `exportLibrary(format) → Promise<Blob>`, a `GET`
named as the verb the button says. The hook that calls it has an action with
the same name — `exportLibrary()`, the thing the button does — and so imports
the wire call as `fetchExportFile`. The alias is the rename, already chosen,
applied on one side of one import. The design log spelled both names in its
sketch; the build followed the sketch to the letter, and the letter was wrong
by the api folders' own rule.

### 2. `GET /api/movies` has been waiting since log 06, and nothing came

The glossary entry from the genre-page round reads: "`/api/movies` stays as
the generic browse API the exporter will want … If nothing has claimed it by
the time export ships, delete it then." Export shipped reading
`storage.listMovies({ sort: 'a-z' })` directly (log 14 Q7, Q16). No frontend
module calls the bare `GET` — every `/api/movies` reference in `src/` is the
form's `POST`. The route, its `parseLimit` helper, and its four-test block are
shipping code with no caller.

What does call it is the test suite, as an observation seam: `movieTitles`
reads `GET /api/movies?sort=recently-added` to check that an add put a row in
the library and a refused add did not, eight times; the delete suite reads it
once to check the neighbours survived; and `routes.import.test.ts` reads it
four times to count what a run wrote. None of those tests is about the route
— each has `storage` in hand from `freshApi()` and is asking "what does the
library hold now", which is the repository's question. The route's own four
sort tests each already have a twin: the empty-`?sort=`, the unknown sort and
the `last-watched` refusal are asserted on `/home?sort=` and `/genre/:name`
through the same `parseSort`, and A–Z through `listMovies` is
`browse.test.ts`'s "a-z orders by title, case-insensitively". The sort
coverage the PRD said to move first is already where it needs to be; what has
to move is the observation.

### 3. A sentence with a hole in it

Story 15 says the count is blank rather than wrong when the summary never
arrives, and the export is still allowed. The idle face does that: no label
beside the filename, the button live. Then the export lands, and the done face
reads _Saved `family-library.csv`⏎with to your computer._ — the `{count}`
slot rendered as nothing inside a sentence built around it. The edges test
asserts that no `null`, `undefined` or `NaN` reaches the copy, and passes; it
does not read the sentence. The prototype's twelve sample films never let its
summary fail, so the prototype has no ruling. "Blank rather than wrong" for a
sentence is the clause left out: _Saved `family-library.csv` to your computer._

This is the one **behaviour change** in the plan, and is named as such on the
genre-page round's precedent (its F2).

### 4. A docblock that promises more than the code keeps

`useExport`'s docblock: "A summary or an export that lands after the dialog
has closed — or after it has been opened again — is dropped, so a stale answer
never redraws a newer opening." The redraw is dropped — `done` and `exporting`
are guarded by the opening counter. The export is not: `saveToComputer` runs
on the blob whatever the counter says, so a maintainer who presses _Export_
and then _Cancel_ while the bytes are on their way still gets the file. That
is the right behaviour — the log ruled cancelling an export in flight out of
scope ("one request, no run"), and a file the maintainer asked for landing is
not a stale redraw — but the docblock says otherwise, and no test pins which
one is true.

### 5. Test blocks split where the build was, and leaf names that narrate it

The delete and bulk-import rounds both regrouped `describe` blocks that a
slice boundary had split in two; #139 left the same shape, smaller:

- `ExportModal.test.tsx` has "reopening" from #137 (through a `rerender` of
  `open`) and "every open is a new export" from #139 (through a `Host` that
  owns `open` the way `LibrarySection` does, and closes through _Done_) —
  the same behaviour under two harnesses, the second the realistic one.
- `routes.export.test.ts` has "sends a header-only file for an empty
  library" inside each format's block from #137/#138, and a `describe.each`
  "a library of none" from #139; "begins with a UTF-8 BOM" inside the CSV
  block, and "the BOM through the route and the reader" from #139.
- One xlsx leaf is named "sends a workbook, not a JSON refusal — the
  intermediate 400 from #137 is gone": a test of a state that existed for
  one commit, whose assertion the block's first leaf already makes.
- Two `writeSheet` leaves and one `ExportModal` describe-preamble carry
  "(issue #139)" in the name or the prose. The top-of-file phase banners are
  the files' convention (round 12's ruling); leaf names are not.

### 6. The docs the initiative owes

Issue 140's list, merged here: the journal entry for the build; CLAUDE.md's
folder map and README's tree, which still say "CSV export to come" in three
places and name none of `writeSheet`, `ExportModal`, `FormatCard`,
`useExport`, `saveToComputer`, `DownloadIcon`, `Modal`'s `bare`,
`types/export.ts`, the two routes, `LibrarySection`'s third row, or the two
`test-support` additions the build made that the PRD said it would not need
(`stubDownload`, because jsdom has no object URLs, and `fileResponse`, the one
double whose caller reads `blob()`); COMPONENT-SPEC's `ExportModal` row, which
gives it `{ open, format, filename, rowCount, columns[], onFormat, onExport,
onClose }` and "Chip/segmented" where it shipped as `{ open, onClose }` owning
its hook over `Modal`, `FormatCard` and `Button`, its `LibrarySection` row
still at two rows with the third "arriving with the export initiative", and
its §4 `Modal` paragraph with no `bare`; and the glossary, whose
`GET /api/movies` note is resolved by this round, whose **Sheet reader** row
gives `readSheet` two parameters where it has three, and whose **Export
dialog** and **Save to computer** rows should say what §4 above settles.

## Solution

Five groups, each a working tree after every commit: the record of the build
first, so the journal describes what shipped before this round moves it; the
wire and the hook second, because the rename is the smallest thing and the
behaviour change should be early and visible; the endpoint third, its
observation seam moved before the route goes; the test regroups fourth; the
docs last, because the folder map has to describe the tree the earlier groups
leave. Fifteen commits.

## Commits

### Group 0 — the record of what was built

1. **The journal's export entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-17): what
   shipped across #137–#139; what arrived that the PRD said would not
   (`stubDownload` and `fileResponse` in `test-support/`, and why); what was
   deliberately not built (the error face, the column picker, Excel styling,
   the save-location dialog, the `ModalHeader` / `ModalBody` composition);
   and the follow-ups — which are this plan, by bare number.

### Group 1 — the wire and the hook

2. **`exportLibrary` becomes `fetchExportFile`.** In
   `features/import-export/api`, the `GET /api/export/:format` call is
   renamed to what every other reading call is called and what its one
   caller already calls it; `useExport` drops the alias and imports the
   name. The api test's leaf names follow. Nothing else changes: the hook's
   action stays `exportLibrary()`, because that is the button's verb and the
   dialog's contract.

3. **`useExport` says what a close mid-request does, and a test pins it.**
   The docblock's "an export that lands after the dialog has closed is
   dropped" becomes what the code does: the redraw is dropped, the file
   still lands — the maintainer asked for it, and cancelling an export in
   flight is out of scope by the log. One new case in `useExport.test.ts`:
   `open` flipped false while the file request is pending, the blob then
   arriving, the browser handed one download under the filename, and `done`
   never set.

4. **The done copy without a count — the one behaviour change.** When
   `movieCount` is `null`, the **Export ready** line reads _Saved
   `family-library.csv` to your computer._ — the clause left out rather than
   a hole left in. `ExportModal.test.tsx`'s "still lands the export when the
   summary was refused" reads the squashed sentence and asserts it; a
   sibling leaf asserts the full sentence when the count is known, so the
   two arms are both pinned. No other copy changes.

### Group 2 — `GET /api/movies` goes

5. **`movieTitles` reads the repository.** In `routes.test.ts`, the helper
   takes `storage` and answers `storage.listMovies({ sort }).map(title)`;
   its eight call sites destructure `storage` from `freshApi()` where they
   did not already. The delete suite's "leaves the movie absent from
   `GET /api/movies`, and its neighbours in place" reads `listMovies` and is
   renamed "leaves the movie absent from the library, and its neighbours in
   place". Every assertion unchanged: each test was asking what the library
   holds, and now asks the library.

6. **`routes.import.test.ts` reads the repository.** Its four bare
   `fetch(`${baseUrl}/api/movies`)` reads of what a run wrote become
   `storage.listMovies({ sort: 'a-z' })` — `freshApi()` there already
   answers `storage`. Assertions unchanged.

7. **The route, `parseLimit` and the block go.** `router.get('/movies')`,
   `parseLimit`, the `moviesResponse` helper and the `GET /api/movies?sort=`
   describe block are removed; the `/home?sort=` leaf "rejects a sort it does
   not recognise, the way /api/movies does" is renamed to name
   `/genre/:name`, its surviving twin. Any import the removal strands
   (`MovieQuery` in `routes/index.ts`, `Movie` in the test) goes with it —
   `tsc` and `eslint` are the check. `MovieQuery.limit` stays: `/home`'s
   rows are capped through it. Four tests fewer, each with a named twin.

### Group 3 — tests read by behaviour

8. **One "reopening" block.** In `ExportModal.test.tsx`, "reopening" (#137)
   and "every open is a new export" (#139) become one block under the
   second's name, on the `Host` harness — a reopen that goes through _Done_
   and the section's own `open` flip rather than a `rerender`. The #137 leaf
   is kept inside it as the prop-driven case if it asserts anything the Host
   case does not, and dropped otherwise. The mid-file "Phase 3" preamble
   folds into the file's top banner.

9. **One "library of none", one "BOM" block.** In `routes.export.test.ts`,
   the two per-format "sends a header-only file for an empty library" leaves
   move into the `describe.each` "a library of none"; "begins with a UTF-8
   BOM" moves into "the BOM through the route and the reader"; the xlsx leaf
   about "the intermediate 400 from #137" is dropped — its block's first leaf
   already asserts a `200` under the workbook type. Leaf names otherwise
   unchanged; the verbose reporter before and after, diffed.

10. **Leaf names stop narrating slices.** The two `writeSheet` leaves ending
    "(issue #139)" lose the suffix; `ExportModal.test.tsx`'s and
    `routes.export.test.ts`'s mid-file "(issue #139)" section banners fold
    into their files' top banners, which stay. Names and comments only.

### Group 4 — the docs that close the initiative

11. **COMPONENT-SPEC says what shipped.** The `ExportModal` row: `{ open,
onClose }`, owns `useExport`, composes `Modal` (bare for the done face),
    `FormatCard` ×2 and `Button` — not `Chip`, not a segmented control. The
    `LibrarySection` row: `ActionRow` ×3 and the `ExportModal` it mounts; the
    section owns two routes and one overlay. §4's `Modal` paragraph gains
    `bare` in one sentence. The `SpreadsheetIcon` row's "Export filename" use
    is `SheetIcon`'s, as the code names it.

12. **CLAUDE.md's folder map and README's tree.** `server/src/import-export/
writeSheet/`; `features/import-export/`'s `ExportModal`, `FormatCard`,
    `useExport`, `saveToComputer` and the two calls in its `api/`;
    `primitives/Icon/DownloadIcon`; `components/Modal`'s `bare`;
    `types/export.ts`; `test-support/stubDownload/` and `fakeResponse`'s
    `fileResponse`; `LibrarySection`'s third row; the two `/api/export`
    routes. "CSV export to come" removed from the three places it appears,
    and the **Bulk Import / Export** section's "An exporter writes …" read
    against the build (eight columns, both formats, A–Z, the round trip, the
    reader's `Status` amendment). Tracked in both files on 135's precedent.

13. **The glossary checked against what shipped.** The `GET /api/movies`
    note under the genre-page session marked resolved by this round, by bare
    number. **Sheet reader**: `readSheet(bytes, filename, onBlankTitle)`.
    **Export dialog** and **Save to computer**: a close mid-request drops the
    redraw and not the file. **Export ready**: the copy without a count. The
    api call under **Export file** named `fetchExportFile`. The session-entry
    rows for **Export**, **Export format**, **Format card**, **Export
    columns**, **Export summary**, **Sheet writer** and **Bare modal** read
    against the code and left where they hold. No **Column pill** row: the
    pill is the dialog's own styled element, already named inside **Export
    columns**, and nobody speaks of it apart from the list it draws.

14. **The journal's paragraph for the round.** What each group changed, the
    test count before and after, what was deliberately left (the decision
    document below, in prose).

15. **The feature table ticks.** README and CLAUDE.md tick **Export** ✅ —
    the project rule is that a feature is Done when its refactor closes, not
    when its build issues do. Closes 141; 136 and 123 closed by comment
    alongside, 140 closed as folded in — by bare number, never a closing
    keyword. _(The three closures are done at closing time, not as commits.)_

## Decision Document

- **The rename is `fetchExportFile`, and the hook's action keeps
  `exportLibrary`.** The api folders' convention is that a reading call is a
  `fetch*` and a writing call says what it writes (`saveRating`,
  `createMovie`, `startImport`); the wire call reads bytes. The hook's
  `exportLibrary()` is what the button does and is the name the dialog's
  tests read; a hook action is named for the intent, a wire call for the
  request. The design log's sketch named both `exportLibrary`; the build's
  alias is the correction the log did not make.
- **The observation seam is the repository, not another route.**
  `storage.listMovies` is the browse query every screen is built out of, and
  "the aggregation and query logic stay tested at the repository seam" is the
  router's own docblock. `/api/home` was rejected: it drops a movie no genre
  claims, which several of the eight tests add. `/api/export/csv` was
  rejected: every movie A–Z through the wire, but it would make the add
  route's tests depend on the export's, and a title read back through a CSV
  parser is not "what the library holds".
- **The four `/movies?sort=` tests go without moving, because their twins
  exist.** Verified before filing: the empty-sort, unknown-sort and
  `last-watched` leaves are asserted verbatim on `/home?sort=` and
  `/genre/:name` through the one `parseSort`; A–Z through `listMovies` is
  the repository's own leaf and `/home`'s. The PRD's "moved first" is
  satisfied by the check, not by a move.
- **`parseLimit` goes; `MovieQuery.limit` stays.** The parser was the route's;
  the cap is the home's (`home.ts` reads it for the 15-card rows). Nothing
  on the wire takes a `limit` any more.
- **The done copy without a count drops the clause.** The alternatives were
  a hole (what ships), a placeholder ("some movies", "your movies") the
  prototype never wrote, or a second summary request on the done face. The
  count is a description, never a promise (glossary: "two reads of one
  library at two moments"), and the honest description with no count is the
  filename alone. One conditional in the dialog; `useExport` unchanged.
- **A close mid-request lands the file.** The request was made on the
  maintainer's press; cancelling an export in flight is out of scope by the
  log; and a download the browser has already been handed cannot be recalled
  from a page anyway. The docblock is corrected to the code, not the code to
  the docblock.
- **`Modal`'s `bare` stays a boolean.** The log and the PRD both name the
  `ModalHeader` / `ModalBody` composition as the refactor to file when a
  third dialog wants a third arrangement. Two arrangements do not earn it.
- **`EXPORT_CONTENT_TYPE` stays in the router.** It is the wire's own
  concern — what the server sends the bytes under — and the client never
  reads it; `types/export.ts` holds what both targets read (the formats, the
  columns, the filenames, the summary), and the content type is not that.
  `isExportFormat` sits beside `isMovieSort` as the same shape over the same
  kind of `as const` list.
- **The prototype's literals stay literal.** The `TickCircle`'s
  `rgba(138, 154, 107, 0.16)` has no token (`tokens.css` has `--color-watched`
  and no soft variant; `MetaLine` writes the same ink at `0.14`, also the
  prototype's own). The dot's and the circle's `99px` are drawn with
  `radius.pill` (`999px`), which is the codebase's spelling of "a circle"
  wherever the prototype writes `99px` on a round thing, and is the same
  pixel at every size in use.
- **The `COLUMNS` list in `ExportModal.test.tsx` stays spelled.** A test
  that imported `EXPORT_COLUMNS` to check the pills would prove the pills
  read the constant, not that the constant is the prototype's eight. The
  writer's test spells them too, for the same reason.
- **The cross-feature import stays, and stays the only one.** `LibrarySection`
  → `ExportModal` by path is the precedent the log recorded: a section
  composing a dialog. No hook and no wire crosses; nothing in this round
  adds a second.
- **`stubDownload` is a `test-support` unit, and stays one.** The PRD said
  no new frontend double was anticipated; jsdom's absent object URLs and
  console-erroring anchor `click()` made one necessary, and it is used by the
  `saveToComputer`, `useExport` and `ExportModal` suites — three callers, the
  folder's own bar. Recorded in the journal as the one thing the PRD's
  testing section got wrong.

## Testing Decisions

- A good test here asserts what the maintainer can see or what the wire
  answers: a file under the right name in the browser's hands, a `200` under
  a content type, a sentence on the done face, a row the library holds after
  an add. Every commit but three changes no assertion; the check is the one
  the last four rounds used — the verbose reporter's leaf names before and
  after, diffed. The three: commit 3 adds one case (`useExport`, a close
  mid-request), commit 4 adds one and extends one (`ExportModal`, the done
  copy with and without a count), and commit 7 removes four with named
  twins; commit 9 removes one duplicate leaf. Baseline at filing: **4135
  tests across 210 files**, `npm run typecheck` green, `eslint src server`
  clean (per #139's closing check). Expected after: 4132 across 210.
- Group 1's rename is checked by the api and hook suites passing under the
  new name and by `tsc`. The behaviour change in commit 4 is held by its own
  two leaves and by every other `ExportModal` done-face leaf passing
  unchanged (each of those has a count).
- Group 2 is checked by every rewired test passing unchanged in assertion
  before the route goes (commits 5 and 6 leave the route in place), and by
  the whole suite passing after it goes (commit 7). The three route suites
  are the precedent — a real listener over a real migrated `:memory:`
  library — and the rewired helpers read the same storage those listeners
  serve.
- Group 3 changes nothing but where a test's name sits, on the delete and
  bulk-import rounds' precedent; the verbose reporter diff is the check.
- Group 4 has no test; it is read.

## Out of Scope

- **The `ModalHeader` / `ModalBody` composition** — filed when a third
  dialog wants a third arrangement, per the log and the PRD.
- **`routes/index.ts` at ~1490 lines.** This round takes ~35 lines out of it
  (the route and `parseLimit`) and adds none. The routes round the last plan
  named is still its own round.
- **A shared listening-API harness and a shared fetch double** — still
  project-wide rounds, still not this one.
- **Cancelling an export in flight** — ruled out by the log; commit 3 pins
  the consequence rather than changing it.
- **An error face, a snackbar on done, a column picker, Excel styling, a
  save-location dialog** — the log's ruled-out list, unchanged.
- **Re-importing an export as an update** — Bulk import skips rows already
  in the library; Edit exists for amendments.
- **Any pixel.** The surface was read against `feat.ExportModal.dc.html`
  and `page.SettingsPage.dc.html` and is the prototype's; nothing in this
  round touches a styles file.

## Further Notes

The smallest round yet, and the one with the least to say about seams — one
new server unit beside its mirror, one feature with four units, and a build
that read the log closely enough to make no duplicate. What it did make is
the kind of thing a close reading of a sketch produces: the sketch named the
wire call `exportLibrary`, so the build did, and the convention it broke was
in the folder next door. Worth noting for the next log: when the design
section sketches a signature, the sketch is a shape, and the name should be
checked against the rung's neighbours before it becomes the build's.

The hole in the done sentence is the other finding worth a pattern. The
edges slice asserted that no `null`, `undefined` or `NaN` reached the copy
— the right thing to guard, and it held — but did not read the sentence,
and the sentence had a slot the prototype's sample data never emptied. A
copy assertion should read the copy: `squashed()` exists in that suite for
exactly this, and reaching for it in the "summary never arrives" block would
have caught the hole on arrival.

# Refactor plan: Sheet in sight, the Meta move in the house's reads, docblocks in the glossary's words, and the docs that close step 56

> Source initiative: `sheet-in-sight`, issue 700 (step 56).
> Shipped by issues 701 to 705: two server slices RED and GREEN each, the
> prototype amended, the client slice RED and GREEN, and the walk and
> documents slice (`578ffe50` to `75eac67a`).
> Design log: `docs/design-logs/74-sheet-in-sight.md`.
> PRD: `docs/PRDs/74-sheet-in-sight.md` (700). Plan:
> `docs/PRDs/74-sheet-in-sight-plan.md`.
> Handoff: `docs/handoff/handoff-sheet-in-sight/README.md`, history since
> 703 amended the prototype; `COMPONENT-SPEC.md` is finished here.
> This is the initiative's closing round. It ticks **Sheet in sight** and
> closes 700. Filed as issue #706.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`sheet-in-sight` shipped every phase of its plan. The **Meta folder** is
`_meta/`; `folderLayout` holds `META_FOLDER`, `OLD_META_FOLDER` and
`isMetaFolder`, the one rule every reader uses. The walk passes either name
in silence, knows an **Export folder** by either and reads the sheet from
`_meta/` before `Meta/`; `sheetRootOf` answers the folder above for either;
an Export writes `_meta/`. The **Library sheet writer** makes the **Meta
move** before each write and writes where the sheet lies when the rename is
refused. `FolderShapes` draws the **Sheet note**, and the Reset dialog's
_What stays_ lists the sheet second. The build also caught one place log 74
did not list: the Enrichment setup's note said `Meta`, and 703 and 704
brought the prototype and the app to `_meta` (`b23437c7` to `545dafa1`).
The walk (705) passed all six checks in the shell.

At `75eac67a` the full suite has **13208 tests passing across 929 files**
(one skipped), and `tsc -b --force` is clean. `eslint` over every file the
initiative added or changed reports **0 errors and 1 warning**, an unused
`name` in `routes.exportSeries.test.ts` from issue 277, older than this
initiative.

The design held. What is left is small: two helpers the Meta move wrote
beside a unit that already answers their question, a filename spelled twice,
a phrase the rename's find-and-replace left in six docblocks, a few ragged
lines, and documents that still say `Meta`. Every finding below was checked
against the code at `75eac67a`. They fall into three families.

### 1. The Meta move beside the house's own reads

- **`settledMetaFolder` asks its two questions through private helpers.**
  The move added `folderAt` (a `stat` that answers _is a folder_) and
  `somethingAt` (an `lstat` that answers _is anything there_), with the
  `lstat` and `stat` imports they need. The writer already imports
  `readableFolder` for its reach skip, and that unit is the house's one
  answer to both questions as a value: `'readable'` for a folder,
  `'missing'` for nothing there, `'not-a-folder'` for anything else.
  Swapping the two helpers for it keeps every writer suite green (checked
  at `75eac67a`: 7 files, 47 tests, the Meta move suite's mocked `stat`
  included).
- **The sheet's filename is spelled twice in the writer.** `LIBRARY_SHEET`
  writes `${META_FOLDER}/${LIBRARY_SHEET_STEM}.csv`, and the move added
  `SHEET_FILENAME`, `${LIBRARY_SHEET_STEM}.csv`, beside it. One should be
  built from the other.

### 2. Docblocks in the glossary's words

- **_Meta folder sheet_ in six docblocks.** Where a docblock said _the
  folder's `Meta/` sheet_, 701 wrote _the folder's Meta folder sheet_: five
  in `createImporter` (`WalkedFolder.sheet`, `heldSheets`, the sheet read
  for a **Folder scan**, the Folder scan itself, one walked folder placed)
  and `LayoutWalk`'s in the walk. The glossary's name for a Library folder's
  sheet is the **Library sheet**, and its invariant (log 74) already says the
  scan reads at most one, `_meta/`'s when there, else the Old Meta folder's.
  The `heldSheets` line also runs to 84 columns.
- **Three lines the initiative wrote break the file's wrap.** The walk's
  `holdsMeta` docblock is 81 columns. `createLibrarySheet`'s docblock ends
  one line at _a sheet_ well short of the width, and `FolderShapes`' at
  _No props:_, each where a phrase was inserted without rewrapping the
  paragraph.

### 3. Documents that still say `Meta`

- **`COMPONENT-SPEC.md` names `Meta` three times.** 703 amended its
  ImportFlow, LibraryFolders and ResetDialog rows, and `b23437c7` the
  Enrichment prototypes, but the spec's Enrichment row still quotes the
  note as _The sheet in `Meta`_ and the done summary as _the sheet in
  Meta._, and the Enrichment decisions table (_Storage_) and its
  server-side note say the sheet is kept in `Meta/` and that the writer
  only rewrites `Meta/familyflix-library.csv`.
- **The release checklist points at `Meta\` seven times** where the build
  under test now writes `_meta\`: the sheet rewrite, video quality's sheet
  cell, the scan after a reset, rebuild whole, rebuild edges, the Export
  round trip, and a new Export being _flat, one folder per title beside
  `Meta/`_. The v0.16.1 fixture's `Meta\familyflix-library.csv` is right
  as written: that Export predates the step. The checklist also has no
  smoke step for this initiative, where the initiatives that changed what
  a scan, a sheet or an Export does each added one (prior art: `3104c8bc`,
  `e1fe0cdd`).
- **The build has no journal entry**, and the feature checklist's row reads
  ⬜ Planned with step 56 still 🔜 and its full description.

The README is untouched: its _Project Structure_ names folders and rules,
never units; its rule that the only writers into a Library folder are the
Layout fill and the Library sheet writer stays true, and its _never moves,
renames or deletes a file of yours_ stays true, since the Meta folder is
FamilyFlix's own. CLAUDE.md already names `_meta/familyflix-library.csv`
and the Meta move (705). The glossary already carries the log's rows.

## Solution

One round in three groups, each commit leaving the suite green and the
typecheck clean:

1. **The Meta move in the house's reads**: `settledMetaFolder` asks
   `readableFolder`; the sheet's filename spelled once.
2. **Docblocks in the glossary's words**: _Meta folder sheet_ becomes the
   **Library sheet**; the three ragged lines rewrapped.
3. **The documents**: `COMPONENT-SPEC.md`'s last `Meta`, the release
   checklist's paths and smoke step, the build's journal entry, and the
   entry and ticks that close step 56 and issue 700.

## Commits

Every commit is `refactor:` (or `docs:` where it says so), titled
`refactor: [sheet-in-sight] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is added, weakened or changes its
claim: the suites already in place (the writer's seven, the Meta move suite
among them, the walk's and the importer's, `FolderShapes`') are the proof
that each move kept the behaviour.

### Group 1: the Meta move in the house's reads

1. **`settledMetaFolder` reads through `readableFolder`.** The move is made
   when the Old Meta folder reads `'readable'` and the Meta folder reads
   `'missing'`; `folderAt` and `somethingAt` go, and with them the `lstat`
   and `stat` imports. A file named `_meta` still blocks the move, as
   `somethingAt` did (it reads `'not-a-folder'`). The writer's suites stay
   green unchanged, the Meta move suite's mocked `stat` reaching
   `readableFolder` as it reached `folderAt`.

2. **The sheet's filename spelled once.** `SHEET_FILENAME` is declared
   first and `LIBRARY_SHEET` is `${META_FOLDER}/${SHEET_FILENAME}`, so the
   `.csv` is written in one place. Both keep their names and docblocks;
   `LIBRARY_SHEET`'s value, which `createLibrarySheet.test` pins as
   `_meta/familyflix-library.csv`, is unchanged.

### Group 2: docblocks in the glossary's words

3. **The Library sheet, named.** The five `createImporter` docblocks say
   _the folder's **Library sheet**_ (or _whose **Library sheet**_) where
   they say _Meta folder sheet_, and `LayoutWalk` says the walk answers the
   path of the sheet in the root's **Meta folder**, either name, or `null`.
   The `heldSheets` line comes back under the width with it. No code moves.

4. **The three ragged lines rewrapped**: the walk's `holdsMeta` docblock to
   the file's width, and the paragraphs of `createLibrarySheet`'s and
   `FolderShapes`' docblocks reflowed around the phrases 702 and 704
   inserted. No word changes.

### Group 3: the documents

5. **`docs:` `COMPONENT-SPEC.md` says `_meta`.** The Enrichment row quotes
   the note as _The sheet in `_meta`_ and the done summary as _the sheet in
   \_meta._, both as the prototype now draws them (`b23437c7`); the
   Enrichment table's _Storage_ keeps the sheet in `_meta/` (log 58, log
   74), and its server-side note reads that the writer only rewrites
   `_meta/familyflix-library.csv` and makes the one **Meta move**, the
   words CLAUDE.md uses.

6. **`docs:` the release checklist knows the Sheet in sight.** The seven
   paths a current build writes read `_meta\` (and _beside `_meta/`_); the
   v0.16.1 fixture's `Meta\` stays. One new smoke step, after rebuild edges,
   over the sandbox Library folder in the shell: rename its `_meta\` to
   `Meta\`, put a `notes.txt` beside the sheet, and rate a film: `Meta\` is
   gone and `_meta\` holds both files; _Import setup_ and a group's _Scan_
   draw the Sheet note; and the Reset dialog lists four items under _What
   stays_, the sheet second. The reset step itself stays last, where the
   checklist already puts it.

7. **`docs:` the build's journal entry.** _2026-11-23: Sheet in sight, the
   build (issues 701 to 705)_, placed before this round's: what each slice
   shipped (the name and both readers; the Meta move and its refused path;
   the prototype amended; the Sheet note and the reset item; the
   Enrichment note the build caught, `b23437c7` to `545dafa1`, outside log
   74's list), the walk's six checks as 705's commit records them (the
   shell in its start shape over a scratch folder, Explorer's order by
   `StrCmpLogicalW`, the held sheet a handle with no share mode), and the
   judgement calls a later session needs: the importer's `Meta/` fixtures
   kept where they stand for an old library or Export, and the walk's own
   suite split out as `walkLibraryFolder.metaFolder.test.ts`. Its counts
   are the ones this plan records at `75eac67a`.

8. **`docs:` step 56 is done.** The feature checklist's row reads ✅ Done;
   step 56 becomes one line and a link, as the steps before it (_56. ✅
   **Sheet in sight**: `_meta/` heads the folder, and the sheet is said
   aloud ([log 74](design-logs/74-sheet-in-sight.md))._), and the paragraph
   that introduced it goes. The dev journal gains this round's entry:
   counts before and after, what each group changed, where the round left
   the plan, and the follow-ups below. The commit's body closes 700.

## Decision Document

- **A question the house already answers is asked of its unit.**
  `readableFolder` is the one value-not-throw read of what lies at a path;
  the Meta move asks it both of its questions, as the writer's reach skip
  beside it does. A dangling link named `_meta` (something `lstat` saw and
  `stat` does not) would now read `'missing'` and the rename would be
  refused, writing in `Meta/`: the refused path log 74 Q6 already settles,
  for a case no household makes.
- **A name is spelled once per unit.** `LIBRARY_SHEET` is built from the
  writer's `SHEET_FILENAME`, as `LIBRARY_SHEET_STEM` and `META_FOLDER`
  build both. The walk's `SHEETS` and the Export's `.<csv|xlsx>` stay as
  they are: each spells a different set of names from the same stem.
- **A docblock names the sheet by its glossary term.** A Library folder's
  sheet is the **Library sheet**, in whichever Meta folder holds it; _Meta
  folder sheet_ is not a term. Where a docblock means the folder, it says
  **Meta folder**, and where it means either name, it says so.
- **The spec and the checklists follow the code.** `COMPONENT-SPEC.md` and
  the release checklist are living documents and say `_meta`; the older
  handoff READMEs and the glossary's earlier sections are their logs'
  moments and stay as written (log 74 Q2). A path that stands for an Export
  written before the step (the v0.16.1 fixture) keeps `Meta\`.
- **Unchanged, as settled by log 74 or as built:** `isMetaFolder` and both
  constants in `folderLayout`; the walk's `holdsMeta`, `sheetInFolder` and
  `sheetIn`; `sheetRootOf`; the Meta move's place in `writeOne` and its
  order (after the three skips, before the sheet on disk is read);
  `WHAT_STAYS` as plain strings; the Sheet note's `Mono` path as a string
  literal, as the shapes above it are; the Enrichment note's `_meta`;
  CLAUDE.md; the glossary; the README.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what comes
  out: the folders on disk after a write, the sheet the walk returns, the
  folder `sheetRootOf` answers, the words on screen. It never checks which
  helper answered a question or how a docblock is wrapped.
- **No test changes its claim.** Group 1 moves no behaviour a suite can
  see, and the writer's seven suites are the proof: `createLibrarySheet`,
  `.unreadable`, `.dialect`, `.padded`, `.nested`, `.yearless` and
  `.metaMove`, whose wrapped `stat` already reaches `readableFolder` (the
  writer's reach skip reads through it). The swap was run against them
  before planning and reverted. Prior art: header fit's groups 1 to 4 and
  seamless art's groups 2 to 4, which changed no test.
- **Groups 2 and 3 touch no code.** The full suite and `tsc -b --force`
  close each group, and `eslint` over the touched files ends at 0 errors
  and no warning from this initiative.
- **No walk.** Nothing drawn, fetched or stored changes; 705's walk stands.
  The release checklist's new step is the next release's to run.

## Out of Scope

- **The Enrichment done summary.** The app reads _Saved to your library,
  the sheet in your collection root_ off a `written.sheet` the server always
  answers `false`, where the prototype draws _your library, each title
  folder, the sheet in \_meta_ since log 58. Older than this initiative (the
  app's line dates from issue 211) and a visible change; a follow-up for the
  journal.
- **`fillLayout`'s private `isDirectory`**, the same question
  `readableFolder` answers, written by log 58's build. Older than this
  initiative; the follow-up names it beside the done summary.
- **The Sheet note's words in three suites** (`FolderShapes`,
  `ImportSetup`, `LibraryFolders.scan`): each screen pins the copy it draws,
  as the house's screen suites do.
- **The Reset dialog's 137-column string**: `WHAT_STAYS` holds plain
  strings (log 74 Q13), and Prettier keeps a string whole.
- **Long `it` titles and comment lines in the initiative's suites**, and
  the unused `name` in `routes.exportSeries.test.ts` (issue 277).
- **A `_meta` that is a file**: the move is not made and the write fails
  at its `mkdir`, quietly, as a sheet that cannot land does. Unchanged
  behaviour, for a case no household makes.
- **The older handoff READMEs and the glossary's earlier sections** that
  say `Meta/` (log 74 Q2).

## Further Notes

- Groups 1 and 2 are independent of each other; commit 4 runs after 3,
  since both touch `createImporter`'s neighbourhood of docblocks and the
  walk's. Group 3's commits 7 and 8 come last, since 8 records this round's
  counts.
- **Follow-ups for the journal**: the Enrichment done summary's divergence
  from the prototype and the `written.sheet` that is never true, and
  `fillLayout`'s `isDirectory`, both older than this step; and the next
  release runs the checklist's new Sheet in sight step on the installed
  app.
- Eight commits; the build was a rename read two ways and one new write,
  and the round is the house's reads for that write, the glossary's words
  where a find-and-replace left none, and the documents a closing round
  always writes.

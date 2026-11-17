# Plan: Export paths, a sheet that gives the library back whole

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/643

An Export gives the library back whole, its art included, whatever shape the
library had when it was taken, and a sheet's paths read the same on Windows
and Linux. A `Folder` cell is read as a path whose last segment is the
**Folder key**; a path cell's file is looked for in the matched Title folder,
then under the **Sheet root**; a new Export is flat, in the **Folder
layout**; a Source folder is spelled with `/`; and a Resolve's pick in a
Link run links. The spec is design log 67; no screen changes and no
prototype is amended.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 6's walk of the maintainer's real case is done by the agent
itself in the shell, unattended, and is backed by a route test so the
acceptance never waits on a hand. No decision is left open: the maintainer
approved every recommendation of log 67 in advance.

- The phases are log 67's _Implementation Plan_ slices, thinned: slice 1
  into the rows matching (phase 1) and the art coming back (phase 2).
- **Each phase starts from its own RED test**, except phase 6's documents
  (proved by its checklist and a green suite).
- **Phase 1 may land without phase 2**: an old Export's rows match, and its
  path cells are reported as not contained and fill nothing, as today. All
  six land before the next `npm version`.
- **Every existing import, export, sheet and route test stays green after
  every phase**, the **Round trip** and **Export round trip** suites above
  all. The dev library imports exactly as before.
- The glossary and the checklist's step 50 row were done in the grill-me;
  the row stays 🔜 until the refactor. CLAUDE.md is untouched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration. Stored `\` Source folders stay as they are;
  every reader splits on `/` and `\`.
- **Routes**: none new. The Import route already passes the sheet's path,
  from which the run takes its Sheet root. No Setup step field.
- **Key models**:
  - `SheetRow.folder` stays the **Folder key**, now the `Folder` cell's last
    non-empty segment. A new `SheetRow.folderPath` is the **Folder path**:
    the cell's segments, `\` read as `/`, joined by `/`. For every sheet
    FamilyFlix writes from now on the two are equal.
  - A **Match** carries its row as read; no path cell is resolved by the
    matcher.
  - `sheetRootOf(sheetPath)`, pure, in the import-export domain: the folder
    holding the sheet's `Meta/` folder when the sheet lies in one, else the
    sheet's own folder. A Folder scan's Meta sheet uses the same rule.
  - `titleFolderName(path)`, pure, in the media domain beside
    `foldFolderKey`: the last non-empty segment, split on `/` and `\`.
  - `sourceFolderOf(root, dir)`, pure, beside `placeTitleFolder`: the
    folder relative to its Library folder, with `/` on every platform.
- **The rules**:
  - Matching stays exact: a scanned Title folder's name against the Folder
    key. Two such folders stay `ambiguous`; the bare-title fallback is not
    widened. Duplicate rows are told apart by the Folder path's fold.
  - A path cell is contained when, `\` read as `/`, its leading segments
    fold equal to the Folder path's, no segment is empty, `.` or `..`, none
    holds a colon, and the last names its column's kind.
  - A contained cell is resolved by replacing its Folder path with the
    matched Title folder. Its file is looked for first there, then joined
    as written under the Sheet root; the first that exists fills the empty
    place. The folder's own read wins over both. A cell naming nothing
    fills nothing and stops nothing. The `Video` cell is never read.
  - The Sheet root is only read, never written; its files are copied into
    managed storage like any art.
  - An Export's row key is its Source folder's Title folder name; clashing
    keys number `(1)`, `(2)` with a warning line (log 61 Q4).

---

## Phase 1: An old Export's rows find their folders

**User stories**: 1 to 4, 18, 19, 27, 30

### What to build

`readSheet` reads a `Folder` cell as a path: `\` and `/` both separate, the
Folder path is its segments joined by `/`, and the Folder key is the last.
Duplicate rows are told apart by the Folder path. The matcher still matches
a folder's name against the key, so `Movies\Guardians of the Galaxy` finds
`Guardians of the Galaxy/` in whichever Library folder holds it. A v0.16.1
Export, written by that version with backslash keys, nested folders and art
under the Export folder, is kept as a test fixture exactly as written. Demo:
its sheet, uploaded over a re-linked inner Library folder, matches every
title with no Problem.

### Acceptance criteria

- [ ] A `Folder` cell of `Movies\Guardians of the Galaxy`, of
      `Movies/Guardians of the Galaxy`, of mixed separators or with a
      trailing separator reads as Folder path `Movies/Guardians of the
    Galaxy` and Folder key `Guardians of the Galaxy`.
- [ ] A one-segment cell reads as before; its Folder path equals its key.
- [ ] Two rows with the same Folder path are duplicates; two with the same
      key under different paths are not.
- [ ] A row whose Folder path has a parent segment matches its Title folder
      by name; two folders of that name in two Library folders stay
      `ambiguous`; a near spelling never matches.
- [ ] The v0.16.1 fixture is checked in byte for byte; an importer suite
      over it and a re-linked inner folder imports every title with no
      Problem.
- [ ] The dev library and every existing sheet suite import as before.

---

## Phase 2: The Export's art comes back from its sheet

**User stories**: 5 to 11, 20, 21, 31, 32

### What to build

`sheetRootOf` answers the run's Sheet root. A path cell is contained under
its row's Folder path, `\` read as `/` (the backslash refusal goes; `..`,
`..\`, empty segments and a drive letter's colon are still refused).
`resolvePathCell` replaces the Folder path by the matched Title folder.
`pathCellFills` alone resolves cells: the film and show fills take the Sheet
root and look for each file in the Title folder, then under the Sheet root.
The matcher's `resolvedRow` and the fills' `isAbsolute` pass-through go.
The importer hands the fills the Sheet root from the sheet path the Import
route passes. Then one route test of the maintainer's case. Demo: the
v0.16.1 fixture's sheet, uploaded from its `Meta/` folder, fills every
poster, backdrop, Still, season poster and subtitle.

### Acceptance criteria

- [ ] `sheetRootOf`: a sheet in `Meta/` answers that folder's parent; a
      sheet beside its folders answers its own folder.
- [ ] `readSheet`: a v0.16.1 path cell is contained under its Folder path;
      `..\`, `..`, an empty segment and a drive letter are still refused
      and reported; a cell not under its row's folder is still reported
      and ignored.
- [ ] `pathCellFills`: a file in the Title folder wins; a file only under
      the Sheet root fills; a cell naming nothing fills nothing; a place
      the folder's own read fills stays as it is.
- [ ] `matchRows` carries each row as read.
- [ ] The phase 1 suite now gets every poster, backdrop, Still, season
      poster and subtitle back; nothing under the Export folder is written.
- [ ] An uploaded Library sheet reads its art from its own Library folder
      as before; a hand-made sheet outside any `Meta/` reads art beside
      itself.
- [ ] Route test: titles at `Movies/<title>` under one Library folder,
      exported, Factory reset, the inner folder linked, the Export's sheet
      uploaded from its `Meta/` folder; every title is back, no Problem,
      every poster set.

---

## Phase 3: The Export writes the layout

**User stories**: 12 to 17, 27

### What to build

`titleFolderName` names a Source folder's Title folder. The Export keys
each row and lays out each folder by it (`titleFolderOf`), so a new Export
is flat, one Title folder per title, its `Folder` cells one segment and its
art cells starting with that name. Clashing names number `(1)`, `(2)` with a
warning line. The Library sheet reads each recorded Title folder where it
lies, keyed by its Folder key, and `layoutCells` writes path cells relative
to the folder holding the Title folder. Demo: a library of `Movies/<title>`
Source folders exports flat, and its folders copied over the inner Library
folder scan back whole.

### Acceptance criteria

- [ ] `titleFolderName`: `/`, `\`, mixed, trailing separators and one
      segment.
- [ ] `exportRows`: a nested Source folder writes its last segment as the
      key; two nested titles sharing a last segment number `(1)` and `(2)`
      with a warning line.
- [ ] A new Export's folders lie one per title directly in it, and its art
      cells start with each title's key.
- [ ] The Library sheet of a nested library starts its path cells with the
      title's own folder name; for a root-level library it is byte for
      byte as before.
- [ ] A new Export's folders copied over a re-linked inner Library folder
      import every title with its art; its sheet uploaded does too.

---

## Phase 4: One spelling for a Source folder

**User stories**: 28, 29

### What to build

`sourceFolderOf` records a Source folder with `/` on every platform. Every
site that records or looks one up calls it: the Title folder placer, the
film placer's source, the importer's show import and its held-show lookup,
and the Show folder read's held-series lookup. Every new Source folder is
one segment today, so no stored value changes. Demo: no change in
behaviour; the unit's own test pins `/`.

### Acceptance criteria

- [ ] `sourceFolderOf` answers `Movies/Heat` for a nested folder on every
      platform, and a one-segment folder as before.
- [ ] Every recording and lookup site uses it; no `relative(...)` spells a
      Source folder elsewhere.
- [ ] A Source folder stored with `\` is still read and found.
- [ ] The source-folder, held-show and Show folder suites stay green.

---

## Phase 5: The Resolve links

**User stories**: 22 to 26

### What to build

Movie-form feature only, no server change. `useImportMode`, on a Resolve
in the shell, reads the picked video's path through the **Path bridge** and
asks the containing read, as a plain add does. Under a Library folder the
pick travels as a **Found file**, which the server already places by the
run's Import mode; under none, or in a browser, its bytes are uploaded and
copied. The Import mode control stays undrawn on a Resolve. Demo: a
`no-folder` row resolved by picking its video in a Link run keeps its
Library folder.

### Acceptance criteria

- [ ] On a Resolve in the shell, a pick under a Library folder sends its
      path; in a Link run the film is linked where it lies.
- [ ] In a Copy run the same pick is copied.
- [ ] A pick under no Library folder, or with no bridge (a browser), sends
      bytes and is copied, as today.
- [ ] No Import mode control is drawn on a Resolve.

---

## Phase 6: The walk and the documents

**User stories**: all, proved end to end

### What to build

The maintainer's real case, walked by the agent without a hand: in the
shell (the `run` skill) on a temp library of `Movies/<title>` and
`Series/<title>` under one Library folder, export, Factory reset, link the
two inner folders, upload the Export's sheet from its `Meta/` folder, and
resolve one `no-folder` row by a pick in a Link run. Any gap the walk finds
is fixed in its phase's unit and its test first. Then the docblocks of
every changed unit say what they now do, the feature checklist's step 50
row is written to the build and stays 🔜, and the dev journal gains this
step's entry.

### Acceptance criteria

- [ ] In the shell, every title comes back with its poster and no Problem;
      the resolved row's film stays linked in its Library folder.
- [ ] A new Export taken in the walk is flat, and copied over a Library
      folder it scans back whole.
- [ ] The docblocks of `sourceFolderOf`, `titleFolderName`, `sheetRootOf`,
      `readSheet` (`SheetRow`, `resolvePathCell`, containment), `matchRows`,
      `pathCellFills`, `exportRows`, `createLibrarySheet`, `layoutCells`,
      `createImporter` and `useImportMode` describe their current behaviour.
- [ ] Step 50's row in `docs/feature-checklist.md` describes the build and
      stays 🔜; `docs/dev-journal.md` has a step 50 entry;
      `docs/ubiquitous-language.md` matches the build.
- [ ] CLAUDE.md is unchanged; no em dash in any prose.
- [ ] The full suite is green.

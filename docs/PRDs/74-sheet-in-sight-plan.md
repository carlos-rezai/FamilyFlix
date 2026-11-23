# Plan: Sheet in sight, the Library sheet easy to find and said aloud

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/700

The **Meta folder** becomes `_meta/`, so it heads a Library folder in
Explorer. A held `Meta/` is still read, and the **Library sheet writer**
renames it the next time it writes (the **Meta move**). The maintainer is
told about the sheet where a folder comes in (the **Sheet note**) and before
a reset (the Reset dialog's _What stays_). The spec is design log 74 and
`docs/handoff/handoff-sheet-in-sight/README.md` until phase 3 amends the
prototype.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** The agent walks phase 5 itself in the shell. It simulates the
sheet held open in Excel by holding the file open from another process
(a PowerShell handle opened with no share mode), so the rename is refused
the same way. No decision is left open, since log 74 settled them all.

- The phases are log 74's _Implementation Plan_ slices. Slice 3 is split as
  in log 73's plan: the prototype amendment is phase 3, the note and the
  dialog item are phase 4, and the walk and documents are phase 5.
- **Phases 1, 2 and 4 each start from their own RED test** (`tdd`). Phase 3
  is the prototype and the spec, proved by reading them against the handoff.
  Phase 5's documents are proved by the walk and a green suite.
- **Every existing test stays green after every phase.** Importer fixtures
  that stand for an old library or an old Export keep their `Meta/`. The
  round-trip suites move to `_meta/` with phase 1.
- The glossary's terms were written in the grill-me. The checklist's step
  56 row stays 🔜 until the refactor. The README is not touched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new and none changed.
- **Schema**: no migration. The sheet's columns and its triggers are
  unchanged.
- **Dependencies**: none new.
- **On disk**:
  - The **Meta folder** is `_meta/`, in a Library folder's root and in an
    Export folder's. The **Library sheet** is `_meta/familyflix-library.csv`.
  - The **Old Meta folder** is `Meta/`, read for good in libraries and
    Exports alike.
  - Exactly `_meta` and `Meta` are Meta folders, compared as spelled.
    `meta`, `_Meta` and `Meta (2019)` are titles.
- **Key models**:
  - `folderLayout`: `META_FOLDER = '_meta'`, `OLD_META_FOLDER = 'Meta'`,
    and `isMetaFolder(name)`. This is the one rule every reader uses.
    `LIBRARY_SHEET_STEM` is unchanged, and `LIBRARY_SHEET` follows
    `META_FOLDER`.
  - The walk's sheet lookup order: `_meta/` then `Meta/`, and `.csv` before
    `.xlsx` in each, else `null`. The walk's result shape is unchanged.
  - `sheetRootOf`: the folder above for either name, else the sheet's own
    folder.
- **The rules**:
  - The Meta move happens only inside the writer's `writeOne`. It runs after
    the unlisted, unscanned and unreachable skips and before the sheet on
    disk is read. If `Meta/` is a folder and `_meta` is absent, the writer
    makes one `rename`. If it lands, the write goes to `_meta/`. If it is
    refused, the write goes to `Meta/`. In every other case the write goes
    to `_meta/`. The move does not wait for a changed cell.
  - FamilyFlix deletes nothing during the move, never merges the two
    folders, never warns about both, and never moves an Export folder or
    moves at startup.
  - The writer's public interface (`touch`, `flush`, `hold`, `release`) and
    its triggers are unchanged.
  - No snackbar, no toggle and no new scan mode.

---

## Phase 1: The new name, both read

**User stories**: 1, 2, 3, 4, 12 (reading), 14, 15, 16, 17, 18, 19, 20, 33

### What to build

`folderLayout` learns the new name and the old one. The walk passes either
folder in silence at a Library folder's root. A folder holding either name
counts as an Export folder. The sheet is read from `_meta/` first, then
`Meta/`. `sheetRootOf` finds the art above a sheet in either folder. The
writer and `writeExport` write `_meta/`. The importer changes only in its
docblocks. In this phase a held `Meta/` is not yet moved: the writer writes
a fresh `_meta/` beside it, and because `_meta/` is read first, that sheet
rules. Demo: a fresh Library folder scanned and rated grows
`_meta/familyflix-library.csv`, the first entry in Explorer. An Export lands
its sheet in `_meta/`. An old Export with `Meta/` still imports with its
art.

### Acceptance criteria

- [ ] `isMetaFolder` accepts `_meta` and `Meta` and refuses `meta`,
      `_Meta` and `Meta (2019)`.
- [ ] The walk passes `_meta/` and `Meta/` in silence and never offers
      either as a title. A folder holding either is an Export folder.
- [ ] The walk's sheet comes from `_meta/` when it is there, else from
      `Meta/`, with `.csv` before `.xlsx` in each, and `null` when neither
      holds a sheet.
- [ ] `sheetRootOf` answers the folder above for a sheet in `_meta/` or
      `Meta/`.
- [ ] A fresh Library folder's sheet is written to
      `_meta/familyflix-library.csv`.
- [ ] `writeExport` and the export route tests find the sheet under
      `_meta/`, and an Export folder holds no `Meta/`.
- [ ] Importer suites standing for an old library or Export
      (`oldExport`, `exportFolder`, `sheetRoot`) still pass on `Meta/`, and
      the round-trip suites pass on `_meta/`.

---

## Phase 2: The Meta move

**User stories**: 5, 6, 7, 8, 9, 10, 11, 12 (writing), 13

### What to build

The writer's own move. Before a Library folder's sheet is written, the
writer settles which folder to write into, as the rules above describe. It
then writes there exactly as it does today: it refuses a sheet the reader
can't read, skips identical bytes, and writes a temporary file beside the
sheet before renaming it into place. A new suite,
`createLibrarySheet.metaMove.test.ts`, covers the move. Demo: copy a library
with `Meta/` and scan it. `Meta/` is now `_meta/` with every file it held.
With the sheet held open, the scan still records into `Meta/`, and the next
rating after the sheet is released moves it.

### Acceptance criteria

- [ ] A held `Meta/` is moved whole to `_meta/`, a second file in it (an
      `.xlsx`) included, and the sheet is written in `_meta/`.
- [ ] The folder is moved even when the sheet's bytes would not change.
- [ ] With both `_meta/` and `Meta/` present, `Meta/` is untouched and
      `_meta/` is written, with no warning.
- [ ] A refused rename (a mocked `rename`) writes the sheet into `Meta/`
      and leaves no `_meta/` sheet. The next write moves the folder.
- [ ] An unlisted, unscanned or unreachable folder is neither moved nor
      written.
- [ ] The writer's existing suites (`createLibrarySheet`, `.unreadable`,
      `.dialect`, `.padded`) stay green.

---

## Phase 3: The spec amended

**User stories**: none directly; it is the spec phase 4 builds to

### What to build

The prototype and its spec brought to the handoff README.
`feat.ImportFlow.dc.html` and `page.LibraryFoldersPage.dc.html` draw the
Sheet note after the folder-first rule in _What the scanner accepts_, in
that rule's style, with the path in mono. `page.SettingsPage.dc.html`'s
Reset dialog lists four items under _What stays_, with the sheet second.
Any `Meta\` path the prototype draws reads `_meta\`. `COMPONENT-SPEC.md`'s
ImportFlow, LibraryFolders and ResetDialog rows describe the note and the
item. After this phase the prototype rules, and the handoff README is
history. Demo: the prototype, opened in a browser, draws the note on Import
setup and on Scan, and the Reset dialog's four items.

### Acceptance criteria

- [ ] The Sheet note's words match the handoff exactly, on both pages,
      with `_meta\familyflix-library.csv` in mono.
- [ ] The note is 13px sans, faint ink, 8px above, line-height 1.5, the
      folder-first rule's style.
- [ ] _What stays_ lists the handoff's four items in order. The title,
      subtitle, _What goes_, the refusal and the buttons are unchanged.
- [ ] `COMPONENT-SPEC.md`'s three rows name the Sheet note and the new
      item.

---

## Phase 4: Said aloud

**User stories**: 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 32

### What to build

The note and the dialog item in the app, a 1:1 translation of the amended
prototype. `FolderShapes` draws the Sheet note as a second paragraph in the
folder-first rule's style, with the path in `Mono`. It takes no props, so
Import setup and the Library folders page's Scan draw the same note.
`ResetDialog`'s `WHAT_STAYS` gains the sheet as a plain string second.
Demo: Import setup and a group's Scan both draw the note, and Settings →
Storage → Reset… lists four items under _What stays_.

### Acceptance criteria

- [ ] `FolderShapes` draws the Sheet note's exact words, with
      `_meta\familyflix-library.csv` in the mono face.
- [ ] Import setup and the Library folders page's Scan both draw the note.
- [ ] `ResetDialog`'s _What stays_ lists four items, the sheet second, in
      the handoff's words, and nothing else in the dialog changes.
- [ ] No snackbar, toggle or new control is added.

---

## Phase 5: Walk it live, then the documents

**User stories**: 28, 34 (and 1 to 27 checked live)

### What to build

The acceptance walk in the shell (`npm run electron:dev`), done by the
agent, followed by the documents. The walk:

1. A fresh Library folder, scanned and rated, grows
   `_meta/familyflix-library.csv`, the first entry when the folder is
   listed.
2. A copied library with `Meta/` and a second file in it is moved on scan,
   both files intact.
3. With the sheet held open from another process, a scan still records
   into `Meta/`. After the handle is released, the next rating moves it.
4. An old Export with `Meta/` imports with its art.
5. Import setup and the Library folders page draw the note, and the Reset
   dialog lists four items.
6. A reset then a scan brings the library back. After `_meta/` is deleted,
   a reset then a scan starts clean, and the end of the scan writes a fresh
   sheet.

Then the documents: CLAUDE.md's Architectural Boundaries line (the writer
rewrites `_meta/familyflix-library.csv` and makes the one Meta move), the
docblocks of every changed unit (`folderLayout`, `walkLibraryFolder`,
`sheetRootOf`, `createLibrarySheet`, `writeExport`, `createImporter`,
`FolderShapes`, `ResetDialog`), and the checklist's step 56 entry.

### Acceptance criteria

- [ ] Each of the walk's six checks passes in the shell.
- [ ] CLAUDE.md names `_meta/familyflix-library.csv` and the Meta move in
      its rule on who writes into a Library folder.
- [ ] Every changed unit's docblock describes its new face. The older
      handoff READMEs and the README are untouched.
- [ ] The checklist's step 56 entry describes the initiative and stays 🔜.
- [ ] The full suite and the typecheck (`--force`) are green.

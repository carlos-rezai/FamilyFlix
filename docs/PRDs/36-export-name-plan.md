# Plan: Export name — the Export folder's name as an editable field

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/294

Today every export gets the same name, `familyflix-collection_DD-MM-YYYY`.
A second export on the same day becomes `… (1)`, and a copy made for a
relative still reads as a dated backup. The Export dialog lets the maintainer
choose _where_ the folder goes, but not what it is called.

This is build step 19, the fourth of the third chain (log 32 Q6a), and a
`feat:`. The PRD and design log 36 decide that it ships as **one issue with
two commits**, and the plan keeps that. A `refactor:` commit comes first and
renames `ExportSummary.folderName` to `defaultName` with no change in
behaviour. Then a `feat:` commit adds the whole slice. The rename prepares the
slice and is not a vertical slice of its own, so it is the phase's first
commit rather than a phase.

## Running the phase

Phase 1 runs AFK under `issue-loop`. The prototype revision comes first in the
same issue, before the code (log 36). It reshapes one row of a file that
already exists, so it does not need a HITL stop.

## Architectural decisions

Durable decisions that apply across the phase:

- **Routes**:
  - `GET /api/export` answers the **Export summary** with `defaultName` in
    place of `folderName`, with the same value: today's dated name.
  - `POST /api/export { format, destination, name, images, subtitles }`.
    A refusal answers `400 { error, field }`, which is `POST /api/import`'s
    shape. `field` is `'destination'` or `'name'`. A malformed body, such as a
    non-string `name`, is `400` with a sentence and **no** field.
- **Schema**: no migration.
- **Key models**:
  - `ExportField = 'destination' | 'name'`, typed in the export types beside
    `ExportSummary`, following `ImportField`'s precedent.
  - `StartExport` gains `name: string`. `ExportSummary.folderName` becomes
    `defaultName`.
  - **Name refusal**: one of `unnamed`, `too-long` (over 200 characters),
    `bad-character` (`< > : " / \ | ? *` or a control character),
    `bad-ending` (a trailing space or dot, which covers `.` and `..`) and
    `reserved` (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, in
    any case, before any extension), checked in that order. Windows' rules
    apply on every platform.
  - The **Export refusal** is the three destination kinds (`relative`,
    `missing`, `read-only`) plus the five name kinds. Each maps to one sentence
    and one field in the route's table.
- **Boundaries**:
  - The rule for an acceptable name is spelled once, on the server beside the
    dated-name writer (the reader-beside-writer precedent of `yearSpan` and
    `episodeTag`). It is a **security boundary**: it is the only thing between
    the typed string and the `join` under the destination. It refuses and
    never sanitises. Nothing is stripped or trimmed, and `safeFilename` is not
    used.
  - The body reader checks only that `name` is a string. What a folder may be
    called is the domain's rule.
  - The writer checks the destination first and the name second. Either
    refusal makes nothing on disk. The writer stops reading the clock; the
    dated name has one caller, the summary.
  - A taken name is still numbered `… (1)`. The sheet takes the requested
    name: `<name>.xlsx`, or `<name>.csv` beside `<name>-episodes.csv`.
  - The client never checks the name. It shows one refusal at a time, under
    the field it names, until the next press of _Export_. A `400` without a
    known field rejects like any other failure.
  - The name follows _Save to_'s rule: it is filled from the summary unless it
    was edited first, and every open resets it.

---

## Phase 1: The Folder name field

**User stories**: 1–32

### What to build

**Commit 1, `refactor:`.** Rename `ExportSummary.folderName` to
`defaultName` through the type, the summary builder, the hook, the dialog,
their suites and the ExportModal entry in `COMPONENT-SPEC.md`. Nothing
changes in behaviour.

**Commit 2, `feat:`.**

1. **The prototype.** Revise it first. In the ExportModal prototype, the name
   row becomes the _Folder name_ section: a label row with the count at
   `space-between`, then a `prim.TextField` (folder icon, mono, not rounded,
   bound to `onName`), then a danger sentence shown when `nameRefused` is set.
   _Save to_'s refusal reads `destinationRefused`. `COMPONENT-SPEC.md` gains
   `name` beside `defaultName`.
2. **The rule.** Add the pure name check beside the dated-name writer, with a
   suite covering each kind at its edge.
3. **The server.** The body reader carries `name`. The writer checks the
   destination and then the name, and names the folder and the sheet after the
   request. The route's refusal table gains a field on every entry and answers
   `400 { error, field }`.
4. **The client.** The wire call reads `{ kind: 'refused', field, sentence }`
   off a `400` with a known field. The hook gains `name` and `setName`, with a
   name-edited mark beside the destination's, and posts the name. Its refusal
   carries its field. The dialog draws the _Folder name_ section after
   _Save to_: the heading with the title count at its right end (absent until
   the summary lands), the `TextField` primitive (folder glyph, `mono`, not
   rounded, `aria-label="Folder name"`, placeholder `familyflix-collection`),
   and the refusal under it. The old name row retires.

When this phase is done, the maintainer can type `For Uncle` in the Export
dialog and get a `For Uncle` folder holding `For Uncle.xlsx`. An untouched
dialog exports exactly as it does today, and a bad name is refused with one
sentence under the field, with nothing made on disk.

### Acceptance criteria

- [ ] The `refactor:` commit renames `folderName` to `defaultName`
      everywhere. Every suite passes with only the rename changed
- [ ] The ExportModal prototype draws the _Folder name_ section under
      _Save to_, with the count in its label row and the two refusals split
      into `destinationRefused` and `nameRefused`
- [ ] The name rule passes a 200-character name and refuses 201 as
      `too-long`. `con.txt` and `Lpt9` are `reserved` and `CONSOLE` is not.
      `..` is `bad-ending`. `a/b`, `a\b` and a tab are `bad-character`.
      Whitespace-only is `unnamed`. The dated name and `Heat (1995) – kopia`
      pass. The kinds are checked in their order
- [ ] Nothing is stripped or trimmed from a name anywhere on the server
- [ ] The body reader carries `name` and refuses a non-string `name` with a
      sentence
- [ ] The folder and the sheet take the requested name, and a taken name is
      numbered `… (1)`
- [ ] A refused name makes nothing at the destination. A destination refusal
      wins over a name refusal
- [ ] `POST /api/export` answers `400 { error, field }` for one refusal of each
      field, with the PRD's eight sentences. A non-string `name` gets `400`
      with no field
- [ ] `GET /api/export` carries `defaultName` as today's dated name
- [ ] The wire call reads `field` and `sentence` off a `400`, and a `400`
      without a field rejects
- [ ] The hook fills the name from `defaultName`, never over a typed name, and
      resets it on every open. The name is sent in the body. The refusal
      carries its field and is kept until the next press
- [ ] The _Folder name_ field comes after _Save to_. Its count is absent
      before the summary lands. A name refusal is drawn under the name field
      and not under _Save to_, and the other way round. Typing reaches the
      posted body
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

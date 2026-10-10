# Refactor plan: Export name — the refusal table's shape restored, one reading of a fielded refusal, one spelling of what Windows refuses, the tests that say what they prove, and the docs that close it

> Source initiative: [`export-name`, issue #294](https://github.com/carlos-rezai/FamilyFlix/issues/294)
> Shipped by issue 295 (`04636ab` refactor, `bf0b4b6` RED, `13c4d0b` GREEN).
> Design log: `docs/design-logs/36-export-name.md`. Plan:
> `docs/PRDs/36-export-name-plan.md`.
> Filed as issue 296.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`export-name` shipped as log 36 Q10 ruled: a `refactor:` commit that renamed
`ExportSummary.folderName` to `defaultName`, then one `feat:` slice. The slice
revised `feat.ExportModal.dc.html` and `COMPONENT-SPEC.md`, added
`exportNameRefusal` beside `exportName`, carried `name` through `exportBody`
and `writeExport` (which stopped reading the clock), gave every
`EXPORT_REFUSALS` entry a `field`, taught `startExport` to read it, gave
`useExport` a name and a fielded refusal, and drew the _Folder name_ section.

Every log-36 ruling was checked against the code for this plan. Q1–Q4 and
Q6–Q10 hold. The five name kinds are checked in their order, nothing is
trimmed, the destination is checked before the name, the client never checks
the name, every open resets both fields, and the prototype came first. The
export suites are green: 185 server leaves across 13 files and 135 client
leaves across 7. What the slice left behind falls into five groups.

### 1. The route's refusal table lost its status

Every refusal table in `routes/index.ts` has the shape
`{ status, error }`: `FOLDER_REFUSALS`, `DECISION_REFUSALS` and the
enrichment start's table. The route reads `status` off the entry. Log 36's
Design gave `EXPORT_REFUSALS` the type `{ status, field, error }`. The slice
added `field` but replaced `status` with it, and the route now writes a
literal `400`. That makes it the one table whose entries don't say how they
are answered. Its docblock still reads "How each refused export destination is
answered: a `400` and its sentence". The route's comment over
`POST /api/export` took the slice's edit without being reflowed.

### 2. The body reads the name out of the dialog's order

Log 36 Q5 checks the destination before the name "top to bottom as the
dialog draws them", so a body wrong in two ways earns the upper field's
sentence. `writeExport` keeps that rule, but `exportBody` doesn't. It checks
format, destination, the two _Include_ booleans, and then the name.
`StartExport` declares `name` last too, where log 36's Design put it after
`destination`. The docblock took the edit without being reflowed, so one line
runs past the width. `writeExport`'s docblock has a ragged reflow too.

### 3. Two spellings of one rule, on each side of the wire

- **The forbidden characters.** `exportName`'s `BAD_CHARACTER` and
  `exportRows`' `UNSAFE_IN_NAME` are the same character class
  (`[<>:"/\\|?*\u0000-\u001f]`) with the same meaning, "what Windows refuses
  in a folder name". The first refuses a name the maintainer typed. The second
  strips a title's folder inside the export. Each carries its own
  `eslint-disable`. The purposes differ, but the class should be spelled once.
- **The fielded refusal.** `api.ts` has `isRefusal` (import, `sheet | root`)
  and `isExportRefusal` (export, `destination | name`). They are the same
  guard, differing only in the two field names, and each spells its type's
  union a second time as `field === … || field === …`. `EXPORT_FORMATS` and
  `MOVIE_SORTS` show the codebase's way of doing this: an `as const` list the
  union is derived from, so a value can be checked against the same
  declaration that names it.
- **`refusalSentence`'s docblock** says "the export's and the folder add's
  refusals both read through it". Only the folder add does now.

### 4. Names the second field made wrong

- `useExport` exports an interface called `ExportRefusal`. That is a
  different thing from the server's `ExportRefusal` (the union of eight
  kinds), in the same initiative, under the same name. It is used only inside
  the hook.
- `useExport`'s destination setter is still `setField`, beside the new
  `setNameField`. With two fields, "field" doesn't say which one.
- The hook's docblock lists "the format, the summary, the destination" and
  leaves out the name. It also took the edit without being reflowed.
  `ExportModal`'s docblock has a line past the width.
  `ExportModal.styles`' `SectionLabel` lists four sections and leaves out
  _Folder name_. The `PathRow`/`Refusal` re-export says "a refused
  destination's line", but it draws the name's too.

### 5. Tests that don't prove what they say, and docs not yet ticked

- **A backslash that is a backspace.** In JavaScript, `'a\b'` is `a`, the
  backspace control character, then `b`. It is not a backslash.
  `exportName.test` labels that case _a backslash_ and checks a real one
  separately (`String.raw`), so the suite holds and only the label is wrong.
  `writeExport.name.test` labels it _a name with a backslash_ and has no real
  one, so the writer is never shown to make nothing for a backslash, which is
  the separator that matters on Windows.
- **"Dated" where the name is now asked for.** `writeExport.test`'s _gains
  the dated folder_ and `routes.export.test`'s _leaves the dated folder on
  disk_. Both route POST suites (`routes.export.test`,
  `routes.exportSeries.test`) name every request `exportName(new Date())`, so
  they look as if the POST still reads the clock. It doesn't. Only the
  summary's leaf should reach for the clock.
- **`ExportModal.name.test`'s helper is `folderName()`**, which is the
  retired summary field's name, used for the new field.
- **The glossary.** **Export summary** still lists `folderName` and "the
  `N titles` label on the name row". **Export dialog** still draws "the name
  row". **Export ready** says a refusal shows "under _Save to_". **Export
  name** still sits under the 🔜 note.
- **CLAUDE.md.** Step 19 and its Maintainer tools entry are 🔜. The tree's
  `exportName/` line doesn't mention `exportNameRefusal`. The `writeExport/`
  and `exportBody/` lines don't mention the name. The `useExport/` and
  `ExportModal/` lines still describe the name row.
- **README.** Step 19 and its status row are 🔜.
- **The dev journal** has no entry for the build and none for this round.

## Solution

Five groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry first, so it describes what
   shipped before this round changes anything.
1. **The server.** The refusal table's shape, the body read in the dialog's
   order, and one spelling of the forbidden characters.
2. **The client.** The fields as lists, one fielded-refusal reader, and the
   hook's and dialog's names and docblocks.
3. **The tests' tidies.** The real backslash, and "dated" retired where the
   name is asked for.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 294 and this issue.

That's fifteen commits. No pixel, sentence, status, schema or prototype
changes. One wire behaviour changes: a body wrong in both its name and its
_Include_ booleans now earns the name's sentence (group 1). Our client never
sends such a body.

## Commits

### Group 0: the record of what was built

1. **The journal's export-name build entry.** A new top entry, _Export name
   (issue #295)_, with the same sections as the earlier build entries:
   - What shipped: the rename, the prototype and spec revision,
     `exportNameRefusal` and its suite, the body's `name`, the writer's name
     and its lost `now`, the fielded `EXPORT_REFUSALS`, `startExport`'s
     field, the hook's name and refusal, and the _Folder name_ section. That
     was one refactor commit, one RED and one GREEN, as Q10 ruled.
   - The deviation the build made: `EXPORT_REFUSALS` lost `status`, where log
     36's Design kept it beside `field`.
   - The judgement calls left for this round: items 1–5 above, by name.
   - What was deliberately not built: everything log 36 rules out.
   - The test and file counts at the end of the build, measured at
     `13c4d0b`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the server

2. **`EXPORT_REFUSALS` keeps its status.** Each entry becomes
   `{ status: 400, field, error }`, the shape of `FOLDER_REFUSALS` with
   `field` added, as log 36's Design typed it. The route reads
   `const { status, field, error }` and answers `res.status(status)`, as the
   folder add does. The table's docblock is rewritten to say each refused
   destination or name is answered with a status, the field it names and its
   sentence. The comment over `POST /api/export` is reflowed with its words
   unchanged. Every route leaf passes unchanged, because the answers are
   byte-identical.

3. **The body reads the name after the destination.** `exportBody` checks
   format, destination, name, then the two booleans, which is the dialog's
   top-to-bottom order and the order log 36 Q5 gave the writer. It builds its
   value in the same order. `StartExport` declares `name` after
   `destination`, as log 36's Design does. The docblock is rewritten in that
   order and reflowed. One new `exportBody` leaf covers a body with a
   non-string name _and_ a non-boolean `images`: it earns the name's sentence.
   Every existing leaf passes unchanged, because each is wrong in one way
   only.

4. **`writeExport`'s docblock reflowed.** The ragged lines ("inside it
   exclusively, / copy each file") are rewrapped to the file's width, with the
   words unchanged. Comments only.

5. **One spelling of what Windows refuses in a folder name.** `exportName`
   exports its character class as `FORBIDDEN_IN_NAME`. It is non-global and
   documented as the one spelling, so it carries the module's one
   `eslint-disable`. `exportNameRefusal` tests against it. `exportRows`
   drops `UNSAFE_IN_NAME` and its `eslint-disable`, and builds its global
   replacer from the shared class's source, so no `lastIndex` is ever shared
   between a test and a replace. Its docblock points at `exportName` as the
   owner. Every `exportName` and `exportRows` leaf passes unchanged.
   `safeFilename` in `media/` is a file's rule in another domain and is not
   touched.

### Group 2: the client

6. **The fields as lists.** In the shared types, `EXPORT_FIELDS =
['destination', 'name'] as const` and `IMPORT_FIELDS = ['sheet', 'root']
as const`, each with its union derived (`(typeof X)[number]`), following
   `EXPORT_FORMATS`. `ExportField` and `ImportField` keep their names and
   meanings. The types barrel exports both lists. Every suite passes
   unchanged, and the typecheck carries it.

7. **One reader of a fielded refusal.** `api.ts` replaces `isRefusal` and
   `isExportRefusal` with one generic guard,
   `isFieldRefusal(body, fields)`. It answers whether a body is
   `{ error: string; field: F }` for a field in the list it is given.
   `startImport` calls it with `IMPORT_FIELDS` and `startExport` with
   `EXPORT_FIELDS`. `refusalSentence`'s docblock names its one remaining
   caller, the folder add, and the function moves to sit above
   `addLibraryFolder`, which reads it. Every `api` leaf passes unchanged,
   including _a `400` without a field rejects_ for both.

8. **The hook's names.** `useExport`'s exported `ExportRefusal` interface
   becomes `ExportFieldRefusal`, so it no longer shares a name with the
   server's kind union. The destination's setter becomes
   `setDestinationField`, beside `setNameField`. The hook's docblock names
   the name among what the dialog holds, and is reflowed. The per-field
   docblocks are unchanged. Every `useExport` leaf passes unchanged.

9. **The dialog's docblocks.** `ExportModal`'s docblock is reflowed to the
   file's width, with the words unchanged. In `ExportModal.styles`,
   `SectionLabel` lists _Folder name_ among the sections, and the
   `PathRow`/`Refusal` re-export says it draws _Save to_'s row and a refused
   field's line. Comments only.

### Group 3: the tests' tidies

10. **A backslash is a backslash.** In `exportName.test`, the `'a\b'` case
    is relabelled _a backspace_, which is the control character it is, and
    stays as a control-character case beside the NUL and the unit separator.
    The `String.raw` case becomes _a backslash_. In `writeExport.name.test`,
    the _makes nothing_ table's backslash case is spelled `String.raw`, so
    the writer is shown to make nothing for a real `\`. Test only. The leaf
    count is unchanged.

11. **"Dated" retired where the name is asked for.** `writeExport.test`'s
    _gains the dated folder_ becomes _gains the named folder_.
    `routes.export.test`'s _leaves the dated folder on disk_ becomes _leaves
    the Export folder on disk_. Both route POST suites name their requests
    with one module-level `NAME` constant instead of `exportName(new Date())`,
    so only the summary's leaf reads the clock. `ExportModal.name.test`'s
    `folderName()` and `folderNameLabel()` helpers become `nameField()` and
    `nameLabel()`. Test only. The leaf count is unchanged.

### Group 4: the docs

12. **The glossary.**
    - **Export summary**: lists `defaultName`, and its count sits "on the
      _Folder name_ label row".
    - **Export dialog**: draws the **Folder name field** where it drew the
      name row.
    - **Export ready**: a refusal shows "under the field it names".
    - **Export name**: says it is the **Folder name field**'s default and
      whatever the maintainer types there, refused by a **Name refusal** and
      never stripped. The 🔜 note above the section drops its step-19
      sentence.
    - **Folder name field** and **Name refusal**: drop _(new)_ as the earlier
      rounds did.

    Docs only.

13. **CLAUDE.md ticks step 19.** The tree lines change as follows:
    - `exportName/`: names `exportNameRefusal`, the reader beside the writer,
      and the one spelling of the forbidden characters.
    - `exportBody/`: names the name, read as a string.
    - `writeExport/`: checks the destination, then the name, and names the
      folder and the sheet after the name asked for.
    - `useExport/`: the name filled from `defaultName`, never over an edit,
      and the fielded refusal.
    - `ExportModal/`: the **Folder name field** in place of the name row.
    - The Bulk import / export section: the Export folder is named by the
      **Folder name field**, prefilled with
      `familyflix-collection_DD-MM-YYYY`.

    Step 19 and the Maintainer tools entry _Export name_ become ✅. Docs
    only. Closes 294.

14. **README ticks step 19.** Step 19 and its status row become ✅. Docs
    only.

15. **The refactor's journal entry.** A new top entry, _Export name refactor
    (issue 296)_, with the same sections as issue 293's entry: what each group
    changed, the one wire behaviour that moved (group 1's doubly malformed
    body), the counts, and the follow-ups by bare number. Docs only. Closes
    this issue.

## Decision Document

- **Every refusal table is `{ status, … , error }`.** `EXPORT_REFUSALS` adds
  `field` to that shape. It doesn't replace `status`. The route reads every
  status off its table.
- **The dialog's order is the wire's order.** `exportBody` checks the
  destination, then the name, then the booleans, and `StartExport` declares
  its fields in that order. A body wrong in two ways earns the upper field's
  sentence, the same rule as the writer.
- **What Windows refuses in a folder name is spelled once**, as
  `FORBIDDEN_IN_NAME` in `exportName`. The name check tests against it, and
  the title-folder namer in `exportRows` strips with a global copy of it.
  Refusing and stripping stay separate behaviours over one class. A typed
  name is never stripped.
- **A field list is an `as const` list.** `EXPORT_FIELDS` and
  `IMPORT_FIELDS` follow `EXPORT_FORMATS`, and the unions are derived from
  them.
- **One guard reads a fielded refusal.** `isFieldRefusal(body, fields)` in
  `features/import-export/api/` serves both starts. It stays in that file
  because both callers live there. It doesn't graduate to `src/api/`,
  because no other feature reads it.
- **The client's refusal shape is `ExportFieldRefusal`.** Server and client
  no longer share a name for two different things.
- **Unchanged:** every sentence, every status, every field name, the
  prototype, `exportNameRefusal`'s kinds and order, the 200 cap, numbering,
  _Export ready_, `safeFilename`, and `refusalSentence`'s behaviour.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, or what a
  person sees. It never checks how a unit is wired inside. Server units are
  tested over sandboxes and the route over the composed router. The hook and
  the dialog are tested through the DOM and `fakeResponse`.
- **`exportBody`**: one new leaf, a body wrong in its name and its booleans
  earning the name's sentence. Prior art: its own leaves for a body wrong in
  two ways.
- **`exportName`, `exportRows`**: no new leaves. They pass unchanged over
  the shared class, which proves it is the same class.
- **`writeExport`**: the _makes nothing_ table checks a real backslash. Its
  leaf count is unchanged.
- **`api`**: no new leaves. The field-reading and fieldless-`400` leaves for
  both starts already pin the shared guard.
- **Routes**: no new leaves. Commit 2 must leave every `400 { error, field }`
  byte-identical, which the existing leaves check.
- Every commit runs the touched suites, `tsc -b --force`, ESLint and
  Prettier, and they must be green. The full suite runs before the docs
  group.

## Out of Scope

- `exportRows`' title-folder namer learning the reserved names (`CON`, …) or
  the 200 cap. That would be a change in behaviour to the export's inner
  folders, with its own question. It is recorded in the journal as a
  follow-up.
- `safeFilename` in `media/`. It is a file's rule in another domain.
- Renaming the prototype's `rowLabel` or `counted`. The prototype is the
  spec, and its data names are not wrong, only old.
- Clearing a refusal on the next edit (ImportFlow's rule). Log 36 Q6 kept the
  Export's own rule.
- Moving the client's fielded-refusal guard to `src/api/`. Only one feature
  reads it.
- Splitting or merging the `writeExport.*` and `routes.export*` suites.

## Further Notes

- Log 36 is an immutable snapshot. The journal records that the build
  dropped `status` from `EXPORT_REFUSALS` against log 36's Design, and that
  commit 2 restores it.
- The forbidden-character class has a third look-alike in
  `media/safeFilename`. It is deliberately left apart because it guards a
  file inside a Movie folder in another domain (log 36 Q4). The journal
  records it so that a later round doesn't mistake it for an oversight.

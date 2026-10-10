> **Initiative:** `export-name`
> **Design log:** `docs/design-logs/36-export-name.md`
> **Issue:** #294
> **Build order:** step 19, the fourth of the third chain (log 32 Q6a). It ships as one `refactor:` and then one `feat:`

## Problem Statement

I keep the family library up to date, and I export it from Settings. Every
export gets the same name, `familyflix-collection_DD-MM-YYYY`. If I export
twice in one day, the second becomes `familyflix-collection_10-10-2026 (1)`,
and I can't tell which is which without opening them. When I make a copy for
a relative, say an Excel sheet of the films for my uncle, it still reads as a
dated backup, and I rename it in Explorer afterwards. The dialog already lets
me choose _where_ the folder goes. It doesn't let me choose what it is
called.

## Solution

The Export dialog's name row becomes a **Folder name field**. It sits under
_Save to_, in the same shape: a heading with the title count at its right
end, then a mono text field with the folder glyph. The field starts at
today's dated name, so pressing _Export_ without touching it does what it
does now. Once I type in it, the dialog never overwrites my name, even if the
summary arrives late. This is the same rule _Save to_ follows.

The server decides whether a name is acceptable. If a folder can't be called
that on Windows (empty, too long, a forbidden character, a trailing space or
dot, or a name Windows reserves), the export is refused with one plain
sentence under the name field. Nothing is made. FamilyFlix never quietly
strips or trims what I typed. If the destination is also wrong, I hear about
the destination first, because it is the field above. A name that is already
taken is still numbered `… (1)`, and the sheet inside takes the name I asked
for.

## User Stories

1. As the maintainer, I want to type the Export folder's name, so that an export made for someone reads as theirs rather than as a dated backup.
2. As the maintainer, I want the field to start at today's `familyflix-collection_DD-MM-YYYY`, so that an export I don't name behaves exactly as it does today.
3. As the maintainer, I want the field under _Save to_, so that the dialog reads top to bottom as where, then what it's called.
4. As the maintainer, I want the field to look like _Save to_ (a heading, then a boxed mono field with the folder glyph), so that the two path-like fields read as a pair.
5. As the maintainer, I want the title count (`142 titles`) kept at the right of the name's heading, so that I still see how much is about to be written.
6. As the maintainer, I want the count missing rather than wrong while the summary loads, so that the dialog never shows a number it doesn't have.
7. As the maintainer, I want my typed name kept when the summary lands after I started typing, so that a slow summary never wipes what I wrote.
8. As the maintainer, I want every open of the dialog to start from today's name again, so that last time's name for my uncle doesn't leak into today's backup.
9. As the maintainer, I want the placeholder to read `familyflix-collection` when I clear the field, so that I can see what kind of name belongs there.
10. As the maintainer, I want the name I typed sent with the export, so that the folder on disk is called what I asked for.
11. As the maintainer, I want the sheet inside the folder named after the name I asked for, so that the folder and its sheet match (`For Uncle.xlsx`, or `For Uncle.csv` beside `For Uncle-episodes.csv`).
12. As the maintainer, I want a name already taken at the destination numbered `For Uncle (1)`, so that an export never writes into or over a folder that exists.
13. As the maintainer, I want _Export ready_ to show the folder actually made, numbered or not, so that I know where to look.
14. As the maintainer, I want an empty or whitespace-only name refused with "Give the export folder a name.", so that I never get a folder with no name.
15. As the maintainer, I want a name over 200 characters refused with "Keep the name under 200 characters.", so that the numbered folder and the episodes sheet still fit inside Windows' limit.
16. As the maintainer, I want a name containing `< > : " / \ | ? *` or a control character refused with a sentence that lists them, so that I know which characters to remove.
17. As the maintainer, I want a name ending in a space or a dot refused with "A folder name can't end in a space or a dot.", so that I'm told instead of Windows quietly dropping it.
18. As the maintainer, I want `CON`, `NUL`, `COM1`, `LPT9` and the other reserved names (any case, with or without an extension) refused with "Windows keeps that name for itself. Choose another.", so that I never make a folder Explorer can't open.
19. As the maintainer, I want a name like `CONSOLE` or `Heat (1995) – kopia` accepted, so that the rules refuse only what Windows refuses.
20. As the maintainer, I want nothing stripped or trimmed from my name, so that the folder is either exactly what I typed or refused with a reason.
21. As the maintainer, I want a name refusal drawn under the name field and a destination refusal under _Save to_, so that each sentence sits beside the thing to fix.
22. As the maintainer, I want only one refusal shown at a time, the destination's first when both are wrong, so that I fix the dialog from top to bottom.
23. As the maintainer, I want a refused export to make nothing on disk, so that a bad name leaves no half-made folder behind.
24. As the maintainer, I want the refusal to stay until I press _Export_ again, so that it behaves as _Save to_'s refusal does today.
25. As the maintainer, I want the name never checked as I type, so that the field doesn't nag me while I'm halfway through a word.
26. As the maintainer, I want a name containing a path separator or `..` refused, so that an export can only ever be created directly inside the destination I chose.
27. As a developer, I want a server answer of `400` without a field treated as a failure like any other, so that a malformed body we never send can't draw a sentence under the wrong field.
28. As a developer, I want the Export summary's two defaults named `defaultDestination` and `defaultName`, so that the summary reads as what the dialog starts at.
29. As a developer, I want the rule for an acceptable name spelled once, on the server beside the dated-name writer, so that the client can't drift from it.
30. As a developer, I want every Export refusal to carry the field it names, so that a third field later costs one entry in one table.
31. As the maintainer, I want the prototype to show the _Folder name_ section before the code does, so that the prototype stays the spec.
32. As a family member, I want nothing on my screens to change, so that browsing and watching look as they did.

## Implementation Decisions

- **Prototype first, in the same issue.** In the ExportModal prototype, the name row becomes the _Folder name_ section. It has a label row with the count at `space-between`, then a `prim.TextField` (folder icon, mono, not rounded, `on-input` bound to `onName`), then a danger sentence shown when `nameRefused` is set. _Save to_'s refusal reads `destinationRefused`. `COMPONENT-SPEC.md`'s ExportModal entry renames `folderName` to `name` and `defaultName`. The composed app prototype needs no edit of its own.
- **Types.** `ExportField = 'destination' | 'name'`, typed in the export types beside `ExportSummary`. This follows `ImportField`'s precedent. `StartExport` gains `name: string`. `ExportSummary.folderName` is renamed `defaultName`.
- **`exportNameRefusal(name)` (new, pure)**, beside `exportName(now)` in the `exportName` unit, following the reader-beside-writer precedent of `yearSpan` and `episodeTag`. It answers `null` or an `ExportNameRefusal`. The kinds are checked in this order:
  - `unnamed`: empty, or whitespace only.
  - `too-long`: more than 200 characters.
  - `bad-character`: any of `< > : " / \ | ? *`, or a control character.
  - `bad-ending`: ends in a space or a dot, which covers `.` and `..`.
  - `reserved`: `CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9` or `LPT1`–`LPT9`, in any case, before any extension.

  Windows' rules apply on every platform. Nothing is ever stripped or trimmed. This check is the only thing between the typed string and the `join` under the destination, so it is a security boundary. It must never relax into sanitising, and `safeFilename` is not used.

- **`exportBody`** reads `name` only as a string. A non-string is a malformed body: `400` with a sentence and no field. What a folder may be called is the domain's rule, not the body reader's.
- **`writeExport`** checks the destination first (`relative`, `missing`, `read-only`) and the name second. A refused name makes nothing. It then makes the folder with `request.name`, which is still numbered when taken, and names the sheet after `request.name`. It loses its `now` parameter and stops reading the clock. `exportName(now)` keeps its one caller, `exportSummary`. `ExportRefusal` becomes the three destination kinds plus `ExportNameRefusal`.
- **The route.** `EXPORT_REFUSALS` gains a `field` on every entry, and `POST /api/export` answers `400 { error, field }`, which is `POST /api/import`'s shape. The sentences:
  - `relative` → `destination`: "Type the full path, starting with a drive letter."
  - `missing` → `destination`: "No folder at that path."
  - `read-only` → `destination`: "FamilyFlix can't write to that folder."
  - `unnamed` → `name`: "Give the export folder a name."
  - `too-long` → `name`: "Keep the name under 200 characters."
  - `bad-character` → `name`: "A folder name can't use < > : \" / \ | ? or \*."
  - `bad-ending` → `name`: "A folder name can't end in a space or a dot."
  - `reserved` → `name`: "Windows keeps that name for itself. Choose another."
- **`GET /api/export`** answers `defaultName` in place of `folderName`, with the same value.
- **`startExport`** answers `{ kind: 'refused', field, sentence }` for a `400` that names a known field. A `400` without one rejects like any other failure, and the dialog is left as it was.
- **`useExport`** gains `name` and `setName`. `setName` marks the name edited through a `nameEdited` ref, beside `edited`, which is renamed `destinationEdited`. The name is filled from `summary.defaultName` unless it was edited first. Every open resets both fields and both refs. `refusal` becomes `{ field, sentence } | null`, one at a time, and is kept until the next press. The name is posted with the request.
- **`ExportModal`** draws the _Folder name_ section after _Save to_. The heading is a `SectionLabel` in a `LabelRow` with the `Count` at its right end, absent until the summary lands. Under it is the `TextField` primitive: folder glyph, `mono`, `rounded={false}`, `aria-label="Folder name"`, placeholder `EXPORT_NAME_PREFIX`. Under that is the `Refusal`, drawn when the refusal names `name`. _Save to_'s `Refusal` is drawn only when it names `destination`. `NameRow`, `NameLead` and `ExportName` retire.
- **No change** to numbering, to _Export ready_ (still `folderNameOf(result.folder)`), to the Include toggles, the column pills, the format cards or _Browse…_.
- **Shipping.** One issue, two commits. First, a `refactor:` renames `ExportSummary.folderName` to `defaultName` with no change in behaviour, through the type, `exportSummary`, the hook, the dialog and their suites. Then a `feat:` slice adds the prototype revision, `exportNameRefusal`, the body's `name`, the writer, the route's fields, `startExport`'s field, the hook's name and refusal, and the _Folder name_ section.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, or what a person sees. It never checks how a unit is wired inside. Server units are tested over sandboxes and the route over the composed router. The hook and dialog are tested through the DOM and `fakeResponse`, never through their internals.
- **`exportName`**: each kind at its edge. 200 characters pass and 201 is `too-long`. `con.txt` and `Lpt9` are `reserved`, and `CONSOLE` is not. `..` is `bad-ending`. `a/b`, `a\b` and a tab are `bad-character`. Whitespace-only is `unnamed`. The dated name and `Heat (1995) – kopia` both answer `null`. The kinds are checked in their order. Prior art: `yearSpan`'s and `episodeTag`'s suites.
- **`exportBody`**: `name` is carried, and a non-string `name` is refused with a sentence. Prior art: its own `destination` cases.
- **`writeExport`**: the folder and the sheet take `request.name`. A taken name is numbered. A bad name makes nothing at the destination. A destination refusal wins over a name refusal. Prior art: its existing destination-refusal and numbering cases.
- **`exportSummary`**: `defaultName` is today's dated name.
- **`routes.export`**: `400 { error, field }` for one refusal of each field. The summary carries `defaultName`. A body with a non-string `name` gets `400` with no field.
- **`api` (`startExport`)**: `field` and `sentence` are read off a `400`, and a `400` without a field rejects. Prior art: `startImport`'s `field` cases.
- **`useExport`**: the prefill from `defaultName`. `defaultName` never lands over a typed name. A reopen resets the name. The name is sent in the body. The refusal carries its field and is kept until the next press. Prior art: the existing _Save to_ prefill cases.
- **`ExportModal`**: the _Folder name_ field comes after _Save to_ (`comesBefore`). The count sits in its label row and is absent before the summary. A name refusal is drawn under the name field and not under _Save to_, and the other way round. Typing reaches the posted body.

## Out of Scope

- Remembering a name between opens. _Save to_ isn't remembered either.
- A name template or date tokens.
- Renaming an Export folder after it is written.
- Checking the name as it is typed, or anywhere in the client.
- Clearing a refusal on the next edit (ImportFlow's rule). The Export keeps its own rule.
- A sheet name that differs from the folder's.
- Any other platform's naming rules. The app ships on Windows only.

## Further Notes

- Glossary entries already written in log 36's commit: **Folder name field**, **Name refusal**, and the `defaultName` rename on **Export summary**. **Export name** moves from 🔜 to the shipped wording when the step's refactor closes. ✅ is ticked in README and CLAUDE.md only after the refactor, not when the build issues close.
- The 200-character cap leaves room under Windows' 255 for ` (999)` and `-episodes.csv`.

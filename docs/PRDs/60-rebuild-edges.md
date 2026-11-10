> **Initiative:** `rebuild-edges`
> **Issue:** #563 (the PRD, step 43)
> **Design log:** `docs/design-logs/60-rebuild-edges.md`
> **Handoff:** `docs/handoff/handoff-rebuild-edges/` (keeps the QA ticket, 562, whole)
> **Build order:** step 43, **Rebuild edges**, the checklist's _Rebuild edges_. It ships as thin slices (log 60, _Implementation Plan_). No migration, no new route, no screen change and no prototype amendment; the new log lines are in the handoff's _Copy_ table.

## Problem Statement

Step 42 made the **Round trip** hold: a library written to its **Library sheet**, Factory reset and rebuilt by one scan comes back equal. But the Library sheet is a file the maintainer opens in Excel, edits by hand and saves back, and a Title folder is one the family adds files to over the years. A second QA pass found the round trip sound and its edges not.

A path cell is trusted: a `Poster` cell of `../secret.txt` copies that file into managed storage as a poster, and the **Layout fill** then writes it into the Title folder as `Images/poster.txt`. _Import from spreadsheet_ reads the same cells from any sheet it is handed.

A sheet resaved by a Dutch or German Excel is `;`-separated and reads as one titleless column; Excel's plain _CSV_ is cp1252 and spells `Amélie` as `Am�lie`. Either way the run's close rewrites the sheet from the library and the maintainer's record (ratings, hearts, Watched) is erased. Cells the reader can't parse (`8,5`, `ja`, a filled Episode `Synopsis`) and a second row for one title are dropped in silence, so the maintainer never learns to fix them before the rewrite erases them.

A held film never takes a poster, backdrop or track put into its folder later, though the sheet already names them; a new season's poster needs a second scan. A track named in its own language (`Nederlands.srt`) or with a region (`heat.pt-BR.srt`) reads as English. `POST /series` links episode videos another title already plays, which the movie add refuses. And both sheets write ragged rows.

## Solution

What the maintainer keeps by hand comes back, whole and safely, with no second reader, no second writer and no new screen.

- A path cell is read only when it is **contained**: relative, inside its own row's Title folder (its first segment the row's **Folder key**, no empty, `.` or `..` segment, no `\` or `:`), and naming its kind (an image for `Poster`, `Backdrop`, `Still`; a subtitle for `Subtitles`). Anything else is read as blank and logged.
- The **Sheet reader** reads the sheet's **Sheet dialect** off its bytes: UTF-8 (a BOM or valid UTF-8) or cp1252, `,` or `;`. A decimal comma is read in any sheet.
- The **Library sheet writer** keeps the dialect it found: a `;` sheet is rewritten `;` with decimal commas, a `,` sheet keeps today's bytes, both UTF-8 behind a BOM. A sheet the reader refuses is never replaced; the scan says so.
- Every cell the reader can't take is an **Unread cell**, one Warning line each; two rows for one title read the first and say so; a Meta sheet's titleless row is no longer silent.
- An Episode row's `Synopsis` is not an episode's field: a filled one is an Unread cell.
- A rescan fills a held film's empty poster and backdrop and adds tracks of languages it holds none of, as it does a held series', and runs after the run's new episodes so a new season's poster lands on the same scan. The `✓ Updated` line names what was taken.
- A track named by a pool language's own name, or with a region subtag, reads as that language.
- `POST /series` refuses a held video with the movie add's `409 <Title> already plays this file.`
- Every sheet row is written as wide as its header.

## User Stories

### Contained path cells

1. As the maintainer, I want a path cell that climbs out of its Title folder (`../secret.txt`) not read, so that a sheet can never copy a file from outside my library into it.
2. As the maintainer, I want a path cell whose first segment is not its row's Folder key not read, so that one title's row can't take another title's art.
3. As the maintainer, I want the Folder key in a path cell compared as Folder keys are (`sameFolderKey`), so that a cell written by another Excel's casing still reads.
4. As the maintainer, I want a path cell holding an empty, `.` or `..` segment not read, so that `Ronin (1998)/../../private/diary.srt` is refused even though it starts with the Folder key.
5. As the maintainer, I want a path cell holding `\` or `:` not read, so that an absolute or drive-lettered path can't slip in on Windows.
6. As the maintainer, I want a `Poster`, `Backdrop` or `Still` cell read only when it names an image, so that a text file never becomes a poster.
7. As the maintainer, I want each `Subtitles` path read only when it names a subtitle, so that a diary never becomes an English track.
8. As the maintainer, I want the `Video` cell passed unchecked, since no import reads it, so that the rule is spelled only where it matters.
9. As the maintainer, I want a refused path cell read as blank and logged as an Unread cell (`⚠ Ronin (1998): Poster "../secret.txt" not read`), so that I see what the sheet tried.
10. As the maintainer, I want _Import from spreadsheet_ held to the same rule, since it goes through the same reader, so that no sheet I'm handed can reach outside its folders.
11. As the maintainer, I want the ticket's Ronin repro to copy nothing into managed storage and write nothing into the Title folder, so that the bug's own case is the demo.
12. As the maintainer, I want the check made once, by the reader, lexically over the cell, so that the rule can't drift between the scan and the upload and needs no disk.

### Excel-saved sheets

13. As the maintainer, I want a sheet resaved `;`-separated by a Dutch or German Excel read in columns, so that my record survives the Excel I own.
14. As the maintainer, I want the separator read off the header row (more `;` than `,` outside quotes means `;`), so that no setting is needed.
15. As the maintainer, I want a sheet with a UTF-8 BOM, or whose bytes are valid UTF-8, read as UTF-8, so that today's sheets read as they do.
16. As the maintainer, I want a sheet that isn't valid UTF-8 read as cp1252, so that Excel's plain _CSV_ spells `Amélie (2001)` right and matches its folder.
17. As the maintainer, I want an xlsx read as today, with no dialect, so that only CSV changes.
18. As the maintainer, I want a decimal comma (`8,5`, `7,9`) read as a decimal point in any sheet, so that a Rating of `8,5` is 8.5 (rounded to 9 as today) and a TMDB rating of `7,9` is 7.9.
19. As the maintainer, I want the ticket's Heat repro (rated and hearted, resaved `;` and cp1252, Factory reset, rescanned) to rebuild with its rating and heart, so that the bug's own case is the demo.
20. As the maintainer, I want a `;` sheet rewritten `;`-separated with decimal commas, so that my Excel opens it in columns after every rewrite and the loop the ticket found never comes back.
21. As the maintainer, I want a `,` sheet rewritten byte for byte as today, so that nothing changes for a sheet that already worked.
22. As the maintainer, I want every rewritten sheet UTF-8 behind a BOM, so that every Excel reads it; a cp1252 sheet is read once as cp1252 and written back as UTF-8.
23. As the maintainer, I want a brand-new Library sheet written `,`, so that the default is unchanged.
24. As the maintainer, I want an Export always written `,`, so that an Export is the same whoever's Excel last touched the Library sheet.
25. As the maintainer, I want a sheet on disk that the reader still refuses never replaced by the writer, so that a sheet I can still fix is never erased.
26. As the maintainer, I want such a sheet left until it reads or I remove it, as a New folder's sheet is, so that the rule matches the one I already know.
27. As the maintainer, I want the scan's line to say it was left: `⚠ Could not read <path>, scanned without it and left as it is`, so that I know the library and that sheet now drift.
28. As the maintainer, I want the Round trip test to hold over a `;`-separated sheet too, so that the second spelling is proved, not assumed.

### Unread cells and duplicates

29. As the maintainer, I want one Warning line per filled cell the reader can't take, so that I can fix the sheet before the rewrite on close erases it.
30. As the maintainer, I want a Movie or Series row's line to name its Folder key: `⚠ Heat (1995): Rating "8½" not read`.
31. As the maintainer, I want a Season row's line to name its season: `⚠ Tidewater (2018) Season 1: Poster "x.txt" not read`.
32. As the maintainer, I want an Episode row's line to name its tag: `⚠ Tidewater (2018) S01E02: Status "half" not read`.
33. As the maintainer, I want `Year`, `Season`, `Episode`, `Rating`, `Runtime`, `TMDB rating`, `TMDB id` and `Air date` each an Unread cell when filled and unparseable, so that no number or date is dropped in silence.
34. As the maintainer, I want an unknown `Type` logged and still read as Movie, as a blank one is, so that a typo is seen and the row isn't lost.
35. As the maintainer, I want `Status` read only from its yes-list (`Watched`, …) and its spelled no-list (`no`, `false`, `0`, `unwatched`, `in progress`), anything else an Unread cell, so that `half` is named, not folded to unwatched.
36. As the maintainer, I want `Favorite` read only from its yes-list and its no-list (`no`, `false`, `0`), anything else an Unread cell, so that `ja` is named and I learn to write `Yes`.
37. As the maintainer, I want no new synonyms (`ja`, `nee`), so that the lists stay bounded and the line tells me what to write.
38. As the maintainer, I want a genre outside the pool to keep its own existing line, so that genres aren't reported twice.
39. As the maintainer, I want a filled Episode row `Synopsis` cell to be an Unread cell, since no screen draws an episode synopsis, so that a hand-entered one isn't dropped in silence.
40. As the maintainer, I want the `Synopsis` column kept in the header and blank on Episode rows, as on Season rows, so that the sheet's shape is unchanged.
41. As the maintainer, I want two rows of the same Row type, Folder key, season and episode to read the first and log `⚠ Heat (1995) is in the sheet twice, the first row read`, so that the rule is the one a person reading top down expects.
42. As the maintainer, I want a titleless row in a Folder scan's Meta sheet logged with the upload's `⚠ Row 12 has no title, skipped`, so that both runs say the same things.
43. As the maintainer, I want the upload and the Folder scan to log every skip through one callback, so that the two runs can't disagree about what they report.
44. As the maintainer, I want the ticket's finding 7 table (`8,5`, `7,9`, `ja`, two rows) to read or say each one, so that the bug's own case is the demo.

### Files put in later

45. As the maintainer, I want a held film's empty poster filled from its Title folder on a rescan, so that a poster I drop into `Images/` later reaches the library.
46. As the maintainer, I want a held film's empty backdrop filled the same way.
47. As the maintainer, I want a held film's path cells to fill an empty place first, as a new film's do, so that the sheet and the folder are read by one rule.
48. As the maintainer, I want a held film never to have art it already has replaced, so that a Synced or picked poster survives a rescan.
49. As the maintainer, I want a track in a held film's folder added when the film holds no track of its language, so that `Subtitles/English.srt` put in later is read.
50. As the maintainer, I want the same track rule for each held episode, so that films and series grow alike.
51. As the maintainer, I want a track whose language the title already holds never added, so that a track the Layout fill wrote out is never read back as a second copy.
52. As the maintainer, I want these fills to need no review row, so that a growing folder needs no settling.
53. As the maintainer, I want the held-files fill to run after the run's new episodes are in, so that a season the same run adds gets its Season poster on that scan.
54. As the maintainer, I want the in-loop Season poster kept for a new series only, so that only one place sets a held series' Season poster.
55. As the maintainer, I want the ticket's Heat repro (poster, backdrop and track added, one _Scan all_) and Sev repro (Season 02 with its poster, one _Scan all_) each to land on one scan, so that the bugs' own cases are the demo.
56. As the maintainer, I want a held title's `✓ Updated` line to name what it took (`poster`, `backdrop`, `season posters`, `stills`, `subtitles`) beside its Sheet fills, film and series alike, so that the log is true; today a filled series is logged _Already in library_.

### Track languages

57. As the maintainer, I want each pool language's own name (`español`, `français`, `deutsch`, `português`, `italiano`, `nederlands`) read as that language, so that `Nederlands.srt` is Dutch.
58. As the maintainer, I want those names matched with diacritics folded, so that `Espanol.srt` and `Francais.srt` read too.
59. As the maintainer, I want a two-letter region after a known code read past (`pt-BR`, `en_GB`), so that `heat.pt-BR.srt` is Portuguese, not English.
60. As the maintainer, I want a folder holding `English.srt` and `Nederlands.srt` to give one English and one Dutch track, so that the ticket's case is the demo.
61. As the maintainer, I want no language library, the seven pool names only, so that the rule stays small.

### The series add, the sheet's shape

62. As the maintainer, I want `POST /series` with an episode video a held title plays refused with `409 <Title> already plays this file.`, naming the first held video's holder, so that two titles never play one file.
63. As the maintainer, I want the refusal made before anything is written, so that a refused add leaves no series, no row and no numbered `Tidewater (2018) (1)` Folder key.
64. As the maintainer, I want the movie add and the series add to share one refusal, so that the sentence and the rule can't drift.
65. As the maintainer, I want the scan's `↓` line kept naming the file under its Library folder's root, as the prototype draws it, so that no prototype is amended for a line that is already true.
66. As the maintainer, I want every row of both sheets padded to its header's width, so that a Season row under the 22-column header has 22 fields and a strict RFC 4180 reader reads it.
67. As the maintainer, I want the Round trip to still hold byte for byte after the padding, so that each sheet is rewritten once, at its next touch, and then stays still.

### Documents

68. As the maintainer, I want the glossary to hold **Sheet dialect** and **Unread cell**, and the updated **Sheet reader**, **Sheet writer**, **Library sheet writer**, **Held video**, **Path cells** and **Language pool**, so that code and docs share one vocabulary (already done in the grill-me commit; kept true by the build).
69. As the maintainer, I want a dev-journal line correcting log 58 Q13's Episode Synopsis tick, since a log is immutable, so that the record is honest.
70. As the maintainer, I want the docblocks of `readSheet`, `writeSheet`, `createLibrarySheet`, `createImporter`, `detectSubtitleLanguage` and `pathCellFills` to say what they now do, so that a reader meets the rules where they live.
71. As the maintainer, I want CLAUDE.md untouched, since the writers into a Library folder are still the two it names.

## Implementation Decisions

- **One initiative** (log 60 Q1), step 43, settling all ten findings of QA ticket 562. Not reopening `rebuild-whole`, which is Done with its refactor.
- **`sheetDialect`**, new and pure (import-export domain, Q5): `sheetDialect(bytes) => { encoding: 'utf-8' | 'windows-1252'; separator: ',' | ';' }`. A UTF-8 BOM or valid UTF-8 is UTF-8, else cp1252 (`TextDecoder('windows-1252')`); `;` when the header row holds more `;` than `,` outside quotes, else `,`. No tabs or other separators.
- **`readSheet`** (Q3, Q5, Q8 to Q12):
  - Its workbook opener decodes a CSV by its dialect and hands `exceljs` the separator; an xlsx is unchanged.
  - A path cell is checked lexically and pure: first segment the row's Folder key by `sameFolderKey`; no segment empty, `.` or `..` or holding `\` or `:`; `Poster`, `Backdrop`, `Still` by `isImageFilename`, each `Subtitles` path by `isSubtitleFilename`. A failing cell is blank and an Unread cell. `Video` is unchecked.
  - A number cell is `-?\d+([.,]\d+)?`, the comma read as the point.
  - Unread cells for every column Q9 lists, `Type` still read as Movie, `Status` and `Favorite` by spelled yes- and no-lists, a filled Episode `Synopsis`.
  - The first of two rows (same Row type, Folder key, season, episode) is read.
  - `onBlankTitle(rowNumber)` becomes `onSkip(skip: SheetSkip)`, `SheetSkip` being `blank-title { rowNumber }`, `unread-cell { label, column, text }` or `duplicate { label }`; `skipLine(skip)` gives each its Log line text.
- **`writeSheet`** (Q6, Q19): `writeSheet(table, format, separator = ',')`; a `;` separator writes decimal commas with it. Every row padded to the header's width. CSV output UTF-8 behind a BOM as today.
- **`createLibrarySheet`** (Q6, Q7): it already reads the file on disk to skip equal bytes; it now takes that file's dialect and rewrites in it, and leaves a sheet the Sheet reader refuses as it is. A new sheet is `,`. Its interface (`touch`, `hold`, `release`, `flush`) is unchanged.
- **Export** always writes `,`.
- **`createImporter`** (Q10, Q13 to Q15):
  - The upload's `SheetRead` and the Folder scan's `readMetaSheet` both pass `onSkip` and log every skip by `skipLine`; a Meta sheet that doesn't read logs `⚠ Could not read <path>, scanned without it and left as it is`.
  - `fillHeldArt` is widened to `fillHeldFiles`: a held film's empty poster and backdrop from its Title folder's read (path cells into empty places first, `filmWithCells`), and for a film and each held episode, each track of a language the title holds none of. Never replacing, no review row.
  - `fillHeldFiles` runs after the run's new episodes are in, walking every season the series then holds; the in-loop Season poster stays for a new series only (`held === null`).
  - The held title's `✓ Updated` line names what was taken (`poster`, `backdrop`, `season posters`, `stills`, `subtitles`) beside its Sheet fills.
- **`detectSubtitleLanguage`** (media domain, Q16): `CODES` gains the endonyms, matched with diacritics folded; a two-letter last piece after a known code reads as the code.
- **`heldVideoRefusal`**, new (routes, Q17): `heldVideoRefusal(storage: Pick<LibraryStorage, 'titleHolding' | 'getMovie' | 'getSeries'>, placed: readonly (StoredVideo | null)[]) => string | null`, the 409 sentence for the first placed video a held title plays. Moved out of the movie route; `POST /series` calls it too, before anything is written. Storage holds no wording.
- **Not changed** (Q18): the Layout fill's `↓` line keeps the path under its Library folder's root, as the prototype draws it.
- **No new domain, no new route, no migration, no client change, no prototype amendment** (Q20, Q22).
- **Names** (Q21): new **Sheet dialect**, **Unread cell**; updated **Sheet reader**, **Sheet writer**, **Library sheet writer**, **Held video**, **Path cells**, **Language pool**. Already in the glossary as of the grill-me commit. Retired name: `fillHeldArt` (now `fillHeldFiles`), `onBlankTitle` (now `onSkip`).
- **Slices** (log 60, _Implementation Plan_):
  1. contained path cells (the reader's rule, Unread cell, `skipLine` logged by both runs);
  2. the Sheet dialect (`sheetDialect`, decoding, `;`, decimal commas);
  3. the dialect kept, an unreadable sheet left (`writeSheet`'s separator, `createLibrarySheet`);
  4. Unread cells and duplicates (every column, the no-lists, the first row);
  5. held files (`fillHeldFiles` for films, tracks by language, after new episodes, `✓ Updated` names);
  6. track languages (endonyms, region subtags);
  7. the series add's refusal and rectangular rows (`heldVideoRefusal`, padding);
  8. the documents (Q22).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: the rows read, the skips reported and their lines, the sheet's bytes, the library's titles and files after a run, the files on disk, the HTTP status and body. It never asserts which helper ran or the order of internal calls.
- Every finding starts from its own RED test reproducing it (the ticket's baseline on `57b91cc1`: no existing test catches any).
- **The Round trip** acceptance test stays green and gains a `;`-separated case: a `;` sheet with decimal commas, Factory reset and rebuilt, comes back equal and is rewritten byte for byte `;`. Prior art: the step 42 Round trip test.
- **`sheetDialect`**, pure: BOM UTF-8, BOM-less valid UTF-8, cp1252 bytes (`Am\xe9lie`), `;` header, `,` header, `;` inside a quoted header cell not counted. Prior art: other pure import-export units' table tests.
- **`readSheet`**: each containment failure (`../`, a foreign Folder key, `.`/empty segment, `\`, `:`, wrong kind per column) blank and an `unread-cell` skip; a cased Folder key read; `Video` unchecked; a `;` cp1252 sheet read whole; `8,5` and `7,9`; each Q9 column's Unread cell; `Type` unknown read as Movie and reported; `Status` and `Favorite` lists; an Episode `Synopsis`; the first of two rows and a `duplicate` skip; `skipLine` texts as the handoff's _Copy_ table. Prior art: its existing tests.
- **`writeSheet`**: a `;` separator with decimal commas; `,` bytes unchanged; every row padded to the header's width. Prior art: its existing tests.
- **`createLibrarySheet`**, with fake timers and a temp directory: a `;` sheet rewritten `;` with `7,9`; a cp1252 sheet rewritten UTF-8 behind a BOM; a corrupt sheet survives a rating change byte for byte; a new sheet `,`. Prior art: its existing tests.
- **`createImporter`**: the Ronin repro copies and writes nothing and logs both cells; a Meta sheet's skips logged in a Folder scan (a titleless row, too); an unreadable Meta sheet's `left as it is` line; the Heat repro fills poster, backdrop and track on one scan with a true `✓ Updated` line; a held film's existing art kept; a track of a held language not added; the Sev repro's Season 2 poster on one scan. Prior art: its fixture-library tests.
- **`detectSubtitleLanguage`**: each endonym, diacritics folded, `pt-BR` and `en_GB`, today's cases unchanged. Prior art: its existing tests.
- **`heldVideoRefusal`**, with a fake storage: `null` for unheld and null videos; the first held video's holder named, film or series. Prior art: `foundPathRefusal`'s tests.
- **Routes**: `POST /series` linking a held episode video is a 409 with the sentence and writes nothing; the movie add's 409 unchanged. Prior art: `routes.addMovieHeld` and `routes.addSeriesLinked` tests.

## Out of Scope

- A symlink inside a Title folder pointing out (Q4).
- Storing an episode synopsis (Q12): a column, a migration and a Sync field for a text no screen draws.
- New `Status` or `Favorite` synonyms (`ja`, `nee`).
- Tab-separated or other sheet separators.
- A series add naming one video twice in one request.
- A relative path on the `↓` line (Q18).
- The ticket's _Not covered_ list: a real TMDB Sync, the Electron window, the Ordered shutdown's flush, Linux case sensitivity, an external or network drive.
- The ticket's _By design_ notes, as logs 58 and 59 settled them.

## Further Notes

- The trade-off is accepted: the reader holds one more rule per path column and the writer one more read of the file it replaces; a `;` sheet's decimal commas are a second spelling the Round trip must cover; a sheet that never reads is never rewritten, so the library and that sheet drift until the maintainer fixes it, the scan's line being the only notice.
- Every Library sheet on disk is rewritten once at its next touch (the padding), then stays still.
- The maintainer approved every recommendation of log 60 in advance; this PRD adds no decision the log doesn't hold.

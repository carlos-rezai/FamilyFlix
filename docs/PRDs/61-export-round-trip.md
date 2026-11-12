> **Initiative:** `export-round-trip`
> **Issue:** #581 (the PRD, step 44)
> **Design log:** `docs/design-logs/61-export-round-trip.md`
> **Handoff:** `docs/handoff/handoff-export-round-trip/` (keeps the QA ticket, 580, whole)
> **Build order:** step 44, **Export round trip**. It ships as thin slices (log 61, _Implementation Plan_). No migration, no new route, no screen change and no prototype amendment; the new log lines are in the handoff's _Copy_ table.

## Problem Statement

Step 43 made a hand-kept sheet and a growing folder reach the library safely, and a third QA pass found the **Round trip** sound: a library rebuilt from its **Library sheet** after a Factory reset comes back equal, and the sheet is the same byte for byte. The **Export**, the backup the family keeps of its library, is not.

An Export spells every row's Folder key (and every Title folder in the **Export folder**) from the title as it is now, not from the folder on disk. A title renamed in the app, renamed by a Sync (`Amelie (2001)` synced to `Amélie`), or given a corrected year names a folder that does not exist. Uploaded after a Factory reset, it gives two Problems (`no-folder` and `no-row`) where it should give none. Copied over the Library folder of videos, it leaves a stray folder, an Orphaned row and a title with no metadata at all, and the run's close writes that loss into the sheet.

An upload never reads the Library folder's own `Meta/familyflix-library.csv`. After a Factory reset no title is held, so an older Export imports its own values unopposed, and the **Library sheet writer** then rewrites the newer Meta sheet from that library. The record the reset left in place to rebuild from is gone, and nothing in the log says the two sheets disagreed.

An Export carries files under their **Layout place** names, so copied over a Title folder holding its own (`heat-1995-POSTER.png`, `Nederlands.srt`) each role is filled twice. The reader silently reads a different poster than before, and a new title imports `Dutch` twice, so the subtitle menu lists Dutch twice.

A Folder key is folded for case only. A folder named in Unicode NFD (a library copied from a Mac) never matches a row typed or saved by Excel in NFC, and `⚠ Amélie (2001) is in the sheet but has no folder` reads as nonsense because the two names look identical.

And since step 41 made `Season 00` the specials' place, any rebuilt show with a special offers _Play S00E01_ even with S01E01 and S01E02 watched.

## Solution

An Export gives the library back whole, uploaded after a Factory reset or copied over a Library folder of videos, without ever erasing the newer record a Library folder already holds, and with no second reader, no second writer and no new screen.

- An Export row's Folder key is the Library sheet's: the title's **Source folder** when it has one, else `Title (Year)` spelled. The `Title` cell stays the title's own, so a renamed title keeps its new name and its own folder. Two Library folders sharing one key are numbered as today.
- An upload into a Library folder never scanned before, which holds a Library sheet, first places that folder by its own sheet as a **Folder scan** would. The uploaded rows are then matched over the titles it placed: they fill the cells those titles lack, and each cell the two sheets disagree on waits in the **Review step** as a **Sheet difference**, _Yours | Spreadsheet_, Yours being the folder's own record. A folder already scanned is unchanged.
- A **Layout place** two files fill is a **Doubled place**: the read still takes the first by name order, and the walk logs one **Layout warning** naming it (`⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read`). A Subtitles folder reads one track per language.
- Folder keys are compared folded once: NFC, then lower case. A path cell under a row matched by its fold is resolved under the folder's own name on disk. The Library sheet still writes the disk's own bytes.
- _Play_ on a show offers a special only when one is part-watched or nothing else is left: the ticket's show offers _Play S01E03_.

## User Stories

### The Export's Folder keys

1. As the maintainer, I want an Export row's `Folder` to be its title's Source folder when it has one, so that a renamed title's row names the folder its video is really in.
2. As the maintainer, I want an Export's Title folder named by that same Folder key, so that its files copied over my Library folder land in the title's own folder.
3. As the maintainer, I want an Export row's `Title` cell to stay the title as the library holds it, so that a title I renamed in the app keeps its new name after a restore.
4. As the maintainer, I want a title Synced from `Amelie (2001)` to `Amélie` exported under `Amelie (2001)`, so that a Sync never breaks my backup.
5. As the maintainer, I want a title whose year I corrected exported under the folder it was found in, so that the corrected year doesn't orphan its row.
6. As the maintainer, I want a title in no Library folder (a browser add, a copy) to keep its spelled `Title (Year)` Folder key, so that every title still has a folder in the Export.
7. As the maintainer, I want two titles from two Library folders that share one Folder key numbered `(1)`, `(2)`, … with today's `⚠ Two titles share the folder …` line, so that neither overwrites the other in the Export.
8. As the maintainer, I want the Export and the Library sheet to derive Source folders by one rule, so that the two sheets can never disagree on a Folder key.
9. As the maintainer, I want an Export written without reading any Library folder from disk, so that I can export while a drive is unplugged.
10. As the maintainer, I want the ticket's Amélie repro (renamed, rated 7, TMDB id 194, genres), exported, Factory reset and uploaded, to come back with no Problem and every field, so that the bug's own case is the demo.
11. As the maintainer, I want the same Export copied over the bare videos and scanned to come back whole, with no stray folder and no Orphaned row, so that log 58's promise holds.

### An upload and the folder's own sheet

12. As the maintainer, I want _Import from spreadsheet_ to read a never-scanned Library folder's own Library sheet before the uploaded one, so that an older Export can't erase the newer record the reset left in place.
13. As the maintainer, I want that folder placed by its own sheet exactly as a Folder scan would (every column read back, the Round trip's rules), so that an upload and a scan rebuild a folder alike.
14. As the maintainer, I want the uploaded rows matched over the titles the folder's own sheet placed, so that they are treated as held titles.
15. As the maintainer, I want an uploaded cell that a placed title lacks to fill it as a **Sheet fill**, so that the upload still adds what the folder's sheet didn't hold.
16. As the maintainer, I want each cell the two sheets disagree on to wait in the Review step as a Sheet difference, _Yours | Spreadsheet_, so that I choose which value wins.
17. As the maintainer, I want _Yours_ in that difference to be the folder's own record, so that the newer record is the default I keep.
18. As the maintainer, I want the review to be the notice that the sheets disagreed, so that a disagreement is a choice, not a silent loss.
19. As the maintainer, I want a Library folder already scanned treated as today, since its Library sheet already is the library, so that a normal upload is unchanged.
20. As the maintainer, I want an unscanned folder with no Library sheet treated as today, so that an upload over bare videos still works.
21. As the maintainer, I want one run, one `✓ … complete` line and one trip to review for one start, so that an upload never looks like two runs.
22. As the maintainer, I want no new refusal on the import screen, since the prototype draws none, so that the screen is unchanged.
23. As the maintainer, I want the Folder scan's per-folder placing drawn out into one step both runs call, so that the scan and the upload can't drift in how they place a folder.
24. As the maintainer, I want the ticket's Heat repro (rated 5 and exported, then rated 9 and hearted, Factory reset, the Export uploaded) to keep 9 and its heart, with review offering _Yours 9 | Spreadsheet 5_, so that the bug's own case is the demo.
25. As the maintainer, I want the Library sheet writer to rewrite the folder's sheet only from a library that already read it, so that the rewrite on _Finish_ keeps what I chose in review.

### Doubled places

26. As the maintainer, I want a Title folder's Poster filled twice to log `⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read`, so that I know which one the library took.
27. As the maintainer, I want the same line for a Backdrop filled twice, so that every role the read picks by is named.
28. As the maintainer, I want a Season poster filled twice to log `⚠ Tidewater (2018) Season 1 holds 2 posters, poster.png read`, naming the season as the Unread cell lines do.
29. As the maintainer, I want a Still filled twice for one Episode tag to log `⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read`, naming the episode.
30. As the maintainer, I want two tracks of one language in a Subtitles folder to read only the first by name order, so that the subtitle menu never lists Dutch twice.
31. As the maintainer, I want that logged as `⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read`, so that I can delete the one I don't want.
32. As the maintainer, I want the same one-track-per-language rule for each episode's Subtitles folder, so that films and series read alike.
33. As the maintainer, I want the read to keep taking the first file by name order, so that which file is read stays predictable.
34. As the maintainer, I want the Library sheet's path cells to name the file read, so that the sheet still names what the read found.
35. As the maintainer, I want the next scan quiet once I delete the extra file, so that the warning goes away when the folder is fixed.
36. As the maintainer, I want the rule to catch doubles from any hand copy, not only from an Export, so that the warning means the same whatever made it.
37. As the maintainer, I want the ticket's merged Heat repro to hold `Dutch, English` and log each doubled poster, backdrop, Season poster and Still, so that the bug's own case is the demo.

### Folder keys in NFD

38. As the maintainer, I want two Folder keys compared NFC then lower case, so that a folder copied from a Mac matches a row Excel saved.
39. As the maintainer, I want the fold spelled once and used by every comparison (folder to row, a sheet's duplicate rows, the Export's numbering), so that the rule can't drift.
40. As the maintainer, I want the Library sheet to keep writing the disk's own bytes, so that the Round trip stays byte for byte.
41. As the maintainer, I want a path cell under a row matched by its fold resolved under the folder's own name on disk, so that an NFC cell still opens the NFD folder's files.
42. As the maintainer, I want the ticket's NFD Amélie repro to scan with rating 7 and no Orphaned row, so that the bug's own case is the demo.

### Specials

43. As the maintainer's parent, I want _Play_ on a show to offer the first part-watched episode of any season, so that a special I stopped halfway is still resumed.
44. As the maintainer's parent, I want _Play_ otherwise to offer the first unwatched episode outside Season 0, so that a special doesn't jump ahead of the story.
45. As the maintainer's parent, I want a show with every regular episode watched to offer the first regular episode, as a watched show does today, so that specials stay specials.
46. As the maintainer's parent, I want a list holding only specials (the Season 0 page, a show of specials alone) to keep today's rule over them, so that those pages still play something.
47. As the maintainer, I want one rule serving the Series page and each Season page, so that the two never offer different episodes.
48. As the maintainer, I want the Series page to keep drawing seasons in number order, as the prototype does, so that nothing on screen moves.
49. As the maintainer, I want the ticket's show (S01E01 and S01E02 watched, one special) to offer _Play S01E03_, so that the bug's own case is the demo.

### Proof and documents

50. As the maintainer, I want each finding to start from its own RED test, since no existing test catches any, so that each fix is proved against its bug.
51. As the maintainer, I want the Round trip test kept green, so that nothing here breaks step 42's promise.
52. As the maintainer, I want one Export round trip test: a title renamed in the app exported, the library Factory reset, and the Export both uploaded and copied over a Library folder of bare videos, each giving the library back equal with no Problem.
53. As the maintainer, I want the glossary to hold **Export round trip** and **Doubled place**, and the updated **Export**, **Folder key**, **Bulk import**, **Layout read**, **Layout warning** and **Next episode** (done in the grill-me commit; kept true by the build).
54. As the maintainer, I want the checklist's step 44 and a dev-journal entry for this step, so that the record is complete.
55. As the maintainer, I want the docblocks of `exportRows`, `writeExport`, `createLibrarySheet`, `createImporter`, `readTitleFolder`, `folderKeyOf` and `nextEpisodeOf` to say what they now do.
56. As the maintainer, I want CLAUDE.md untouched, since the writers into a Library folder are still the two it names and an Export still only adds its own folder.

## Implementation Decisions

- **One initiative** (log 61 Q1), step 44, `export-round-trip`, settling all five findings of QA ticket 580 (kept whole in the handoff). Not reopening `rebuild-edges`, which is Done with its refactor.
- **`sourceFoldersOf`**, new and pure (import-export domain, Q3): `sourceFoldersOf(titles: StoredLibraryTitles, folderId?: string) => Map<string, string>`, each title recorded against a Library folder with a Source folder, by id; limited to `folderId`'s titles when given, every folder's otherwise.
- **`createLibrarySheet`** (Q3): its folder's map comes from `sourceFoldersOf(titles, folderId)` in place of today's inline map. Its interface (`touch`, `hold`, `release`, `flush`) is unchanged.
- **`writeExport`** (Q3): `ExportContent` gains `sourceFolders: ReadonlyMap<string, string>`, handed on to `exportRows` as its `sourceFolderOf`, as the Library sheet already does. The Export's File plan names each Title folder by the row's key.
- **Export route** (Q3): builds `sourceFolders` with the rest of its content, by `sourceFoldersOf` over every folder. No new route, no body change.
- **`exportRows`** (Q4, Q11): `claimFolder` compares keys by `foldFolderKey`; the `(1)`, `(2)` numbering and its Warning line are unchanged and now also answer a Source folder key two Library folders share.
- **`folderKeyOf`** (media domain, Q11): `foldFolderKey(key) = key.normalize('NFC').toLowerCase()`; `sameFolderKey` compares two folds.
- **`readSheet`** (Q11, Q12): `rowKey` folds the Folder key by `foldFolderKey`. `resolvePathCell` takes the matched folder's name on disk and replaces the cell's first segment with it, so its callers (`matchRows`, `pathCellFills`) reach an NFD folder from an NFC cell. The containment rule of log 60 is unchanged.
- **`readTitleFolder`** (media domain, Q8 to Q10): reads as today (a role's first file by name order), now one track per language per Subtitles folder, and reports every Doubled place. `FilmFolderScan`, `SeasonFolderScan` and `SeriesFolderScan` each gain `doubled: DoubledPlace[]`, `DoubledPlace` being `{ place: 'poster' | 'backdrop' | 'season-poster' | 'still' | 'track'; season?; episode?; language?; read; count }`. The reader holds no wording.
- **`createImporter`** (Q5 to Q10):
  - The walk words each Doubled place as a Layout warning beside its other Layout warnings, per the handoff's _Copy_ table.
  - The Folder scan's per-folder placing (Meta rows read, matched by `matchRows`, placed, held titles filled) is drawn out of `executeScan` into one step both runs call.
  - A sheet run calls that step for each walked folder whose `scannedAt` is `null` and which holds a Library sheet, before it matches the uploaded rows; those rows then meet held titles and yield Sheet fills and Sheet differences by today's rules. A scanned folder, or one with no sheet, is unchanged.
  - No new run, no new phase, no second `✓ … complete` line.
- **`nextEpisodeOf`** (library domain, Q13): the first part-watched episode of any season, else the first unwatched outside Season 0, else the first outside Season 0; a list holding only Season 0 episodes falls back to today's rule over them. Its signature is unchanged.
- **Not changed** (Q14): the Up next card's order.
- **No new domain, no new route, no migration, no client change, no screen change, no prototype amendment** (Q15, Q17). The new log lines are in the handoff's _Copy_ table.
- **Names** (Q16): new **Export round trip**, **Doubled place**; updated **Export**, **Folder key**, **Bulk import**, **Layout read**, **Layout warning**, **Next episode**. Already in the glossary as of the grill-me commit.
- **Slices** (log 61, _Implementation Plan_):
  1. the Export's Folder keys (`sourceFoldersOf`, `ExportContent.sourceFolders`, the route);
  2. an upload reads the folder's sheet first (the shared per-folder placing, called for an unscanned folder);
  3. Doubled places (one track per language, every Doubled place a line);
  4. folds (`foldFolderKey` in its three callers, the path cell under the matched name);
  5. specials last (`nextEpisodeOf`);
  6. the documents (Q17).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: the rows written, the map returned, the log lines, the library's titles and files after a run, the review's rows, the files on disk, the episode offered. It never asserts which helper ran or the order of internal calls.
- Every finding starts from its own RED test reproducing it (the ticket's baseline on `53241fbb`: 761 files green, no existing test catches any).
- **The Round trip** acceptance test stays green. **The Export round trip** is a new acceptance test beside it: a title renamed in the app is exported, the library Factory reset, and the Export both uploaded and copied over a Library folder of bare videos; each gives the library back equal, with no Problem. Prior art: the Round trip test in `createImporter`.
- **`sourceFoldersOf`**, pure: titles with and without a Source folder; limited to one folder and across all; a title in no Library folder absent. Prior art: other pure import-export units' table tests.
- **`writeExport`** / **`exportRows`**: a renamed title's row and Title folder named by its Source folder, its `Title` cell the new name; a title with none spelled; two folders' titles on one key numbered with the Warning line; keys differing only in NFC/NFD claimed as one. Prior art: their existing tests.
- **`createLibrarySheet`**: today's tests stay green over `sourceFoldersOf`. Prior art: its existing tests.
- **`folderKeyOf`**: NFD and NFC of one name fold equal; case folded; different names differ. Prior art: its existing tests.
- **`readSheet`**: two rows differing only in normalisation are a `duplicate`; `resolvePathCell` under a matched folder's name replaces an NFC first segment. Prior art: its existing tests.
- **`readTitleFolder`**: two posters, two backdrops, two Season posters, two Stills for one tag, two tracks of one language (film and episode), each read first by name order and reported as a Doubled place with its count; one of each reports nothing. Prior art: its existing temp-directory tests.
- **`createImporter`**: the Heat upload repro keeps 9 and its heart and offers _Yours 9 | Spreadsheet 5_ in review, and the Meta sheet is not rewritten to 5; a scanned folder's upload unchanged; an unscanned folder with no sheet unchanged; one complete line; each Doubled place line as the _Copy_ table; the merged Heat repro holds `Dutch, English`; the NFD Amélie repro scans with rating 7 and no Orphaned row, its path cells reached. Prior art: its fixture-library tests.
- **`nextEpisodeOf`**: the ticket's show offers S01E03; a part-watched special offered; all regulars watched offers the first regular; a specials-only list keeps today's rule; an empty list `null`. Prior art: its existing tests.
- **Routes**: the Export route's output carries Source folder keys. Prior art: `routes.export` tests.

## Out of Scope

- The Up next card's order (Q14).
- Merging an Export over a Library folder by name, or the Export keeping a held file's own name (Q8): the Doubled place line is the answer.
- A Library folder's sheet newer than a scanned library: the writer keeps them equal (Q6).
- Writing Folder keys in NFC (Q11).
- Refusing an upload until its folder is scanned, or a newest-wins rule per cell (Q5).
- The ticket's _Not covered_ list: a real TMDB Sync, the Electron window, the Ordered shutdown's flush, Linux case sensitivity, an external or network drive.
- The ticket's _By design_ notes, as logs 58, 59 and 60 settled them.

## Further Notes

- The trade-off is accepted: an upload into a folder never scanned does a scan's work first, so its review can hold differences the maintainer did not expect from "an upload"; that is the point, but it is more to read. An Export's Title folders can now carry `(1)` suffixes for titles in two Library folders on one key, where the spelled key differed.
- The maintainer approved every recommendation of log 61 in advance; this PRD adds no decision the log doesn't hold.

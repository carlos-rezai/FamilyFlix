# Export round trip: handoff

Step 44, design log `docs/design-logs/61-export-round-trip.md`. This handoff
is the QA ticket that opened the step, filed after step 43 (Rebuild edges) as
issue 580 and deleted once its grill-me was held: its text is kept here
whole, below the line, as the record of what was found. It has no screen of
its own and amends no prototype. Where this README and the log differ, the
log rules: the log settles each finding, and the copy it adds is below.

## Copy

New lines in the import's log, worded as the lines beside them:

| Where                                                  | Text                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| A title's Poster or Backdrop filled twice (Q8)         | `⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read`      |
| A Season poster filled twice (Q10)                     | `⚠ Tidewater (2018) Season 1 holds 2 posters, poster.png read`  |
| A Still filled twice (Q10)                             | `⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read`     |
| Two tracks of one language (Q9)                        | `⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read`            |
| An upload's cell the folder's own sheet disagrees with | today's Sheet difference in review, _Yours \| Spreadsheet_ (Q5) |

The Export's own lines are unchanged: a Folder key two titles share is
numbered with today's `⚠ Two titles share the folder …` line (Q4). _Play_ on
a show with specials names its first unwatched regular episode (Q13).

---

> **Initiative:** `rebuild-edges` (QA follow-up to steps 41 to 43, design logs 58, 59 and 60)
> **Found by:** a third end-to-end QA pass on `53241fbb`: the real server (`server/src/main.ts`) on a scratch DB, media directory and Library folders per scenario, driven over HTTP with the disk inspected after each step, and one look at a rebuilt library in the built renderer. Offline, no FFmpeg.

## Summary

Every finding of the previous QA ticket (562, kept in `docs/handoff/handoff-rebuild-edges/README.md`) is fixed and holds live. The Library sheet round trip holds: a library rebuilt from its `Meta/` sheet after a Factory reset is equal, twice in a row, and the sheet is the same byte for byte. Uploading an Export's CSV or xlsx after a reset gives back every field with no Sync, **as long as no title was renamed**.

What fails is the Export as a backup: it names each Title folder after the title rather than the folder on disk, so any title renamed in the app or by a Sync does not come back from it. Separately, uploading an Export that is older than the folder's own `Meta/` sheet erases the newer sheet.

## Findings

### 1. High: the Export spells the Folder key from the title, not the Source folder

`createLibrarySheet` hands `exportRows` its `sourceFolderOf`, but `writeExport` (`writeExport.ts:217`) does not, so every Export row's `Folder` (and its Title folder in the Export) is respelled `Title (Year)` from the library's title and year. A title renamed in the app, or by a TMDB Sync (`Amelie (2001)` synced to `Amélie`), or with its year corrected, gets a Folder key that no longer names its folder on disk. The design's premise, that an Export's folders copied over a Library folder of videos scan back whole (log 58 Q19 and Q20), breaks for every such title.

- **Repro:** `Amélie (2001)/amelie.mp4`; its Title edited to `Le Fabuleux Destin d'Amélie Poulain`, rated 7, TMDB id 194, genres. Export (CSV or xlsx, images and subtitles on).
- **Actual:**
  - The Export's row is `Folder` = `Le Fabuleux Destin d'Amélie Poulain (2001)`, and the Library sheet's is `Amélie (2001)`.
  - **Upload after a Factory reset:** two Problems instead of a clean import, `no-folder` for the row and `no-row` for `Amélie (2001)`. Its rating, TMDB id, genres and the rest only come back if the row is resolved by hand.
  - **Export merged over the Library folder:** a stray `Le Fabuleux Destin… (2001)/Subtitles/French.srt` folder (`⚠ … holds no video or Season folder`), the row an Orphaned row, and Amélie comes back with **no metadata at all**. The run's close then writes that into the sheet.
- **Expected:** the Export names a title with a Source folder by that folder, as the Library sheet does. A title in no Library folder keeps the spelled `Title (Year)`.

### 2. Medium (data loss): uploading an older Export erases the newer `Meta/` sheet

_Import from spreadsheet_ reads only the uploaded sheet, not the Library folder's own `Meta/familyflix-library.csv`. The run's close then rewrites that Meta sheet from the library it just built, so whatever the Meta sheet held that the upload did not is gone. A Factory reset leaves the Meta sheet in place precisely so it can rebuild the library, and this path destroys it.

- **Repro:** scan `Heat (1995)/heat.mkv`; rate Heat 5; Export (CSV); rate Heat 9 and heart it, then wait for the sheet; Factory reset; add the folder back; _Import from spreadsheet_ with the Export's CSV; _Finish_.
- **Actual:** Heat is 5 with no heart, and `Meta/familyflix-library.csv` now says `5` with no heart. The newer record is lost, and nothing in the run's log says the two sheets disagreed.
- **Suggested shape:** read the folder's Meta sheet in an upload run too, with any cell the two sheets disagree on waiting in the review as _Yours | Spreadsheet_, as a held title's does today. Or, at the least, do not rewrite a Meta sheet the run did not read.

### 3. Low: an Export merged over a Library folder that has its own art doubles it

The Export renames every file it carries to its layout name (`Nederlands.srt` becomes `Dutch.srt`, `heat-1995-backdrop.png` becomes `backdrop.png`, `season01-poster.png` becomes `poster.png`, `tidewater-S01E02-still.png` becomes `S01E02.png`). Merged over a Library folder that already holds those files under their own names, each one lands beside its original.

- **Repro:** a Title folder with `Images/heat-1995-POSTER.png`, `Images/heat-1995-backdrop.png` and `Subtitles/Nederlands.srt`; Export with images and subtitles; Factory reset; copy the Export over the Library folder; _Scan new folders_.
- **Actual:** Heat has tracks `Dutch, English, Dutch` (the player's subtitle menu lists Dutch twice), and the reader silently picks one of two posters and two backdrops, a different one from before (`backdropPath` changed). Season 1 and S01E02 likewise hold two posters and two Stills.
- **Expected:** either the Export keeps a held file's own name when it came from a Title folder, or a second poster, backdrop, Still or same-language track found by role is one Layout warning line, not a silent pick.

### 4. Low: an NFD folder name never matches a typed sheet row

A Title folder whose name is in Unicode NFD (`Amélie (2001)`, how a library copied from a Mac, or by some sync tools, leaves accents) is matched by Folder key casing-insensitively but not normalisation-insensitively. The Library sheet echoes the disk's bytes, so the round trip holds, but a row typed by hand or saved by Excel (NFC) is an Orphaned row, `⚠ Amélie (2001) is in the sheet but has no folder, left out`, which reads as nonsense because the two names look identical. Its values are lost, and the rewrite on close drops the row.

- **Repro:** folder `Amélie (2001)/a.mkv`; a Meta sheet row `Folder` = `Amélie (2001)`, `Rating` 7; scan. **Actual:** the line above, and no rating.
- **Suggested shape:** compare Folder keys as `normalize('NFC')` on both sides, as the casing is folded today.

### 5. Low (seen during the pass, not this step's code): a show with specials always resumes on S00E01

`nextEpisodeOf` takes the first unwatched episode in season order, and season 0 sorts first. Since step 41 made `Season 00` the specials' place in the layout, any rebuilt show with a special offers _Play S00E01_ even with S01E01 and S01E02 watched (seen in the renderer: `Play S00E01`, `2 of 5 episodes watched`). The natural next is S01E03; a special is rarely what the family means by _Play_.

## By design, noted

- `In progress` comes back Unwatched at its start (log 59 Q8). A sheet's Runtime loses to the probe, and a genre outside the pool (`Mystery`) is dropped with its line.
- `sv.srt` reads as English: the pool is seven languages (log 60).
- A link outside every Library folder is refused with `400`; the form sends `copy` for it.
- Uploading an Export's CSV over bare videos brings back no art (log 58 Q20); its path cells resolve against the Library folder.

## What passed

About 140 checks across 17 scenarios, among them:

- **The previous ticket's findings, all fixed live:**
  - **1:** the Ronin repro copies nothing and writes nothing, with one Unread cell line per cell, including an absolute path and a cell naming another title's folder.
  - **2:** a `;`-separated cp1252 sheet with decimal commas reads whole, is rewritten `;` with `7,9` behind a BOM, and a corrupt sheet survives a rating change byte for byte.
  - **3 and 4:** a held film takes a poster, backdrop and `Deutsch.srt` but not a second English, and a new season takes its poster on one scan, with a quiet rescan after.
  - **5:** `POST /series` with a held video is `409 Tidewater already plays this file.`
  - **7:** `8½`, `11`, `half`, `ja`, `abc`, an unknown Type, `12.345`, an Episode Synopsis, and the Excel dates `20-1-2010` and `1/27/2010` are each one line, and two rows for one title read the first and say so.
  - **8:** the endonyms and `pt-BR` read right.
  - **10:** every row of both sheets is 22 fields wide.
- **Round trip:** a hand-written sheet with every column (a synopsis with quotes, `;`, a newline and accents; an edited title; a series' Year range and creator; specials; Season posters; Stills by tag and by `-still` name; per-episode tracks) rebuilds, then two Factory reset rebuilds are equal and the sheet is byte-identical.
- **Export:** CSV and xlsx carry 3 films and 1 series, no videos, and every path cell names a file that travelled. Text cells equal the Library sheet's (finding 1 aside), and the Watched tick, heart and rating set in the app are on the row. An upload after a reset with no renamed title has no Problems and every non-art field back, and it rewrites the Library sheet byte-identical to the one it replaced.
- **Layout warnings:** a root video, year-less, shelved, mixed, `Season 1`, empty and Extras-only folders each give their line, two loose videos are `no-video`, `$RECYCLE.BIN` and `.hidden` are silent, art and tracks beside the video are not read, and nothing is written beside a left-out folder.
- **Episodes:** `Episode 3`, a folder beating its tag (`Season 02/…S01E05` is S02E05), `Season 00`, and an untagged video is Unplaced.
- **Hand adds:** a linked add in a Title folder keeps the user's `my-own-POSTER.jpg`, the same video twice is `409`, a shelved add gets no Images or Meta, an unscanned folder's sheet survives a hand add, and a later scan doubles nothing.
- **Two Library folders:** one Folder key in both gives two films, each in its own sheet; the sheet is held during review and written on _Finish_; removing a folder titles play from is `409`.
- **Matching:** a Folder key in other casing, or padded with spaces, is matched, a Movie row over a series folder leaves it a series, and an Orphaned row gives its line.
- **UI:** a rebuilt film's and series' pages draw the rating (4.5 and 4.0 stars), Watched, the heart, genres, director or creator, cast, the synopsis with accents, `2018–2020`, `3 seasons · 5 episodes` and `2 of 3 watched` on Season 1.

## Not covered

A Sync against real TMDB (offline), the Electron window and its dialogs, the Ordered shutdown's flush, Linux case sensitivity, an external or network drive, and a sheet actually resaved by Excel (its spellings were typed in).

## Baseline

The full suite is green on `53241fbb` (761 files, 11794 passed, 1 skipped). No existing test catches any finding above, so each fix should start from a RED test that reproduces it.

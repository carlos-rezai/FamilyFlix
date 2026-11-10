# Rebuild edges: handoff

Step 43, design log `docs/design-logs/60-rebuild-edges.md`. This handoff is
the QA ticket that opened the step, filed after step 42 (Rebuild whole) as
issue 562 and deleted once its grill-me was held: its text is kept here
whole, below the line, as the record of what was found. It has no screen of
its own and amends no prototype. Where this README and the log differ, the
log rules: the log settles each finding, and the copy it adds is below.

## Copy

New and changed lines in the import's log, worded as the lines beside them:

| Where                                                 | Text                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| A sheet's **Unread cell**, a Movie or Series row (Q9) | `⚠ Heat (1995): Rating "8½" not read`                              |
| An Unread cell on a Season row (Q9)                   | `⚠ Tidewater (2018) Season 1: Poster "x.txt" not read`             |
| An Unread cell on an Episode row (Q9)                 | `⚠ Tidewater (2018) S01E02: Status "half" not read`                |
| A second row for one Folder key (Q11)                 | `⚠ Heat (1995) is in the sheet twice, the first row read`          |
| A Folder scan's Meta sheet that doesn't read (Q7)     | `⚠ Could not read <path>, scanned without it and left as it is`    |
| A held title's files taken from its folder (Q14)      | today's `✓ Updated` line, naming `poster`, `backdrop`, `subtitles` |
| `POST /series` with a held episode video (Q17)        | `409 Tidewater already plays this file.`, the movie add's sentence |

The `↓` line of the Layout fill is the prototype's Sync line and is not
changed (Q18): it names the file under its Library folder's root, as
`FamilyFlix.dc.html` draws it, not the relative path the rebuild-whole
handoff's _Copy_ table gave as shorthand. A Meta sheet's titleless row now
logs the upload's existing `⚠ Row 12 has no title, skipped` (Q10).

---

## Rebuild whole: QA follow-up, path cells escape the folder, Excel-saved sheets lost

> **Initiative:** `rebuild-whole` (QA follow-up to steps 41 and 42, design logs 58 and 59)
> **Found by:** an end-to-end QA pass over the real server (`server/src/main.ts` on a scratch DB, media directory and Library folders per scenario, driven over HTTP, the disk inspected after each step), plus one look at a rebuilt library in the built renderer. Offline, no FFmpeg.

## Summary

The layout reads, the Layout warnings, the Library sheet's lifecycle and the Factory reset round trip all hold: a library written to its sheet, reset and rebuilt by _Scan new folders_ comes back equal, twice in a row, with the sheet byte for byte. Uploading an Export's CSV or xlsx after a reset rebuilds every field, rating, heart, Status and TMDB id with no Sync. An Export merged over bare videos scans back whole.

What fails is at the edges: a path cell can reach outside the Library folder, a sheet saved by a Dutch Excel is lost and then overwritten, and a held film never takes art dropped into its folder later.

## Findings

### 1. High: a path cell reads any file outside the Library folder

`resolvePathCell` (`readSheet.ts:142`) joins the cell onto the Library folder and never checks that the result stays inside it; `pathCellFills` checks only that the file exists, not that it is an image or a subtitle. An absolute cell fails only by accident (it is joined under the base).

- **Repro:** `Ronin (1998)/ronin.mkv`, and a Meta sheet row with `Poster` = `../secret.txt` and `Subtitles` = `Ronin (1998)/../../private/diary.srt`; scan.
- **Actual:** `secret.txt` is copied into the managed media directory as Ronin's poster, `diary.srt` as an English track, and the Layout fill then writes `Ronin (1998)/Images/poster.txt` and `Subtitles/English.srt` into the Title folder.
- **Expected:** a cell that resolves outside its Title folder is not read, and a Poster, Backdrop or Still cell names an image (`isImageFilename`), a Subtitles cell a subtitle (`isSubtitleFilename`). _Import from spreadsheet_ goes through the same code, and it takes any sheet it is handed.

### 2. Medium (data loss): a Library sheet saved by Excel is skipped, then overwritten

A Dutch or German Excel saves CSV with `;` as the separator. The scan reads none of it (one line: `⚠ Could not read …\Meta\familyflix-library.csv, scanned without it`), and the run's close rewrites the sheet from the library (log 59 Q19), so the record is erased.

- **Repro (proved end to end):** scan, rate Heat 9 and heart it, wait for the sheet; resave it `;`-separated; Factory reset; add the folder back; _Scan new folders_; _Finish_. **Actual:** Heat has no rating and no heart, and the sheet is rewritten without them.
- The same sheet saved as Excel's plain _CSV (Comma delimited)_ is cp1252 with no BOM: `Amélie (2001)` reads as `Am�lie (2001)`, gives `⚠ Am�lie (2001) is in the sheet but has no folder, left out`, and its row is lost the same way.
- **Suggested shape:** sniff the separator from the header row (`Type;Folder;…`), and read a BOM-less sheet that is not valid UTF-8 as cp1252. Consider not rewriting a folder's sheet on close when the run could not read it.

### 3. Medium: a held film never takes art or tracks put into its Title folder later

A held series' empty poster, backdrop, Season posters and Stills are filled from its folder on a rescan (log 59 Q5, `fillHeldArt`, `createImporter.ts:1327`); a held film's are not, so the library and its sheet disagree.

- **Repro:** scan `Heat (1995)/heat.mkv`; add `Images/poster.jpg`, `Images/backdrop.jpg`, `Subtitles/English.srt`; _Scan all_, three times. **Actual:** Heat still has no poster, backdrop or track, while the Library sheet's Poster cell now names `Heat (1995)/Images/poster.jpg`. Only a Factory reset rebuild brings them in.

### 4. Low: a new season's poster needs a second scan

`fillHeldArt` walks the seasons the library already holds, before the run adds the new episodes, so a season the same run adds misses its Season poster.

- **Repro:** scan `Sev (2022)/Season 01/`; add `Season 02/Sev.S02E01.mkv` and `Season 02/Images/poster.jpg`; _Scan all_. **Actual:** S02E01 joins, Season 2 has no poster; a second scan fills it.

### 5. Low: `POST /series` links episode videos another title already plays

A movie add of a held video is refused (`409 Heat already plays this file.`); a series add is not. The form's Show folder pick refuses a held folder (`heldSeriesId`), so this needs an episode video picked one at a time from a held show, or a direct call.

- **Repro:** scan `Tidewater (2018)/Season 01/` (2 episodes); `POST /series` (link) with the same two videos. **Actual:** `201`, two series play the same files, and the Library sheet gains `Tidewater (2018) (1)` rows with no Video cells. A numbered Folder key belongs only in an Export (log 58 Q19), and on a rebuild it is an Orphaned row.

### 6. Low: an Episode row's Synopsis cell is never written or read

Log 58 Q13 gives Episode rows a `Synopsis` cell, but `Episode` has no synopsis field, so the cell is always blank and a hand-entered one is dropped with no line.

### 7. Low: cells that don't parse are dropped with no log line

None of these says anything in the run's log:

| Cell                           | Read as           |
| ------------------------------ | ----------------- |
| `Rating` `8,5` (a Dutch Excel) | no rating         |
| `TMDB rating` `7,9`            | no TMDB score     |
| `Favorite` `ja`                | not a favourite   |
| two rows for one Folder key    | the last row wins |

One Warning line per cell left unread would let the maintainer fix the sheet before the rewrite on close erases the value.

### 8. Low: a track named in its own language reads as English

`detectSubtitleLanguage` knows the English names and ISO codes only: `Nederlands.srt`, `Deutsch.srt`, `Español.srt` and `heat.pt-BR.srt` all read as English. A Title folder holding `English.srt` and `Nederlands.srt` gets two English tracks.

### 9. Low (copy): the scan's `↓` line prints an absolute path

The handoff's _Copy_ table (`docs/handoff/handoff-rebuild-whole/README.md`) gives `↓ poster.jpg  →  Heat (1995)/Images/poster.jpg`; the scan writes `↓ poster.jpg  →  C:\…\Movies\Heat (1995)\Images\poster.jpg`.

### 10. Low: both sheets write ragged rows

The Library sheet and the Export's CSV drop each row's trailing empty cells: under the 22-column header a Season row is `Season,Tidewater (2018),1` (3 fields), and the Export's lines are 18 to 22 fields long. Excel and the Sheet reader cope; a stricter reader (RFC 4180) won't.

## By design, noted

- Uploading an Export's CSV over a Library folder of bare videos brings back every text field but no art, though the art lies beside the sheet in the Export folder: path cells resolve against the Library folder (log 58 Q20). Copying the Export's folders over the videos and scanning brings it all.
- A Runtime cell loses to the probe (log 59 Q7). A genre outside the fixed pool is dropped, as everywhere else.
- A movie or series rebuilt with its TMDB id still counts as a Sync gap while it lacks a poster, a Season poster or a Still (`syncGap`).

## What passed

About 200 checks across 15 scenarios, among them:

- **Layout warnings:** each text, one loose-videos line, silence for `Meta/`, an Export folder, `.hidden`, `$RECYCLE.BIN`, `System Volume Information` and `Extras/`.
- **Folder rules:** year-less, shelved, suffixed, release-named, range-named, empty, nested, Extras-only, mixed and hollow folders left out; `Season 00`, `season 02`, `Season 001` and `Season 100` read; `Season 1` and `Specials` not; the folder's season beats the tag; `Episode 3`, `Aflevering 3`; a second claim on a number is Unplaced; two loose videos are `no-video`; accents, `&`, `'` and `(500) Days of Summer (2009)` read.
- **Library sheet:** BOM, A to Z, path cells as on disk (`heat-1995-POSTER.jpg`, `season 02/` kept), quotes, commas and newlines in a synopsis, held during review, family's value on a skip, applied value on _Apply_, a watch tick writes nothing, a crossing into In progress does, edits, ratings, hearts, Watched, Delete and Clear details reach it, an unplugged folder catches up, a New folder's sheet survives a hand add, a reset (also one pressed during review) leaves it byte-identical, an Orphaned-row line, a rescan changes nothing.
- **Rebuild:** a hand-written sheet's every field on the first scan (TMDB id and rating, heart, Watched, air dates, a series' Year range and creator); two Factory reset rebuilds equal, sheet byte for byte; specials; a year edited away from the Folder key; a sheet with no `Folder` or `Type` column; reordered columns, a stray column, `MOVIE`; a UTF-8 sheet with no BOM and LF line ends; an xlsx in `Meta/`.
- **Growth:** new episodes and seasons join a held series, keeping Watched and the heart; a held series' poster and Stills fill; a renamed Title folder relinks its held film, no duplicate.
- **Export:** the layout less videos, every path cell names a file that travelled, text cells equal the Library sheet's, xlsx, Images/Subtitles off, a taken name numbered, titles Windows forbids (`Mission: Impossible`, `What If...?`, `AC/DC Live`) exported to safe folder names. CSV upload, xlsx upload and an Export merged over bare videos each rebuild the library whole.
- **Hand adds:** a linked add in a Title folder gets a row and a Layout fill that keeps the user's own `my-own-POSTER.jpg`; loose, shelved and copied adds get neither; the same video twice is refused; the Show folder pick passes `Season 1/` and `Extras/` in silence; ambiguous and no-folder Problems on an upload; copy mode still writes each folder's sheet.
- **Scale:** 400 films and 900 episodes scan to review in 2.4 s; a rating reaches the 1,420-row sheet in 3.2 s (debounce included), the server answering in under 15 ms meanwhile.
- **UI:** a rebuilt film's and series' pages draw the rating, Watched, heart, genres, credits, poster, `1 of 3 episodes watched` and _Play S01E02_.

## Not covered

- A Sync against real TMDB (offline), the Electron window and its dialogs, the Ordered shutdown's flush, Linux case sensitivity, an external or network drive.

## Baseline

The full suite is green on `57b91cc1` (739 files, 11582 passed, 1 skipped). No existing test catches any finding above, so each fix should start from a RED test that reproduces it.

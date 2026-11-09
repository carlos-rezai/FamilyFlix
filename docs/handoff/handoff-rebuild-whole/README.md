# Rebuild whole: handoff

Step 42, design log `docs/design-logs/59-rebuild-whole.md`. This handoff is
the QA ticket that opened the step, filed after step 41 (Folder layout) as
issue 546 and deleted once its grill-me was held: its text is kept here
whole, below the line, as the record of what was found. It has no screen of
its own and amends no prototype. Where this README and the log differ, the
log rules: the log settles each finding, and the copy it adds is below.

## Copy

Two new lines in the import's log, worded as the lines beside them:

| Where                                                              | Text                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| A scan's log, a file the Layout fill writes                        | `↓ poster.jpg  →  Heat (1995)/Images/poster.jpg`, the Sync's own line |
| A Folder scan's log, a sheet row with no Title folder (log 59 Q18) | `⚠ Heat (1995) (1) is in the sheet but has no folder, left out`       |

A Title folder whose Season folders hold no video takes the existing
`⚠ <Folder> holds no video or Season folder, left out` (log 59 Q17).

---

## Folder layout: QA follow-up, the rebuild loses series art and sheet fields

> **Initiative:** `folder-layout` (follow-up to the PRD, 533)
> **Found by:** an end-to-end QA pass over the real server (`server/src/main.ts` on a scratch DB, media directory and Library folder per scenario, driven over HTTP, the disk inspected after each step). Stories cited are the PRD's (`docs/PRDs/58-folder-layout.md`).

## Summary

The film layout, the Layout warnings, the Layout fill, the Library sheet's lifecycle (debounce, hold during review, release, Unreachable catch-up, Factory reset exemption, Delete, Clear details) and the Export layout all behave as specified. **The Factory reset rebuild does not.** A series comes back with no art, and several sheet columns are never imported. Worst of all, when the rebuild's run closes, the Library sheet is rewritten from the thinner library, so **the values the import skipped are erased from `Meta/familyflix-library.csv` itself**. That makes story 86's promise lossy on the first rebuild and permanent on the second.

## Findings

### 1. High: a scan never imports a series' art (series poster, backdrop, Season posters, Stills)

`readTitleFolder` reads them, but `groupShows` doesn't carry them and `importShow` never passes art to `addSeries`, `addEpisode` or the Season posters. Breaks stories 17, 23, 24, 81 and 86 for every series, on a first scan, a rebuild after a Factory reset and an Export merged back over videos. No importer test asserts a scanned series' poster, Season poster or Still.

- **Repro:** `Tidewater (2018)/Images/poster.jpg`, `Season 01/Images/poster.jpg`, `Season 01/Images/Stills/S01E01.jpg`, `Season 01/Tidewater.S01E01.mp4`; scan. **Expected:** series poster, Season 1 poster, S01E01 Still. **Actual:** all `null`; the episode's subtitle track _is_ read.
- **Knock-on:** the Library sheet then writes the Series and Season `Poster` cells and the `Still` cells blank, so the art is also gone from the sheet.

### 2. High (data loss): the rebuild skips sheet columns, then the sheet rewrite erases them

`importMatch` and `importShow` ignore these `SheetRow` fields, which `readSheet` already parses:

| Row type | Column dropped                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Movie    | `TMDB id`, `TMDB rating`, `Runtime` (only the probe is used; without a probe the sheet value is lost) |
| Series   | `TMDB id`, `TMDB rating`, `Favorite`                                                                  |
| Episode  | `Status`, `Runtime`                                                                                   |

Breaks stories 37 ("a rebuild needs no second Sync and keeps the family's hearts"), 81 and 86. _Import from spreadsheet_ goes through the same code.

- **Repro (proved end to end):** scan a series, mark S01E01 watched and heart the series, wait for the sheet (it shows `Watched` and `Yes`), Factory reset, add the folder, _Scan new folders_. **Actual:** series heart off, S01E01 _Unwatched_; on _Finish_ the sheet is rewritten with `Unwatched` and a blank `Favorite`. A hand-written Meta sheet with `TMDB id 562`, `TMDB rating 7.8` loses both the same way on its very first scan.
- **Suggested shape:** import every sheet field; and, as a guard, consider not letting a release rewrite a held folder's sheet with blanks over cells the run read and did not take.

### 3. Medium: the Library sheet's path cells name files that aren't there

`createLibrarySheet` writes path cells from the Export's File plan (`exportRows`), which names each file where an Export would put it (`Images/poster.<ext>`, `Subtitles/<Language>.<ext>`, `Stills/S01E03.<ext>`), not the file the Title folder actually holds. Breaks story 40 ("a path cell names only a file that is there").

- `Images/die-hard-1988-poster.jpg` on disk → cell `Die Hard (1988)/Images/poster.jpg`
- `Subtitles/diehard.pt.srt` → `Subtitles/Portuguese.srt`; `Subtitles/random-name.srt` → `Subtitles/English (2).srt`
- the user's own `Images/my-own-POSTER.jpg` kept by the Layout fill (correctly) → cell still `Images/poster.jpg`
- a Frame still, which the Layout fill never writes → cell `Season 01/Images/Stills/S01E03.jpg`

The film rebuild still finds its art by role, so the visible damage is an untrue sheet, plus any reader that follows the cells (an _Import from spreadsheet_ of this sheet).

### 4. Low (Linux only): an Episode's `Video` cell re-spells the Season folder

The cell is `${Folder}/${spellSeasonFolder(n)}/<video>`, not the stored Source file, so a `season 03/` folder (read, case folded, story 18) is written `Season 03/...`. That's fine on Windows, but on the Linux AppImage the cell names nothing. Using the episode's `sourceFile` would make it exact.

### 5. Low: the Show folder pick and the scan disagree on non-layout subfolders

In a Title folder holding `Season 01/` and `Season 1/Tidewater.S01E09.mp4`, the scan passes `Season 1/` in silence (story 94), but `GET /show-folder` lists `Season 1/Tidewater.S01E09.mp4` as Unplaced for the form to number. Story 100: "a hand-added show and a scanned show agree".

### 6. Low: a Library sheet row whose folder is gone vanishes in silence

A Folder scan reading `Meta/` drops a row no Title folder holds, with no line in the log; the rewrite on close then removes it from the sheet. Seen with an Export merged back: its `Heat (1995) (1)` row (a copied title, no folder) disappeared with no line. After a Factory reset, a title whose folder was renamed or moved loses its rating, heart and Status the same silent way. One Warning line per orphaned row would at least say so.

### 7. Low: a Title folder whose Season folders hold no video is neither read nor warned

`Hollow Show (2020)/Season 01/` (empty): no title and no Layout warning. Its sibling case, `Empty (2000)` with no video or Season folder, warns as story 90 says.

### 8. Low: the importer never runs the Layout fill

The PRD's `fillLayout` decision lists "import, a scan's import" among its callers; `createImporter` has no `layoutFill` dependency. A scan's art already lies in the layout, so the gap only shows when a sheet's path cell names a file outside it (for instance a poster lying beside the video), which is then copied in but never written to `Images/`. _(From reading the code; not reproduced.)_

### 9. Low: a sheet write lost to a crash stays stale until the next change

Pending touches live only in memory; the Ordered shutdown flushes them, but a hard kill within the 3 s debounce loses them, and nothing rewrites the sheet on the next start or scan. Rewriting every reachable folder's sheet at startup (or at a scan's close) would make the sheet self-healing.

## What passed

About 110 checks across 5 scenarios, among them:

- **Layout warnings:** each one's text, the single loose-videos line, and silence for `Meta/`, Export folders and system folders.
- **Folder rules:** year-less, shelved, range, suffixed, empty and mixed folders are left out; `Season 00`, `season 03` (case folded) and `Season 100` are read; `Season 1`, `Specials` and `S04` are not; the folder's season wins over the tag; `Episode 3` and `Aflevering 4` are numbered.
- **Film reads:** two loose videos give `no-video`; `Extras/` is not read; images are read by role and case folded, the first by name order; `folder`/`fanart` are ignored; track languages come off names.
- **Library sheet writes:** the BOM, the A to Z order and forward slashes are right; the sheet is held during review and rewritten on close with the family's value; a resume tick with no Status crossing writes nothing; an Unreachable folder catches up; a Factory reset leaves the sheet byte-identical; Delete and Clear details reach it.
- **Layout fill:** it writes only empty slots, keeps the user's own art, never replaces a track, names a second track of one language `(2)`, never writes a Frame still, and a second save adds nothing.
- **Hand adds:** a linked add in a Title folder gets a sheet row and a fill; one loose or shelved gets neither; a copied add is in no sheet.
- **Export:** it has the layout less videos, `Meta/` in both formats, a single `Library` worksheet, Frame stills included, numbered Folder-key clashes, and blank cells when Images/Subtitles are off. _Import from spreadsheet_ of its CSV and its xlsx brings the series' episodes back (story 83).

## Not covered

- A Sync against real TMDB (the pass was offline).
- The Electron window and its UI: the Sync's _Where it is saved_ and the Export dialog copy.
- The Ordered shutdown's flush (a signal can't be delivered to the child on Windows).
- A read-only Title folder's Warning line.
- Linux case sensitivity (finding 4 comes from reading the code).

## Baseline

Baseline: the full suite is green on `077b91cd` (724 files, 11477 passed, 1 skipped). None of the findings above is caught by an existing test, so each fix should start from a RED test that reproduces it.

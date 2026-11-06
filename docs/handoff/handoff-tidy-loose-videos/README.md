# Tidy loose videos: handoff

> **Not built 1:1.** This handoff was drawn against an older FamilyFlix. Design log 57 (`docs/design-logs/57-tidy-into-folders.md`) rules where the two disagree: the tidy is offered as a `loose` Problem in a Folder scan's Review step and from the Folder row's Tidy dialog, built from the existing units. Keep this folder for copy and intent.

New maintainer screen at `/settings/library/tidy`, reached from **Settings → Library → Tidy loose videos** and from the hint a scan gives when it walks past loose videos. It finds every video lying loose at the top level of a Library folder and moves each into a new folder of its own, named after the file: `Apex (2026).mp4` becomes `Apex (2026)\Apex (2026).mp4`, with its subtitles and `-poster` image moving with it. It lists every move first and moves nothing until the maintainer confirms.

This is the **only** place FamilyFlix moves a file inside a Library folder, and only on that confirm. A scan and a Write target still only add.

Prototype: `prototype/page.TidyLooseVideosPage.dc.html` (open in a browser; self-contained mock data). It starts on a stand-in for Settings → Library; **Simulate a scan** shows the scan hint. Also wired into `FamilyFlix.dc.html` (`screen: 'tidy'`, component `feat.TidyFlow.dc.html`), where finishing an import raises the same hint.

## Screenshots

- `screenshots/01-entry-settings-row-and-scan-hint.png`: Settings row with the `9 loose` badge, and the scan hint snackbar
- `screenshots/02-plan-default.png`: plan, default (the two `Northwind` rows show the duplicate-name block)
- `screenshots/03-rename-inline.png`: inline rename open
- `screenshots/04-sibling-year-hint.png`: one of the pair got a year; the other gets a hint to add one too
- `screenshots/05-left-where-they-are.png`: the _Left where they are_ list
- `screenshots/06-rename-name-clash.png`: renaming into a folder name that already exists
- `screenshots/07-name-the-show.png`: naming a show for loose episodes
- `screenshots/08-moving.png`: moving, with the live log
- `screenshots/09-done-with-failure.png`: finished, one move failed
- `screenshots/10-rescanning.png`: rescanning after a tidy
- `screenshots/11-rescan-still-loose.png`: rescan result, some still loose
- `screenshots/12-no-more-loose-files.png`: rescan result, nothing loose

## Where it goes in the code

| Piece     | Location                                                  | Reuse                                                                                                                                                              |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry row | `src/features/settings/LibrarySection/LibrarySection.tsx` | New `ActionRow` after _Manage library_: glyph `▤`, label **Tidy loose videos**, badge (see Entry row), → `navigate('/settings/library/tidy')`                      |
| Page      | `src/pages/TidyLooseVideosPage/TidyLooseVideosPage.tsx`   | Composition only: `MaintainerLayout` + organism                                                                                                                    |
| Organism  | `src/features/library-admin/TidyLooseVideos/` (suggested) | `PageHeader` (Back → where the maintainer came from: `/settings` or the import review; heading _Tidy loose videos_, lede below)                                    |
| Rows      | `TidyMoveRow`, `TidySkippedRow` (new molecules)           | Card shape of `ManagedFolderRow`; checkbox look of the import's _Also fetch metadata_ box                                                                          |
| Progress  | Existing                                                  | `ProgressBar` (determinate, 10px) + `ImportLog` (220px). Same pattern as Import and TMDB enrichment, so no `LogoLoader` here (see Loading states, _Not used here_) |
| Buttons   | Existing                                                  | `Button` primary / secondary (md)                                                                                                                                  |
| Feedback  | Existing                                                  | `useSnackbar`                                                                                                                                                      |
| Scan hint | Import / scan result + `useSnackbar`                      | Warning line in `ImportLog`, then an info snackbar with an action (see Scan hint)                                                                                  |

## Entry points

### Entry row

- Desc when there's something to tidy: _N videos at the top of <folder> have no folder of their own, so scans skip them._
- Desc when nothing is loose: _Gives each loose video a folder of its own. Shows every move before anything happens._
- Badge after the label (`gap 9px`) only when N > 0: `N loose`. 11px/700, `letter-spacing .4px`, uppercase, `accent` ink on `accentSoft`, `accentLine` 1px, pill, `2px 9px`.

### Scan hint

When a scan walks past loose videos it does not add them, and says so:

1. A warning line in the log, before the _complete_ line: _⚠ Walked past N loose videos at the top of <folder>. They have no folder of their own, so they were not added. Tidy them to include them._
2. ~500ms after the scan finishes, an info snackbar (not auto-dismissed):
   - Title: _N loose videos left out_
   - Message: _They sit at the top of <folder> with no folder of their own, so the scan couldn't add them as films._
   - Action: **Review & tidy** → opens the tidy screen and dismisses the snackbar.

## Layout

Same frame as Import: `bg2` page, content max-width 780, `space-6` sides, `space-8` bottom.

- Header: 42px outline `IconButton` (back) + h1 serif 30/600.
- Lede (15 `textFaint`, `margin-left 58px`, max-width 560, line-height 1.5): _Gives every video lying loose in a Library folder a folder of its own, named after the file, so the next scan finds it as a film. You can rename any of them before they move._

The screen has six states: **Plan**, **Moving**, **Done**, **Rescanning**, **Still loose**, **No more loose files**.

## 1. Plan

Stacked, `gap 18px`.

1. **Folder card** (`surface`, `borderSoft`, `radius.md`, `14px 16px`): folder icon 20, the Library folder path in mono 14 `text` (ellipsis), then `N loose videos at the top level` (13 `textFaint`), then **Rescan** (34px outline button: transparent, `border` 1px, 8px radius, 13.5/600, refresh icon 14). While rescanning the label reads `Scanning…`; when done, info snackbar: _Looked through <folder> again. Still N loose videos, nothing new._ (or the updated count).
2. **Confirm callout** (`accentSoft` bg, `accentLine` 1px, 10px radius, info icon in `accent`): **Nothing moves until you confirm.** _This is the only place FamilyFlix moves a file inside a Library folder. Scans and imports only ever add._
3. **Planned moves**: group heading (12/700, `.9px` tracking, uppercase, `textFaint`) with `N of M selected` on the right (13 `textFaint`). Rows below, `gap 8px`.
4. **Left where they are** (only when there are any): same heading style, rows `gap 8px`.
5. **Footer** (wraps): primary **Move N videos** (`Move 1 video`; `Nothing selected` as secondary when N = 0), ghost **Not now** (back), and on the right `N files in all, including subtitles and posters` (13 `textFaint`).

### Move row

`surface`, `borderSoft` 1px (`accentLine` while editing), `radius.md`, `14px 16px`, flex, `gap 14px`, top-aligned. Unselected or blocked rows sit at `opacity .55`.

1. **Checkbox**: 22px, 6px radius, 2px border. On: `accent` fill and border, `✓` in `#1a1109`. Off: `textFaint` border. Clicking a **blocked** row's checkbox opens its rename instead.
2. **Text** (`flex:1; min-width:0`)
   - File name, mono 13.5 `text`, ellipsis. **Rename** button on the right (30px outline, 7px radius, 13/600, pencil 13, `textDim` → `text`).
   - Destination, mono 12.5 `accent`: `→ E:\Movies\Apex (2026)\Apex (2026).mp4`.
   - When renamed: _Renamed by you · was <original name>_ (12.5 `textFaint`).
   - Notes (12.5, below, see Names and years): duplicate name, existing folder, or the sibling year hint.
   - Companions: _Moves with it:_ + mono list joined by `·` (12.5 `textFaint`), already showing their new names.

### Inline rename

Opens inside the row (`bg2` well, `border` 1px, 10px radius, padding 14):

- **Title** (flex) + **Year** (110px, digits only, max 4, placeholder `e.g. 1963`). Prefilled by splitting the current name on a trailing `(YYYY)`.
- Preview: _Will be called **<name>.<ext>**. The folder, the video, its subtitles and its poster all take this name._ Empty title shows `Untitled`.
- Live errors (12.5 `danger`): _A folder with that name is already here. Change the title or add a different year._ / _Another loose video would get the same name. Add a year to tell them apart._
- **Use this name** (36px, `accent`, 13.5/700) · **Cancel** (ghost) · **Back to file's name** (ghost, right, only when renamed). Saving the original name again clears the rename. Saving also re-selects the row.

The new name `Title` or `Title (Year)` is applied to the folder, the video and every companion (companion = same base name + its own suffix, so `Northwind.en.srt` → `Northwind (2018).en.srt`).

### Names and years

Years are **not** asked for by default. A video with no year moves as it is. FamilyFlix only steps in when names collide:

| Case                                                                | Row                                                                                                                                                                                                                               | Blocks the move?            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Two planned moves would get the same folder name (case-insensitive) | Both rows: _Another loose video is also called "<name>". Rename one of them, usually by adding its year, so each gets its own folder._ (`danger`)                                                                                 | Yes, until the names differ |
| A folder with that name already exists                              | _A folder with this name is already here. Rename this video to move it._ (`danger`)                                                                                                                                               | Yes                         |
| One of a same-name pair got a year, the other has none              | Hint well (`accentSoft`, 8px radius, `8px 10px`): _You gave the other "<title>" a year. Add one here too, so the two are easy to tell apart._ + **Add a year** (28px, `accentLine` outline, `accent` 12.5/700) → opens the rename | No, it's a suggestion       |

Blocked rows are left out of **Move N videos** and the counts.

### Skipped row (Left where they are)

`surface`, **dashed** `border` 1px (solid `accentLine` while its editor is open), `radius.md`, `14px 16px`. 10px dot in `warning` (`#c9a86a`), name in mono 13.5 `textDim`, reason 13 `textFaint`. Actions on the right (wrap under on narrow widths), `gap 8px`:

- Main action: 38px, `accentSoft` bg, `accentLine` 1px, `accent` 13.5/700.
- Other action: 38px outline, `border` 1px, `text` 13.5/600, `surface3` on hover.

Two kinds in the prototype:

1. **Folder already exists**: _A folder named "Harbor Lights (2019)" is already here. If this is a different film with the same title, rename it. Changing the year is usually enough._
   - **Rename** (main): adds it to Planned moves and opens its rename, prefilled.
   - **Move into it** (other): adds it to Planned moves with the destination `Harbor Lights (2019)\Harbor Lights (2019).mkv (existing folder)`. No rename on that row.
2. **Loose episodes** (files tagged `S01E01` but not naming a show): _These look like episodes of a show, but the files don't say which one. Name the show to give them a folder._
   - **Name the show** (main) opens the show editor in the row.

### Show editor

Same well as the inline rename.

- **Show name** (flex, empty, placeholder `e.g. The Tin Forest`) + **Season** (110px, digits, max 2, prefilled from the tags).
- _Where they'll go_ (12/600 `textDim`), then one mono 12.5 `accent` line per episode: `→ E:\Movies\The Tin Forest\Season 01\S01E01 The Gate in the Fence.mkv`. With no name yet: `(show name)\Season 01\…`.
- Note: _Episodes keep their file names. Only the show and season folders are new._
- **Add to planned moves** (36px; `accent` when a name is typed, `surface3`/`textFaint` and inert when empty) · **Cancel**.
- In Planned moves the show appears as one row (first episode as the name, the others under _Moves with it_), destination `E:\Movies\<Show>\Season NN\`, and an **Edit show** button (same look as Rename) that sends it back to the editor.

## 2. Moving

- Heading serif 24/600: _Moving videos into their folders…_; stat 15 `textDim`: `N of M done`.
- `ProgressBar` 10px, determinate.
- Current file, mono 12.5 `textFaint`, ellipsis.
- _Activity log_ heading + `ImportLog` (220px). Lines:
  - `✓ <file>  →  <Folder>\<file>   (+N with it)`, adding `(renamed)` after the file when renamed (`success`)
  - `⚠ <file> did not move. <reason>` (`warning`)
- Note (13 `textFaint`): _Each video moves together with its subtitles and poster, or not at all. Stopping now keeps what's already moved._
- **Stop after this one** (secondary): finishes the current video, then goes to Done.

## 3. Done

- Two stat cards (as Import review): `N` in `success`, _moved into folders of their own_; and only with failures, `N` in `accent` with an `accentLine` border, _couldn't move and stayed where they were_.
- One row per failure: `danger` dot, file name, reason + _Its subtitles stayed with it._, **Try again** (38px, `surface3`). Success → snackbar _Moved. It's in its own folder now._
- Callout: refresh tile + **Scan again to add them** / _The tidied videos now look like films to the scanner. A rescan adds them to your library._
- **Rescan this folder** (primary) · **Done** (ghost, back).

## 4. Rescanning

Stays on this screen (it does **not** jump back to Settings). Heading _Scanning <folder> again…_, line _Adding the films that now have folders, and looking for anything still loose._, indeterminate `ProgressBar`.

## 5. Result

**Still loose** (card with `accentLine` border, padding `28px 24px`):

- Title serif 24: `N loose video(s) still left`
- _N new films were added to your library. The rest still need something from you, such as a new name, a show name, or another try._
- **Review them** (primary, back to Plan with only what's left) · **Go to library** · **Back to settings** (secondary).

**No more loose files** (centred card, 56px `success` check circle):

- Title serif 26: _No more loose files_
- After a rescan: _Every video in <folder> now has a folder of its own. N new film(s) were added to your library._
- Opening the screen with nothing loose shows the same card: _Every video in <folder> already has a folder of its own._
- **Go to library** (primary) · **Back to settings** (secondary).

Videos that moved leave the plan for good; the Settings badge and every count show only what remains.

## Behaviour

- One editor open at a time (rename or show). Opening another closes the first without saving.
- Back from the screen returns to where the maintainer came from (Settings, or the import review).
- Nothing touches the disk before **Move N videos**. Rescan only reads.
- Motion follows the existing contract (hover 120ms, press 60ms scale, snackbars `ffSnackIn`).

## Rules for the server

- **Loose video**: a video file sitting directly in a Library folder's root.
- **Companions**: files in the same root whose name starts with the video's base name followed by `.` or `-` (`Apex (2026).en.srt`, `Apex (2026)-poster.jpg`). Samples and trailers beside it stay put.
- **Episode**: has an `SxxEyy` / `NxNN` tag. Never filed as a film; offered to the show editor instead.
- **One video at a time, all or nothing**: create the folder, move the video and its companions; if any part fails, move back what moved and remove the empty folder, then report the failure. The prototype's _It's open in another app_ is the file-in-use case.
- **Linked video**: if a held Linked video points at a file that moves, its stored path is updated in the same step.

## Server (to confirm)

Suggested routes, alongside the Library folder scan:

- `GET  /api/library/folders/:id/loose` → `{ root, moves: { id, file, companions[] }[], skipped: { id, kind: 'folder-exists'|'episodes', files[], season? }[], existingFolders[] }`
- `POST /api/library/folders/:id/tidy` with `{ moves: { id, name? }[], intoExisting: id[], shows: { id, name, season }[] }` → progress stream like the import (`moved` / `failed { reason }` per item).
- Scan result gains `looseCount` for the hint and the badge.
- Rescan reuses the existing scan.

## Open questions

1. Should loose videos one level down (e.g. `E:\Movies\Unsorted\x.mp4`) be tidied too? (Prototype: top level only.)
2. Shows: should the show folder go into a Series Library folder instead of the Movies one?
3. If an external drive is unplugged mid-run: stop at once and report the rest as _not moved_, or retry when it's back?
4. Should **Move into it** check that the existing folder doesn't already hold a video?

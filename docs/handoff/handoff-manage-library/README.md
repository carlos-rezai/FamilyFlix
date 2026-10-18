# Manage library — handoff

New maintainer screen at `/settings/library`, reached from **Settings → Library → Manage library**. Lists every title's folder, split by Movies / Series, with three actions per folder: **Edit** (by hand or TMDB sync), **Clear metadata**, **Delete**.

Prototype: `prototype/page.ManageLibraryPage.dc.html` (open in a browser; self-contained mock data). Also wired into `docs/handoff/FamilyFlix.dc.html` (`screen: 'manage'`).

## Screenshots

| #   | State                                                                                           |
| --- | ----------------------------------------------------------------------------------------------- |
| 01  | `screenshots/01-movies-default.png` — Movies tab, default                                       |
| 02  | `screenshots/02-edit-menu.png` — Edit ▾ menu open                                               |
| 03  | `screenshots/03-more-menu.png` — ⋯ menu (Clear metadata / Delete…)                              |
| 04  | `screenshots/04-delete-confirm-linked.png` — Delete confirm, linked folder warning              |
| 05  | `screenshots/05-clear-metadata-confirm.png` — Clear metadata confirm                            |
| 06  | `screenshots/06-syncing-and-cleared-row.png` — row syncing with TMDB; row with cleared metadata |
| 07  | `screenshots/07-series-tab.png` — Series tab                                                    |

## Where it goes in the code

| Piece     | Location                                                  | Reuse                                                                                                                                                                                   |
| --------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry row | `src/features/settings/LibrarySection/LibrarySection.tsx` | New `ActionRow` after _Library folders_: glyph `☰`, label **Manage library**, desc _Edit, clear or delete the folders behind each movie and series._ → `navigate('/settings/library')` |
| Page      | `src/pages/ManageLibraryPage/ManageLibraryPage.tsx`       | Composition only: `MaintainerLayout` + organism                                                                                                                                         |
| Organism  | `src/features/library-admin/ManageLibrary/` (suggested)   | `PageHeader` (Back → `/settings`, heading _Manage library_, lede below)                                                                                                                 |
| Tabs      | —                                                         | `PillTabs` (`Movies` / `Series`), tab in `?tab=`, omitted at `movies`. Add a count pill to each tab (see Tab count)                                                                     |
| Row       | `ManagedFolderRow` (new molecule)                         | Shape of `FolderRow`: 40px accent tile + `FolderIcon`, mono path                                                                                                                        |
| Menus     | —                                                         | `Menu` (right-aligned panel, `$danger` item for Delete)                                                                                                                                 |
| Dialogs   | —                                                         | `Modal` (title, subtitle, icon tile)                                                                                                                                                    |
| Feedback  | —                                                         | `useSnackbar`                                                                                                                                                                           |

## Layout

- Lede: _Every title's folder, as FamilyFlix knows it. Edit its details, clear them, or delete it for good._
- Toolbar row: `PillTabs` left; summary right — 13px `textFaint`: `N folders` + ` · M without metadata` when M > 0.
- List: rows stacked, `gap: 8px`.
- Empty tab: card on `surface`, 48px vertical padding, centred `textFaint` 15px — _No movies in your library._ / _No series in your library._

### Tab count

Inside each tab, after the label, `gap: 8px`: 12px/600, `padding: 1px 7px`, pill radius. Active: `rgba(26,17,9,.16)` bg, `#1a1109` ink. Inactive: `surface3` bg, `textFaint` ink.

### Row

`surface` bg, `borderSoft` 1px, `radius.md`, padding `14px 14px 14px 16px`, flex, `gap: 14px`, centred.

1. **Tile** — 40×40, 9px radius, `accentSoft` bg, `accent` ink, `FolderIcon` 20.
2. **Text** (`flex:1; min-width:0`)
   - Title 16/600 `text` + year 14 `textFaint`, baseline-aligned, `gap 8px`.
   - Path — mono 13 `textFaint`, `overflow-wrap:anywhere`, `margin-top:3px`.
   - Meta line (`margin-top:8px`, 12px, `gap 8px`):
     - Source badge — **Linked** / **Imported**: 600, `textDim` on `surface3`, `border` 1px, pill, `2px 8px`.
     - Files — movie: `3 files` / `1 file`; series: `3 seasons · 151 episodes`.
     - `·` in `border`.
     - Status — 7px dot + label in `textDim`:
       - `Synced with TMDB` — dot `success`
       - `Edited by hand` — dot `info`
       - `No metadata` — dot `warning`
       - `Syncing with TMDB…` — 10px ring spinner (`accentLine` with `accent` top), row at `opacity .75`, both buttons disabled.
3. **Actions** (`gap 6px`)
   - **Edit ▾** — `Button` secondary/sm look: 36px tall, `surface3`, `border`, 8px radius, 14/600, chevron-down 14.
   - **⋯** — 36px ghost square, `textFaint` → `text` + `surface3` on hover. `aria-label="More actions for <title>"`.

**No-metadata row**: title shows the **folder name** (last path segment) in mono 15/500 `textDim`; year hidden.

### Edit ▾ menu (min-width 220)

Two-line items (15px label `text`, 12px hint `textFaint`, 16px leading icon `textDim`):

- **Edit details** — _Change title, year, poster by hand_ → opens the Movie form / series edit in edit mode.
- **Sync with TMDB** — _Fetch details and artwork again_ → runs a single-title enrichment; row shows Syncing state; on success the status becomes _Synced with TMDB_, snackbar success: _"<title>" synced with TMDB._ Needs the TMDB key; with no key, send to Settings → Network as the detail page does today.

### ⋯ menu (min-width 200)

- **Clear metadata** — disabled (40% opacity) when status is already _No metadata_.
- hairline divider (`borderSoft`, `margin 4px 6px`)
- **Delete…** — `$danger` item.

## Dialogs (`Modal`, 520px)

Both share: icon tile, title, subtitle, the folder path in a mono well (`bg2`, `borderSoft`, 9px radius, `12px 14px`), then a two-column **Removed / Kept** list (group-heading style; Removed heading in `danger`, ✕ in `danger`; Kept heading `textFaint`, ✓ in `success`). Actions right-aligned: **Cancel** (secondary) + confirm (lg, 44px).

### Delete

- Icon tile: danger tint `rgba(201,122,106,.12)` / border `.32`, `danger` ink, trash glyph.
- Title: _Delete "<title>"?_
- Subtitle: _This removes the movie|series from FamilyFlix and deletes its folder from disk. It can't be undone._
- Removed: _The folder and N files_ (series: _N episode files_) · _Details, poster and artwork_ · _Watch history_. Kept: _Nothing_.
- **Linked** folders only — warning callout (danger tint bg/border, 13px): _This is a linked folder. It's deleted from where it lives on disk, not just unlinked — and it won't be in the Recycle Bin._
- Confirm: **Delete folder** — `danger` bg, `#1a1109` ink.
- After: row removed, snackbar danger: _"<title>" and its folder were deleted._

### Clear metadata

- Icon tile: the standard accent tile.
- Title: _Clear metadata?_
- Subtitle: _The movie|series stays in your library under its folder name, with no details, until you edit it or sync with TMDB._
- Removed: _Title, year and synopsis_ · _Poster and artwork_ · _Genres, cast and ratings_. Kept: _The folder and N files_ · _Watch history_.
- Confirm: **Clear metadata** — primary.
- After: row flips to No-metadata state, snackbar info: _Metadata cleared for <folder name>._

## Behaviour

- One menu open at a time; outside press / Escape closes (the `Menu` contract).
- Dialog dismissal is the `Modal` contract (✕, Escape, scrim); focus returns to the ⋯ trigger.
- Blank until the list lands, like Library folders.
- Motion follows the existing contract: hover 120ms, press 60ms scale (.97 buttons / .94 icon), menus `ffPop .14s`, modal `ffFade`/`ffPop`.

## Server (to confirm)

Suggested routes, alongside `routes.deleteSeries` / `routes.reset`:

- `GET  /api/library/managed?kind=movies|series` → `{ id, kind, title, year, path, source: 'linked'|'imported', files | {seasons, episodes}, meta: 'tmdb'|'manual'|'none' }[]`
- `DELETE /api/library/managed/:id` — removes DB rows **and** the folder on disk (linked or managed copy).
- `POST /api/library/managed/:id/clear-metadata` — keeps files and watch history.
- Sync reuses the existing single-title enrichment.

### Open questions

1. Should Clear metadata also clear watch history? (Prototype keeps it.)
2. Confirm linked-folder delete bypasses the Recycle Bin, or switch to trash and soften the warning.
3. Unreachable folders: show `Can't be reached right now` in `danger` (as `FolderRow` does) and disable Delete?

# 14 — Export

> **Initiative:** `export`
> **PRD:** [#136](https://github.com/carlos-rezai/FamilyFlix/issues/136) · `docs/PRDs/14-export.md`
> **Plan:** to follow the PRD

This log is the `grill-me` session that settled the feature before the PRD was
written, run against the prototype and the code as they stood on 2026-09-16. It
is an immutable snapshot of that moment. The session ran with every
recommendation accepted in advance by the maintainer, whose one instruction was
the scope: _translate the prototype 1:1 into the codebase, in its naming and
conventions_ — and, first, to check whether the **Import progress console** the
feature table ticks ✅ was really done, and build that instead if not.

## Background

The **Import progress console** is done. `#128` ("Bulk import: the console")
closed on 2026-09-14; `src/features/import-export/ImportProgress/` renders every
piece of `feat.ImportFlow.dc.html`'s running step — the Connect ✓ → Scan →
Import stepper, the serif headline, the stat line, the bar, the current item in
mono, elapsed and the ETA, the **Activity log** and _Cancel import_ — over a
server run polled every 500 ms. The only trace of the initiative still open is
its umbrella `#123`, with all seven phases and the refactor (`#135`) closed under
it: housekeeping, not missing work. So this session is **Export**, the last 🔜
row under _Maintainer tools_.

The prototype is `docs/handoff/feat.ExportModal.dc.html`, mapped by
COMPONENT-SPEC §5 to `features/import-export/ExportModal` with
`{ open, format, filename, rowCount, columns[], onFormat, onExport, onClose }`,
"an overlay rendered above the current route" (§6). Log 13 Q1 sent it here —
"Export gets its own grill" — and Q2 left the `⬇ Export to CSV` row out of
`LibrarySection` on purpose: "a row whose destination does not exist is not
drawn". The container's simulation (`FamilyFlix.dc.html`, `openExport` …
`runExport`) shows the two faces of one card:

- **Idle:** a header — a download glyph in the 44px accent tile, _Export
  library_, _Save your whole collection as a spreadsheet._, ✕ — over a body of
  four rows: **Format**, two selectable cards (_CSV — Plain comma-separated.
  Opens anywhere._ / _Excel — .xlsx workbook with a header row._) each with an
  18px radio dot; a filename row (a ruled-sheet glyph, `family-library.csv` in
  mono, `12 movies` in accent on the right); **Columns included**, eight small
  pills — Title, Year, Genres, Director, Cast, Rating, Status, Subtitles; and
  _Export as CSV_ / _Export as Excel_ (`primary`) beside _Cancel_
  (`secondary`).
- **Done:** no header at all — a 64px circle tinted with the watched colour
  holding a tick, _Export ready_, "Saved `family-library.csv`⏎with 12 movies
  to your computer.", and _Done_ (`secondary`). `runExport` flips straight to
  it; the simulation writes nothing.

`page.SettingsPage.dc.html` lists the row the section will gain: `⬇`,
_Export to CSV_, _Save your whole library out as a spreadsheet backup._

What exists to build on:

- `server/src/import-export/readSheet/`: `.xlsx` or `.csv` by extension through
  `exceljs`, the header row through a synonym table, `SheetRow` out. The
  writer's mirror image and the other half of the round trip README promises
  ("bulk-edit externally and re-import").
- `storage.listMovies(query)` with `sort: 'a-z'`, and `storage.countMovies()`,
  already behind `GET /api/genres`' `total`.
- `components/Modal/`: the scrimmed card with the whole dismissal contract,
  built for the **Delete dialog** with the Export dialog named as its second
  customer (log 12 Q9; COMPONENT-SPEC §4). It always draws its header.
- `features/settings/LibrarySection/` + `ActionRow/`: two rows, the third
  reserved. `features/movie-detail/DeleteMovieDialog/`: the shape of a dialog
  that owns its hook, swallows a refused request, and reads its in-flight state
  off the button label.
- `primitives/Icon/`: `SheetIcon` (the ruled sheet — the filename row's glyph
  exactly) and `CheckIcon` (the done tick exactly). No download glyph yet.
- `src/types/import.ts`: the precedent for a type file shared by both build
  targets, and `MOVIE_SORTS` the precedent for an `as const` value living there.

## Problem

A prototype with two faces, a simulation that writes nothing, and a codebase
whose one dialog molecule always has a header. The questions are where the file
is built, what exactly is in it and whether it can come back in through the
importer, how it reaches the maintainer's disk from a Chromium page, how the
header-less done face fits on `Modal`, and who opens the dialog when the row
that opens it belongs to one feature and the dialog to another.

## Questions and Answers

1. **Is the Import progress console done, or is this session that?** ✅ Done —
   `#128` closed, `ImportProgress` complete against the prototype, only the
   umbrella `#123` left open with nothing under it. This session is **Export**.
   `#123` should simply be closed.

2. **What is "Export"?** ✅ Three things: `feat.ExportModal` in both faces; the
   `⬇ Export to CSV` row in `LibrarySection`; and the server side that writes
   the file. Initiative name **`export`** — log 13 Q1 reserved a name distinct
   from the `import-export/` folder so a commit prefix reads unambiguously.
   Log file `14-export.md`.

3. **Where is the file built — browser or server?** ✅ **Server.** `exceljs` is
   already there for `readSheet`; a `writeSheet` beside it is its mirror, and
   the round-trip test (write → `readSheet`) belongs on the side that has the
   reader. ❌ Client-side: exceljs's browser bundle is ~1 MB of frontend for one
   dialog, and the round trip could not be tested against the reader.

4. **Which columns?** ✅ **The prototype's eight, in its order** — Title, Year,
   Genres, Director, Cast, Rating, Status, Subtitles — declared once as
   `EXPORT_COLUMNS as const` in `src/types/export.ts` (the `MOVIE_SORTS`
   precedent) and read by the writer and the dialog's pills alike. ❌ Synopsis,
   runtime, the stored paths: not in the prototype; a **Sheet** is a listing of
   the collection, not a manifest of the **Managed media directory**.

5. **What goes in each cell?** ✅ Title as stored; Year the number or blank;
   Genres the names joined `", "`; Director or blank; Cast joined `", "`;
   Rating the stored 0–10 integer or blank; Status one of `Watched`,
   `In progress`, `Unwatched` off the derived `status`; Subtitles the language
   names in track order joined `", "`. Rows **A–Z by title**
   (`listMovies({ sort: 'a-z' })`) — the order a sheet is read in. ❌ Rating as
   a star string (`3½`): the reader's rating column is the stored scale, and a
   second scale would have to be taught to it for the round trip.

6. **Does an exported sheet come back in through Bulk import?** ✅ **Almost, and
   the gap is two lines.** `readSheet` splits Genres on `,` and Cast on `,`,
   reads Rating on the same scale, and reads Director. Its `watched` column
   knows only the header `watched` and the values `yes / true / 1 / ✓`, so a
   `Status` column reading `Watched` would be ignored. Amendment: `status` joins
   the synonyms for that column, and `watched` joins the truthy values;
   `In progress` and `Unwatched` fall through to `false`, which is right for a
   reader that has no resume position to give. The CSV is written with a UTF-8
   BOM so Excel opens _Amélie_ as _Amélie_; fast-csv's parser strips it on the
   way back, and the round-trip test guards both.

7. **Wire?** ✅ Two reads on one path:
   - `GET /api/export` → `ExportSummary { movieCount }` off
     `storage.countMovies()` — the export described before it is written; the
     `N movies` label on the filename row and in the done copy.
   - `GET /api/export/:format` (`csv` | `xlsx`, anything else `400`) → the
     bytes, `Content-Type` per format, `Content-Disposition: attachment;
filename="family-library.<format>"`.

   The route calls `storage.listMovies` and `writeSheet` and returns. ❌ A
   `createExporter` domain object injected into the router: there is no run,
   no state and no cancel — a pure writer over a list is the whole domain.
   ❌ Reading the count off `GET /api/genres`' `total`: the number is right but
   the name is wrong, and a call that discards nine-tenths of its payload is a
   smell the glossary would have to explain.

8. **How does the file reach the maintainer's disk from a Chromium page?** ✅
   `fetch` → `Blob` → **`saveToComputer(blob, filename)`**: an object URL on an
   anchor with `download`, clicked, revoked. Lives in
   `features/import-export/saveToComputer/` — a DOM side effect, so not
   `utils/` (whose one rule is _no side effects_). ❌ Navigating the page to the
   URL and letting `Content-Disposition` do it: a `500` would replace the app
   with a JSON body, and there would be no in-flight state to show. In Electron
   the same blob download raises `will-download`, and the shell's default save
   dialog is the prototype's "to your computer" — nothing to build now.

9. **The done face has no header, and `Modal` always draws one.** ✅ `Modal`
   gains **`bare?: boolean`**: the card is the children — no header, no ✕, no
   body padding — and `title` becomes the card's `aria-label` instead of the
   heading it labels. Escape and the scrim still ask `onClose`, as the
   prototype's overlay does under its done face. ❌ A second `Modal` for the
   done face: it would re-run `ffPop`, and the prototype swaps content inside
   one card. ❌ Keeping the header on the done face: not the prototype.

10. **The two format cards — `Chip`? A segmented control?** ✅ A feature
    molecule, **`FormatCard`** (`features/import-export/FormatCard/`), on the
    `StatTile` pattern: `{ label, description, selected, onSelect }`, a
    `role="radio"` button inside a `role="radiogroup"` labelled _Format_, the
    selected one on the accent-soft fill with the accent-line border, its 18px
    dot filled accent inside a 3px `surface-2` ring. The prototype draws it
    inline rather than importing `prim.Chip`, and so does the code.

11. **The column pills — `Chip` `sm`?** ✅ The dialog's own `ColumnPill` in
    `ExportModal.styles.ts`: 12.5px on `5px 11px`, dim text on the surface with
    the border. `Chip` `sm` is 14px on `6px 14px` and is a genre tag; the
    prototype did not reach for `prim.Chip` here either. Not the "one-off
    styled div when a primitive exists" rule: no primitive draws this pill.

12. **The header glyph?** ✅ A new `DownloadIcon` in `primitives/Icon/` — the
    prototype's `M12 3v11m0 0l-4-4m4 4l4-4M5 19h14` at stroke 1.9, `currentColor`
    — in the Modal's tile at 22px. `SheetIcon` (the filename row, 18px) and
    `CheckIcon` (the done tick, 32px in the watched colour) already exist and
    match the prototype's paths exactly.

13. **Who opens the dialog?** ✅ **`LibrarySection`** holds `exportOpen` and
    mounts `<ExportModal open onClose />` beside its rows — the section "owns
    where its rows lead" (log 13 Q2), and this row leads to an overlay rather
    than a route; the Modal's portal puts it above the whole route as the spec
    says. This is the app's first import of one feature's organism by another
    (`@/features/import-export/ExportModal/ExportModal`, by path) and is
    recorded as such: the wire stays in `import-export/api`, the Settings hub
    composes. ❌ `SettingsPage` holding the state: a page is composition only,
    and a `useState` is the first line of logic. ❌ `ExportModal` under
    `features/settings/`: it is the sheet's writer's own screen, and the spec
    places it.

14. **State?** ✅ **`useExport(open)`** in `features/import-export/useExport/`:
    on open, reset to `csv` and idle (the prototype's `openExport`) and fetch
    the summary; `chooseFormat`; `exportLibrary()` — _Exporting…_ and the button
    disabled (the form's _Adding…_ precedent) → the blob → `saveToComputer` →
    done. A refused request leaves the dialog where it was with nothing changed
    — the Delete dialog's rule; the prototype designs no error face and none is
    invented. A summary that never arrives leaves the row label blank rather
    than wrong; the export is still allowed. Zero movies is still an export — a
    header-only sheet, `0 movies`. The label singularises: `1 movie`, a case the
    prototype's twelve sample films never reached.

15. **The row says "Export to CSV" and the dialog offers Excel.** ✅ **Keep the
    prototype's label.** The dialog is where the format is chosen, and the row's
    copy is the prototype's; a label is not a place to improvise. Recorded as
    an accepted quirk, not amended.

16. **`GET /api/movies`?** ✅ The glossary said _"if nothing has claimed it by
    the time export ships, delete it then"_, and nothing has — the export route
    reads `storage.listMovies` directly. Its removal, with `parseLimit`, is
    this initiative's **refactor pass**: its route tests carry the sort
    coverage that must land on the repository test or on `/home` first.

17. **What is the writer's unit?** ✅ One, **`writeSheet(movies, format)`** →
    `Promise<Buffer>`, pure over the list — the row mapping is private inside it
    as `readSheet`'s cell parsing is private inside that. ❌ A separate
    `exportRow` unit: the eight cell rules are the writer's own, spelled once.

18. **The `filename`?** ✅ `family-library.csv` / `family-library.xlsx` — the
    prototype's — as `EXPORT_FILENAME: Record<ExportFormat, string>` beside the
    columns in `src/types/export.ts`, so the route's `Content-Disposition`, the
    dialog's row and the done copy all read one declaration.

## Design

### Types — `src/types/export.ts` (new, re-exported from `types/index.ts`)

```ts
// shared by both build targets, on the MOVIE_SORTS precedent
export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_COLUMNS = [
  'Title',
  'Year',
  'Genres',
  'Director',
  'Cast',
  'Rating',
  'Status',
  'Subtitles',
] as const;
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

export const EXPORT_FILENAME: Record<ExportFormat, string> = {
  csv: 'family-library.csv',
  xlsx: 'family-library.xlsx',
};

/** `GET /api/export` — the export described before it is written. */
export interface ExportSummary {
  movieCount: number;
}
```

### Backend — `server/src/import-export/writeSheet/` (new)

```ts
/**
 * The **Sheet writer**: the library's movies out as the bytes of one
 * spreadsheet, in the format asked for — the Sheet reader's mirror.
 */
export function writeSheet(
  movies: Movie[],
  format: ExportFormat
): Promise<Buffer>;
```

- Header row `EXPORT_COLUMNS`; one row per movie in the order given.
- Cells: Title; Year or `''`; Genres `names.join(', ')`; Director or `''`;
  Cast `join(', ')`; Rating the stored integer or `''`; Status `Watched` /
  `In progress` / `Unwatched`; Subtitles `languages.join(', ')` in track order.
- `csv`: `workbook.csv.writeBuffer({ formatterOptions: { writeBOM: true } })`.
  `xlsx`: `workbook.xlsx.writeBuffer()`, one worksheet, no styling.
- `readSheet` amendment: `status` joins `SYNONYMS.watched`; `'watched'` joins
  `WATCHED`.

### Routes — `server/src/routes/index.ts`

```
GET /api/export            → 200 ExportSummary { movieCount }
GET /api/export/:format    → 200 bytes
                             Content-Type: text/csv; charset=utf-8
                                         | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
                             Content-Disposition: attachment; filename="family-library.<format>"
                           → 400 { error } for a format that is not csv | xlsx
```

The file route is `storage.listMovies({ sort: 'a-z' })` → `writeSheet` →
`res.send(buffer)`. Nothing new is injected into `createApiRouter`.

### Frontend

```
src/primitives/Icon/DownloadIcon.tsx           ← the header tile's glyph (new)
src/components/Modal/                          ← gains `bare`: the card is the children, title → aria-label
src/features/import-export/
├── ExportModal/                               ← the organism: owns useExport, draws both faces on Modal
├── FormatCard/                                ← one selectable format: label, description, the radio dot
├── useExport/                                 ← open → reset + summary; chooseFormat; exportLibrary → save → done
├── saveToComputer/                            ← a Blob and a filename → an anchor download
└── api/                                       ← + fetchExportSummary, exportLibrary (one caller each)
src/features/settings/LibrarySection/          ← the third ActionRow; holds `exportOpen`; mounts ExportModal
```

```ts
// ExportModal
export interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// useExport
export interface ExportState {
  format: ExportFormat;
  movieCount: number | null; // null until the summary lands, or if it never does
  exporting: boolean;
  done: boolean;
  chooseFormat: (format: ExportFormat) => void;
  exportLibrary: () => Promise<void>;
}
export function useExport(open: boolean): ExportState;

// api
export function fetchExportSummary(): Promise<ExportSummary>;
export function exportLibrary(format: ExportFormat): Promise<Blob>;

// saveToComputer
export function saveToComputer(blob: Blob, filename: string): void;

// Modal — one new prop
bare?: boolean; // no header, no ✕, no body padding; `title` becomes aria-label
```

**Idle face** (`Modal` with `icon={<DownloadIcon size={22} />}`, title
_Export library_, subtitle _Save your whole collection as a spreadsheet._):
the body's `gap 20` column holds the **Format** label over the two
`FormatCard`s in a `gap 10` row; the filename row (`bg-2`, `border-soft`,
`radius-md`, `14px 16px`): `SheetIcon` 18px + mono 13.5px `EXPORT_FILENAME[format]`
left, accent 600 13px `{n} movie(s)` right; **Columns included** over the
eight `ColumnPill`s wrapping at `gap 7`; then `Button` `primary`
_Export as CSV_ / _Export as Excel_ (_Exporting…_ disabled while in flight) and
`Button` `secondary` _Cancel_ → `onClose`.

**Done face** (`Modal bare`, title _Export ready_): `44px 32px` centred; the
64px circle on `rgba(138, 154, 107, 0.16)` holding `CheckIcon` 32px in the
watched colour; serif 600 24px _Export ready_; 15px dim _Saved_ `<mono>`
`{filename}` `<br />` _with {n} movie(s) to your computer._; `Button`
`secondary` _Done_ → `onClose`.

**`LibrarySection`** gains
`<ActionRow glyph="⬇" label="Export to CSV" desc="Save your whole library out as a spreadsheet backup." onClick={() => setExportOpen(true)} />`
and mounts `<ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />`.

### Prototype amendments

None to the surface. One to the reader's contract (Q6): a `Status` column
round-trips, which the prototype never had to decide because its simulation
writes nothing.

## Implementation Plan

1. **The tracer bullet — a CSV lands.** `src/types/export.ts`; `writeSheet`
   for `csv` with the round-trip test through `readSheet` (the `readSheet`
   amendment with it); `GET /api/export` and `GET /api/export/csv`; `Modal`
   `bare`; `DownloadIcon`; `FormatCard`; `saveToComputer`; `useExport`; the
   idle and done faces of `ExportModal`; the third row in `LibrarySection`.
   Press the row, press _Export as CSV_, and `family-library.csv` is in the
   Downloads folder with every movie A–Z.
2. **Excel.** `writeSheet` for `xlsx`, the route's second format, the second
   `FormatCard` live, the label switching. Round trip through `readSheet` for
   both.
3. **The edges.** The refused request leaves the dialog as it was; the summary
   that never arrives leaves the label blank; zero movies; one movie; a title
   with a comma, a quote and a diacritic survives both formats; Escape and the
   scrim close the done face.
4. **Docs, glossary and the refactor filing** — the feature table ticks only
   after the refactor pass, which carries the `GET /api/movies` removal (Q16).

## Trade-offs

**Easier:** one writer beside one reader in one domain folder, with a
round-trip test that keeps them honest; one type file both targets read, so the
columns, the filename and the formats are spelled once; a dialog that owns its
hook on the Delete dialog's exact pattern, so its tests read the same way.

**Harder:** `Modal` now has two shapes, and `bare` is a boolean rather than a
composition (`ModalHeader` / `ModalBody`) — the composition is the better
long-term shape if a third dialog wants a third arrangement, and is the
refactor to file then, not now. The first cross-feature organism import is a
precedent that wants watching: a section composing a dialog is fine; a feature
importing another's hook or wire would not be.

**Ruled out:** a save-location dialog (the Electron shell's, when it ships);
a column picker (the pills are a list, not controls); Excel styling — a bold
header, column widths (the prototype says "a header row" and no more); a
snackbar on done (the done face is the confirmation); a Description column or
the stored paths; any change to the row's _Export to CSV_ label (Q15);
enrichment, TMDB and everything log 13 ruled out before.

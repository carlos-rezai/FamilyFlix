# Plan: Export — the library out as one spreadsheet, CSV or Excel

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/136

This is the second half of the folder that was named for both halves. Bulk
import turned the family's sheet and twelve hundred folders into **Movies**,
and from that moment every edit lives only in `familyflix.db`; README has
promised since the first commit that the library can be written back out, and
the prototype has drawn the dialog since the handoff. It is also the smallest
initiative since Delete: no run, no state, no cancel — a pure writer over a
list, two routes, one dialog with two faces, and one row.

The slicing follows the design log's own sketch: **the tracer bullet — a CSV
lands in Downloads** (Phase 1) → **Excel** (Phase 2) → **the edges**
(Phase 3). The refactor pass the PRD names — `GET /api/movies` removed once
export reads `listMovies` directly — is filed by `request-refactor-plan` after
Phase 3, as #135 was for bulk import, and the feature table ticks there and
not before.

Every phase is checked by looking: open Settings, press `⬇ Export to CSV`,
press the button, open what lands in Downloads. From Phase 1 that sentence is
true for CSV; Phase 2 makes it true for Excel; Phase 3 makes it true for a
library of none, a library of one, and a title with a comma in it.

## Three things settled in the tracer bullet rather than later

- **The refused request is the hook's shape from its first commit.** The
  log lists "the refused request leaves the dialog as it was" among the
  edges. Here it is Phase 1: a `useExport` written to do anything else on a
  rejected fetch — and rewritten in Phase 3 to clear `exporting` and change
  nothing — is a test suite written twice. The rule is the Delete dialog's,
  and the Delete plan's: a contract scheduled for demolition is not written.

- **Both format cards are drawn in Phase 1.** `FormatCard` and its
  `radiogroup` are built once, and the filename row and the button label
  switch with the choice from the start. Until Phase 2 the route answers
  `400` for `xlsx`, so _Export as Excel_ meets the refusal above and the
  dialog stays idle — an intermediate state of the Maintainer's surface,
  named rather than hidden, and honest by the rule already in place.

- **The reader amendment rides with the round trip.** A `Status` column
  reading `Watched` is what makes an export a backup rather than a listing,
  and the writer's round-trip test is the test that proves it. The three
  reader stories are one test file; they land together in Phase 1.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** Two, under the existing `/api` router, reading the `storage`
  it already holds — **nothing new is injected**. There is no run and no
  state, so no `createExporter` beside `createImporter`; a pure writer over a
  list is the whole domain:

  ```
  GET /api/export            -> 200 ExportSummary            { movieCount }
  GET /api/export/:format    -> 200 bytes
                                Content-Type: text/csv; charset=utf-8
                                          | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
                                Content-Disposition: attachment; filename="family-library.<format>"
                             -> 400 { error }                 any format but csv | xlsx
  ```

  The summary is `storage.countMovies()`. The file is
  `storage.listMovies({ sort: 'a-z' })` → `writeSheet` → send. Reading the
  count off the genres payload's `total` was rejected: right number, wrong
  name.

- **Schema.** No change. Every column the file carries is already on the
  row or derived from it.

- **Key models.** One new shared type module, `src/types/export.ts`,
  re-exported from the barrel on the precedent of `MOVIE_SORTS` — `as const`
  values both build targets import:
  `EXPORT_FORMATS = ['csv', 'xlsx']` and `ExportFormat`;
  `EXPORT_COLUMNS` — `Title, Year, Genres, Director, Cast, Rating, Status,
Subtitles`, in that order, spelled once for the header row and the
  pills — and `ExportColumn`;
  `EXPORT_FILENAME: Record<ExportFormat, string>` —
  `family-library.csv` / `family-library.xlsx` — read by the route's
  disposition, the filename row and the done copy;
  `ExportSummary { movieCount: number }`.

- **The domain — `server/src/import-export/writeSheet/`, one unit.**
  `writeSheet(movies, format) → Promise<Buffer>`, the **Sheet reader**'s
  mirror beside it, over the `exceljs` the reader already depends on. Pure
  over the list it is given: it does not read storage and does not sort —
  the caller decides the order. The eight cell rules live inside it and
  nowhere else: Title as stored; Year the number or empty; Genres
  `names.join(', ')`; Director or empty; Cast `join(', ')` in stored order;
  Rating the stored 0–10 integer or empty; Status `Watched` / `In progress` /
  `Unwatched` from the derived `status`; Subtitles the languages in track
  order `join(', ')`. No synopsis, no runtime, no stored path. `csv` writes
  with a UTF-8 BOM so Excel opens diacritics; `xlsx` writes one worksheet, a
  header row, no styling.

- **The reader amendment.** `status` joins the `watched` column's synonyms;
  `watched` joins the truthy values, case-folded, beside `yes / true / 1 /
✓`. `In progress` and `Unwatched` fall through to `false` — a reader with
  no resume position to give does the honest thing. The CSV parser strips
  the BOM on the way back in, so the round trip guards both directions.

- **The file is built on the server.** The client fetches bytes and saves
  them. Client-side generation was rejected: a megabyte of frontend for one
  dialog, and no round trip to test against.

- **`Modal` gains `bare`.** One optional boolean: the card is the children —
  no header, no ✕, no body padding — and `title` becomes the card's
  `aria-label` instead of the heading it labelled. Escape and the scrim
  still ask `onClose`; focus still moves in and back out. The done face is
  the app's one bare modal, swapped inside the same card so the pop-in runs
  once. The `ModalHeader` / `ModalBody` composition is the refactor to file
  if a third arrangement ever arrives.

- **Where things live.** `DownloadIcon` in the Icon primitives (the
  prototype's path, stroke 1.9, `currentColor`; `SheetIcon` and `CheckIcon`
  already match). Under `features/import-export/`: `FormatCard` on the
  `StatTile` pattern — a `role="radio"` button, the pair in a
  `role="radiogroup"` named _Format_; `saveToComputer` — an object URL on an
  anchor with `download`, clicked, revoked — a DOM side effect and so not
  `utils/`; `useExport(open)` → `{ format, movieCount, exporting, done,
chooseFormat, exportLibrary }`; `ExportModal { open, onClose }` owning the
  hook and drawing both faces; and the feature's own `api/` gaining
  `fetchExportSummary()` and `exportLibrary(format) → Promise<Blob>`, one
  caller each. `ColumnPill` is the dialog's own styled element in its styles
  file — no primitive draws a 12.5px pill, so the one-off rule is not
  broken. No new `test-support/` unit: `freshStorage`, `newMovie`,
  `makeMovie` and `fakeResponse` cover what is needed.

- **Who opens it.** `LibrarySection` holds `exportOpen`, gains the third
  `ActionRow` and mounts `<ExportModal open onClose />` beside its rows —
  the section owns where its rows lead, and this row leads to an overlay
  rather than a route, so closing it leaves the page where it was. This is
  the app's first import of one feature's organism by another, recorded as
  such: a section composing a dialog is fine; a feature importing another's
  hook or wire would not be.

- **The download.** `saveToComputer` hands the blob to the browser; under
  Electron the same download raises `will-download` and the shell's save
  dialog, with nothing extra built. Navigating the page to the route was
  rejected: a `500` would replace the app with a JSON body, and there would
  be no in-flight state to show.

- **Copy, fixed by the prototype.** The row `⬇ Export to CSV` / _Save your
  whole library out as a spreadsheet backup._ — the label kept as drawn
  though the dialog offers Excel, an accepted quirk. The header
  _Export library_ / _Save your whole collection as a spreadsheet._; the
  cards _CSV — Plain comma-separated. Opens anywhere._ and _Excel — .xlsx
  workbook with a header row._; the labels _Format_ and _Columns included_;
  the count `{n} movie` / `{n} movies`, or nothing while unknown; the
  buttons _Export as CSV_ / _Export as Excel_, _Exporting…_ in flight,
  _Cancel_, _Done_; the done face _Export ready_ / "Saved `{filename}` with
  {n} movies to your computer."

- **Not built, anywhere in these phases.** A save-location dialog; a column
  picker; Excel styling; a snackbar on done; an error face; cancelling an
  export in flight; re-importing an export as an update to existing rows;
  a Description, runtime or path column; any network; the rest of the
  Settings shell; the `ModalHeader` / `ModalBody` composition.

---

## Phase 1: The tracer bullet — a CSV lands in Downloads

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18,
19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31, 33, 34, 36, 37, 38, 39, 40,
41, 42, 43, 44, 45, 46, 50, 51, 53, 54, 55, 56, 57, 58, 59

### What to build

The thinnest complete path, for CSV. The Settings hub's **Library section**
gains its third row, `⬇ Export to CSV`, which opens the **Export dialog**
over the page rather than navigating anywhere; closing it by ✕, _Cancel_,
Escape or the scrim leaves the page where it was, scroll and all, with focus
back on the row.

**The idle face** is the prototype's: the download glyph in the accent tile,
_Export library_, _Save your whole collection as a spreadsheet._, the ✕;
_Format_ over the two **Format cards** as a radio group with CSV checked on
every open, the selected card on the accent-soft fill with its dot filled;
the filename row — the ruled-sheet glyph, `family-library.csv` in mono, and
the count in accent, which switch to `.xlsx` the moment Excel is chosen; the
eight **Column pills** as a list, not controls; and _Export as CSV_ /
_Export as Excel_ beside _Cancel_. The count is the server's own answer,
fetched on open — `null` until it lands, blank on screen while so, and
never blocking the export; `1 movie` singular.

**The export** fetches the CSV route, hands the blob to the browser as a
download named `family-library.csv`, and only then swaps the card's content
for **the done face**: no header, the 64px watched-tinted circle with the
tick, _Export ready_, "Saved `family-library.csv` with {n} movies to your
computer." with the count the idle face showed, and _Done_. The button reads
_Exporting…_ and is disabled for the life of the request; the cards and
_Cancel_ are left alone. A request the server refuses — including, in this
phase, a press on _Export as Excel_ — leaves the dialog exactly as it was:
idle, the format kept, the button back to its label. No error face.

**The wire** is both routes in their final shape: the summary answering the
count, the file route answering CSV bytes with the content type and the
attachment disposition, and `400 { error }` for any format that is not
`csv` or `xlsx` — `xlsx` itself is refused here only because no writer arm
exists yet, and the refusal for an unknown format is the contract that
stays.

**The Sheet writer** writes the header row in the eight names and order,
one row per movie in the order given — the route gives A–Z — under the
eight cell rules, with a UTF-8 BOM. **The Sheet reader** learns that
`Status` is its watched column and `Watched` is true, that `In progress`
and `Unwatched` are false, that `watched` and its old values still read,
and to strip a BOM. The round trip — write, then `readSheet` — yields one
**Sheet row** per movie with every field equal, so an untouched export
re-imported through Bulk import adds nothing.

### Acceptance criteria

- [ ] `src/types/export.ts` exports `EXPORT_FORMATS`, `EXPORT_COLUMNS`,
      `EXPORT_FILENAME` and `ExportSummary`, re-exported from the barrel and
      imported by both build targets
- [ ] `writeSheet(movies, 'csv')` writes the header row `Title, Year,
Genres, Director, Cast, Rating, Status, Subtitles`; an empty list
      writes a header-only sheet; one movie, one row; the order given is the
      order written
- [ ] Each cell rule holds: a null year, director and rating come out empty;
      genres, cast and subtitles join with `, `, subtitles in track order;
      status reads `Watched` / `In progress` / `Unwatched` from each derived
      state; rating is the stored integer; no synopsis, runtime or path
      appears
- [ ] The CSV begins with a UTF-8 BOM
- [ ] `readSheet` reads a `Status` header as the watched column, `Watched`
      as true, `In progress` and `Unwatched` as false; the `watched` header
      and `yes / true / 1 / ✓` still read; a BOM is stripped
- [ ] The round trip — `writeSheet` then `readSheet` — yields one row per
      movie with title, year, genres, director, cast, rating and watched
      state equal
- [ ] `GET /api/export` answers `200 { movieCount }`, `0` on an empty library
- [ ] `GET /api/export/csv` answers `200`, `text/csv; charset=utf-8`,
      `Content-Disposition: attachment; filename="family-library.csv"`, and a
      body the reader reads back as every movie A–Z by title
- [ ] `GET /api/export/pdf` — any format but the two — answers
      `400 { error }`; a failing file route answers a status, never a page
- [ ] `fetchExportSummary` resolves the count and rejects on a non-OK status;
      `exportLibrary('csv')` resolves a `Blob`, rejects on `500` and on a
      request that cannot be made
- [ ] `saveToComputer(blob, filename)` creates an object URL, clicks an
      anchor carrying `download` with the filename, and revokes the URL
- [ ] `useExport` opens on `csv`, idle, with `movieCount` `null` until the
      summary lands and `null` still if it fails; `chooseFormat` switches;
      `exportLibrary` sets `exporting`, hands the blob to save under the
      format's filename, then sets `done`; a rejected fetch clears
      `exporting` and leaves `done` false and the format kept; reopening
      resets to `csv` and idle with a fresh summary
- [ ] `DownloadIcon` renders its path at the size given
- [ ] `FormatCard` renders label and description as a `radio`, checked when
      selected, calls `onSelect` on press; the pair sit in a `radiogroup`
      named _Format_
- [ ] `Modal bare` draws no heading and no ✕, carries `title` as the card's
      accessible name, closes on Escape and the scrim, moves focus in and
      back out; a caller that does not ask for it is unchanged
- [ ] `ExportModal` closed renders nothing; open shows the heading, both
      cards with CSV checked, `family-library.csv`, the count once it lands
      (`1 movie` singular, nothing while `null`), the eight pills as a list,
      _Export as CSV_ and _Cancel_; choosing Excel switches the filename and
      the label; export reads _Exporting…_ disabled, then the done face
      with the tick, _Export ready_ and the filename and count in the copy;
      _Done_ closes; a refused export leaves the idle face and the format;
      Cancel and ✕ close
- [ ] `LibrarySection` shows three rows; the third opens the dialog; closing
      it returns focus to the row; nothing navigates
- [ ] No export control on the browse home, a card, the detail page or the
      player
- [ ] Against a library of the importer's fixture: pressing the row, then
      _Export as CSV_, lands `family-library.csv` in Downloads with every
      movie A–Z; re-importing it through Bulk import adds nothing

---

## Phase 2: Excel

**User stories**: 11, 28, 30, 36, 47, 49, 50, 51, 52, 57

### What to build

The second format, live end to end. `writeSheet(movies, 'xlsx')` writes one
worksheet with the same header row and the same eight cell rules, and no
styling — a bold header, column widths and frozen panes are all things the
prototype does not promise. The file route answers it under the OpenXML
spreadsheet content type and `family-library.xlsx`, and the Excel card's
export lands that file in Downloads, the done face naming it. The round trip
now holds in both formats: an untouched `.xlsx` re-imported adds nothing,
and an export with a row edited — a genre added, a year corrected — carries
that row's changes onto a fresh library, in either format, so that
bulk-editing externally is real.

### Acceptance criteria

- [ ] `writeSheet(movies, 'xlsx')` writes one worksheet, the header row in
      the eight names, one row per movie in the order given, under the same
      cell rules as CSV, with no styling
- [ ] `GET /api/export/xlsx` answers `200`, the OpenXML spreadsheet content
      type, `Content-Disposition: attachment; filename="family-library.xlsx"`,
      and a body the reader reads back as every movie A–Z
- [ ] The round trip yields one row per movie with every field equal in both
      formats
- [ ] `exportLibrary('xlsx')` reads its route and resolves a `Blob`
- [ ] Choosing Excel and pressing _Export as Excel_ hands the browser
      `family-library.xlsx`; the done copy reads "Saved `family-library.xlsx`
      with {n} movies to your computer."
- [ ] An export with one row's genre and year edited, imported through Bulk
      import onto a fresh library, yields a movie carrying the edited values
      — in both formats
- [ ] The Excel card's intermediate refusal from Phase 1 is gone: no `400`
      for `xlsx`

---

## Phase 3: The edges

**User stories**: 14, 15, 32, 35, 47, 48, 52, 54

### What to build

What a real library meets that the fixture does not. A library of zero
movies reads _0 movies_ and still exports a header-only sheet — an honest
backup of an empty library, not an error. A summary that never arrives
leaves the count blank and the button live. _Amélie_ and _"Whatever," she
said_ — a diacritic, a comma, a quote — survive both formats and read back
exactly, and the CSV opens in Excel on the family's machine with the
diacritics intact. The done face, which has no ✕, still closes on Escape and
the scrim; reopening after _Done_ shows the idle face with CSV checked and a
fresh count, so every open is a new export.

### Acceptance criteria

- [ ] An empty library shows _0 movies_, exports, and the file is the header
      row alone in both formats
- [ ] A summary that rejects leaves the count label blank and _Export as
      CSV_ enabled; the export still lands
- [ ] A title holding a comma, a double quote and a diacritic writes and
      reads back identically in both formats; the CSV's BOM survives the
      route and the reader
- [ ] The done face closes on Escape and on the scrim
- [ ] Reopening the dialog after _Done_ shows the idle face, CSV checked, and
      a count fetched afresh
- [ ] The feature ticks 🔜 → ✅ in README and CLAUDE.md only after the refactor
      pass — the `GET /api/movies` and `parseLimit` removal with its sort
      coverage moved first — filed by `request-refactor-plan` after this
      phase, per the project rule; umbrella #123 closes alongside

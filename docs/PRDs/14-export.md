## Problem Statement

I am the maintainer of this library, and there is no way to get it back out.

Bulk import is done: the family's Excel sheet and its twelve hundred folders
became **Movies** in one run, and from that moment the app owns the truth —
the sheet on disk is a snapshot of the day the import ran. Every edit since
(a rating on the detail page, a genre added in the form, a film marked
watched by the player) lives only in `familyflix.db`. README has promised
from the first commit that the library can be written "back out to CSV for
backup or for bulk-editing externally and re-importing", and the
`import-export/` folder was named for both halves. Only the first half
exists.

The prototype has drawn the second half since the handoff —
`feat.ExportModal` with its idle face and its _Export ready_ face, and the
`⬇ Export to CSV` row on the Settings page — and it is the last 🔜 row under
_Maintainer tools_. Log 13 left the row out of the **Library section** on
purpose: "a row whose destination does not exist is not drawn." The Settings
hub has two rows where the prototype has three.

There is one more reason it matters: the **Sheet reader** reads a `watched`
column and nothing else about watch state, so even a hand-written sheet
cannot carry the library's _Watched_ / _In progress_ / _Unwatched_ back in.
An export that the importer cannot read is a backup that cannot restore.

## Solution

One dialog, opened from the third row of the **Library section**, that
writes every **Movie** in the library out as one spreadsheet — CSV or Excel —
and hands it to the browser as a download. The prototype's two faces,
translated 1:1.

**Idle.** A download glyph in the accent tile, _Export library_, _Save your
whole collection as a spreadsheet._, and the ✕. Below: **Format**, two
selectable **Format cards** — _CSV — Plain comma-separated. Opens anywhere._
and _Excel — .xlsx workbook with a header row._ — each with a radio dot; the
filename row showing `family-library.csv` (or `.xlsx`) in mono beside the
count, _12 movies_, in accent; **Columns included**, eight pills — Title,
Year, Genres, Director, Cast, Rating, Status, Subtitles; and _Export as CSV_
/ _Export as Excel_ beside _Cancel_.

**Export ready.** No header — a tick in a circle tinted the watched colour,
_Export ready_, "Saved `family-library.csv` with 12 movies to your
computer.", and _Done_.

The file is built on the server by a **Sheet writer** that is the **Sheet
reader**'s mirror, so an **Export file** read back by Bulk import yields one
**Sheet row** per **Movie** — and every one of them is already in the
library, so re-importing an untouched export adds nothing. The one gap that
made this untrue is closed: the reader learns that a `Status` column is its
watched column and that `Watched` is a truthy value.

## User Stories

### The row and the door

1. As the maintainer, I want an `⬇ Export to CSV` row under _Library_ on the
   Settings page, so that the hub has the third door the prototype draws.
2. As the maintainer, I want the row's description to read _Save your whole
   library out as a spreadsheet backup._, so that its copy is the prototype's.
3. As the maintainer, I want pressing the row to open the **Export dialog**
   over the Settings page rather than navigating to a route, so that closing
   it leaves me where I was, scroll and all.
4. As the maintainer, I want the row to keep its _Export to CSV_ label even
   though the dialog offers Excel too, so that the label is the prototype's
   and not an improvement I did not ask for.
5. As a family member, I want the row nowhere but Settings, so that the browse
   surface stays free of maintainer tools.

### The idle face

6. As the maintainer, I want the dialog to open with a download glyph in the
   accent tile, the heading _Export library_ and the line _Save your whole
   collection as a spreadsheet._, so that it reads as the prototype does.
7. As the maintainer, I want a **Format** label over two selectable cards,
   _CSV_ and _Excel_, each with a one-line description under it and a radio
   dot, so that the format is a visible choice and not a hidden default.
8. As the maintainer, I want CSV selected every time the dialog opens, so that
   the common case is one press away and a previous session's choice never
   surprises me.
9. As the maintainer, I want the selected card on the accent-soft fill with
   the accent border and its dot filled, and the other card plain, so that I
   can see which I chose without reading.
10. As the maintainer, I want the two cards to behave as a radio group named
    _Format_ — one selected, radio semantics for a screen reader — so that a
    keyboard reaches them the way a form control is reached.
11. As the maintainer, I want the filename row to show `family-library.csv`
    in mono beside the ruled-sheet glyph, and to switch to
    `family-library.xlsx` the moment I choose Excel, so that I know exactly
    what will land in my Downloads folder before I press the button.
12. As the maintainer, I want the count on the filename row — _12 movies_ —
    to be the number the server would write right now, so that the row
    describes the export rather than guessing at it.
13. As the maintainer, I want the count to singularise — _1 movie_ — so that
    a library of one does not read as a typo.
14. As the maintainer, I want a library of zero movies to read _0 movies_ and
    still be exportable, so that a header-only sheet is an honest backup of an
    empty library and not an error.
15. As the maintainer, I want the count to be blank rather than wrong if the
    summary never arrives, and the export still allowed, so that a slow or
    failed count never blocks the thing I came for.
16. As the maintainer, I want a **Columns included** label over eight small
    pills — Title, Year, Genres, Director, Cast, Rating, Status, Subtitles —
    so that I can see what the file will hold before it is written.
17. As the maintainer, I want the pills to be a list and not controls, so that
    the dialog does not offer a column picker the prototype does not draw.
18. As the maintainer, I want the primary button to read _Export as CSV_ or
    _Export as Excel_ to match the card I chose, so that the button names what
    it does.
19. As the maintainer, I want _Cancel_ beside it, and the ✕ in the header, so
    that I have the prototype's two ways to change my mind by pointer.
20. As the maintainer, I want Escape and a press on the scrim to close the
    dialog too, so that it dismisses like every other dialog in the app.
21. As the maintainer, I want focus to land on the card when the dialog opens
    and to return to the row when it closes, with Tab held inside, so that a
    keyboard never falls through to the scrimmed page.

### The export itself

22. As the maintainer, I want pressing _Export as CSV_ to fetch the file from
    the server and hand it to the browser as a download named
    `family-library.csv`, so that it lands in my Downloads folder without a
    further prompt.
23. As the maintainer, I want the button to read _Exporting…_ and be disabled
    for the life of the request, so that a second press cannot start a second
    download and I can see something is happening.
24. As the maintainer, I want the format cards and _Cancel_ left alone while
    exporting rather than disabled, the way the prototype leaves them, so
    that the in-flight state changes one thing and not the whole card.
25. As the maintainer, I want the dialog to flip to _Export ready_ only after
    the bytes have been handed to the browser, so that the tick never appears
    before the file exists.
26. As the maintainer, I want a request the server refuses to leave the dialog
    exactly as it was — idle, my format kept, the button back to its label —
    so that I can try again or cancel, and nothing pretends to have worked.
27. As the maintainer, I want no error face invented for that case, so that
    the surface stays the prototype's.
28. As the maintainer running FamilyFlix in Electron, I want the same download
    to raise the shell's save dialog, so that "to your computer" means what it
    says on the desktop too, with nothing extra built.

### The Export ready face

29. As the maintainer, I want the done face to have no header — no tile, no
    heading row, no ✕ — but a 64px circle tinted the watched colour holding
    a tick, the serif heading _Export ready_, and the line "Saved
    `family-library.csv` with 12 movies to your computer.", so that it is the
    prototype's done face pixel for pixel.
30. As the maintainer, I want the filename in that line in mono and the count
    the same number the idle face showed, so that the two faces agree.
31. As the maintainer, I want _Done_ to close the dialog, so that the
    confirmation has one exit by pointer.
32. As the maintainer, I want Escape and the scrim to close the done face as
    well, so that a dialog with no ✕ is still a dialog I can dismiss.
33. As the maintainer, I want the done face to swap content inside the same
    card rather than open a second dialog, so that the card does not pop in
    twice.
34. As the maintainer, I want the done face to carry _Export ready_ as its
    accessible name even with no header, so that a screen reader knows which
    dialog it is in.
35. As the maintainer, I want reopening the dialog after _Done_ to show the
    idle face again with CSV selected and a fresh count, so that every open is
    a new export.

### The file

36. As the maintainer, I want the file to have exactly eight columns in the
    order Title, Year, Genres, Director, Cast, Rating, Status, Subtitles, with
    a header row spelling them so, so that the pills and the file agree.
37. As the maintainer, I want every movie in the library in the file, A–Z by
    title, so that the sheet reads the way I would read it.
38. As the maintainer, I want the title cell to hold the title as stored, so
    that nothing is "cleaned up" on the way out.
39. As the maintainer, I want a movie with no year to have a blank year cell,
    not `0` or `null`, so that the sheet reads as a sheet.
40. As the maintainer, I want genres joined with `, ` in one cell, so that the
    importer can split them again.
41. As the maintainer, I want a movie with no director to have a blank cell,
    so that absence reads as absence.
42. As the maintainer, I want the cast joined with `, ` in one cell, in stored
    order, and blank when there is none, so that the importer reads it back
    as the same list.
43. As the maintainer, I want the rating written as the stored 0–10 integer,
    or blank when unrated, so that it re-imports on the scale the reader
    reads — and not as a star string.
44. As the maintainer, I want the status cell to read `Watched`, `In progress`
    or `Unwatched` off the movie's derived status, so that the sheet says what
    the poster badge says.
45. As the maintainer, I want the subtitles cell to hold the languages in
    track order joined with `, `, and blank when there are none, so that I can
    see at a glance which films have which.
46. As the maintainer, I want no synopsis, no runtime and no stored paths in
    the file, so that it is a listing of the collection and not a manifest of
    the media directory.
47. As the maintainer, I want a title containing a comma, a quote or a
    diacritic to survive both formats and read back exactly, so that _Amélie_
    and _"Whatever," she said_ are not mangled.
48. As the maintainer, I want the CSV to open in Excel with diacritics intact,
    so that the file is usable on the family's machine without a wizard.
49. As the maintainer, I want the Excel file to be one worksheet with a header
    row and no styling, so that it is "an .xlsx workbook with a header row"
    and nothing the prototype does not promise.
50. As the maintainer, I want the CSV served as `text/csv` and the workbook as
    its own spreadsheet content type, each with an attachment disposition
    carrying the right filename, so that any client — a browser, curl, the
    Electron shell — treats it as a file and names it correctly.

### The round trip

51. As the maintainer, I want an untouched export re-imported through Bulk
    import to add nothing, so that the backup is safe to point the importer at.
52. As the maintainer, I want an export with a row edited — a genre added, a
    year corrected — to carry that row's changes back in on a fresh library,
    so that bulk-editing externally is real and not a README aspiration.
53. As the maintainer, I want the reader to recognise a `Status` column as its
    watched column, and `Watched` as true, so that watch state survives the
    round trip.
54. As the maintainer, I want `In progress` and `Unwatched` to read as not
    watched, so that a reader with no resume position to give does the honest
    thing.
55. As the maintainer, I want the reader to keep reading `watched` under the
    values it already knew, so that the family's hand-written sheet still
    imports.

### The wire

56. As the client, I want one summary read that answers how many movies an
    export would write, so that the count on the row is a fact and not a
    payload nine-tenths discarded.
57. As the client, I want one file read per format that answers the bytes, so
    that the dialog fetches exactly what it will save.
58. As the client, I want a format that is neither `csv` nor `xlsx` answered
    with `400` and a reason, so that a typo in a URL is a refusal and not a
    crash.
59. As the client, I want a failed file route answered as a status the dialog
    can swallow rather than a page the browser navigates to, so that a failed
    export never takes the app away.

### Housekeeping

60. As the maintainer, I want the `GET /api/movies` endpoint that has waited
    for "the exporter" removed once it is confirmed unclaimed, so that the API
    has no route with no caller — and its sort coverage moved first.
61. As the maintainer, I want the feature table's Export row ticked only after
    that refactor pass, so that ✅ means what it says.

## Implementation Decisions

### Where the file is built

- **The server.** `exceljs` is already a backend dependency for the Sheet
  reader; a writer beside it is its mirror, and the round-trip test (write →
  read) can only live on the side that has the reader. The client fetches
  bytes and saves them. Client-side generation was rejected: a megabyte of
  frontend for one dialog, and no round trip to test against.

### The types

- A new shared type module, `export`, re-exported from the types barrel on the
  precedent of the import types and of `MOVIE_SORTS` — `as const` values both
  build targets import:
  - `EXPORT_FORMATS = ['csv', 'xlsx']` and `ExportFormat` derived from it.
  - `EXPORT_COLUMNS` — the eight names in prototype order — and
    `ExportColumn` derived from it. Read by the writer's header row and by
    the dialog's pills, spelled once.
  - `EXPORT_FILENAME: Record<ExportFormat, string>` —
    `family-library.csv` / `family-library.xlsx` — read by the route's
    `Content-Disposition`, the dialog's filename row and the done copy.
  - `ExportSummary { movieCount: number }` — what the summary route answers.

### The Sheet writer

- One unit, `writeSheet(movies, format) → Promise<Buffer>`, in the
  `import-export` domain beside `readSheet`. Pure over the list it is given;
  it does not read storage and does not sort — the caller decides the order.
- Header row `EXPORT_COLUMNS`; one row per movie in the order given.
- The eight cell rules live inside it and nowhere else: Title as stored;
  Year the number or empty; Genres `names.join(', ')`; Director or empty;
  Cast `join(', ')`; Rating the stored integer or empty; Status `Watched` /
  `In progress` / `Unwatched` from the derived `status`; Subtitles the
  languages in track order `join(', ')`. A separate row-mapping unit was
  rejected — the rules are the writer's own.
- `csv` writes through exceljs's CSV writer with a UTF-8 BOM so Excel opens
  diacritics correctly; `xlsx` writes one worksheet, no styling.

### The Sheet reader amendment

- `status` joins the synonyms for the `watched` column; `watched` joins the
  truthy values (case-folded, alongside `yes / true / 1 / ✓`). `In progress`
  and `Unwatched` fall through to `false`. The CSV parser strips the BOM on
  the way back in; the round-trip test guards both directions.

### The wire

- `GET /api/export` → `200 ExportSummary` off `storage.countMovies()`.
- `GET /api/export/:format` → `200` bytes, `Content-Type: text/csv;
charset=utf-8` or the OpenXML spreadsheet type,
  `Content-Disposition: attachment; filename="family-library.<format>"`;
  `400 { error }` for any other format.
- The file route is `storage.listMovies({ sort: 'a-z' })` → `writeSheet` →
  send. **Nothing new is injected into the router**: there is no run, no
  state and no cancel, so no `createExporter` domain object — a pure writer
  over a list is the whole domain. Reading the count off the genres payload's
  `total` was rejected: right number, wrong name.

### The Modal

- `Modal` gains one optional prop, `bare`: the card is the children — no
  header, no ✕, no body padding — and `title` becomes the card's
  `aria-label` instead of the heading it labelled. Escape and the scrim still
  ask `onClose`. The done face is the app's one bare modal. A second `Modal`
  for the done face was rejected (it would re-run the pop-in); keeping the
  header on it was rejected (not the prototype). A `ModalHeader` /
  `ModalBody` composition is the better shape if a third arrangement ever
  arrives, and is the refactor to file then.

### The frontend units

- **`DownloadIcon`** in the Icon primitives — the prototype's path at stroke
  1.9, `currentColor` — for the header tile at 22px. `SheetIcon` (filename
  row, 18px) and `CheckIcon` (done tick, 32px in the watched colour) already
  exist and match the prototype's paths.
- **`FormatCard`** — a feature molecule in `import-export`, on the `StatTile`
  pattern: `{ label, description, selected, onSelect }`, a `role="radio"`
  button; the two sit in a `role="radiogroup"` labelled _Format_. Selected:
  accent-soft fill, accent-line border, 18px dot filled accent inside a 3px
  surface-2 ring. Not `Chip`, and not a segmented control: the prototype
  draws it inline, and so does the code.
- **`ColumnPill`** — the dialog's own styled element in its styles file:
  12.5px on `5px 11px`, dim text on the surface with the border. `Chip` `sm`
  is a genre tag at a different size; no primitive draws this pill, so the
  one-off rule is not broken.
- **`saveToComputer(blob, filename)`** — an object URL on an anchor with
  `download`, clicked, revoked. Its own unit under `import-export`, not
  `utils/`: it is a DOM side effect, and `utils/` has one rule. Navigating
  the page to the URL was rejected: a `500` would replace the app with a JSON
  body, and there would be no in-flight state to show. Under Electron the
  same blob download raises `will-download` and the shell's save dialog.
- **`useExport(open)`** → `{ format, movieCount, exporting, done,
chooseFormat, exportLibrary }`. On open: reset to `csv` and idle, fetch
  the summary. `movieCount` is `null` until it lands and stays `null` if it
  never does. `exportLibrary`: set exporting → fetch the blob →
  `saveToComputer` → done. A rejected fetch clears `exporting` and changes
  nothing else — the Delete dialog's rule.
- **`ExportModal`** — `{ open, onClose }`. Owns `useExport`; draws the idle
  face on `Modal` with the icon, title and subtitle, and the done face on
  `Modal bare`. The button label reads _Export as CSV_ / _Export as Excel_,
  and _Exporting…_ disabled in flight. The count label reads `{n} movie` /
  `{n} movies`, or nothing while `null`.
- **The api module** of `import-export` gains `fetchExportSummary()` and
  `exportLibrary(format) → Promise<Blob>` — one caller each, so they stay in
  the feature rather than the shared `api/`.

### Who opens it

- **`LibrarySection`** holds `exportOpen`, gains the third `ActionRow`
  (`⬇`, _Export to CSV_, _Save your whole library out as a spreadsheet
  backup._) and mounts `<ExportModal open onClose />` beside its rows — the
  section owns where its rows lead, and this row leads to an overlay. This
  is the app's first import of one feature's organism by another, and is
  recorded as such: a section composing a dialog is fine; a feature
  importing another's hook or wire would not be. The page holding the state
  was rejected (composition only); the dialog living under `settings` was
  rejected (it is the writer's own screen and the spec places it).

### The refactor pass

- `GET /api/movies` and its `parseLimit` helper are removed once export ships
  reading `storage.listMovies` directly, as the glossary said they would be
  if unclaimed. Its route tests carry the sort coverage, which lands on the
  repository test or on the home route's first. The feature table ticks after
  this pass.

## Testing Decisions

A good test asserts **external behaviour** — what a route answers, what bytes
come out, what the reader reads back, what the screen shows and what the
browser was handed — never how it was reached. The precedents are
`routes.test.ts` (a real listener over a real migrated in-memory database),
the `readSheet` tests (fixture buffers in and rows out), the Delete dialog's
tests (a dialog that owns its hook, read through its button label) and the
`saveRating`-style client tests against `fakeResponse`. **Every unit gets its
co-located test**, as the maintainer confirmed for this project.

**The writer** carries the most weight, in the style of the reader's tests:

- Both formats write the header row in the prototype's eight names and
  order; an empty list writes a header-only sheet; one movie, one row.
- Each cell rule: a null year, director and rating come out empty; genres,
  cast and subtitles join with `, `; subtitles in track order; status from
  each of the three derived states; rating as the stored integer.
- The order given is the order written.
- **The round trip**: write → `readSheet` yields one `SheetRow` per movie with
  the title, year, genres, director, cast, rating and watched state equal,
  in both formats; the CSV begins with a BOM and reads back clean; a title
  with a comma, a quote and a diacritic survives both formats.

**The reader amendment**: a `Status` header is read as the watched column;
`Watched` reads true; `In progress` and `Unwatched` read false; the existing
`watched` header and truthy values still work.

**The routes**, through `createApiRouter` over `freshStorage`: the summary
answers the count, `0` on an empty library; the CSV route answers `200`, the
CSV content type, the attachment disposition with the CSV filename, and a
body the reader reads back as the movies A–Z; the xlsx route the same for its
type and filename; an unknown format answers `400` with an error. The sort
coverage from the `/movies` route tests moves before that route goes.

**The client calls**: `fetchExportSummary` reads its route and resolves the
count, rejects on a non-OK status; `exportLibrary` reads the format's route
and resolves a Blob, rejects on `500` and on a request that cannot be made.

**`saveToComputer`**: creates an object URL from the blob, clicks an anchor
carrying `download` with the filename, and revokes the URL — asserted through
stubs on the URL API and the anchor click, since jsdom implements neither.

**`useExport`**: opens on `csv` and idle and fetches the summary; the count is
`null` until it lands and stays `null` on a failed summary; `chooseFormat`
switches; `exportLibrary` sets `exporting`, hands the blob to save under the
format's filename, and sets `done`; a rejected fetch clears `exporting` and
leaves `done` false and the format kept; reopening resets.

**`FormatCard`**: renders the label and description as a `radio`, checked
when selected, calls `onSelect` on press.

**`DownloadIcon`**: renders its path at the size given, like the other icons.

**`Modal bare`**: draws no heading and no ✕; the card carries the title as
its accessible name; Escape and the scrim still close it; focus still moves
in and back out.

**`ExportModal`**: closed renders nothing; open shows the heading, both cards
with CSV checked, the CSV filename and the count once it lands, the eight
pills, _Export as CSV_ and _Cancel_; choosing Excel switches the filename and
the button label; _1 movie_ singular; a `null` count leaves the label blank;
pressing export reads _Exporting…_ disabled, then the done face with the tick,
_Export ready_ and the filename and count in the copy; _Done_, Escape and the
scrim close; a refused export leaves the idle face and the format; Cancel and
✕ close.

**`LibrarySection`**: three rows; the third opens the dialog; closing it
returns focus to the row.

No new frontend `test-support/` unit is anticipated; `freshStorage`,
`newMovie`, `makeMovie` and `fakeResponse` cover what is needed.

## Out of Scope

- **A save-location dialog** — the browser's Downloads folder now, the
  Electron shell's save dialog when the shell ships, nothing to build here.
- **A column picker** — the pills are a list.
- **Excel styling** — a bold header, column widths, frozen panes: "a header
  row" and no more.
- **A snackbar on done** — the done face is the confirmation; the snackbar
  system is its own 🔜.
- **A Description / synopsis column, runtime, or the stored paths.**
- **Any change to the row's _Export to CSV_ label** — an accepted quirk, not
  an amendment.
- **An error face** — a refused request leaves the idle face as it was.
- **Cancelling an export in flight** — one request, no run.
- **Re-importing an export as an update** — Bulk import skips rows already in
  the library; a bulk-edited export rebuilds an empty library or adds new
  rows, it does not amend existing ones. Edit exists for that.
- **The `ModalHeader` / `ModalBody` composition** — filed if a third dialog
  arrangement ever arrives.
- **Enrichment, TMDB, any network** — as log 13 ruled out.
- **The rest of the Settings shell** — Playback, Storage, About.

## Further Notes

**Trade-offs accepted.** `Modal` now has two shapes behind a boolean rather
than a composition; the composition is the right long-term shape and the
refactor to file when a third dialog wants a third arrangement. The count on
the filename row and the file are two reads of one library at two moments —
the count is not a promise, and the done copy repeats it rather than counting
the file. The first cross-feature organism import is a precedent that wants
watching.

**Implementation order**, from the log: the tracer bullet first — types,
`writeSheet` for CSV with the round trip and the reader amendment, both
routes, `Modal bare`, `DownloadIcon`, `FormatCard`, `saveToComputer`,
`useExport`, both faces of `ExportModal`, the third row — so that a press on
the row lands `family-library.csv` in Downloads with every movie A–Z. Then
Excel. Then the edges: the refused request, the summary that never arrives,
zero and one movie, the comma-quote-diacritic title, Escape and the scrim on
the done face. Then docs, glossary and the refactor filing, with the feature
table ticking only after the refactor pass.

**Housekeeping alongside**: the Bulk import umbrella `#123` has nothing open
under it and should simply be closed.

Design log: `docs/design-logs/14-export.md`.

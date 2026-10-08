# Plan: Export options — a dated folder, every title and field, written where you choose

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/275

Today an export is one file, `family-library.csv`, downloaded by the browser
into Downloads, holding films alone under eight columns. Log 31 moves the
write to the server: every export becomes a new dated **Export folder** inside
an **Export destination** the maintainer chooses. It holds a **Titles sheet**
of films and series under sixteen columns, an **Episodes sheet**, and
optionally each title's art and subtitles beside it.

The slicing goes from the folder outwards:

**a dated folder of films** (Phase 1) → **series and episodes** (Phase 2) →
**images** (Phase 3) → **subtitles** (Phase 4) → **_Browse…_** (Phase 5) →
**the edges** (Phase 6) → **the close** (Phase 7).

The log's plan had eight steps. Two changes were made here:

- **No prototype-only slice.** Step 0, the prototype revision, goes into
  Phase 1's build step. This follows the Library folders plan.
- **The Metadata sheet moves into Phase 1.** The log placed it with the
  edges. But Phase 1 changes `EXPORT_COLUMNS` and the Sheet writer's
  signature, and `writeBack` calls both. The Metadata sheet therefore moves
  onto the new header in the same slice that changes it.

## Running the phases

Phases 1–6 run AFK under `issue-loop`.

- **The prototype amendment lands in Phase 1's build step.** The GREEN
  subagent revises `docs/handoff/` first, then builds to the revised files.
  Both land in the slice's `feat:` commit, so every later phase builds against
  a prototype that is already revised. The amendment covers the whole
  initiative:
  - `feat.ExportModal.dc.html` gets the new idle face: the lede, _Save to_
    with and without _Browse…_ and with a refusal line, the name row, the
    _Include_ group's two toggles, and the sixteen pills. It also gets the new
    _Export ready_ copy, with and without the count clause.
  - `COMPONENT-SPEC.md` gives ExportModal its new props, and gives the folder
    bridge its second member, `pickOne`.
- **No HITL marks in Phases 1–6.** Every acceptance criterion is a Vitest
  assertion, a typecheck or a file diff. Two checks are the maintainer's own:
  an Excel export opened with a hyperlink clicked, and a folder picked with
  _Browse…_ in an Unpackaged run. Nothing waits on either.

Phase 7 is docs-only, so the loop stops there by design. Per the standing
rule, a feature is Done only after its refactor. The close is therefore the
refactor's last commit, made after `request-refactor-plan` and `refactor`.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **The server writes the export.** It writes straight into the destination
  folder, and the browser saves nothing. The download path stays live until
  the refactor and is unused from Phase 1 on. That path is
  `GET /api/export/:format`, the client's file fetch, **Save to computer**
  and `EXPORT_FILENAME`.
- **One request, not a run.** There is no Current run, no polling and no
  cancel. The disabled _Exporting…_ button is the progress indicator.
- **Client route.** None new. The Export dialog is still opened from the
  Settings hub's Library group. The row keeps _Export to CSV_ and its line.
- **HTTP routes.**

  | Route                                                         | Answer                                                                                                                                                      |
  | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `GET /api/export` (changed)                                   | `200 ExportSummary { movieCount, seriesCount, episodeCount, defaultDestination, folderName }`                                                               |
  | `POST /api/export { format, destination, images, subtitles }` | `201 ExportResult { folder, movieCount, seriesCount }` · `400 { error }` for a malformed body or a refused destination · `500 { error }` after the rollback |
  - `defaultDestination` is the first Library folder, in the order added,
    that `readableFolder` calls readable. With none, it is
    `<home>\Downloads`.
  - `folderName` is today's **Export name** before any numbering.
  - `folder` is the absolute path actually written, numbered if it was.
  - Every refusal is one sentence:
    - _Type the full path, starting with a drive letter._
    - _No folder at that path._
    - _FamilyFlix can't write to that folder._
    - On failure: _The export stopped partway: `<reason>`. Nothing was left
      behind._
  - The body is read by a route-layer unit, `exportBody`, on
    `enrichmentBody`'s precedent: a typed `StartExport`, or a `400`
    sentence.

- **The shape on disk.**

  ```
  <destination>\familyflix-collection_DD-MM-YYYY[ (n)]\
  ├── familyflix-collection_DD-MM-YYYY.xlsx         ← Titles, then Episodes
  │   or .csv + -episodes.csv                       ← each behind a BOM
  └── Heat (1995)\                                  ← only with Images or Subtitles on
      ├── poster<ext>  backdrop<ext>                ← the stored file's own extension
      ├── English.srt                               ← a film's subtitles, by language
      ├── stills\S01E03<ext>                        ← a series' episode stills
      └── subtitles\S01E03 English.srt              ← a series' episode subtitles
  ```

  - The Export folder is created **exclusively**. A taken name is numbered
    the way Chromium numbers a download: `name (1)`, `name (2)`, and so on.
  - A title folder is named as a Movie folder is (`movieFolder(title, year)`)
    and numbered on a clash.
  - Path cells are relative to the Export folder and use forward slashes.
  - Video files never travel.

- **Key models** (`src/types/export.ts`, both build targets):
  - `EXPORT_COLUMNS` holds the sixteen columns, in this order: Type, Title,
    Year, Runtime, Genres, Director, Cast, Synopsis, Rating, Status, Favorite,
    Seasons, Episodes, Subtitles, Poster, Backdrop.
  - `EXPORT_EPISODE_COLUMNS` holds: Series, Season, Episode, Title, Air date,
    Runtime, Status, Subtitles, Still.
  - `EXPORT_NAME_PREFIX` is `'familyflix-collection'`.
  - `StartExport { format; destination; images; subtitles }`.
  - `ExportResult { folder; movieCount; seriesCount }`.
  - `ExportSummary` grows as in the route table.
- **The server units** (`import-export/`, each in its folder with its suite):
  - **`exportName(now)`** is pure, with the clock injected.
  - **`exportRows(movies, series, include)`** is pure, and the deep module of
    the initiative. It owns every cell rule, the A–Z merge, the episode
    ordering, the title folder names and the file plan.
  - **`writeSheet(tables, format, name)`** stays pure and stays the Sheet
    reader's mirror. It answers named files.
  - **`writeExport`** is the injected writer and never throws. It answers
    `written`, `refused` or `failed`. It reads stored files only through
    `Media.readStored`, so `media/` stays the only reader of managed storage.
  - The route composes it over the existing A–Z movie read and the series
    reader's per-id detail read. It adds no new router parameter.
- **The shell seam.** There is one new IPC channel,
  `FOLDER_CHANNELS.pickOne` = `'familyflix:folders:pick-one'`, with
  `FolderBridge.pickOne(): Promise<string | null>`. `pick()` is unchanged.
- **Rules amended.**
  - _Only the Write targets write into a Library folder_ becomes _the Write
    targets and an Export, each only ever adding what is not there_.
  - A Folder scan passes over an Export folder, because it holds no video.
- **Feature home.** The renderer side stays in `features/import-export/`.
  `startExport` replaces the file fetch as the feature's one-caller wire.

---

## Phase 1: The tracer — a dated folder of films lands where you typed

**User stories**: 1–6, 11–18, 21–24, 26, 28–33, 35, 37, 39–40, 45, 57–62, 66–69

### What to build

The thinnest complete path from the dialog to a dated folder on disk that
holds the films' sheet, in either format.

- **Prototype.** The whole initiative's amendment lands first, as listed
  under _Running the phases_.
- **Types.**
  - The sixteen `EXPORT_COLUMNS` and `EXPORT_NAME_PREFIX`.
  - `StartExport` and `ExportResult`.
  - The grown `ExportSummary`.
- **Server.**
  - **`exportName`**: a local date gives `familyflix-collection_DD-MM-YYYY`.
  - **`exportRows`** over films. It applies every film cell rule, moved out of
    the Sheet writer:
    - Type is `Movie`.
    - Runtime is in minutes.
    - Genres and Cast are each joined with `, `.
    - Synopsis.
    - Rating is the stored value.
    - Status is `Watched`, `In progress` or `Unwatched`.
    - Favorite is `Yes` or blank.
    - Seasons and Episodes are blank.
    - Subtitles holds the languages in track order.
    - Poster and Backdrop are blank, because Images arrives in Phase 3.

    Rows are A–Z by title. Every column is written whatever the options.

  - **`writeSheet(tables, format, name)`** writes the Titles table. As `csv`
    it is `<name>.csv` behind a BOM. As `xlsx` it is `<name>.xlsx`, whose
    first worksheet is named `Titles`.
  - **`writeExport`** in its tracer shape:
    1. Check the destination: absolute, then `readableFolder`, then
       writable. Each failure is a `refused` sentence.
    2. Create the Export folder exclusively.
    3. Write the sheet into it.
  - **`exportBody`** and **`POST /api/export`**: `201`, `400` and `500`.
  - **`GET /api/export`** answers `seriesCount`, `episodeCount`,
    `defaultDestination` and `folderName` beside `movieCount`.
  - **The Metadata sheet.** `writeBack` moves onto `exportRows` and
    `writeSheet`, over that Library folder's films alone, with the image cells
    blank. It is still `familyflix-metadata.csv`.

- **Client.**
  - **`startExport`** is the feature's new wire call. `fetchExportSummary`
    reads the larger summary.
  - **`useExport(open)`** grows `destination`, `setDestination`, `refusal`
    and `result`, and resets all of them on every open.
    - `destination` fills from `summary.defaultDestination` once the summary
      lands, but never over a path typed first.
    - `exportLibrary()` posts `StartExport` with `images: false` and
      `subtitles: false` until Phases 3 and 4.
    - A `201` sets `result`.
    - A `400` sets `refusal` and keeps the idle face.
    - Any other failure leaves the dialog as it was.
    - A close mid-request drops the redraw, not the export.
  - **`ExportModal`**, idle face, top to bottom:
    1. The new lede.
    2. **Format**, unchanged.
    3. **Save to**: a mono `TextField` with the folder glyph, and the 13px
       `danger` refusal line.
    4. The name row: the folder glyph, the Export name in mono, and
       `N titles` / `1 title` in accent, dropped while the summary is
       `null`.
    5. **Columns included**: sixteen pills.
    6. _Export as CSV / Excel_, which reads _Exporting…_ and is disabled in
       flight.

    _Export ready_ reads "Saved `<folder name>` to `<destination>` with N
    titles." It names the folder actually written, and the count clause is
    dropped when the summary never landed.

When this phase is done, a maintainer with `E:\Movies` listed opens the
dialog. _Save to_ already reads `E:\Movies`. Pressing _Export as CSV_ creates
`E:\Movies\familyflix-collection_08-10-2026\` holding the films' sheet, and
_Export ready_ says so. Fed back to Bulk import, that sheet adds nothing.

### Acceptance criteria

- [ ] The revised `feat.ExportModal.dc.html` and the `COMPONENT-SPEC.md`
      entries land in the slice's `feat:` commit.
- [ ] `exportName` zero-pads the day and month, uses the local date, and
      carries the prefix.
- [ ] `exportRows` over films:
  - [ ] It writes the sixteen-column header.
  - [ ] Rows are sorted A–Z.
  - [ ] Every film cell rule above holds.
  - [ ] Poster and Backdrop are blank.
- [ ] `writeSheet`:
  - [ ] As csv, it names the file after the export and starts it with a
        BOM.
  - [ ] As xlsx, the first worksheet is `Titles`.
  - [ ] Both formats read back through `readSheet`.
- [ ] `writeExport` over a sandbox:
  - [ ] A valid destination gains the dated folder holding the sheet.
  - [ ] A relative destination is refused, and nothing is created.
- [ ] `exportBody`: each malformed body is a `400` sentence.
- [ ] Routes:
  - [ ] The summary's counts are correct.
  - [ ] `defaultDestination` is the first reachable folder, skips an
        unreachable one, and is Downloads with none listed.
  - [ ] `folderName` is today's Export name.
  - [ ] `POST` answers `201` with the written folder, and `400` for a refused
        destination.
- [ ] The round trip, for films: an untouched export re-imported adds nothing,
      and an edited row imports its edit.
- [ ] `writeBack`: the Metadata sheet carries the sixteen-column header with
      its image cells blank, and is still never written over an existing
      file.
- [ ] `useExport`:
  - [ ] Every open resets the state.
  - [ ] The default fills only an untouched field.
  - [ ] The `201`, `400` and other-failure paths each behave as specified.
  - [ ] A close mid-request drops the redraw.
- [ ] `ExportModal`:
  - [ ] Each section of the idle face is drawn against the revised
        prototype.
  - [ ] The refusal line shows, and the typed path is kept.
  - [ ] The title count reads `1 title` for one and is absent with no
        summary.
  - [ ] The button reads _Exporting…_ in flight.
  - [ ] _Export ready_ is drawn with and without the count clause.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 2: Series and episodes

**User stories**: 25, 27, 34, 36, 41–44

### What to build

Series join the Titles sheet, and a second table carries their episodes.

- **Server.**
  - **`exportRows`** takes series details beside films, merged A–Z by title
    across both kinds. A series row has:
    - Type `Series`.
    - The Year range (`2019–2023`, `2021–`).
    - A blank Runtime.
    - The creator under Director.
    - Status off its episodes: every episode watched gives `Watched`; none
      watched or started gives `Unwatched`; anything else gives
      `In progress`.
    - Its Seasons and Episodes counts.
    - Favorite as the series heart.
  - **The Episodes table**: one row per episode under
    `EXPORT_EPISODE_COLUMNS`, ordered by series A–Z, then season, then
    number. Still is blank until Phase 3.
  - **`writeSheet`** writes the Episodes table as a second worksheet,
    `Episodes`, after `Titles`. As csv, it is a second BOM'd file,
    `<name>-episodes.csv`. Titles stays first in both formats.
  - **The route** reads each series' detail over the full series list, and
    counts series in `ExportResult`.
- **Client.** Nothing changes on screen. The count already includes series.

When this phase is done, an export of a library holding _Heat_ and
_Severance_ lists both in one A–Z sheet, and its Episodes table holds
_Severance_'s episodes in order.

### Acceptance criteria

- [ ] `exportRows`:
  - [ ] Films and series are merged A–Z.
  - [ ] Every series cell rule above holds.
  - [ ] Status covers all three cases.
  - [ ] The episode header and episode ordering are correct.
- [ ] `writeSheet`:
  - [ ] As xlsx, the workbook holds two worksheets in order, `Titles` then
        `Episodes`.
  - [ ] As csv, there are two files, each named correctly and each starting
        with a BOM.
- [ ] The round trip, with a series row and a synopsis among the titles: an
      untouched export re-imported adds nothing, and no episode is read as a
      film.
- [ ] `POST /api/export` answers `seriesCount`.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 3: Images

**User stories**: 46–54

### What to build

Posters, backdrops and stills travel beside the sheet, unless the maintainer
turns them off.

- **Server.**
  - **The file plan.** `exportRows` gains its plan: each stored path paired
    with its relative, forward-slash path in the Export folder.
    - Each title's folder is named as a Movie folder is, and numbered on a
      clash.
    - The poster and backdrop are named `poster` and `backdrop`, with the
      stored file's own extension.
    - Stills go under `stills/`, named with `spellEpisodeTag`.
    - The Poster, Backdrop and Still cells are filled only with Images on and
      a stored file present. A title with no art leaves its cells blank.
  - **`writeExport`** pipes each planned file out of `Media.readStored`.
  - **`writeSheet`** in xlsx writes each path cell as a hyperlink whose text
    is the path.
- **Client.**
  - **`useExport`** gains `images` (default `true`) and `setImages`, reset on
    open and sent with the request.
  - **`ExportModal`** gains the **Include** group with its _Images_ row: Row
    furniture with a Toggle.

When this phase is done, an export holds `Heat (1995)\poster.jpg`. The
sheet's Poster cell reads `Heat (1995)/poster.jpg`, and in Excel that cell is
a link.

### Acceptance criteria

- [ ] `exportRows`:
  - [ ] Title folder names follow the Movie folder rule, and a clash is
        numbered apart.
  - [ ] Paths are relative, use forward slashes and keep the stored file's
        extension.
  - [ ] Stills are named by the Episode tag.
  - [ ] Image cells are blank with Images off, and blank for a title with no
        art.
- [ ] `writeSheet`: xlsx path cells are hyperlinks whose text is the path.
- [ ] `writeExport` over a sandbox and a real `createMedia`:
  - [ ] With Images on, the art is on disk.
  - [ ] With Images off, there are no title folders.
- [ ] `useExport`: `images` defaults to on, resets on open, and is sent.
- [ ] `ExportModal`: the Include group and the _Images_ Toggle are drawn.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 4: Subtitles

**User stories**: 55–56, 58

### What to build

Subtitle files travel too, when asked for.

- **Server.** The file plan copies each film subtitle beside its title's art,
  named by language (`English.srt`). Each episode subtitle goes under
  `subtitles/` as `S01E03 English.srt`. These are planned only with
  Subtitles on. Video files are never planned.
- **Client.**
  - **`useExport`** gains `subtitles` (default `false`) and `setSubtitles`.
  - **`ExportModal`**'s Include group gains the _Subtitles_ row.

When this phase is done, an export with _Subtitles_ on holds
`Heat (1995)\English.srt` beside the poster.

### Acceptance criteria

- [ ] `exportRows`: film and episode subtitle names and placement are correct,
      and nothing is planned with the toggle off.
- [ ] `writeExport`: the files on disk match each of the four toggle
      combinations. With both toggles off, the export holds only the sheet
      files. No video file is ever written.
- [ ] `useExport`: `subtitles` defaults to off, resets on open, and is sent.
- [ ] `ExportModal`: the _Subtitles_ Toggle is drawn second in Include.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 5: _Browse…_

**User stories**: 7–10

### What to build

In the desktop app, _Browse…_ opens a native dialog that picks one
destination folder.

- **Types.** `FOLDER_CHANNELS.pickOne` and `FolderBridge.pickOne`.
- **Shell.**
  - **`electron/pickFolders/`** gains the one-folder mapping beside the
    existing one: the dialog's answer gives one path, or `null` for a cancel.
  - **`main.ts`** answers the channel with `dialog.showOpenDialog(window, {
title: 'Choose a folder', properties: ['openDirectory', 'createDirectory']
})`. It only wires.
  - **`preload.ts`** exposes the member.
- **Client.**
  - **`fakeFolderBridge`** learns `pickOne`.
  - **`useExport`**'s `browse` is `null` when `folderBridge()` is `null`. A
    pick writes the field, and a cancel leaves it as it was.
  - **_Browse…_** sits beside the _Save to_ field, and is drawn only when
    `browse` is non-null.

When this phase is done, a maintainer in the desktop app presses _Browse…_,
picks `F:\Backup`, and the field reads it. In a browser there is no button.

### Acceptance criteria

- [ ] `pickFolders`: the one-folder mapping gives the path, and `null` for a
      cancel.
- [ ] `useExport`:
  - [ ] `browse` is `null` without the bridge.
  - [ ] A pick writes the field.
  - [ ] A cancel leaves the field unchanged.
- [ ] `ExportModal`: _Browse…_ is drawn only with `fakeFolderBridge`.
- [ ] `tsconfig.electron.json` compiles `main.ts`, `preload.ts` and
      `pickFolders`.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 6: The edges

**User stories**: 19–20, 63–65, 70

### What to build

Every way an export can go wrong is handled, and nothing that already exists
is ever touched.

- **`writeExport`:**
  - **The three refusal sentences**, each checked in order: relative,
    missing (or not a folder), and not writable.
  - **A taken name is numbered**: `name (1)`, `name (2)`, and so on. An
    existing folder of the same name is left untouched.
  - **A stored file that can't be read** is skipped, and its cell is
    blanked. The plan is settled before the sheet is written, or the sheet is
    written last.
  - **Any other failure** removes the Export folder on a best-effort basis,
    following the Movie folder's rollback rule. It answers `failed` with the
    _stopped partway_ sentence, and the route answers `500`.
  - **Zero titles** still writes a folder holding the headers.
- **A Folder scan** over a Library folder that holds an Export folder imports
  nothing from it.
- **Client.** A `500` leaves the dialog as it was, as Phase 1 specified, and
  the refusal line shows each sentence.

When this phase is done, a second export the same day lands as
`familyflix-collection_08-10-2026 (1)` beside the first, which is untouched.
An injected write failure leaves no folder behind.

### Acceptance criteria

- [ ] `writeExport` over a sandbox:
  - [ ] Each refusal sentence is returned, and nothing is created.
  - [ ] A taken name is numbered, and the existing folder's contents are
        byte-identical afterwards.
  - [ ] A missing stored file is skipped and its cell blanked.
  - [ ] An injected failure rolls the folder back and answers the sentence.
  - [ ] Zero titles writes the header-only sheets.
- [ ] Routes: each refusal is a `400` with its sentence, and a failure is a
      `500`.
- [ ] `createImporter.scan`: a Library folder holding an Export folder, with
      images, adds no titles from it.
- [ ] `ExportModal`: each sentence is drawn on the refusal line.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 7: The close

**User stories**: none new. This phase is the initiative's paperwork.

### What to build

The docs that make the feature Done. Per the standing rule, this is the
refactor's last commit and not a build slice.

- **The retirement**, which lands in the refactor before this commit:
  - `GET /api/export/:format`
  - the client's `fetchExportFile`
  - **Save to computer** and `stubDownload`, if nothing else uses it
  - `EXPORT_FILENAME`
- **CLAUDE.md:**
  - The folder tree names `exportName`, `exportRows`, `writeExport`,
    `exportBody`, `startExport` and the bridge's `pickOne`. It drops
    `saveToComputer`.
  - The Bulk Import / Export section describes the Export folder, the
    sixteen columns, the Episodes sheet and the Include toggles.
  - The Library folders and Write targets rule is amended.
  - Step 15 and the Maintainer tools entry are ticked ✅.
  - 🧭 **Back up the library** joins the Roadmap.
- **The README** is ticked to match.
- **The dev journal** gets the initiative's entry.

### Acceptance criteria

- [ ] No shipping code references `GET /api/export/:format`,
      `fetchExportFile`, `saveToComputer` or `EXPORT_FILENAME`.
- [ ] CLAUDE.md, the README and the dev journal reflect the shipped feature,
      and step 15 reads ✅.
- [ ] The glossary's Export terms match what shipped.

> **Initiative:** `export-options`
> **Design log:** `docs/design-logs/31-export-options.md`
> **Build order:** step 15

## Problem Statement

I am the maintainer. When I export the library today, the file always lands
in my Downloads folder, named `family-library.csv`. It holds films only, in
eight columns: no series, no synopsis, no runtime, no favorites, and no
artwork. I keep the collection itself in my Library folders, and I would like
the export to sit beside it, dated, so I can tell one export from the next.

It should also carry everything I see on a title's overview page, posters
and backdrops included, so that the export is a real copy of what the app
knows. A sheet that leaves out every series and every picture is not that.

## Solution

The Export dialog learns **where** the export is written and **what** travels
with it.

- **Save to.** A destination field under the Format cards, in mono with the
  folder glyph. It opens holding the default: the first reachable Library
  folder, or my Downloads folder when none is listed or reachable. I can type
  any other folder. In the desktop app, a _Browse…_ button beside the field
  opens a native dialog that picks one folder. A path that isn't an absolute,
  existing, writable folder is refused with one sentence under the field, and
  what I typed stays.
- **A dated folder.** Every export is a new folder,
  `familyflix-collection_DD-MM-YYYY`, created inside the destination. If that
  name is already taken, the export takes `… (1)`, `… (2)` and so on. It
  never writes into or over anything that already exists.
- **Every title, every field.** The sheet inside is named after the folder.
  It holds films **and series**, A–Z by title, under sixteen columns: Type,
  Title, Year, Runtime, Genres, Director, Cast, Synopsis, Rating, Status,
  Favorite, Seasons, Episodes, Subtitles, Poster and Backdrop. A second
  table, **Episodes**, has one row per episode. In Excel it is a second
  worksheet; in CSV it is a second file, `…-episodes.csv`.
- **Images beside the sheet.** With _Images_ on (the default), each title
  gets a folder named like a Movie folder, `Heat (1995)`, holding its poster
  and backdrop, plus a series' episode stills under `stills\`. The sheet's
  image cells hold the relative path (`Heat (1995)/poster.jpg`). In Excel
  that path is a link, so clicking it opens the picture.
- **Subtitles if I want them.** With _Subtitles_ on (off by default), every
  subtitle file is copied beside its title's art.
- **Done says where.** _Export ready_ reads "Saved
  `familyflix-collection_08-10-2026` to `E:\Movies` with 142 titles."
- **Still round-trips.** An untouched export fed back to Bulk import adds
  nothing: the reader ignores the new columns and reads the titles it always
  read.

## User Stories

1. As the maintainer, I want the Export dialog to show a _Save to_ field, so that I can see where the export will be written before I press Export.
2. As the maintainer, I want _Save to_ to open holding my first reachable Library folder, so that by default the export lands beside the collection itself.
3. As the maintainer, I want the default to skip a Library folder whose drive is unplugged, so that the default destination is never a folder that can't be written.
4. As the maintainer with no Library folders listed, I want the default to be my Downloads folder, so that the export still has somewhere sensible to go, as it does today.
5. As the maintainer, I want every open of the dialog to start from the default again, so that a one-off destination doesn't stick around for next time.
6. As the maintainer, I want to type any folder path into _Save to_, so that I can export to a USB stick or another drive.
7. As the maintainer in the desktop app, I want a _Browse…_ button beside the field, so that I can pick the destination in a native folder dialog instead of typing it.
8. As the maintainer, I want _Browse…_ to pick exactly one folder, and to let me create a new folder from inside the dialog, so that I can make a fresh place for the export on the spot.
9. As the maintainer, I want cancelling the _Browse…_ dialog to leave the field as it was, so that a cancel changes nothing.
10. As the maintainer running the dev page in a browser, I want _Browse…_ not drawn at all, so that I never see a button that can't work there; typing still does.
11. As the maintainer, I want the field to fill with the default only if I haven't already typed something, so that a slow summary never wipes out a path I've started typing.
12. As the maintainer, I want a relative path refused with _Type the full path, starting with a drive letter._, so that I know what the field expects.
13. As the maintainer, I want a path that doesn't exist refused with _No folder at that path._, so that a typo doesn't fail silently.
14. As the maintainer, I want a folder FamilyFlix can't write to refused with _FamilyFlix can't write to that folder._, so that I find out before anything is half-written.
15. As the maintainer, I want a refusal to show as one red line under _Save to_, keeping what I typed and the dialog's idle face, so that I can correct the path and try again.
16. As the maintainer, I want to export into any folder at all, including one inside a Library folder, so that I am not second-guessed about where my backup goes.
17. As the maintainer, I want every export to create a new folder named `familyflix-collection_DD-MM-YYYY` with today's date, so that each export is dated and kept apart from the others.
18. As the maintainer, I want the dialog to show that folder name in mono on its name row, so that I know what will appear in the destination.
19. As the maintainer, I want a second export on the same day to take `familyflix-collection_08-10-2026 (1)`, so that it never writes into or over the first one.
20. As the maintainer, I want the export never to touch any file that already exists in the destination, so that exporting into my collection's folder is always safe.
21. As the maintainer, I want the sheet inside to carry the folder's name, so that a sheet copied out on its own still says what it is and when it was made.
22. As the maintainer, I want the name row to show `142 titles`, counting films and series together, so that I know how much the export will carry.
23. As the maintainer with one title, I want it to read `1 title`, so that the count reads naturally.
24. As the maintainer, I want the count dropped when the summary never arrived, so that the dialog doesn't show a number it doesn't have.
25. As the maintainer, I want films and series in one sheet, A–Z by title across both kinds, so that the sheet reads the way I'd look something up.
26. As the maintainer, I want a `Type` column saying `Movie` or `Series`, so that I can tell the two kinds apart and filter by them.
27. As the maintainer, I want a series' Year to be its Year range (`2019–2023`, `2021–`), so that the sheet says what its overview page says.
28. As the maintainer, I want a film's Runtime in minutes, and blank for a series, so that the column means one thing.
29. As the maintainer, I want the Genres and Cast lists joined with `, `, so that they read like a list in one cell.
30. As the maintainer, I want a series' creator under `Director`, so that the reader that already maps that column onto a series' creator keeps working.
31. As the maintainer, I want the Synopsis in the sheet, so that the export carries the description the overview page shows.
32. As the maintainer, I want the household Rating as stored, so that the round trip keeps the stars.
33. As the maintainer, I want a film's Status as `Watched`, `In progress` or `Unwatched`, so that the sheet carries the watch state.
34. As the maintainer, I want a series' Status worked out from its episodes (every episode watched → `Watched`, none watched or started → `Unwatched`, otherwise `In progress`), so that it agrees with the series page's progress line.
35. As the maintainer, I want a `Favorite` column of `Yes` or blank, so that the hearts travel with the export.
36. As the maintainer, I want a series' `Seasons` and `Episodes` counts, and blanks for a film, so that the sheet shows how big each show is.
37. As the maintainer, I want a film's subtitle languages in track order under `Subtitles`, so that I know which languages each film has without the files.
38. As the maintainer, I want `Poster` and `Backdrop` columns holding paths relative to the sheet, so that every picture is findable from its row.
39. As the maintainer, I want every column written whatever the options, so that the header never changes from one export to the next.
40. As the maintainer, I want the dialog to list all sixteen columns as pills, so that I can see what the sheet will hold.
41. As the maintainer, I want an Episodes table with one row per episode (Series, Season, Episode, Title, Air date, Runtime, Status, Subtitles, Still), ordered by series A–Z, then season, then number, so that a season page's contents travel too.
42. As the maintainer exporting to Excel, I want the Episodes table as a second worksheet after Titles, so that the workbook is one file.
43. As the maintainer exporting to CSV, I want the episodes in a second file, `familyflix-collection_08-10-2026-episodes.csv`, beside the titles file, so that each CSV is one table.
44. As the maintainer, I want the titles to stay first in both formats, so that re-importing never reads an episode as a film.
45. As the maintainer, I want each CSV to start with a byte-order mark, so that Excel reads accented titles correctly.
46. As the maintainer, I want an _Include_ group with an _Images_ toggle, on by default, so that posters, backdrops and stills travel unless I say otherwise.
47. As the maintainer, I want each title's images in a folder named the way a Movie folder is (`Heat (1995)`), so that the export looks like the collection I already keep.
48. As the maintainer, I want the poster and backdrop saved as `poster` and `backdrop` with the stored file's own extension, so that the files are named predictably and never re-encoded.
49. As the maintainer, I want a series' episode stills saved as `stills\S01E03<ext>` in its folder, so that each still says which episode it belongs to.
50. As the maintainer, I want two titles that would share a folder name numbered apart, so that neither title's art overwrites the other's.
51. As the maintainer, I want image paths in cells written with forward slashes, so that Excel and Windows both follow them.
52. As the maintainer exporting to Excel, I want each image cell to be a hyperlink whose text is its path, so that a click opens the picture.
53. As the maintainer, I want a title with no artwork to leave its image cells blank, so that the drawn Default poster is never mistaken for a stored picture.
54. As the maintainer, I want the image cells blank when _Images_ is off, so that the sheet never points at a file that wasn't written.
55. As the maintainer, I want a _Subtitles_ toggle, off by default, so that subtitle files travel only when I want a copy that goes somewhere else.
56. As the maintainer, I want a film's subtitles copied beside its art, named by language (`English.srt`), and an episode's under `subtitles\S01E03 English.srt`, so that each file says what it is.
57. As the maintainer, I want an export with both toggles off to hold only the sheet (or the two CSVs), so that a quick spreadsheet backup stays small.
58. As the maintainer, I want video files never copied, so that an export stays seconds long and doesn't duplicate hundreds of gigabytes.
59. As the maintainer, I want the button to read _Exporting…_ and be disabled while the export is written, so that I know it is working and can't start it twice.
60. As the maintainer, I want _Export ready_ to say "Saved `familyflix-collection_08-10-2026` to `E:\Movies` with 142 titles.", with the folder actually written (numbered if it was), so that I know exactly where to look.
61. As the maintainer, I want the done face's count clause dropped when the summary never landed, so that it never states a number it didn't have.
62. As the maintainer, I want closing the dialog mid-export to leave the export running, so that the folder is still written.
63. As the maintainer, I want an export that breaks partway to remove the folder it created and tell me in one sentence (_The export stopped partway: <reason>. Nothing was left behind._), so that I'm never left with half an export.
64. As the maintainer, I want an image or subtitle whose stored file is missing to be skipped and its cell left blank, so that one lost file doesn't sink the whole export.
65. As the maintainer with an empty library, I want the export to still write a folder with the headers, so that the action behaves the same way every time.
66. As the maintainer, I want an untouched export fed back to Bulk import to add nothing, so that an export is a safe backup and not a source of duplicates.
67. As the maintainer, I want an export with one row edited to import that edit, so that bulk-editing outside the app still works.
68. As the maintainer, I want the Settings row to keep its _Export to CSV_ label and line, so that the way in is where it has always been.
69. As the maintainer, I want the Metadata sheet a Sync writes into each Library folder to use the same sixteen-column header, so that every sheet the app writes reads one way.
70. As the maintainer, I want a later Folder scan to pass over an Export folder without importing anything from it, so that exporting into a Library folder never adds ghost titles.

## Implementation Decisions

### What is built, and what retires

- One initiative that amends the existing Export (log 14) rather than adding
  a second one: the same Settings row, the same dialog, the same `/api/export`
  route family.
- **The server writes the export** straight to the destination. The browser
  download path (`GET /api/export/:format`, the client's file fetch, **Save to
  computer**, and the fixed export filename constants) retires in this
  initiative's refactor pass, after the new path is green. Nothing else uses
  it.

### Wire contract

- `GET /api/export` → `ExportSummary { movieCount, seriesCount, episodeCount,
defaultDestination, folderName }`. `defaultDestination` is the first
  Library folder, in the order added, that `readableFolder` calls readable,
  else `<home>\Downloads`. `folderName` is today's Export name before any
  numbering.
- `POST /api/export { format, destination, images, subtitles }` → `201
ExportResult { folder, movieCount, seriesCount }`, where `folder` is the
  absolute path actually written. `400 { error }` for a body that isn't a
  valid `StartExport`, or a destination that is refused (one sentence each, as
  in the Solution). `500 { error }` for a write that broke, after the
  rollback.
- The body is read by a new route-layer unit, `exportBody`, on
  `movieFormBody`'s and `enrichmentBody`'s precedent: the request in, a typed
  `StartExport` or a `400` sentence out.
- One request, not a run: no polling, no cancel, no Current run. The disabled
  _Exporting…_ button is the progress indicator. This is accepted because
  without video files an export takes seconds.

### Shared types (`export.ts`)

- `EXPORT_FORMATS`, `ExportFormat` unchanged.
- `EXPORT_COLUMNS` becomes the sixteen Titles columns, in this order: Type,
  Title, Year, Runtime, Genres, Director, Cast, Synopsis, Rating, Status,
  Favorite, Seasons, Episodes, Subtitles, Poster, Backdrop. Log 14's eight keep
  their relative order and their cell rules.
- New: `EXPORT_EPISODE_COLUMNS` (Series, Season, Episode, Title, Air date,
  Runtime, Status, Subtitles, Still), `EXPORT_NAME_PREFIX`, `StartExport` and
  `ExportResult`. `ExportSummary` grows as above.

### Server modules — `import-export/`, each in its folder with its suite

- **`exportName(now)`**: pure. A date → `familyflix-collection_DD-MM-YYYY`
  in local time. The one place the name is spelled; the clock is injected.
- **`exportRows(movies, series, include)`**: pure, and the deep module of
  the initiative. Movies and series details in, `{ tables: { titles,
episodes }, files: ExportFilePlan[] }` out. It owns:
  - every cell rule, moved out of `writeSheet` and spelled once;
  - the A–Z merge of both kinds;
  - a series' Status off its episodes;
  - the episode ordering;
  - the per-title folder names (`movieFolder(title, year)`, numbered on a
    clash);
  - the file plan: each stored path paired with its forward-slash path
    relative to the Export folder. Poster and backdrop take the stored
    file's extension, stills go under `stills/` named with `spellEpisodeTag`,
    film subtitles are named by language, and episode subtitles go under
    `subtitles/`.

  An image or subtitle path cell is filled only when its toggle is on.

- **`writeSheet(tables, format, name)`**: still pure, still the Sheet
  reader's mirror, and now answering named files. For `xlsx`: one workbook
  with a `Titles` worksheet, then an `Episodes` worksheet, unstyled, with the
  path cells as hyperlinks whose text is the path. For `csv`: two BOM'd files,
  `<name>.csv` and `<name>-episodes.csv`.
- **`writeExport(media, request, content, now)`**: the injected writer, and
  it never throws. It answers `written`, `refused` or `failed`.
  1. Check the destination: absolute, then `readableFolder`, then a write
     check (`access(W_OK)`, the Write targets' own). Each failure is a
     `refused` sentence.
  2. Create the Export folder **exclusively**, numbering a taken name
     Chromium's way (`name (1)`, `name (2)`, …).
  3. Write the sheet files.
  4. Pipe each planned file out of `Media.readStored`. A stored file that
     can't be read is skipped and its cell blanked. This means the plan is
     settled before the sheet is written, or the sheet is written last.
  5. On any other failure, remove the Export folder (best-effort, the Movie
     folder's rollback rule) and answer `failed` with _The export stopped
     partway: <reason>. Nothing was left behind._

  `media/` stays the only reader of managed storage.

- **The route** composes `writeExport` the way `createApiRouter` already
  composes storage and media: no new router parameter. The movie list comes
  from the existing A–Z read, and each series detail from the series reader's
  existing per-id detail read over the full series list. The route maps the
  outcome onto `201` / `400` / `500`.
- **The Metadata sheet** a Sync writes (`writeBack`) moves onto `exportRows`
  - `writeSheet` over that Library folder's films alone, with the image cells
    blank: it gains the sixteen-column header and is still
    `familyflix-metadata.csv`.

### Shell — the folder bridge's second member

- `FOLDER_CHANNELS.pickOne` = `'familyflix:folders:pick-one'`.
  `FolderBridge.pickOne(): Promise<string | null>`.
- In main: `dialog.showOpenDialog(window, { title: 'Choose a folder',
properties: ['openDirectory', 'createDirectory'] })`. The pure mapping (the
  dialog's answer → one path or `null`) sits beside `pickFolders` in
  `electron/pickFolders/`. `main.ts` wires the channel, `preload.ts` exposes
  the member, and `fakeFolderBridge` learns it.
- It is named for what it does rather than for its one caller, because the
  bridge is generic. `pick()` is unchanged.

### Frontend — `features/import-export/`

- **`useExport(open)`** grows `destination`, `setDestination`, `images`
  (default `true`), `setImages`, `subtitles` (default `false`),
  `setSubtitles`, `browse` (`null` when `folderBridge()` is `null`), `refusal`
  and `result: ExportResult | null`. On every open it resets all of them.
  It fills `destination` from `summary.defaultDestination` once the summary
  lands, but never over a path typed first (`useTmdbKey`'s rule).
  `exportLibrary()` posts `StartExport`:
  - a `201` sets `result`, which is Export ready;
  - a `400` sets `refusal` and keeps the idle face;
  - any other failure leaves the dialog as it was;
  - a close mid-request drops the redraw, not the export.
- **`startExport`**, the feature's one-caller wire, replaces the file fetch.
  `fetchExportSummary` reads the larger summary.
- **`ExportModal`** idle face, top to bottom, on log 14's Modal:
  1. The header: the download tile, _Export library_, _Save your whole
     collection — details, artwork and all._, and ✕.
  2. **Format**: the two Format cards, unchanged.
  3. **Save to**: the mono `TextField` with the folder glyph, _Browse…_ only
     with the bridge, and the 13px `danger` refusal line.
  4. The name row: the folder glyph, the Export name in mono, and
     `N titles` / `1 title` in accent.
  5. **Include**: two Settings-`Row`-furniture rows, each with a Toggle.
  6. **Columns included**: sixteen pills.
  7. _Export as CSV / Excel_ (`primary`, _Exporting…_ in flight) and
     _Cancel_.
- **Export ready** stays the same Bare modal, with the new copy: the folder
  name and the destination each in mono, and the count clause dropped when
  the summary never landed.
- The Settings row is unchanged: _Export to CSV_, _Save your whole library
  out as a spreadsheet backup._

### Prototype first

- Before phase 1 is built, `feat.ExportModal.dc.html` in `docs/handoff/` is
  revised to the idle face and done copy above. It shows _Save to_ with and
  without _Browse…_ and with a refusal, the name row, the Include toggles and
  the sixteen pills. `COMPONENT-SPEC.md`'s ExportModal row gets the new
  props, and the folder bridge its second member. Build matches the revised
  prototype 1:1.

### Rules amended

- "Only the Write targets write into a Library folder" becomes: "the Write
  targets and an Export, and each only ever adds what is not there." An
  Export into a Library folder creates its own new folder and touches nothing
  else.
- A Folder scan passes an Export folder by: it holds no video, so neither it
  nor its title folders is a Source folder.

## Testing Decisions

A good test here drives a unit through its public interface and asserts on
what the maintainer or the next unit would see: the cells of a table, the
bytes and names of a file, the tree on disk, the status and body of a route,
the text and controls on the dialog. Tests do not assert on private helpers,
on call order inside a unit, or on how a table is built. The prototype is the
spec for the dialog's surface.

Modules tested, each with its own suite:

- **`exportName`**: zero-padded day and month, local date, the prefix. Prior
  art: the pure unit suites in `import-export/` (`titleKey`).
- **`exportRows`**: the heaviest suite. It covers:
  - the sixteen-column header and the episode header;
  - A–Z across both kinds;
  - every cell rule for a movie and for a series: Year range, blank Runtime,
    creator under Director, Favorite, Seasons and Episodes counts, subtitle
    languages;
  - series Status off its episodes, in all three cases;
  - episode ordering;
  - title folder naming and numbering on a clash;
  - the file plan's relative forward-slash paths and extensions, stills via
    the Episode tag, subtitle names;
  - image and subtitle cells blank when their toggle is off, and blank for a
    title with no art.

  Prior art: `matchRows`, `groupShows`, and the enrichment `plannedEnrichment`
  suites.

- **`writeSheet`**: in xlsx, two worksheets in order, their names, and the
  hyperlink cells with their text. In csv, two files, their names and the BOM
  on each. Read back through `readSheet` for the round trip. Prior art: the
  existing `writeSheet` suite.
- **`writeExport`**: over a sandbox directory and a real `createMedia`. It
  covers:
  - each refusal sentence;
  - the exclusive, numbered folder, with an existing folder left untouched;
  - the files on disk for each toggle combination;
  - a missing stored file skipped and blanked;
  - an injected failure rolling the folder back;
  - zero titles.

  Prior art: `writeBack` (permission checks, never overwriting) and the
  `libraryFixture` / `seriesFixture` sandboxes.

- **`exportBody`**: each malformed body is a `400` sentence. Prior art:
  `enrichmentBody`, `movieFormBody`.
- **Routes**: the summary's counts and `defaultDestination` (first reachable,
  an unreachable one skipped, Downloads with none); `POST` `201` / `400` /
  `500`; and the **round trip**, where an untouched export (a series row and
  a synopsis among the titles) re-imported adds nothing, and an edited row
  imports its edit. Prior art: `routes.export.test.ts`,
  `routes.libraryFolders.test.ts`.
- **`writeBack`**: the Metadata sheet now carries the new header, with its
  image cells blank.
- **`pickFolders`** (shell): the one-folder mapping, including `null` for a
  cancel. Prior art: the existing `pickFolders` suite.
- **`useExport`**: the reset on open, the default filling only an untouched
  field, `browse` `null` without the bridge, `pickOne` writing the field and
  a cancel leaving it, the `201` / `400` / other-failure paths, and a close
  mid-request. Prior art: the current `useExport` suite, `useTmdbKey`,
  `useLibraryFolders`, `fakeFolderBridge`.
- **`ExportModal`**: each section of the idle face against the revised
  prototype, _Browse…_ present only with the bridge, the refusal line, the
  title count's singular and absent cases, _Exporting…_, and the Export ready
  copy with and without the count. Prior art: the current `ExportModal` suite.

## Out of Scope

- **Video files.** A full backup, which joins the Roadmap as 🧭 **Back up
  the library**. If it is built, that is when an export earns a run with
  progress and cancel.
- **Embedded images** in the `.xlsx`.
- **A column picker.** The pills are a list, not controls.
- **Remembering the last destination.**
- **A _Show in folder_ button** on Export ready. The path is printed
  instead.
- **Teaching the Sheet reader the new columns**: restoring posters,
  backdrops, favorites or runtime from a sheet. This would change Bulk
  import's contract, and is a follow-up of its own.
- **`originalTitle`, `tmdbScore` and `tmdbId` columns.** They are stored but
  not drawn on an overview page.
- **A Current run, polling or cancel** for the export.
- **Any change to the Settings row's label or line.**

## Further Notes

- Build phases, from the design log: 0. The prototype revision.
  1. The tracer: a dated folder with the films' CSV lands where you typed.
  2. Series and episodes.
  3. Images.
  4. Subtitles.
  5. _Browse…_.
  6. The edges.
  7. Docs, the glossary and the refactor filing.
- The feature row ticks ✅ only after the refactor (see memory: _feature
  done only after its refactor_). The refactor retires
  `GET /api/export/:format`, the client file fetch, **Save to computer** and
  `EXPORT_FILENAME`.
- The glossary already carries the new and updated terms from the grill-me
  session: Export folder, Export name, Export destination, Titles sheet,
  Episodes sheet and Include toggles.
- Trade-off accepted: an export is now a folder rather than a single file to
  attach to an email, and a large art export is a wait of seconds behind a
  disabled button, with no progress bar.

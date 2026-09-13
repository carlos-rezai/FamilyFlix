## Problem Statement

I am the maintainer of this library, and the only thing that can fill it is a
dev seed.

FamilyFlix exists because of a real collection: ~12 TB of films, one folder
each, and an Excel sheet tracking titles, years and genres. Every feature
shipped so far — the browse grid, the carousel, search, the detail page, the
player, Add, Edit, Delete — assumes the library is already full. Today it is
full only under `npm run db:seed`, scaffolding whose stated expiry has been in
CLAUDE.md since library-core: _"the commit that ships bulk import is the commit
that deletes it."_

The Add Movie form can take one film at a time through a file picker — thirty
seconds each, which for twelve hundred films is a weekend nobody is going to
spend. And the form is deliberately unable to do better: a browser's
`<input type="file">` yields a name and bytes and never a path, so
`11-add-movie.md` refused folder-path autofill there and sent it here, "where
its argument actually lives". A spreadsheet naming a thousand folders is the
case that needs a scanner, and a typed path is the one thing a server can be
pointed at.

The prototype has drawn the whole flow since the handoff —
`feat.ImportFlow` with its setup, running and review steps, `mol.LogConsole`,
the import context of `feat.MovieForm` — and none of it is built. The
`server/src/import-export/` folder CLAUDE.md gives "Excel/CSV parsing,
row-to-folder matching" to is empty.

## Solution

One screen at `/import`, reached from a new **Library section** on Settings,
that reads the family's **Sheet**, walks the **Library root**, matches every
**Sheet row** to a **Source folder**, and copies each confident **Match** into
the library as a **Movie** — the prototype's three steps, translated 1:1 onto
the storage model the app already has.

**Setup.** Two typed path fields — the spreadsheet and the movies root — and
_Start import_, gated until both are filled. A path that will not open answers
under the field it names.

**Running.** A Connect ✓ → Scan → Import stepper, a serif headline, a stat
line, the bar (indeterminate while scanning, counting `done / total` while
importing), the current item in mono, elapsed and — once enough is done — an
ETA, the **Activity log**, and _Cancel import_. The run is a server job polled
every 500 ms; the screen can be left and re-attached to.

**Review.** Two stat tiles — _matched confidently and imported_ and _need your
attention_ — over a **Needs attention** list of **Problems**, each with a
coloured dot, a title, a reason, **Resolve** and **Skip**. A _✓ All done_ card
once the list is empty, and _Finish — go to library_.

**Resolve** opens the **Movie form** in **Import context** — the accent banner
"Resolving import · {title}", the fields prefilled from the row, the file slots
prefilled from the folder as **Found files**, _Save & continue_ and _Skip this
one_ — the surface `11-add-movie.md` parked for exactly this initiative.

Three places where the documents disagreed are settled by the prototype:
confident matches **commit during the run** and review lists only what the
run could not settle; **TMDB is not here** and never was — what it would add is
an **Enrichment** pass, a future initiative if ever; and a **Problem** is a row
that could not be imported as-is (or, softly, one that imported without a
genre), never a film missing an optional subtitle or poster — those are
**Warning lines** in the log, as the prototype's own running step already
shows.

The originals are **copied, never moved** — the same **Managed copy** the form
makes, so one storage model, and a bad run costs time and never the family's
files. The seed goes in the same initiative, replaced by the importer's own
fixtures.

## User Stories

**The entry**

1. As the maintainer, I want a **Library** section on the Settings page with
   "＋ Add a movie" and "⇪ Import from spreadsheet" rows, so that bulk import
   is reachable from the hub the prototype designs for it.
2. As the maintainer, I want "Add a movie" to land on `/add` and "Import from
   spreadsheet" on `/import`, so that each row goes where its label says.
3. As the maintainer, I want no "Export to CSV" row until export ships, so
   that Settings never shows a row that does nothing.
4. As the maintainer, I want the import page drawn on the Maintainer surface —
   the bg2 sheet, the 760 column, a Back pill — so that it reads as the same
   kind of screen as the form.
5. As the maintainer, I want Back on the import page to return to Settings,
   so that the screen steps back to where I opened it from.

**Setup**

6. As the maintainer, I want two typed path fields — Spreadsheet and Movies
   root folder — with the sheet and folder glyphs, in mono, square-cornered,
   50 high, so that the setup step matches the prototype pixel for pixel.
7. As the maintainer, I want the fields' placeholders to read
   `C:\Movies\library.xlsx` and `C:\Movies`, so that the shape of a path is
   shown before I type one.
8. As the maintainer, I want _Start import_ disabled until both fields are
   non-empty, so that a run can never be started against nothing.
9. As the maintainer, I want a spreadsheet path that does not exist, cannot
   be read, or is neither `.xlsx` nor `.csv` to be refused before any run
   starts, with a 13px danger-coloured line under the Spreadsheet field saying
   why, so that I can correct the one field that is wrong.
10. As the maintainer, I want a root path that does not exist or is not a
    directory refused the same way under the Movies root field, so that the
    two errors never share a line.
11. As the maintainer, I want a sheet with no recognisable title column
    refused under the Spreadsheet field, so that a run never starts on a sheet
    it cannot read.
12. As the maintainer, I want the error line to clear when I edit that field,
    so that a stale refusal does not sit under a corrected path.
13. As the maintainer, I want a second _Start import_ while a run is already
    in progress to be refused and the screen to show the run that is already
    there, so that two runs never copy into the same library at once.
14. As the maintainer, I want the fields' values kept if a start is refused,
    so that a typo costs one keystroke, not two paths.

**Reading the sheet**

15. As the maintainer, I want `.xlsx` and `.csv` sheets both read, decided by
    extension, so that the library's real sheet and a future exported CSV both
    import.
16. As the maintainer, I want the first worksheet read, with its first row as
    the header, so that the ordinary shape of a spreadsheet is the one that
    works.
17. As the maintainer, I want columns found by header name, case-insensitive,
    through a synonym table — _Title/Name/Movie/Film_, _Year_, _Genre/Genres_,
    and the optional _Director_, _Cast/Actors_, _Description/Synopsis_,
    _Rating_, _Watched_ — so that the sheet's headers need not match a fixed
    spelling and the columns I add later are already recognised.
18. As the maintainer, I want a sheet holding only Title, Year and Genre to
    import fully, so that the three columns the real sheet has today are
    enough.
19. As the maintainer, I want a genre cell split on commas, slashes and
    semicolons, so that "Action / Thriller" tags a film with both.
20. As the maintainer, I want unrecognised columns ignored, so that the
    sheet's own bookkeeping columns never break a run.
21. As the maintainer, I want a row with an empty title skipped with a log
    line, so that a blank row costs nothing and is not silent.
22. As the maintainer, I want a year that is not a four-digit number treated
    as no year, so that a stray cell never refuses a row.
23. As the maintainer, I want a genre the **Genre pool** does not know dropped
    from the row and logged once per unknown name, so that the row still
    imports and I learn which spelling to fix.
24. As the maintainer, I want a rating cell read on the 0–10 scale the column
    stores, so that a rated sheet lands as rated movies.
25. As the maintainer, I want a watched cell (yes/true/1/✓) to mark the movie
    watched, so that the family's viewing history survives the migration.

**Scanning**

26. As the maintainer, I want the root walked so that a folder holding a video
    file is a **Source folder** and is not descended, and a folder holding
    none is descended, so that `Movies/Action/Die Hard/` is found and
    `Die Hard/extras/` does not become a second film.
27. As the maintainer, I want a video recognised by extension — `.mp4 .mkv
.avi .webm .mov .m4v .wmv .mpg .mpeg .ts .flv` — so that the scanner has a
    rule the form's anything-goes video slot deliberately does not.
28. As the maintainer, I want an image named `poster.*` / `folder.*` /
    `cover.*` (`.jpg .jpeg .png .webp`) taken as the poster, else the first
    image by name, so that the folder's cover is found the way it is usually
    named.
29. As the maintainer, I want an image named `fanart.*` / `backdrop.*` to
    fill the movie's backdrop, so that the detail page's backdrop slot — empty
    since log 04 — is filled by the one thing that can.
30. As the maintainer, I want every `.srt .vtt .ass .sub` file in the folder
    attached as a subtitle, with its language read from a filename tag
    (`.en`, `.eng`, `English`) onto the form's seven language names and
    `English` when nothing says, so that tracks arrive labelled the way the
    form would label them.
31. As the maintainer, I want a folder holding no video or more than one
    video listed as a **Problem** rather than guessed at, so that the file
    whose absence actually blocks is the one I am asked about.
32. As the maintainer, I want the scan to run to completion before any copy
    starts, so that every match-time problem exists by the time the bar turns
    determinate.
33. As the maintainer, I want a folder the scanner cannot read (permissions)
    logged as a warning and skipped, so that one locked directory never ends
    the run.

**Matching**

34. As the maintainer, I want a row and a folder compared by a **Title key** —
    lower-case, diacritics stripped, dots and underscores to spaces, a
    trailing `(1988)` / `1988` / `[1080p]` tail dropped from the folder name,
    then letters, digits and single spaces only — so that
    `Die.Hard.1988.1080p` matches "Die Hard".
35. As the maintainer, I want a match to require the years to agree when both
    sides carry one, so that a remake is never mistaken for the original.
36. As the maintainer, I want exactly one key-equal folder to be a **Match**,
    so that a confident pairing needs no review.
37. As the maintainer, I want two or more key-equal folders listed as
    `ambiguous` with "Two folders look like plausible matches — pick one.", so
    that a duplicate on disk is mine to settle.
38. As the maintainer, I want no exact folder but one or more whose key starts
    with the row's listed as `ambiguous` with "One folder looks like a match,
    but the name isn't exact.", so that a near miss is offered rather than
    lost.
39. As the maintainer, I want a row with no folder at all listed as
    `no-folder` with "No folder found matching this spreadsheet row.", so that
    a film I have not ripped yet is named.
40. As the maintainer, I want a folder no row claimed listed as `no-row` with
    "Folder isn't in the spreadsheet.", so that a film on disk the sheet forgot
    can still be imported.
41. As the maintainer, I want a row whose title key and year match a movie
    already in the library skipped with the log line "– Already in library
    {Title} ({Year})" — neither a match nor a problem — so that re-running the
    same sheet, after a cancel or a crash, is harmless.
42. As the maintainer, I want the library's titles loaded once at the start of
    the run, so that the already-in-library check costs one query, not one
    per row.

**Importing**

43. As the maintainer, I want each match imported by the form's own sequence
    — reserve a **Movie folder**, copy in the video, the poster, the backdrop
    and each subtitle, derive the runtime, add the movie — so that a bulk
    import writes exactly what Add Movie would.
44. As the maintainer, I want the copy made with the OS copy path, so that
    terabytes move as fast as the disk allows rather than through a stream.
45. As the maintainer, I want the originals under the Library root never
    written to, moved or deleted, so that a bad run costs time and never a
    file.
46. As the maintainer, I want a copy that fails partway to roll the reserved
    folder back and file a `failed` problem reading "Couldn't copy the video
    file: {reason}.", so that one bad disk read never leaves a half-movie.
47. As the maintainer, I want a match with no subtitle to import with the
    warning line "⚠ {Title} — no subtitle track found", so that an optional
    file's absence is noted and never blocks.
48. As the maintainer, I want a match with no poster to import with a warning
    line, so that a film with no artwork still lands with its gradient card.
49. As the maintainer, I want a match whose row has no genre imported and
    then listed as the soft problem `missing-meta` reading "Imported, but the
    row has no genre — it won't appear in any genre row.", so that a film
    invisible to the home's genre rows is pointed out.
50. As the maintainer, I want the movie's `tmdbId` left null, so that nothing
    claims a lookup that never happened.
51. As the maintainer, I want the movie's runtime derived from the copied
    bytes best-effort, so that the detail page's meta line reads the same as
    for a form-added film.

**The running step**

52. As the maintainer, I want a stepper reading Connect ✓ → Scan → Import,
    with the active step in accent and the finished step ticked, so that I can
    see which phase I am in.
53. As the maintainer, I want the headline "Scanning your library…" while
    scanning and "Importing movies…" while importing, so that the phase reads
    at a glance.
54. As the maintainer, I want the stat line "Found N movies so far" while
    scanning and "N of M imported" while importing, with thousands separators,
    so that progress is a number and not a spinner.
55. As the maintainer, I want the bar indeterminate while scanning and at
    `done / total` percent while importing, so that the bar is honest about
    what it knows.
56. As the maintainer, I want the current folder (scanning) or title
    (importing) shown in mono under the bar, so that I can see what the run is
    on.
57. As the maintainer, I want "Elapsed m:ss" shown, and "· About m:ss left"
    once more than 20 items are done, so that a twelve-terabyte copy has a
    forecast and a small one is not lied to.
58. As the maintainer, I want the **Activity log** — a mono console with lines
    coloured by kind (info, scan, path, success, warning, error), pinned to the
    bottom as lines arrive — so that the running step reads like the prototype's
    installer console.
59. As the maintainer, I want the log to open with "Connecting to {root} …",
    show "Scanning {folder}" per folder, "✓ Found N movies across M folders.
    Starting import…" when the scan ends, "✓ Imported {Title}" per match, and
    "✓ Import complete — N imported, P need attention." at the end, so that
    the log tells the story the prototype's does.
60. As the maintainer, I want the log capped at 80 lines, so that a
    thousand-film run keeps the snapshot small and the console readable.
61. As the maintainer, I want the screen to refresh every 500 ms while
    scanning or importing and stop polling once in review, so that the run is
    live without a connection to manage.
62. As the maintainer, I want to be able to leave `/import` mid-run and come
    back to the same running step, so that a long copy does not hold the
    browser hostage.
63. As the maintainer, I want a reload of the page during a run to re-attach
    to it, so that a refresh is not a cancel.
64. As the maintainer, I want the running step shown when I arrive at
    `/import` with a run already in progress, so that the setup fields are
    never offered while a run exists.

**Cancel**

65. As the maintainer, I want _Cancel import_ in the danger variant, so that
    the one destructive control on the screen reads as one.
66. As the maintainer, I want Cancel to abort the in-flight copy and roll that
    one folder back, so that no half-copied movie is left behind.
67. As the maintainer, I want every movie already added to stay, so that
    cancelling keeps the work done and only stops the work ahead.
68. As the maintainer, I want Cancel to discard the run and return me to
    setup with the fields as I typed them, so that restarting is one click —
    and harmless, because already-imported rows are skipped.

**Review**

69. As the maintainer, I want the review step reached automatically when the
    last match is imported, so that I am not asked to click through to it.
70. As the maintainer, I want a stat tile showing how many rows "matched
    confidently and imported" and one showing how many "need your attention",
    so that the run's outcome is two numbers.
71. As the maintainer, I want a **Needs attention** list of every problem,
    each with a dot coloured by kind (`danger` for no-folder / no-video /
    failed, `accent` for ambiguous, `text-faint` for no-row / missing-meta),
    its title and its reason, so that the list reads like the prototype's.
72. As the maintainer, I want each row to carry **Resolve** and **Skip** as
    small secondary Buttons, so that every problem has two ways out and
    neither is a one-off inline control.
73. As the maintainer, I want Skip to dismiss the problem and remove its row
    without importing anything, so that a film I do not want is one click.
74. As the maintainer, I want the tiles to update as I resolve and skip, so
    that the numbers stay true.
75. As the maintainer, I want a "✓ All done — Every flagged movie has been
    handled." card once the list is empty, so that finishing is a state and
    not a guess.
76. As the maintainer, I want _Finish — go to library_ to land on the browse
    home, so that the first thing I see after the run is the library it
    filled.
77. As the maintainer, I want Finish available while problems remain, so that
    I can leave the rest for later.
78. As the maintainer, I want a run that finds nothing to import and raises no
    problems to reach review with zeros in both tiles and the All done card,
    so that an empty root is a result, not an error.

**Resolve**

79. As the maintainer, I want Resolve to open the Movie form at
    `/add?problem=<id>` with the accent banner "Resolving import · {title}",
    so that a flagged row is fixed on the screen I already know.
80. As the maintainer, I want the title, year, genres, director, cast,
    synopsis and rating prefilled from the sheet row, so that I type only what
    the sheet did not have.
81. As the maintainer, I want the video, poster and subtitle slots prefilled
    from the matched folder as **Found files** — shown in the slots the way a
    stored file is, by filename — so that a folder's files need not be picked
    by hand.
82. As the maintainer, I want an `ambiguous` problem prefilled from its first
    candidate with the others named in the banner ("Harbor Lights — also
    matched: Harbor.Lights.2019"), so that a wrong first guess costs a Remove
    and a hand-pick, not a search.
83. As the maintainer, I want a `no-folder` problem to open with the row's
    fields filled and every slot empty, so that I can pick the file from
    wherever it is.
84. As the maintainer, I want a `no-row` problem to open with the folder's
    files filled and the title guessed from the folder name, so that a film
    the sheet forgot is one title away from imported.
85. As the maintainer, I want to replace a found file with a picked one, and
    remove a found subtitle, exactly as I would a stored one, so that the slot
    behaves the same in every context.
86. As the maintainer, I want the save button to read _Save & continue_ and
    the cancel to read _Skip this one_, so that the form's labels say what
    they do in this context.
87. As the maintainer, I want _Save & continue_ to import the movie — found
    files copied from the folder, picked files from their bytes — dismiss the
    problem, and return me to the review step, so that the list is one shorter.
88. As the maintainer, I want _Skip this one_ to dismiss the problem and
    return me to review, so that the form's cancel is the same action as the
    row's Skip.
89. As the maintainer, I want the import context to keep the form's own save
    gate — title and video — so that resolving cannot write a row the form
    would refuse.
90. As the maintainer, I want the server to copy a found path only if it lies
    under the current run's root, so that the resolve route can never be
    pointed at an arbitrary file on the machine.
91. As the maintainer, I want the general `POST /api/movies` to keep accepting
    bytes only, so that no path-accepting field leaks into a route anyone on
    the network can reach.
92. As the maintainer, I want a soft `missing-meta` problem's Resolve to open
    the Edit form at `/add?movie=<id>&problem=<pid>` with the banner, so that
    a film already in the library is amended rather than added twice.
93. As the maintainer, I want the Edit form's ordinary save in that context
    followed by dismissing the problem and a return to review, so that the
    soft kind leaves the list the same way the hard kinds do.
94. As the maintainer, I want a `/add?problem=<id>` for a problem that no
    longer exists — dismissed, or the run gone — to fall back to the plain Add
    context, so that a stale link is never a dead page.
95. As the maintainer, I want the import context's Back and its _Skip this
    one_ to land on `/import`, so that the review step is where every exit
    goes.

**Failure and edge cases**

96. As the maintainer, I want a title with quotes, diacritics or a very long
    name to match, import and sit in a problem row without breaking anything,
    so that the copy holds for any film in the collection.
97. As the maintainer, I want a movie folder name collision (two films with
    the same title and year) suffixed the way the form already suffixes, so
    that a bulk run never overwrites a folder.
98. As the maintainer, I want a file locked or vanishing mid-copy to file a
    `failed` problem and continue with the next match, so that one bad file
    never ends a twelve-hour run.
99. As the maintainer, I want the app restarting mid-run to lose the run and
    keep every movie already added, so that a crash costs a re-run and never a
    row.
100.  As the maintainer, I want a poll that fails (server gone) to keep the
      last snapshot on screen and keep trying, so that a blip does not blank
      the console.
101.  As the maintainer, I want `GET /api/import/current` with no run to answer
      `404`, so that the page knows to show setup.
102.  As the maintainer, I want Skip and Resolve on a problem that is already
      gone to answer `404` and the row to disappear, so that gone is gone here
      as it is for Delete.
103.  As the maintainer, I want a subtitle whose language tag is unknown to
      land as English rather than fail, so that an odd filename never blocks a
      track.
104.  As the maintainer, I want a Source folder path with characters that are
      unsafe in a Movie folder name to still import, so that the managed folder
      is named by the app's own rule and never by the source.
105.  As a parent browsing, I want no import control anywhere on the browse
      home, a card, the detail page or the player, so that the only way to
      start a run is the Settings hub.

**The seed**

106. As the maintainer, I want the dev seed, its `db:seed` script and the
     paragraphs naming them removed, so that the promise in CLAUDE.md is kept
     and there is one way to fill a library.
107. As the maintainer, I want a tiny fixture sheet and folder tree under the
     importer's own tests, so that a dev library is filled by the real
     feature.

## Implementation Decisions

**Scope.** Bulk import and its progress console, as one initiative named
`bulk-import` — distinct from the `import-export/` folder so a commit prefix
reads unambiguously. Export is its own grill. The Settings page gains only the
Library section's two rows whose destinations exist; the rest of the settings
shell stays 🔜.

**The prototype is amended first, as one `docs:` commit, and nothing in `src/`
lands before it.** `feat.ImportFlow`: the setup error line — a 13px line in the
danger colour under the offending field, the problem row's reason geometry
recoloured, the only invented UI in the initiative — and _Resolve_ / _Skip_ as
`prim.Button` `secondary` `sm`, since COMPONENT-SPEC §1 forbids one-off inline
controls. The container's `seedProblems` carries the six kinds and drops
`missing-file`. COMPONENT-SPEC gains the `ImportFlow` row's model and
`LibrarySection`. README and CLAUDE.md are amended on commit timing (matches
import during the run), no TMDB, and the seed's removal.

**The domain — `import-export/`, finally built.** Five units: `readSheet`
(`.xlsx`/`.csv` → rows via `exceljs`, the synonym table, pure over a buffer);
`titleKey` (pure: a title or folder name → its matching key); `matchRows`
(pure: rows × folder scans → matched, problems, unclaimed); `importRun` (the
state machine one run walks: scanning → importing → review); and
`createImporter`, the injected domain. `exceljs` over SheetJS: the latter's npm
package has been frozen since 2022 with open advisories.

**The synonym table.** Title (`title | name | movie | film`), year, genre(s)
(split on `,` `/` `;`), and optionally director, cast (`cast | actors`),
synopsis (`description | synopsis`), rating, watched. Case-insensitive on the
header. Only title is required; a sheet without it is a `400` on the sheet
field. The real sheet holds Title, Year and Genre today; the maintainer will
add rating, actors and description later, and the optional synonyms exist for
that day. Adding a synonym is one line.

**Scanning lives in `media/`** — CLAUDE.md's words for that domain are "folder
scanning … subtitle detection". `walkLibraryRoot(root)` → folder scans;
`scanMovieFolder(dir)` → `{ videos, poster, backdrop, subtitles }`;
`detectSubtitleLanguage(filename)` → one of the form's seven names. **The video
extension list lives in `scanMovieFolder`**, not in `uploadKinds`: that unit's
docblock argues the form's video slot must accept anything so `cannot-play` can
be a state the player draws, and a scanner deciding which folder is a film is a
different rule with a different reason. `Media` gains `copyIn(folder,
sourcePath)` on `fs.copyFile`, answering the **Stored path**.

**The importer.** `createImporter({ storage, media, playback })` exposes
`start`, `current`, `cancel`, `problem`, `resolve`, `dismiss`. One run at a
time, in memory — the **Current run**; a second start is `409`. The run, per
match: reserve folder → copy in video, poster, backdrop, each subtitle →
derived runtime → add movie; a throw removes the folder and files `failed`.
Scanning completes before importing. The library's titles are loaded once at
start for the already-in-library skip. Cancel aborts the in-flight copy, rolls
that folder back, keeps every added movie, discards the run.

**The wire.** Injected as the fifth router argument beside `playback` and
`media`; the router never learns there is a spreadsheet.

- `POST /api/import` `{ sheetPath, rootPath }` → `201 ImportRun` ·
  `400 { error, field: 'sheet' | 'root' }` · `409` while one runs
- `GET /api/import/current` → `200 ImportRun` · `404`
- `POST /api/import/current/cancel` → `204`
- `GET /api/import/current/problems/:id` → `200 ImportProblemDetail` · `404`
- `POST /api/import/current/problems/:id/resolve` — multipart, the form's own
  encoding → `201 Movie`
- `DELETE /api/import/current/problems/:id` → `204` · `404`

The resolve route parses its body with the same reader the movie routes use; a
found file arrives as the path field the edit route already carries for a
stored file, and the importer copies it only if it lies under the run's root —
the `mediaFilePath` boundary rule aimed at the Library root instead of the
managed one. Reusing `POST /api/movies` with a path field was ruled out: it
would make the general route accept arbitrary paths from anyone who can reach
it.

**Shared types.** `ImportPhase`, `LogKind`, `LogLine`, `ProblemKind`,
`ImportProblem`, `ImportRun` and `ImportProblemDetail` in the shared types
folder, re-exported from its barrel, so both build targets read one shape. The
snapshot carries `startedAt`, `found`, `total`, `done`, `matched`,
`currentItem`, the capped `log` and the `problems`; elapsed, percent and the
ETA are derived client-side in a pure `importView`, as the container computes
them (ETA after 20 done).

**Problems are data.** Six kinds, each a reason string and a dot colour:
`no-folder`, `ambiguous` (two reason strings), `no-video` (two), `no-row`,
`failed` — hard, not yet in the library — and `missing-meta`, soft, imported
with a `movieId`. The simulation's `missing-file` kind is dropped: subtitles
and posters are optional on the form this initiative shares its save with, and
a library with none would put every film into review. A missing optional file
is a **Warning line**. The list is data, so a new kind is a reason and a dot,
never a new surface.

**Transport is polling.** `GET /api/import/current` every 500 ms while the
phase is scanning or importing; one endpoint serves the live case and the
re-attach case; the log is capped at 80 lines so a snapshot stays small; jsdom
has no `EventSource` to drive. SSE was ruled out as a connection lifecycle for
nothing a snapshot doesn't give.

**The frontend.** `components/LogConsole` (mono lines by kind, pinned to the
bottom). Under `features/import-export/`: `ImportFlow` (the organism: owns
`useImportRun`, renders one of three steps), `ImportSetup`, `ImportProgress`,
`ImportReview`, the molecules `PhaseStepper`, `StatTile` and `ProblemRow`,
`useImportRun` (start, poll, cancel, skip), the pure `importView`, and the
feature's `api/` (start, current, cancel, problem, resolve, dismiss — one
caller each, so they stay here). `features/settings/LibrarySection` with
`ActionRow`. `pages/ImportPage` composes `MaintainerLayout` and `ImportFlow`.
`TextField` gains its `mono` prop and the `sheet` / `folder` glyphs the
prototype's enum already lists — log 11 Q7 said they arrive with ImportFlow.

**Import context on the form.** `MovieFormFile` gains a third kind,
`{ kind: 'found'; path; filename }` — an absolute path under the run's root.
The form's multipart encoding sends it as the path (a picked file still travels
as bytes; `stored` never occurs here). `useMovieForm` reads `?problem=` (and
`?movie=` beside it for the soft kind), fetches the detail, prefills, and
switches its save target and its labels; `FileField` shows a found file as it
shows a stored one. Back and _Skip this one_ land on `/import`; a save lands on
`/import`. A problem that no longer exists falls back to the plain Add context.

**Copy, never move.** One storage model; the originals survive a bad run;
cancel needs no undo. The disk cost is the maintainer's to plan —
`FAMILYFLIX_MEDIA_PATH` on the drive with room, the originals deleted by hand
once the library checks out. A "move when on the same volume" is a one-line
follow-up in `Media` if the real library turns out to have nowhere to be copied
to, not a redesign.

**No TMDB, and not by deferral.** The prototype has no key field, no
match-confirm step, no network state. What TMDB would add is an **Enrichment**
pass over an already-imported library — a future initiative with its own
prototype amendment, if ever. `tmdbId` stays null.

**The seed goes.** `server/src/db/seed/`, the `db:seed` script and the
paragraphs naming them, in the tracer-bullet commit — as CLAUDE.md has promised
since library-core. The importer's fixtures — a tiny sheet and folder tree
under its tests — fill a dev library from then on.

**Copy is fixed by the prototype.** Headlines "Scanning your library…" /
"Importing movies…"; stat lines "Found N movies so far" / "N of M imported";
"Elapsed m:ss" and "About m:ss left"; the log lines quoted in the stories;
tiles "matched confidently and imported" / "need your attention"; "Needs
attention"; "✓ All done" / "Every flagged movie has been handled."; "Finish —
go to library"; "Cancel import"; "Start import"; the banner "Resolving import ·
{title}"; "Save & continue" / "Skip this one"; the six reason strings.

**No schema change.** `backdropPath`, `watched`, `rating` and `tmdbId` already
exist on the row; the importer writes through `LibraryStorage.addMovie` as the
form does.

## Testing Decisions

A good test asserts **external behaviour** — what a URL answers, what is on
disk, what a pure function returns for a given input, what the screen shows —
never how it was reached. The precedent is `routes.test.ts`, whose header
states the rule outright: the seam is the endpoint over a real listener and a
real migrated `:memory:` database. **Every unit gets its co-located test**, as
the maintainer confirmed.

**The pure modules carry the most weight** — they are the heuristics that will
need tuning against the real folder names, and the easiest things in the
initiative to test:

- `readSheet`, over fixture buffers: an `.xlsx` and a `.csv` with the same
  rows read the same; headers found case-insensitively through every synonym;
  a Title/Year/Genre-only sheet; genres split on each separator; a row with
  no title skipped; a non-numeric year as no year; unrecognised columns
  ignored; no title column → the sheet error; empty sheet → no rows.
- `titleKey`: case, diacritics, dots and underscores, each trailing tail
  form, punctuation, collapsed spaces, and that a title and its folder spelling
  agree.
- `matchRows`, in the style of `choosePlaybackPath`'s table tests: one
  exact → matched; year disagreement → not a match; two exact → `ambiguous`
  with the first reason; prefix only → `ambiguous` with the second; none →
  `no-folder`; unclaimed → `no-row`; already-in-library skipped; the order of
  candidates.
- `detectSubtitleLanguage`: each tag form onto each of the seven names, and
  the English fallback.
- `importView`: headline and stat line per phase, percent, elapsed and the
  ETA gate at 20, thousands separators, dot colour per kind.

**The media seam**, against a real sandbox using `sandboxRoot`, in the style
of the existing `createMedia` groups: `walkLibraryRoot` finds a folder holding
a video and does not descend it, descends one holding none, tolerates an
unreadable directory; `scanMovieFolder` picks the named poster over the first
image, finds the backdrop, lists subtitles with languages, reports zero and
multiple videos; `copyIn` copies bytes into the movie folder and answers the
stored path, leaves the source untouched, refuses a source that does not
exist.

**The importer**, over `freshStorage` and a sandbox root with a fixture tree:
a two-film sheet and tree become two movies; the log's opening, per-folder,
found, per-match and complete lines; a match with no subtitle logs a warning
and imports; a genre-less row imports and files `missing-meta`; a folder with
two videos files `no-video`; a copy failure files `failed` and the folder is
gone; a second start while running throws; cancel keeps the added movies and
rolls back the in-flight folder; a re-run skips already-in-library rows;
`resolve` copies a found file under the root and refuses one outside it;
`dismiss` removes a problem and answers false for a missing one.

**The routes**, through `createApiRouter` the way `routes.test.ts` does, with
the importer injected: `POST /api/import` → `201` with the snapshot; a missing
sheet → `400` with `field: 'sheet'`; a missing root → `400` with
`field: 'root'`; a second start → `409`; `GET …/current` → `200` then `404`
after cancel; `cancel` → `204`; `problems/:id` → the detail and `404`; the
resolve route with a found path under the root → `201` and the file in the
managed directory; with a path outside the root → `400`; `DELETE
…/problems/:id` → `204` then `404`.

**The client calls**, in the style of `saveRating`'s tests against
`fakeResponse`: each sends the right method to the right route, resolves on its
success status, rejects on `500` and on a request that cannot be made;
`startImport` surfaces the `400`'s field.

**`useImportRun`**, with fake timers: starts and holds the snapshot; polls at
500 ms while scanning or importing and stops in review; re-attaches to a
current run on mount; a failed poll keeps the last snapshot; cancel returns to
setup with the field values kept; skip removes the row; a `409` shows the run
already there.

**The components**: `LogConsole` colours each kind and pins to the bottom on
new lines; `PhaseStepper` marks done, active and pending; `StatTile` and
`ProblemRow` carry their copy and the dot colour; `ImportSetup` gates the
button, shows the error line under the right field and clears it on edit;
`ImportProgress` shows headline, stat line, bar state, current item, elapsed
and ETA per snapshot; `ImportReview` lists problems, updates the tiles, shows
All done when empty, and Finish lands on `/`; `ImportFlow` renders one of
three steps per hook state; `LibrarySection`'s two rows land on their routes;
`ImportPage` composes the layout and Back lands on `/settings`.

**The form's import context**: `?problem=` fetches the detail and prefills
fields and slots as found files; the banner names the title and the other
candidates; the labels switch; Save posts to the resolve route with found paths
as text and picked files as bytes, then lands on `/import`; Skip dismisses and
lands on `/import`; the soft kind opens the Edit context and the PATCH is
followed by the dismiss; a gone problem falls back to Add. `movieFormData`
sends a found file as its path. `FileField` shows a found file by filename.

**`TextField`**: `mono` sets the mono family and size; `sheet` and `folder`
draw their glyphs.

**The seed test goes with the seed.**

No new frontend `test-support/` unit is anticipated; `sandboxRoot`,
`freshStorage`, `newMovie`, `fakeResponse`, `LocationProbe` and `makeMovie`
cover what is needed. The importer's fixture sheet and tree live under its own
test folder.

## Out of Scope

- **Export** — its own grill and initiative; the `⬇ Export to CSV` row arrives
  with it.
- **TMDB, or any network** — enrichment is a future initiative with its own
  prototype amendment, if ever.
- **Moving files instead of copying** — one storage model; a same-volume move
  is a one-line follow-up if ever needed.
- **A native folder dialog** — Electron's, later, behind the same field.
- **A chooser for ambiguous folders** — the first candidate prefills; the
  banner names the rest.
- **SSE or WebSockets** — polling one snapshot endpoint.
- **A persisted run** — a crash mid-run loses the log and the problem list,
  never a movie; the re-run is cheap because already-imported rows are
  skipped.
- **A snackbar for a backgrounded run** — the roadmap's "backgroundable
  import" ships here minus the snackbar; the snackbar system is 🔜.
- **Reviewing confident matches before commit** — README and CLAUDE.md are
  amended to say what the tile says.
- **Un-importing a resolved or matched row from review** — Delete exists.
- **The rest of the Settings shell** — Playback, Storage, About.
- **A rating-scale converter** — the sheet's rating is read on the column's
  0–10 scale; a sheet on another scale is a synonym-table follow-up when the
  column arrives.

## Further Notes

**Trade-offs accepted.** The run lives in memory: a crash mid-run loses the
log and the problem list (never a movie), and the maintainer re-runs — cheap
but not free for a 12 TB copy. The synonym table's optional columns are a guess
at headers nobody has typed yet; the first run against the real sheet, once it
grows, may need one line added. `ambiguous` prefills the first candidate rather
than offering a chooser, so a wrong first guess costs a Remove and a hand-pick.
The library root is walked once at start, so a folder added during a run is not
seen until the next.

**Phasing.** Six slices, each checkable by looking:

1. **Amend the prototype and the three documents.** Nothing in `src/` yet.
2. **The thinnest end-to-end slice.** `readSheet` (title + year + genres) →
   `titleKey` → `walkLibraryRoot` / `scanMovieFolder` → `matchRows` →
   `createImporter.start` with `copyIn` → `POST /api/import` +
   `GET /api/import/current` → `useImportRun` polling → `ImportFlow` with setup
   and a running step that is headline, stat line, bar and Cancel. A sheet and
   a folder of two films become two movies on the browse home. The seed goes
   in this commit.
3. **The console.** `LogConsole`, `PhaseStepper`, the current item, elapsed
   and ETA, warning lines for missing subtitle/poster, the 80-line cap.
4. **Review.** Problems recorded during the run; `ImportReview` with
   `StatTile`, `ProblemRow`, Skip, All done, Finish.
5. **Resolve.** `ImportProblemDetail`, the `found` file kind, the import
   context in `useMovieForm` and `MovieForm`, the resolve route with the
   under-root check, the soft kind through Edit.
6. **The entry and the edges.** `LibrarySection` on Settings, the `409`, the
   setup error line, the backdrop, the already-in-library skip, `no-row`,
   `TextField`'s `mono` and glyphs.

**What this hands on.** `components/LogConsole` and the `Modal` shell are what
the 🔜 Export dialog draws on. `Media.copyIn` and the under-root check are what
a same-volume move would replace in one line. The `found` file kind and the
resolve route are the only path-accepting surface in the app, and stay so.
`walkLibraryRoot` is what a native folder dialog would feed unchanged.

**What is now easy.** The save is the form's: one encoding, one field reader,
one folder sequence, so resolving a flagged row is the screen the maintainer
already knows. Every problem kind is a reason string and a dot, so the matcher
can grow kinds without the review screen changing. Scanning is a pure function
over the folder tree and matching a pure function over two lists — when the
real folder names surprise the heuristics, the fix is a table test and a line.

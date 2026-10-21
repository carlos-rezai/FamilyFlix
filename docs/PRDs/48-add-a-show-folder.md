> **Initiative:** `add-a-show-folder`
> **Design log:** `docs/design-logs/48-add-a-show-folder.md`
> **Issue:** #416 (the PRD, step 31)
> **Build order:** step 31, **Add a show folder**. It ships as thin slices (log 48, _Implementation Plan_), the prototype revision first.

## Problem Statement

Adding a show on the Movie form means adding its episodes one pick at a time. _＋ Add episode files_ opens a browser file dialog. Each video becomes an **Episode file row**, numbered from its filename alone. The save then streams every byte into FamilyFlix's own **Series folder**. A five-season show is five dialogs and a full copy of a drive's worth of video, even when the show already sits, neatly sorted into Season folders, inside one of my **Library folders**.

A movie is no better: the form always copies its video, though **Bulk import** has linked videos where they lie since log 41. So the one-title door costs disk space the bulk door doesn't.

Neither add records where its files came from either. A later **Scan folders** over the same files doesn't know the title is held, so it can import the same show or film a second time.

## Solution

**A whole show in one pick.** In the desktop app, the series add's Episodes section gains _＋ Add show folder_, before _＋ Add episode files_. I pick the show's folder (the parent of its Season folders, or a folder of tagged episodes). The server reads it by the **Folder scan**'s own rules and the form fills:

- a **Show folder row** above the episodes (_Show folder_, the path in mono, a ✕ that takes the folder's rows off the form);
- one **Episode file row** per video, in season then episode order, each numbered as a scan would number it, with its stem-matched subtitles as **Subtitle rows** in their detected languages;
- videos no rule could number, numbered by the **Numbering guess** the Series Resolve already uses, so every row is numbered and editable;
- an empty title, filled with the folder's **Title guess** (a typed title is never overwritten);
- one line when subtitles matched no episode: _2 subtitle files matched no episode._

A folder that is already a held series's **Show folder** is refused before any row lands: _Harbor and Vine is already in your library._ A folder that can't be read, or holds no video, is refused in one sentence. A second pick replaces the first folder's rows. Rows I added by hand with _＋ Add episode files_ stay.

**Link or copy, Link by default.** Both kinds of add, in the desktop app, draw the **Import mode** choice under the Files card, before the TMDB check: **Link** (record the video where it lies) or **Copy** (copy it into FamilyFlix). Link is chosen on every visit. It is only possible for a file inside a listed **Library folder**. For anything else, the Link card is disabled with _Only for files inside one of your library folders._ and Copy is chosen. Art and subtitles are always copied. A video I add by hand to a show is always copied.

**The scan knows what the form added.** A video found under a Library folder records its **Source folder** in both modes, so a later Scan folders reads the title as **Already in library**.

## User Stories

### Picking a show folder

1. As the maintainer, I want an _＋ Add show folder_ button in the series add's Episodes section, so that I can add a whole show in one pick.
2. As the maintainer, I want it drawn before _＋ Add episode files_, so that the whole-show path is the first thing I see.
3. As the maintainer, I want it to open the system folder dialog, so that I pick a folder the way I pick a Library folder.
4. As the maintainer, I want nothing to change when I cancel the dialog, so that a cancel is harmless.
5. As the maintainer, I want the button left out in a browser, so that I'm never offered a control that can't work there.
6. As the maintainer, I want the folder read by the same rules as Scan folders, so that the form and a scan never number one show two ways.
7. As the maintainer, I want a show with Season folders read season by season, a Season folder's number winning over the filename's, so that a mislabelled file still lands in its season.
8. As the maintainer, I want a folder of loose tagged episodes (`S01E01`) read as a show, so that a show without Season folders still works.
9. As the maintainer, I want a folder the scan would call a film read as a show anyway, its videos as unnumbered rows, so that the form respects that I said it's a show.

### What the pick puts on the form

10. As the maintainer, I want a Show folder row above the episodes, labelled _Show folder_ with the path in mono, so that I can see which folder I picked.
11. As the maintainer, I want one Episode file row per video, so that every episode in the folder is on the form.
12. As the maintainer, I want each row's season, episode number and tag title filled in, so that I don't type numbers the filename already carries.
13. As the maintainer, I want the rows in season then episode order, so that the list reads like the show.
14. As the maintainer, I want each episode's stem-matched subtitles added as Subtitle rows in their detected languages, so that subtitles come along without extra picks.
15. As the maintainer, I want videos no rule could number given the Numbering guess (the season from the folder, the episode from the Episode word, else the next free number), so that every row is numbered.
16. As the maintainer, I want every guessed number editable, so that I can fix a wrong guess before saving.
17. As the maintainer, I want two rows claiming one number refused by the form's existing gate, so that a clash is caught the way it always has been.
18. As the maintainer, I want a line under the episodes, _2 subtitle files matched no episode._, when subtitles matched nothing, so that I know some files were left behind.
19. As the maintainer, I want no such line when every subtitle matched, so that the form never says _0 subtitle files_.
20. As the maintainer, I want an empty title filled with the folder's Title guess, so that the show is named without typing.
21. As the maintainer, I want a title I already typed kept, so that a pick never overwrites my words.
22. As the maintainer, I want the folder's name read by the importer's title rule, so that the form and a scan name a show alike.

### A second pick, the ✕, and hand-added rows

23. As the maintainer, I want a second folder pick to replace the first folder's rows, so that a show has one Show folder.
24. As the maintainer, I want rows I added with _＋ Add episode files_ kept through a second pick, so that my hand-added episodes aren't lost.
25. As the maintainer, I want the Show folder row's ✕ to take the folder's rows off the form, so that I can undo a wrong pick.
26. As the maintainer, I want the ✕ to leave hand-added rows in place, so that it only undoes the pick.
27. As the maintainer, I want _＋ Add episode files_ still to work beside a picked folder, so that I can add an episode that lives elsewhere.

### Refusals of a pick

28. As the maintainer, I want a folder already held as a series's Show folder refused with _Harbor and Vine is already in your library._, so that I never add a show twice.
29. As the maintainer, I want that refusal to add no rows, so that nothing half-lands.
30. As the maintainer, I want an unreadable folder refused with _That folder can’t be read._, so that I know the pick failed.
31. As the maintainer, I want a folder with no videos refused with _There are no videos in that folder._, so that I know I picked the wrong one.
32. As the maintainer, I want a refusal shown under the form's buttons as a Refusal, so that it reads where the form's other refusals do.

### Link or copy on the form

33. As the maintainer, I want the Import mode choice on the movie add and the series add, so that both doors can link.
34. As the maintainer, I want it under the Files card, before the TMDB check, so that it sits with the files it governs.
35. As the maintainer, I want Link chosen on every visit, never remembered, so that the add matches Bulk import's default.
36. As the maintainer, I want the choice left out in a browser, where every add copies, so that I'm never offered a mode that can't work.
37. As the maintainer, I want the choice left out on an edit, a series edit and a Resolve, so that those keep their own rules.
38. As the maintainer, I want the Link card disabled with _Only for files inside one of your library folders._ when the video or show folder isn't under a listed Library folder, so that I know why Link isn't available.
39. As the maintainer, I want Copy chosen when Link is disabled, so that a save never fails on a mode that can't apply.
40. As the maintainer, I want Link re-enabled when I pick a video or folder that is under a Library folder, so that the choice follows the files.
41. As the maintainer, I want a movie's picked video checked against my Library folders the moment I pick it, so that the choice is right before I save.

### Saving a linked or copied add

42. As the maintainer, I want a linked movie saved with its video left where it lies, so that no disk space is spent on a second copy.
43. As the maintainer, I want a linked show saved with its folder's episodes left where they lie, so that a whole show adds in seconds.
44. As the maintainer, I want a copied show folder's episodes copied into the show's season folders by the server, so that Copy works without streaming every file through the browser.
45. As the maintainer, I want an episode I added by hand always copied, so that a file outside the folder never needs a link rule.
46. As the maintainer, I want art (poster, backdrop, stills, season posters) always copied, so that FamilyFlix owns its artwork as before.
47. As the maintainer, I want a folder row's subtitles copied by the server from their paths, so that subtitles follow the same rule as Bulk import's.
48. As the maintainer, I want a linked title to play from its original file, so that Link behaves like a Bulk-imported Linked video.
49. As the maintainer, I want a failed or refused save to remove FamilyFlix's reserved folder and never touch a linked file, so that a failed add leaves nothing behind and harms nothing of mine.
50. As the maintainer, I want _Adding…_ shown while the server copies a show, so that I know it is working (a progress bar stays out of scope).

### The scan and the form agree

51. As the maintainer, I want a show added from a folder under a Library folder to record that folder as its Show folder, so that a later Scan folders reads it as Already in library.
52. As the maintainer, I want a movie whose video lies under a Library folder to record its Source folder, so that a later scan doesn't import it twice.
53. As the maintainer, I want a Collection folder film to record its Source file too, so that the other films in that folder are still imported.
54. As the maintainer, I want the Source folder recorded in Copy as well as Link, so that a copied title isn't imported a second time either.
55. As the maintainer, I want a video picked from outside every Library folder to record nothing, so that the form claims no folder it doesn't know.

## Implementation Decisions

### The wire

- New shared type `ShowFolderRead`: the folder's absolute `path`, its `titleGuess`, the `libraryFolderId` it lies under or `null`, the `heldSeriesId` whose Show folder it already is or `null`, its `episodes` (season, number, tag title or `null`, absolute video path, and subtitles with path and language), its `unplaced` absolute video paths in scan order, and its `straySubtitles` count.
- `GET /api/show-folder?path=` → `200 ShowFolderRead`, or `400` with one sentence: _That folder can’t be read._ / _There are no videos in that folder._ A held folder is a `200` with `heldSeriesId` set; the form draws the refusal.
- `GET /api/library-folders/containing?path=` → `200 { libraryFolderId: string | null }`. The movie add asks it when a video is picked.
- `POST /api/movies` and `POST /api/series` gain a required `mode` field (`'link' | 'copy'`), travelling first. The field readers refuse a missing or unknown mode in one sentence, `importBody`'s precedent. A browser sends `copy`.
- What travels on Save:

  | Kind / file                 | Link                                    | Copy                                           |
  | --------------------------- | --------------------------------------- | ---------------------------------------------- |
  | Movie video, picked         | its path, as `videoPath`                | its bytes, as today                            |
  | Episode video, folder row   | its path, as the episode's `videoPath`  | its path; the server copies it into the season |
  | Episode video, picked row   | its bytes (a picked row is always Copy) | its bytes                                      |
  | Found subtitle (folder row) | its path; the server copies it          | the same                                       |
  | Poster, still, season art   | bytes, as today                         | the same                                       |

- A found path the form sends must be absolute and of the video (or subtitle) kinds of the file-kind list, else `400`. A Link path under no listed folder is `400` _Link needs a file inside one of your library folders._ The form never sends one.
- No migration: `library_folder_id`, `source_folder` and the Source file already exist.

### Server: `import-export/`

- **`readShowFolder`** (new, deep): given one absolute folder, the listed Library folders and the held series's Show folders, it walks the folder with `walkLibraryFolder` and groups it with `groupShows`, answering a `ShowFolderRead` or a refusal kind (`unreadable`, `empty`). A folder `groupShows` reads as a film (no Season folders, no tags) answers every video as Unplaced. The title guess is the importer's own rule on the folder's name. It is the only new reader; there is no second numbering rule.
- **`placeFoundVideo`** (new, extracted): the importer's private `linkedVideo` + `listedFolderOf` lifted out. `placeFoundVideo(folders, path, mode)` answers a Linked video `StoredVideo` (relative to its listed Library folder, by id) when the mode is Link and the path lies under a listed folder, else `null`. A caller copies on `null`. The importer, the Resolve and the two add routes all call it: one rule for a **Placed video**.
- **`createImporter`** gains a `readShowFolder(path)` member, so the route never learns there is a walk, and calls `placeFoundVideo` in place of its private helpers. Its behaviour is unchanged.
- The Source folder rule is the importer's existing `setSourceFolder`, reused by the add routes for every found video under a listed Library folder, in both modes: a series its Show folder; a film its folder, plus its Source file in a shared (Collection) folder.

### Server: routes

- `movieFormBody` and `seriesFormBody` read `mode`, a found `videoPath` for the movie, and found video and subtitle paths per episode, validating each as above.
- The add routes place each found video through `placeFoundVideo`. A `null` in Copy is a `Media.copyIn` into the reserved folder. Found subtitles are always copied in. They record the Source folder, and on any refusal or failure remove the reserved managed folder, never a linked file (log 41 Q15).
- The two reads are thin: parse the query, ask the importer or the folder list, respond.

### Electron shell

- The preload's Folder bridge gains `pathOf(file)`, the **Path bridge**, over Electron's `webUtils.getPathForFile`: the picked file's absolute path, `''` for a file with none. `FolderBridge` in the shared types gains the member. The video picker stays the `FilePicker` it is; there is no second, native video picker.

### Frontend

- **`ImportModeChoice` and `ChoiceCard` graduate to `src/components/`**, since a second feature now draws them (`EnrichCheckCard`'s precedent). Import setup, the Library folders page and the Export dialog import them from there. `ChoiceCard` gains `disabled`, and `ImportModeChoice` can disable Link with its line.
- **`SeriesFormFiles`** draws _＋ Add show folder_ (only when `folderBridge()` is not `null`), the Show folder row on `FileField`'s filled-row furniture (no new molecule), the stray line, and the Refusal for a held, unreadable or empty folder.
- **`useEpisodeList`** owns the pick: it calls `pickOne()`, reads the folder, and replaces the folder's rows (tagged as the folder's, so a second pick and the ✕ touch only them). Hand-added rows are kept.
- **`useMovieForm`** owns the mode (Link on every visit), its availability (the read's `libraryFolderId`, or the containing answer for a movie's picked video), the forced Copy when Link is unavailable, and the Title guess prefill of an empty title.
- **`formValues`**: `seriesResolveRows`' Numbering guess is extracted as `numberFoundRows`, called by the Series Resolve and the Show folder pick. The wire builder adds `mode`, a movie's found `videoPath` in Link, and folder rows' paths in both modes.
- **`api/`** (the movie form's own): `readShowFolder(path)` and `containingFolder(path)`, one caller each.
- The form's file slot kinds are unchanged. A folder row is a `found` **Found file**; a movie's video picked in the shell keeps its `File` and, when Link is chosen and available, travels as the path the Path bridge read.

### Prototype first (log 48 Q19)

- `feat.MovieForm.dc.html` gains _＋ Add show folder_, the Show folder row, the stray line, the held refusal, the Import mode choice on both kinds, and the disabled Link card with its line.
- `COMPONENT-SPEC.md` lists `ImportModeChoice` and `ChoiceCard` as molecules, with `ChoiceCard`'s `disabled`.

## Testing Decisions

- A good test drives a unit through its public surface: returned values for pure units, status and body for routes, rendered output and user events for components, returned state for hooks. It never reads internals. The wire is faked at `fetch` with `fakeResponse`. The Folder bridge is faked at `folderBridge()`. No test runs Electron.
- **`readShowFolder`** (over a temp folder tree):
  - Season folders numbered by folder;
  - loose tagged episodes;
  - a film-shaped folder answering every video as Unplaced;
  - stem-matched subtitles and their languages;
  - the stray count;
  - the Title guess;
  - `libraryFolderId` under a listed folder and `null` outside;
  - `heldSeriesId` for a held Show folder;
  - `unreadable` and `empty`.

  Prior art: `groupShows`' and `walkLibraryFolder`'s suites.

- **`placeFoundVideo`**: Link under a listed folder → a Linked video relative to it; Link outside every folder → `null`; Copy → `null`; the deepest listed folder chosen for nested ones. Prior art: the importer's linked-video tests, which keep passing unchanged as the regression check.
- **Routes**:
  - `GET /api/show-folder`: `200` read, `400` sentences, a held folder;
  - `GET /api/library-folders/containing`: inside and outside;
  - `POST /api/series` in Link: nothing copied, episodes play, the Show folder recorded;
  - `POST /api/series` in Copy: found rows copied into their seasons;
  - `POST /api/series` mixing found and picked rows;
  - `POST /api/movies` in Link with a found `videoPath`: Source folder and Source file recorded;
  - a missing or unknown `mode`, a relative or wrong-kind path, Link outside every folder → `400`;
  - a failed save removing the reserved folder and leaving the linked file;
  - a Folder scan after a linked form add reading the title as Already in library.

  Prior art: `routes.linkedVideo.test.ts`, the series add suites.

- **`numberFoundRows`**: the Series Resolve's existing numbering cases, now through the extracted unit, plus rows that continue after numbered ones. Prior art: `formValues`' suite.
- **`formValues` wire**: `mode` first; a movie's path in Link and bytes in Copy; folder rows' paths in both modes; picked rows' bytes always.
- **`useEpisodeList` / `useMovieForm`**:
  - a pick filling rows in order;
  - a second pick replacing only the folder's rows;
  - the ✕;
  - a held, unreadable or empty folder adding nothing;
  - the Title guess filling only an empty title;
  - Link by default, forced to Copy when unavailable, re-enabled by a later pick.
- **`SeriesFormFiles` / `MovieForm`**:
  - _＋ Add show folder_ drawn only with the bridge;
  - the Show folder row, the stray line and the refusals;
  - the choice drawn only on a shell add of either kind, never on an edit or Resolve;
  - the disabled Link card's line.

  Prior art: the series kind's form suites.

- **`ChoiceCard` / `ImportModeChoice`**: `disabled` not selectable and its line drawn. Prior art: their existing suites, moved with them.
- **Package smoke**: `pathOf` and a linked add from the real folder dialog are checked by hand in the installed app, `docs/release-checklist.md`.

## Out of Scope

- A film's folder picked whole, with its poster and subtitles autofilled. That stays Bulk import's.
- A show's poster or backdrop read from its folder. The importer reads none either; _Add and sync_ fills them.
- Link on the Edit job, the Series edit job or a Resolve (log 41 Q12 stands there: a held linked video stays linked, a fresh pick is copied, a Resolve follows its run).
- Linking art or subtitles (log 41 Q3).
- An upload or copy progress bar (log 29's shared debt).
- Listing a folder as a Library folder on the fly.
- `<input webkitdirectory>` or any client-side folder read.
- Remembering the Import mode between visits.

## Further Notes

- **The rule that changes:** log 41 Q12 kept the Movie form a Copy. This step reverses that for the add, deliberately: in the shell, the add links by default.
- **Glossary** (log 48 Q18), already in the glossary:
  - new: **Show folder pick**, **Show folder read**, **Show folder row**, **Path bridge**, **Placed video**;
  - amended: **Import mode**, **Movie form**, **Found file**, **Folder bridge**, **Title guess**.

  Never call an Episode link a "link"; say **Episode link** in full.

- **Trade-offs accepted:**
  - Link is only possible under a listed Library folder, so a show on a USB stick is copied, or its folder listed first.
  - A Copy of a show folder shows only _Adding…_ while the server copies.
  - Rows from _＋ Add episode files_ are always copies, beside linked ones.
  - The form now has three ways a file reaches the server (bytes, a held path, a found path) and a mode beside them.
- **Docs** (log 48 Q20): CLAUDE.md's _Movie form_ bullet (the form links by default, in the shell), README's step 31, and the glossary. Ticked ✅ only after the refactor.

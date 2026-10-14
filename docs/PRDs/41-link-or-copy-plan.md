# Plan: Link or copy — import a Library folder without copying its videos

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/339

Today every import copies every video into the **Managed media directory**,
so importing a Library folder doubles the disk and takes an hour. This
initiative adds an **Import mode** to every import: **Link** (the default) or
**Copy**. **Link** plays each video where it lies in its Library folder. Art
and subtitles are still copied, and so is everything a Sync writes. **Copy**
is the import as it is today.

## Running the phases

**Phase 0 is HITL and docs-only.** It amends the prototype before any code
draws it. `issue-loop` stops there so the maintainer can review the
amendment.

**Phases 1–7 run AFK under `issue-loop`**, in order. They are log 41's
_Implementation Plan_ slices 2–5, with three of them split:

- Slice 3 is split into Phase 2 (the video plays) and Phase 3 (the scan
  links).
- Slice 4 is split into Phase 4 (both starts) and Phase 5 (the review and
  the form).
- Slice 5 is split into Phase 6 (the `503`) and Phase 7 (the removal's
  `409`).

The docs (README, CLAUDE.md, the glossary) are log 41's slice 6. They are
not a phase here: they are ticked ✅ only after the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:

  | Route                                             | Answer                                                                               |
  | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
  | `POST /api/import { sheetPath, enrich, mode }`    | as today · `400` for a missing or unknown `mode`, a sentence                         |
  | `POST /api/library-folders/scan { enrich, mode }` | as today · `400` the same                                                            |
  | `DELETE /api/library-folders/:id`                 | `204` · `404` · `409 { error }` while a linked video plays from it                   |
  | the playback read and the stream, both kinds      | as today · `503 { error }` for an `unreachable` VideoFile, no path · `404` file gone |

  `importBody` reads `mode` on both starts, and the scan's body moves there.

- **Schema**:
  - **Migration 11**: `media_folder` on `movies` and `series`. It is the
    **Movie folder** or **Series folder**, relative to the Managed media
    directory, and is backfilled from a film's video directory and from any
    episode's path two directories up, the `__seed__/series/` prefix
    included.
  - **Migration 12**: `video_folder_id` on `movies` and `episodes`,
    referencing `library_folders(id)` with **no `ON DELETE`**. `NULL` means
    `video_path` is a **Stored path**. Set, it means `video_path` is relative
    to that Library folder with forward slashes: a **Linked video**. A path
    is never absolute on either side.

- **Key models** (shared by both build targets):
  - `IMPORT_MODES = ['link', 'copy'] as const` and `ImportMode`. Link is the
    default.
  - `ImportRun.mode`.
  - `Movie.videoFolderId` and `Episode.videoFolderId`, `string | null`.
  - `StoredVideo = { videoPath, videoFolderId }` addresses a **Playable**'s
    video.
  - `VideoFile` is `file` (with the open path), `missing` or `unreachable`.
    It is a value, never a throw.

- **Boundaries**:
  - Only the video is linked. Images, subtitles, every art write, the
    **Write targets** and the **Export** stay on Stored paths.
  - `linkedVideoPath` in `playback/` refuses an absolute path, then any kind
    that isn't a video, then hands the rest to `mediaFilePath`'s containment.
  - `createPlayback(mediaPath, slot, libraryFolderPath)` takes a reader,
    `(id) => string | null`, composed in `main.ts` over `storage`.
  - No route learns there are two roots.
  - A title's managed folder is read through `storage.mediaFolderOf(kind,
id)`. It is never on the wire.
  - `removeFile` is never handed a linked path, and the app never deletes,
    moves or writes a linked video.

- **Unchanged throughout**:
  - The Movie form copies.
  - **Already in library** never changes a held title's mode.
  - The Activity log's lines.
  - The Delete and Reset dialogs' copy.
  - The Write targets and the Export.

---

## Phase 0: Prototype amendment (HITL)

**User stories**: the surface of 1–9, 32 and 42–44

### What to build

The amendments, in `docs/handoff/`:

- **`feat.ImportFlow`'s setup.** The _Files_ choice, **Link** and **Copy**,
  above the _Also fetch from TMDB_ box. Link is chosen, and each card has
  its line from user stories 3 and 4.
- **`page.LibraryFoldersPage`.** The same choice above **Scan folders**, and
  a Folder row's removal refusal in danger ink under the row.
- **`FamilyFlix.dc.html`'s notice copy.** The `unreachable` notice:
  **Can’t reach this film’s folder** and its line.
- **`COMPONENT-SPEC.md`.** `ImportModeChoice`, and `ChoiceCard` in
  `FormatCard`'s place.

### Acceptance criteria

- [ ] Setup and the folders page both draw the choice, with Link chosen.
- [ ] The Export dialog's Format cards draw as before, as `ChoiceCard`.
- [ ] The Folder row's refusal and the player's `unreachable` notice are
      drawn with their copy.
- [ ] `COMPONENT-SPEC.md` lists `ImportModeChoice` and `ChoiceCard`.
- [ ] The maintainer has reviewed the amendment before Phase 1 starts.

---

## Phase 1: The recorded folder

**User stories**: 30, 31, 37, 41

### What to build

Behaviour doesn't change in this phase: every title's managed folder is
recorded, and the media domain finds it there instead of reading it off the
video.

- **Migration 11** and its backfill, for films, series, seeded series, and a
  series with no episodes.
- **`storage.mediaFolderOf(kind, id)`.**
- **`Media` onto the recorded folder:**
  - `storeNamed(folder, name, source)` takes over Season posters too, and
    `storeInSeriesFolder` folds into it.
  - A Still goes into `seasonFolder(mediaFolder, n)`.
  - `openFolder(folder)` absorbs `openSeriesFolder`.
  - `removeTitleFolder(folder)` replaces `removeMovieFolder` and
    `removeSeriesFolder`.
  - Each still checks containment.
- **Callers moved onto it:** the importer, the routes and
  `createEnrichment`. Every title they insert records its `media_folder`.

### Acceptance criteria

- [ ] Migration 11 backfills a film, a series, a seeded series, and leaves a
      series with no episodes sensibly recorded.
- [ ] A film added by the form, the importer or a series add records its
      `media_folder`.
- [ ] `storeNamed`, `openFolder` and `removeTitleFolder` work over the
      recorded folder and refuse a folder outside the media root.
- [ ] Delete removes the recorded folder, for a film and for a series.
- [ ] A Sync's poster, backdrop, Still and Season poster land in the
      recorded folder.
- [ ] Every existing suite stays green.

---

## Phase 2: A linked video plays

**User stories**: 26–29, 33, 37–39

### What to build

The playback side of a Linked video, proven over rows a test writes. Nothing
imports one yet.

- **Migration 12.**
- `videoFolderId` on `Movie` and `Episode`.
- **`StoredVideo`.**
- **`linkedVideoPath(folderPath, videoPath)`.**
- **`createPlayback`'s Library folder reader**, composed in `main.ts`.
- **`videoFile(StoredVideo) → VideoFile`**, answering `file` or `missing`.
- `derivedRuntime` and every route that reads a video's bytes take the
  `StoredVideo`.
- **Delete and Factory reset** never touch a linked video.

### Acceptance criteria

- [ ] `linkedVideoPath`'s sandbox suite covers:
  - a video inside the folder;
  - an absolute path, a `..` escape, and a symlink out;
  - a `.jpg`, a `.srt` and an `.exe`;
  - a missing file.
- [ ] `videoFile` answers `file` for a managed video and for a linked one,
      and `missing` for an unknown folder id and for a missing file under
      either root.
- [ ] Migration 12 leaves `video_folder_id` `NULL` on every existing row,
      and the foreign key refuses deleting a folder a row references.
- [ ] A linked film and a linked episode stream end to end over
      `fixtureVideo`. A linked `.mkv` takes the remux path as a copied one
      does.
- [ ] Subtitles on a linked title read from the managed folder as before.
- [ ] After Delete and after Factory reset, the linked video is still on
      disk.
- [ ] A managed file that shares a linked video's relative path is never
      removed in its place.

---

## Phase 3: A Folder scan links

**User stories**: 1–10, 12–19

### What to build

The **Import mode** end to end on the Library folders page.

- `IMPORT_MODES` and `ImportMode`, and `ImportRun.mode` on the snapshot.
- `importBody` reads the scan's body, `mode` included, and refuses a missing
  or unknown mode in a sentence.
- `scan(enrich, mode)`. Under Link, a found film records
  `{ videoFolderId, videoPath }` where Copy would `copyIn`. Everything else
  is unchanged: the folder is still reserved, art and subtitles copied, the
  runtime derived, and the Source folder and Source file recorded. A
  rollback still removes the reserved folder.
- **Client:**
  - `FormatCard` is renamed `ChoiceCard`, and the Export dialog draws it
    unchanged.
  - `ImportModeChoice` is new: the _Files_ caption over two `ChoiceCard`s
    in a `radiogroup`.
  - `LibraryFolders` draws it above **Scan folders**, at `'link'` on every
    mount.
  - `useFolderScan` posts `mode`.

### Acceptance criteria

- [ ] A Link scan adds a film with no video in its managed folder. Its art
      and subtitles are copied, its runtime is read, its Source folder is
      recorded, and it plays.
- [ ] A Copy scan behaves exactly as today.
- [ ] `ImportRun.mode` is on the snapshot.
- [ ] A re-run in the other mode changes nothing.
- [ ] A cancelled Link run rolls back its reserved folder.
- [ ] The scan refuses a missing or unknown `mode` with `400` and a
      sentence.
- [ ] `ChoiceCard` keeps `FormatCard`'s suite.
- [ ] `ImportModeChoice`'s suite covers radiogroup semantics, the two lines,
      and Link chosen.
- [ ] The folders page draws the choice above **Scan folders**, Link on
      every mount, and the scan posts the chosen mode.

---

## Phase 4: Every start links — shows and the sheet

**User stories**: 1, 9, 11, 18, 25, 52

### What to build

The mode reaches a show's episodes and the sheet start.

- `importShow` follows `ImportRun.mode`: under Link, each episode records a
  Linked video.
- `start(sheetPath, enrich, mode)`, with `importBody`'s `400` on `mode`.
- **Import setup** draws `ImportModeChoice` above _Also fetch_, Link on
  every mount, and `useImportRun`'s start posts it.
- A re-attached run carries its mode.

### Acceptance criteria

- [ ] A Link scan adds a show over `seriesFixture` with no episode video
      copied, and every episode plays.
- [ ] A Link sheet run links its films and shows, and a Copy sheet run
      copies them.
- [ ] The sheet start refuses a missing or unknown `mode` with `400` and a
      sentence.
- [ ] A held show that gains a new episode on a re-run adds it in the run's
      mode, and its held episodes keep theirs.
- [ ] Import setup draws the choice above _Also fetch_, Link on every
      mount, and the start posts the chosen mode.

---

## Phase 5: The review and the form follow the run

**User stories**: 20–24, 40, 47–49

### What to build

- The **Folder picker**, _Import as_, and the Found files of a film
  **Resolve** and a **Series Resolve** all follow `ImportRun.mode`.
- A freshly picked file in a Resolve is copied.
- **The Movie form's edit:**
  - A held linked video travels back as its path and stays linked.
  - A freshly picked video replaces it as a copy, and the linked file is
    not removed.
  - The **Series edit job** works the same per episode, renumbered or not.
    Added episodes are copied.

### Acceptance criteria

- [ ] In a Link run, the Folder picker and _Import as_ add the title linked.
      In a Copy run, they copy it.
- [ ] A film Resolve's Found file and a Series Resolve's Found files follow
      the run's mode. A freshly picked file is copied either way.
- [ ] A title-only edit of a linked film keeps it linked and copies nothing.
- [ ] Picking a new video for a linked film copies it, and the linked file is
      still on disk.
- [ ] A series edit keeps held linked episodes linked, renumbered or not, and
      copies the episodes it adds.

---

## Phase 6: An unreachable folder

**User stories**: 32, 34–36

### What to build

- `videoFile` answers `unreachable` for a linked video whose Library folder
  `readableFolder` doesn't read as `readable`.
- The playback read and the stream answer `503 { error }` for it, with no
  path in the body. `404` still means the file is gone.
- **`PlayerNotice`** gains `unreachable`, a peer of the three in
  `UNAVAILABLE`, with user story 32's copy.
- **`useOpeningReads`** maps a `503` onto `unreachable`.
- The detail pages draw nothing new.

### Acceptance criteria

- [ ] `videoFile` answers `unreachable` for a linked video whose folder is
      missing.
- [ ] The playback read and the stream answer `503` with no path for an
      unreachable folder, and `404` for a missing file in a reachable one,
      for a film and an episode.
- [ ] The video plays again once its folder is back, with nothing cached.
- [ ] `PlayerNotice` draws **Can’t reach this film’s folder** and its line.
- [ ] The player shows it for a `503`, and still shows _file missing_ for a
      `404`.

---

## Phase 7: A folder in use can't be removed

**User stories**: 42–46

### What to build

- `DELETE /api/library-folders/:id` answers `409 { error }` while any linked
  video plays from the folder: _N titles play from this folder. Delete them
  before removing it._, singular at one. The count is films plus series with
  a linked episode there.
- **`useLibraryFolders`'s remove** keeps the route's sentence, as its add
  does.
- **The Folder row** draws the sentence as the 13px `danger` Refusal under
  that row.

### Acceptance criteria

- [ ] Removing a folder with linked titles answers `409` with the plural
      sentence, and with the singular one at one title.
- [ ] A series with several linked episodes there counts as one title.
- [ ] A folder whose titles were all copied is removed with `204`, and its
      titles are kept.
- [ ] The page draws the refusal under the row it was about, and the folder
      stays listed.

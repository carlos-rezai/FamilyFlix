> **Initiative:** `link-or-copy`
> **Design log:** `docs/design-logs/41-link-or-copy.md`
> **Issue:** #339 (the PRD, step 24)
> **Build order:** step 24, the first after Import review. It ships as five thin slices (log 41, _Implementation Plan_). Step 25, **Review at scale + Season art**, is not touched

## Problem Statement

I imported five real series from my Library folders, 3 to 8 seasons each, and it was slow and doubled my disk. Every import copies every video into FamilyFlix's own media folder. That made sense when the files came from a browser picker or from folders I was about to throw away. My Library folders are neither: I listed them, the app rescans them, and they are staying. So the app spends an hour copying terabytes I already have, onto the same drive, so that it can play a second copy of each film.

## Solution

Every import now offers an **Import mode**: **Link** or **Copy**, with **Link** chosen by default.

- **Link** plays each video where it lies in its Library folder. No video is copied. A title's poster, backdrop and subtitles are still copied into its own managed folder, as today, and everything a TMDB Sync writes stays there too. Those are kilobytes; the video is all the bytes.
- **Copy** is the import as it is today: FamilyFlix keeps its own copy, playable with the drive unplugged.

I choose the mode on both ways in: Import setup (_Import from spreadsheet_) and the Library folders page (above **Scan folders**). It is a choice for this run, not a setting, so it is back on **Link** every visit. Every title the run imports follows it, including the ones I settle in the review.

A linked file is never deleted by the app: deleting a title or a factory reset removes only FamilyFlix's own folder. If the drive with a Library folder is unplugged, the player says _Can’t reach this film’s folder_ rather than _file missing_. And I can't remove a Library folder that linked titles still play from: the app tells me in one sentence how many titles play from it.

The Movie form still copies. A file in a Library folder is added by **Scan folders**, which links it; the form is for a file from anywhere else.

## User Stories

### Choosing the mode

1. As the maintainer, I want Import setup to show a _Files_ choice of **Link** or **Copy**, so that I decide whether a run copies my videos.
2. As the maintainer, I want the same choice above **Scan folders** on the Library folders page, so that a sheetless import offers it too.
3. As the maintainer, I want **Link** to read _Play videos where they are. Nothing is copied._, so that I know what it does.
4. As the maintainer, I want **Copy** to read _Keep FamilyFlix’s own copy, playable with the drive unplugged._, so that I know when to pick it.
5. As the maintainer, I want **Link** chosen whenever I open either screen, so that the fast, space-saving import is the default.
6. As the maintainer, I want my last choice not remembered, so that choosing Copy for one run (I'm about to unplug a drive) doesn't silently copy the next.
7. As the maintainer, I want the two cards to work as a radio group by keyboard and screen reader, so that the choice is as accessible as the Export dialog's Format cards.
8. As the maintainer, I want the Export dialog's Format cards to look and behave exactly as before, so that sharing the card with the import changes nothing I see there.
9. As the maintainer, I want the choice placed above the _Also fetch from TMDB_ box on setup and above **Scan folders** on the folders page, so that it sits with the other options for the run.

### A run in Link mode

10. As the maintainer, I want a Link run to add each film without copying its video, so that a large import costs the time to read the folders, not to copy them.
11. As the maintainer, I want a Link run to add each show's episodes without copying them, so that importing a whole series is fast.
12. As the maintainer, I want a linked title's poster, backdrop and subtitles still copied into FamilyFlix's own folder, so that its art and subtitles behave as every other title's.
13. As the maintainer, I want a linked title's runtime still read off its video, so that its detail page shows a runtime as a copied one does.
14. As the maintainer, I want a linked title's Source folder and Source file still recorded, so that the next scan recognises it as **Already in library**.
15. As the maintainer, I want a Link run's progress, bar, ETA and Activity log to read as today, so that the run looks the same whichever mode I chose.
16. As the maintainer, I want a run in Link mode to be cancellable as today, with a title half-added rolled back, so that cancelling never leaves a broken title.
17. As the maintainer, I want a title already in the library to keep its mode on a re-run in the other mode, so that a re-run never moves or duplicates a video.
18. As the maintainer, I want a sheet run and a Folder scan to follow the mode alike, so that both imports behave the same.

### A run in Copy mode

19. As the maintainer, I want a Copy run to do exactly what every import did before, so that I can still keep a copy of a drive I'm about to unplug.

### The review follows the run

20. As the maintainer, I want the **Folder picker** on an `ambiguous` row to link or copy as the run was started, so that a title settled in review is added like its neighbours.
21. As the maintainer, I want _Import as_ on a `no-row` row to follow the run's mode, so that it adds the folder as the scan would have.
22. As the maintainer, I want a film **Resolve**'s Found file to follow the run's mode, so that choosing among a folder's videos doesn't force a copy.
23. As the maintainer, I want a **Series Resolve**'s Found files to follow the run's mode, so that numbering a show's files doesn't force a copy.
24. As the maintainer, I want a file I pick freshly in a Resolve to be copied, so that a file from outside my Library folders is kept by the app.
25. As the maintainer, I want a run I re-attach to still know its mode, so that its review's presses follow it after I come back to the screen.

### Playing a linked title

26. As a family member, I want a linked film to play exactly as a copied one does, so that I never need to know which it is.
27. As a family member, I want a linked episode to play, resume and offer Up next as a copied one does, so that a linked series watches the same.
28. As a family member, I want a linked `.mkv` or `.avi` remuxed or transcoded as a copied one is, so that every format that played before still plays.
29. As a family member, I want subtitles on a linked title to work as before, so that its copied subtitles show over its linked video.
30. As the maintainer, I want my library to hold linked and copied titles side by side, and a series to hold both kinds of episode, so that nothing I imported before has to change.
31. As the maintainer, I want every title I copied before this to keep playing untouched, so that the change costs me nothing.

### When the folder can't be reached

32. As a family member, I want the player to say **Can’t reach this film’s folder** — _It plays from one of your library folders, which can’t be reached right now — most likely a drive that isn’t plugged in._ — when its drive is unplugged, so that I know to plug it in rather than think the film is gone.
33. As a family member, I want a linked file that was moved or deleted to show the usual _file missing_ notice, so that the two situations read differently.
34. As a family member, I want the detail page to look the same whether or not the drive is plugged in, so that browsing doesn't wait on a drive.
35. As the maintainer, I want an unplugged folder to read _Can’t be reached right now_ on its Folder row as today, so that I can see which drive to plug in.
36. As the maintainer, I want a linked title to play again the moment its drive is back, so that nothing needs fixing afterwards.

### Never touching my files

37. As the maintainer, I want deleting a linked title to remove only FamilyFlix's own folder for it, so that my original video stays where it is.
38. As the maintainer, I want the Delete dialog's _The original files are not touched._ to stay true for a linked title, so that the dialog never lies.
39. As the maintainer, I want a factory reset to erase the library and empty FamilyFlix's media folder without touching any linked video, so that _Your library folders and every file in them_ stays true.
40. As the maintainer, I want replacing a linked title's video in the edit form to copy the new file and leave the linked one on disk, so that an edit never deletes my files.
41. As the maintainer, I want a file in FamilyFlix's media folder that happens to share a linked video's relative name never removed in its place, so that the two roots are never confused.

### Removing a Library folder

42. As the maintainer, I want removing a Library folder that linked titles play from refused with _12 titles play from this folder. Delete them before removing it._, so that one ✕ never makes titles unplayable or deletes watch history.
43. As the maintainer, I want the sentence singular for one title (_1 title plays from this folder…_), so that it reads correctly.
44. As the maintainer, I want the refusal drawn in danger ink under that folder's row, so that I see which folder it was about.
45. As the maintainer, I want a series with linked episodes in the folder counted as one title, so that the count matches what I see in the library.
46. As the maintainer, I want removing a folder whose titles were all copied to work as today, keeping its titles, so that Copy titles never block a removal.

### Editing

47. As the maintainer, I want a title-only edit of a linked film to keep it linked, so that fixing a typo never copies a 12 GB file.
48. As the maintainer, I want a series edit to keep each held linked episode linked, renumbered or not, so that numbering a show never copies it.
49. As the maintainer, I want episodes I add in a series edit copied, so that a file from outside the folders is kept by the app.

### TMDB

50. As the maintainer, I want a Sync's poster, backdrop, Stills and Season posters written into a linked title's own managed folder, so that enrichment works for linked titles as for copied ones.
51. As the maintainer, I want the Write targets and the Export unchanged, so that linking changes nothing I write into my folders.

### Starting a run (API)

52. As the maintainer, I want a start with no mode, or an unknown one, refused in one sentence, so that a stale client can't start a run that guesses.

## Implementation Decisions

### Prototype first

The first slice amends the prototype, per _The prototype is the spec_: `feat.ImportFlow` (the **Import mode** choice on setup, above the _Also fetch_ box), `page.LibraryFoldersPage` (the choice above **Scan folders**, and a Folder row's removal refusal), `FamilyFlix.dc.html`'s notice copy (the `unreachable` notice), and `COMPONENT-SPEC.md` (`ImportModeChoice`, and `ChoiceCard` in `FormatCard`'s place). Nothing is built until it lands.

### What is linked, and how it is stored

- **Only the video is linked** (log 41 Q3). Every other path stays a **Stored path**: images, subtitles, the Export's reads and every art write are untouched.
- **The mode is a property of each video** (Q4): a film's, and each episode's. A library can be mixed; a series can hold linked and copied episodes.
- **Migration 11** adds `media_folder` to `movies` and `series`: the title's **Movie folder** or **Series folder**, relative to the **Managed media directory**, **backfilled** from a film's video directory and from any episode's path two directories up (the `__seed__/series/` prefix included).
- **Migration 12** adds `video_folder_id` to `movies` and `episodes`, a reference to `library_folders(id)` with **no `ON DELETE`**. `NULL` (every existing row) means `video_path` is a Stored path. Set, it means `video_path` is relative to that Library folder, with forward slashes: a **Linked video**. Never absolute on either side.
- `Movie` and `Episode` carry `videoFolderId: string | null`. A **Playable**'s video is addressed by **`StoredVideo`** = `{ videoPath, videoFolderId }`, shared by both build targets.
- The Media folder is read server-side through a new `storage.mediaFolderOf(kind, id)`, `titleSource`'s precedent. It is not on the wire.

### The media domain finds a title's folder by `media_folder`

Every `Media` member that read a title's folder off its video now takes the recorded folder, one reading for every title (Q6):

- `storeNamed(folder, name, source)`, a Season poster's too; `storeInSeriesFolder` goes, folded into it. A Still goes into `seasonFolder(mediaFolder, n)`.
- `openFolder(folder)`, `openSeriesFolder` folded in.
- `removeTitleFolder(folder)` replaces `removeMovieFolder` and `removeSeriesFolder`.
- Each still checks containment through `containedFolder`, the `mediaFilePath` rule.
- `removeFile` is never handed a linked path: its callers check `videoFolderId` first.
- The importer, the routes and `createEnrichment` move onto the recorded folder. This slice changes no behaviour: every existing suite passes over it.

### The linked boundary (`playback/`)

- **`linkedVideoPath(folderPath, videoPath) → string | null`** is a new unit (Q7). It refuses an absolute path, then anything but a **video** kind of `fileKinds` (a Library folder is not the app's, so the row may name only a video), then hands the rest to `mediaFilePath(folderPath, videoPath)` for realpath containment and the file. The rule is reused, never spelled again. A symlink out, a `..` that leaves the folder, or a missing file all answer `null`.
- **`createPlayback(mediaPath, slot, libraryFolderPath)`** takes a reader, `(id) => string | null`, composed in `main.ts` over `storage` the way `slot` is (Q8).
- **`videoFile(video: StoredVideo) → VideoFile`** replaces `videoFile(storedPath) → string | null`. It answers a value, never a throw:
  - `file` with the open path;
  - `missing` for everything `null` meant before;
  - `unreachable` when the video is linked and `readableFolder` doesn't read its Library folder as `readable`.
- `subtitleFile` is unchanged. `derivedRuntime` and every route that reads a video's bytes take the `StoredVideo`. No route learns there are two roots.

### The import mode

- `IMPORT_MODES = ['link', 'copy'] as const` and `ImportMode` live in the shared import types, `SHEET_FIELDS`' precedent. **Link** is the default.
- `ImportRun` gains `mode`, `enrich`'s precedent, so a re-attached screen and the review's presses know it.
- `start(sheetPath, enrich, mode)` and `scan(enrich, mode)`.
- Every import of a found video in the run follows `ImportRun.mode`: `importMatch`, `importShow`, the **Folder picker**, _Import as_, and the Found files of a film Resolve or a Series Resolve. A freshly picked file in a Resolve is copied.
- **Link changes one call** (Q14). Where a Copy run would `copyIn` a video, a Link run records `{ videoFolderId: libraryFolder.id, videoPath: <relative, posix> }`. Everything else is unchanged: the folder is still reserved, art and subtitles copied, the runtime derived, and the Source folder and Source file recorded. The rollback on a throw or a cancel removes the reserved folder as today.
- **Already in library** is untouched: a held title never changes mode on a re-run. The Activity log's lines don't change.

### The Movie form

The form still copies (Q12). On an **edit**, a held linked video travels back as its path and stays linked. A freshly picked video replaces it as a copy, and the linked file is not removed. The **Series edit job** works the same per episode, and added episodes are copied.

### Delete, reset, and removing a folder

- **Delete** removes the row, then `removeTitleFolder(media_folder)`. Nothing is asked to remove a linked video. **Factory reset** is unchanged: it empties the Managed media directory and erases the rows. Neither dialog's copy changes (Q15).
- **`DELETE /api/library-folders/:id`** answers `409 { error }` while any linked video plays from the folder: _N titles play from this folder. Delete them before removing it._, singular at one. The count is films plus series with a linked video there. The missing `ON DELETE` makes the database refuse too (Q16).

### Routes

| Route                                             | Answer                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/import { sheetPath, enrich, mode }`    | as today; `400` for a missing or unknown `mode`, a sentence                                  |
| `POST /api/library-folders/scan { enrich, mode }` | as today; `400` the same                                                                     |
| `DELETE /api/library-folders/:id`                 | `204` · `404` · **`409 { error }` while a linked video plays from it**                       |
| the playback read and the stream, both kinds      | as today; **`503 { error }` for an `unreachable` VideoFile**; `404` stays _the file is gone_ |

- `mode` is read by `importBody`, each `400` a sentence. The scan's body moves there too.
- The `503` body carries no path.

### Client

- **`ChoiceCard`** is `FormatCard` renamed on its second caller, in the same feature. The Export dialog draws it unchanged.
- **`ImportModeChoice`** is a new molecule in `features/import-export/`, `EnrichCheckCard`'s precedent: the _Files_ caption over the two `ChoiceCard`s in a `radiogroup`. It is drawn by `ImportSetup` above the _Also fetch_ box, and by `LibraryFolders` above **Scan folders**.
- `ImportFlow` and `LibraryFolders` hold the mode at `'link'` on every mount. `useImportRun`'s start and `useFolderScan` post it.
- `useLibraryFolders`'s remove keeps the route's `409` sentence, as its add does. It is drawn as the 13px `danger` **Refusal** under that **Folder row**.
- **`PlayerNotice`** gains `unreachable`, a peer of the three in `UNAVAILABLE`, with the copy in user story 32 and no new prop. `useOpeningReads` maps a `503` onto it. The detail pages draw nothing new.

### Rules amended (Q9)

- _All file paths are stored as relative paths under the managed media directory_ becomes _relative to the managed media directory, or (for a **Linked video**) to its **Library folder**, by id; never absolute_.
- A Library folder is no longer _never served from_: `playback/` streams its videos, read-only.
- Nothing writes into a Library folder that didn't before.
- _Only `media/` touches managed storage_ stands: a linked video is not managed storage.

### Slices (log 41, _Implementation Plan_)

1. **Prototype.**
2. **The recorded folder.** Migration 11 and its backfill; `Media` onto `media_folder`; `storeInSeriesFolder` and the two removals folded; the importer, routes and `createEnrichment` moved onto it. No behaviour changes.
3. **A linked film plays.** Migration 12, `StoredVideo`, `linkedVideoPath`, `VideoFile`, the folder reader in `main.ts`; `mode` on the Folder scan's body and run; `ImportModeChoice` and `ChoiceCard` on the Library folders page.
4. **Everywhere a run imports.** `importShow`, the sheet start and Import setup's choice; the Folder picker, _Import as_ and both Resolves following the run; the form's edit keeping a held linked video linked.
5. **When the folder is gone.** The `503` and the `unreachable` notice; the removal's `409` and its refusal under the Folder row.
6. **Docs.** CLAUDE.md, README and the glossary per Q21, ticked ✅ only after the refactor.

## Testing Decisions

A good test drives a unit through its public surface and asserts what a caller sees: a run's snapshot and the library's records afterwards, what is (and is not) on disk, a route's status and body, what a screen draws and what a press posts. It never asserts how the importer's closures are arranged or which `Media` member was called.

- **`linkedVideoPath`** gets a pure-ish sandbox suite, `mediaFilePath`'s prior art:
  - a video inside the folder;
  - an absolute path, a `..` escape, and a symlink out;
  - a non-video kind (a `.jpg`, a `.srt`, an `.exe`);
  - a missing file.
- **`createPlayback.videoFile`** covers a managed video, a linked one, a linked one whose folder is unreadable (`unreachable`), an unknown folder id, and a missing file under each root. `fixedSlot` is the prior art for the slot.
- **Migrations 11 and 12** get the migration suites' prior art: the backfill for a film, a series (seed prefix included), and a series with no episodes; `video_folder_id` `NULL` on every existing row; the foreign key refusing a folder delete.
- **`createMedia`** suites move onto the recorded folder (`storeNamed`, `openFolder`, `removeTitleFolder`, containment refused). A test holds that a managed file sharing a linked video's relative path is never removed in its place.
- **`createImporter`**, over `libraryFixture` and `seriesFixture` in a sandbox (the folder-scan suite's prior art):
  - a Link scan adds a film and a show with no video in the Media folder and the art copied;
  - a Copy scan behaves as today;
  - a sheet run follows the mode;
  - `ImportRun.mode` is on the snapshot;
  - the Folder picker, _Import as_ and both Resolves follow it, and a freshly picked file is copied;
  - a re-run in the other mode changes nothing;
  - a cancelled Link run rolls back its folder.
- **Delete and Factory reset**: the linked file is still on disk afterwards.
- **Edit**: a title-only edit keeps a linked film linked, and a picked video replaces it as a copy, leaving the linked file.
- **Routes**:
  - `importBody`'s `mode` refusals on both starts;
  - the folder removal's `409` sentence, plural and singular, and `204` for a copied-only folder;
  - the playback read's and the stream's `503` and `404`;
  - a linked film streamed end to end over `fixtureVideo`.

  The existing `routes.import`, `routes.libraryFolders` and playback route suites are the prior art.

- **Client**, with Testing Library and `fakeResponse`:
  - `ChoiceCard` keeps `FormatCard`'s suite under its new name;
  - `ImportModeChoice` gets a suite: radiogroup semantics, the two lines, Link chosen;
  - `ImportSetup` and `LibraryFolders` draw it, and the start and the scan post `mode`;
  - `useLibraryFolders` keeps the `409` sentence and the Folder row draws it;
  - `PlayerNotice` draws `unreachable`, and `useOpeningReads`/`Player` map a `503` to it.

## Out of Scope

- _Convert to linked and free space_ for titles already copied.
- A **Relocate** of a Library folder whose path or drive letter changed. Linking by folder id makes it a one-row write later; until then the folder reads _Can’t be reached right now_ and its titles answer `unreachable`.
- Link in the **Movie form** (Q12): it would need `webUtils.getPathForFile` over a new preload member, an _inside a listed folder?_ check, and a choice drawn only sometimes.
- Linking art or subtitles.
- A household Import mode in Settings.
- Greying Play on a detail page whose folder is unreachable.
- Re-finding a linked video moved or renamed outside the app, beyond a Folder scan's **Already in library** rule on its Source folder.
- Any change to the **Write targets** or the **Export**.
- Step 25, **Review at scale + Season art**.

## Further Notes

- **Link** (the Import mode) and **Episode link** (log 38's typed numbers) are different things. An Episode link is always called that in full.
- The new and amended terms (**Import mode**, **Link**, **Copy**, **Linked video**, **StoredVideo**, **VideoFile**, **Media folder**; **Movie folder**, **Series folder**, **Stored path**, **Library folder**, **Managed copy**, **Copy-in**, **Episode link**) are in `docs/ubiquitous-language.md` already, from log 41.
- The accepted cost: a title can be unplayable for a reason outside the app (the drive is unplugged), and a Library folder that linked titles play from can't be removed until those titles are gone.

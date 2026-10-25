# 51: Library audit

> **Initiative:** `library-audit`
> **PRD:** `docs/PRDs/51-library-audit.md` (to be written)
> **Plan:** `docs/PRDs/51-library-audit-plan.md` (to be written)

This log is the `grill-me` session for step 34 of the build order, **Library
audit**, held before the prototype revision and the PRD. It ran against the
code as it stood on 2026-10-24 (`65655de`). It is an immutable snapshot of that
moment. The session ran alone, and the maintainer approved every
recommendation in advance, asking that the codebase stay consistent with its
naming, code conventions, patterns and architecture. Their brief:
_library-audit. after testing 0.10.0 live, a lot of issues appeared. some are
listed in our feature-checklist but there could be many more. we need to use
the devtools mcp and test every edge case we can to make sure the user has a
intuitive, easy way to add movie/series, edit, remove only specific
movie/series/episodes files or metadata, update, link or import and so on._

## Background

### How the audit ran

Nothing touched the household's library or the installed app's data.

- **The real layout, read only.** The installed app's database was copied and
  read; `D:\Movies` was listed. One **Library folder**; films in **Collection
  folders** (`Star Wars/Solo (2018).mp4`) and their own folders; shows as
  `Tacoma FD/Season 1/Episode 1 - On the Hot Seat.mp4`, one as
  `Mr. Robot/Season 1/eps1.0_hellofriend.mov.mp4`; an Export folder inside the
  Library folder (art and sheets, no video, so never a **Source folder**).
- **A sandbox library** in the session's scratchpad, of the shapes a real
  household has: the real ones above, plus `Seizoen 1` (the checklist's own
  example), `Season 1 (2008)`, `Release.Show.S01.1080p.WEB-DL`, a `Specials`
  folder, `S01E01` names, a film with two subtitle files and a film named
  `Amelie.2001.1080p.BluRay.mkv`.
- **A sandbox server** (`tsx server/src/main.ts` with its own
  `FAMILYFLIX_DB_PATH`, `FAMILYFLIX_MEDIA_PATH` and component path) driven
  over HTTP: add the folder, scan in Link mode, rescan, then edit rows in the
  sandbox database to stand in for older libraries (no folder on record, a
  title a Sync renamed) and rescan.
- **The UI live**, Vite over that server in Chrome, with a stub
  `window.familyflix` whose `pickOne()` answered a chosen sandbox folder, so
  the **Show folder pick** ran against real reads. What only the shell can do
  (the **Shell trash**) was read in the code, not run.

### What the checklist already listed

Step 34's five known issues (a rescan doubles series; deleting the double
breaks the original; a deleted title can't come back; a show folder's import
is mislabelled; a show folder with season folders isn't read). All five were
reproduced or confirmed; the findings below say how.

## Problem

The Library flows were built one step at a time and never walked end to end.
Walked, they lose titles (a film with no genre is not drawn at all), make
second copies, throw away files nobody asked to throw away, and misread the
folder shapes real shows come in. The household needs one predictable way to
add, edit, take out and bring back a film, a series or one episode, its files
or its details.

## Findings

Numbered once here and referred to by number below.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                              | How it was confirmed                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | **A rescan doubles a title.** **Already in library** has two rules: the folder on record, then **Title key** and year. A title with no folder on record (added before log 48) whose title no longer keys like its folder (a Sync's _Rogue One: A Star Wars Story_ for `Rogue One  (2016).mp4`) matches neither, and a scan links its files a second time.                                            | Reproduced: _Pixar Coco_ and _Tacoma Fire Department_ with no folder on record; a rescan added a second _Coco_ and a second _Tacoma FD_ on the same files. |
| F2  | **Deleting the double trashes the original's files.** `linkedFiles` answers `videos` with the title's own paths even when another held title links the same files; `others` only stops the whole-folder answer.                                                                                                                                                                                      | Code (`media/linkedFiles/linkedFiles.ts`); the dialog for _Pixar Coco_ promised _Its video file(s), to the Recycle Bin_.                                   |
| F3  | **A delete always throws the files away.** A linked title's Delete moves its **Linked files** to the Recycle Bin; there is no way to take a title out of FamilyFlix and keep its files, so it can't be added back.                                                                                                                                                                                   | The **Delete dialog**: _What stays: Nothing_; `trashedFirst` in `routes/index.ts`.                                                                         |
| F4  | **A Show folder pick is mislabelled.** Each **Episode file row** names its video by basename only, so `Seizoen 1/Aflevering 1.mp4` and `Seizoen 2/Aflevering 1.mp4` read the same; an **Unplaced** video from season 2 is numbered S1 E3 by the **Numbering guess**; the **Show folder row** shows the start of the path (`C:\Users\…`), not the folder; a second pick keeps the first pick's title. | Live, picking `Seizoen Show`, then `Year Show (2008)`, `Release Show`.                                                                                     |
| F5  | **Season folders are read in three spellings only.** `Season 1`, `Season 01`, `S01`. `Seizoen 1` and `Season 1 (2008)` are films, so their episodes became films named _Aflevering 1_ and _Season 1_; `Release.Show.S01.1080p.WEB-DL` made each season its own series (_Release Show S01_, _Release Show S02_); a `Specials` folder became a film _Specials_.                                        | Live scan of the sandbox.                                                                                                                                  |
| F6  | **A film with no genre is not drawn.** The Movies home is genre rows; a film with no genre (every scanned film before a Sync) earns none, and the home says _Your library is empty_ with 11 films held. A search narrows the same rows, so it never finds them either.                                                                                                                               | Live: `/api/home` answered no rows; `/api/library-titles` 11 films. Known since log 13 Q15, made severe by Folder scans.                                   |
| F7  | **A title taken out comes back on the next scan.** Once F3 keeps the files, a scan finds them again; it already does for a removed episode (its file stays, by design, and the series no longer holds its Source file or number) and for a deleted copied title (its Source folder is still in the Library folder).                                                                                  | Code (`showMatch`, `heldFilm` in `createImporter.ts`; `pathsOf` in `series/write`).                                                                        |
| F8  | **Picking a Season folder names the show after it.** Picking `Tacoma FD/Season 1` reads its episodes right but guesses the title _Season 1_ and misses that _Tacoma FD_ is held.                                                                                                                                                                                                                     | Live `GET /api/show-folder`.                                                                                                                               |
| F9  | **A scan's tally counts films only.** _Found 15 movies across 22 folders_ counts shows as movies; _Scan complete: 10 imported_ left out the five new series.                                                                                                                                                                                                                                         | Live scan log.                                                                                                                                             |
| F10 | **The form says FILES twice and names a page that isn't there.** The Files card and the **Import mode** choice are both headed _FILES_; the subtitle sends the maintainer to _Import library_, which no screen is called.                                                                                                                                                                            | Live, both kinds of the form.                                                                                                                              |
| F11 | **The Episode word is English only.** `Aflevering 1` gives no number and no title, so every Dutch episode is Unplaced.                                                                                                                                                                                                                                                                               | Live scan and pick.                                                                                                                                        |

Walked and found sound: a rescan of titles with their folder on record (every
title _Already in library_); the **Numbering guess** on `eps1.0_…` names (an
Unplaced Problem, log 38's design); a held Show folder's **Refusal** on the
form; removing a linked episode in the series edit keeps its file (`pathsOf`
skips a Linked video); _Clear details_ and the **Title row**'s furniture.

## Questions and Answers

### Scope

1. **One initiative or several?** ✅ **One**, `library-audit`, step 34, log 51:
   F1 to F11. They share the files that change (the importer's match, the
   **Season folder** rule, the Delete) and each is small once those rules are
   right. ❌ Not built here: **Loading states** and **Scan new folders**
   (their own planned steps); a cleanup of doubles an older library may
   already hold (the household's own database holds none today); the
   **Details state** reading a year parsed from a folder name as _Your own
   details_ (noted, deferred: it misleads but loses nothing).

2. **Prototype first?** ✅ **Yes**, per _The prototype is the spec_, for what
   is drawn: the Delete dialog's two cards (Q6), the **Other row** (Q14), the
   Library folders row's left-out line (Q10), the Episode file row's relative
   path and the Show folder row's ellipsis (Q12), the form's _Link or copy_
   heading (Q16). Files: `page.ManageLibraryPage.dc.html`,
   `page.MoviePage.dc.html`, `page.SeriesPage.dc.html`, `page.LibraryPage.dc.html`,
   `feat.GenreRow.dc.html`, `page.LibraryFoldersPage.dc.html`,
   `mol.EpisodeFileRow.dc.html`, `feat.MovieForm.dc.html`.

### Recognising a held title (F1)

3. **What third rule stops the double?** ✅ **The Held video rule, checked
   second**: after the folder on record and before the Title key, a found
   video that is already a held title's **Linked video** (same Library folder,
   same relative path) or a held episode's **Source file** makes its title
   held. For a **Show folder**, any one held episode video makes the whole
   folder that series; for a film, its one video. When it matches, the folder
   is recorded on the title (`setSourceFolder`, as the key rule already does),
   so the next scan takes the first rule. ❌ Matching on the TMDB title or
   original title: still a guess, and a title the family typed has neither.
   ❌ A unique index on `video_path`: a held double would fail a migration on
   an older library.

4. **Where does it live?** ✅ In the library domain's storage as one read,
   `storage.titleHolding(folderId, videoPath): { kind, id } | null`, over
   `movies` and `episodes` by `video_folder_id` and `video_path`; the
   importer's `heldFilm` and `heldShow` ask it, and so do `readShowFolder`
   (its `heldSeriesId`) and the **Movie form**'s add: a movie add whose
   linked video is held is refused, _Coco already plays this file._, as a
   held Show folder already is (log 48 Q10).

### Taking a title out (F2, F3, F7)

5. **What does a Delete do to a linked title's files?** ✅ **Nothing, unless
   asked**: the default Delete takes the title out of FamilyFlix (its row, its
   art, subtitles and everything in its **Media folder**, as today) and
   leaves its **Linked files** where they lie. Moving them to the Recycle Bin
   is a second, deliberate choice in the same dialog. A copied title is
   unchanged: its copy is FamilyFlix's own and goes with it. ❌ Always
   trashing (today's rule, log 47 Q14): the brief's "remove only specific
   files or metadata" and the checklist's "two separate choices". ❌ Two menu
   items (_Remove_ / _Delete with files_): two danger rows a parent reads as
   the same.

6. **How is the choice drawn?** ✅ **Two `ChoiceCard`s** in the Delete dialog,
   between **What goes / What stays** and the buttons, drawn only for a
   linked title in the shell: **Keep the files** (_They stay in your library
   folder. A scan won't add it again._), chosen on every open, and **Move
   them to the Recycle Bin** (_From your library folder, so it can be
   restored from there._). _What goes_ and _What stays_ follow the choice;
   the callout shows only with the second. The confirm stays _Delete movie_ /
   _Delete series_. ❌ A checkbox: no Checkbox primitive exists, and
   `ChoiceCard` is the molecule the Import mode already uses for the same
   kind of question.

7. **What does the wire carry?** ✅ `DELETE /api/movies/:id?files=trash` (and
   `/series/:id`); no query keeps the files. `trashedFirst` runs only with
   `files=trash`. A browser never sends it (the cards are not drawn), so its
   `409` _Only the desktop app can…_ goes away for a plain Delete.

8. **Can a Delete trash another title's file?** ✅ **Never** (F2):
   `linkedFiles` drops from `videos` every path another held title links,
   and answers `shared` with no paths when none is left; a whole folder
   another title lies in was already refused. The dialog then draws no
   Recycle Bin card and says under _What stays_: _Its video file(s), which
   another title plays_.

9. **How does a title taken out stay out?** ✅ **Left-out videos.** A Delete
   that keeps the files, and an episode removed in the **Series edit job**,
   record each video the title came from (a Linked video, or a copied
   title's Source folder and **Source file**) in a new table,
   `left_out_videos (library_folder_id, video_path)`, relative with forward
   slashes, the Linked video's own spelling (migration 17). A Folder scan and
   a sheet import skip a left-out video before any match, and log one `info`
   line per run: _· Left out 3 videos you deleted earlier_. A **Show folder**
   whose every video is left out is skipped whole; one with new videos takes
   only those. Trashed files need no entry (they are gone). Removing a
   Library folder drops its entries (`ON DELETE CASCADE`); a **Factory reset**
   empties the table.

10. **How does one come back?** ✅ **Two ways.** An explicit add (the Movie
    form picking the file, or a **Show folder pick** of the folder) clears
    the entries it adds, since a hand pick says what it wants. And the
    Library folders page draws, on a **Folder row** with any, a second line
    _3 videos left out_ with a _Bring back_ text button: it forgets that
    folder's entries (`DELETE /api/library-folders/:id/left-out`), and the
    next scan adds them. ❌ A list of left-out files to pick from: a page for
    a rare act; the folder is where they lie.

### Season folders and episodes (F5, F11)

11. **Which names are Season folders?** ✅ `seasonOf` (server) and
    `readSeasonFolder` (client mirror, held together by the drift guard)
    read, either case:
    - `Season 1`, `Season 01`, `Seizoen 1` and `S01`, alone or followed by a
      separator and anything (`Season 1 (2008)`, `Season 1 - 1080p`);
    - a name holding a standalone `S01` token not followed by `E\d`
      (`Release.Show.S01.1080p.WEB-DL`), whose parent is then the Show
      folder;
    - `Specials` (and `Season 0`) as **season 0**, which the form and the
      wire already accept (`season >= 0`).

    The **Episode word** gains `Aflevering 12` and `Afl. 12`, the household's
    language beside English. ❌ Every language's word for season: guesses we
    can't test; the two the household uses are read. ❌ Reading a Season
    folder's number from anywhere in its name (`2008` in `Season 1 (2008)`):
    the number must follow the word.

### The Show folder pick (F4, F8)

12. **What does each row show?** ✅ **The video's path relative to the Show
    folder** (`Seizoen 2/Aflevering 1.mp4`) on every **Episode file row** a
    pick lands, so two seasons' `Aflevering 1` read apart; a picked file
    keeps its name. The **Show folder row** truncates from the start, so the
    folder's own name always shows (`…\scratchpad\lib\Seizoen Show`), the
    full path its `title`. With F5 fixed the season-2 video is numbered from
    its folder and never lands as S1 E3; the Numbering guess also starts
    each season's free numbers from that season.

13. **A second pick, or a Season folder picked?** ✅ A second pick replaces
    the title the first pick filled (the form remembers whether the title
    came from a pick); a typed title is still never overwritten (log 29 Q19).
    A picked **Season folder** is read for its own episodes but titled and
    checked as held by its Show folder (`showFolderOf`), so _Tacoma FD/Season
    1_ is _Tacoma FD_ and is refused while held.

### Films with no genre (F6)

14. **Where does a film with no genre appear?** ✅ **The Other row**: one more
    row on the Movies home, last, titled _Other movies_, holding every film
    with no **Genre**, capped at 15 like a **Genre row**, with _View all_
    opening the **Genre page** in its `other` mode at `/genre-less` (its own
    route, so no genre name can collide with it): every film with no genre,
    uncapped, headed _Other movies_. A search, the rating filter and the
    sort narrow it like any row; a genre filter leaves it out. ❌ A fake
    genre named _Other_ written to the films: a Sync would keep it, and it
    would show in the form's genre chips. ❌ `/genre/other`: a genre the
    family names _Other_ would land on the wrong page. ❌ A plain grid of
    every film: the home's shape is rows.

### Copy and tallies (F9, F10)

15. **What does a scan count?** ✅ Titles: _Found 15 titles across 22
    folders_; _Scan complete: 15 imported_ counting a new series as one, as
    a film is. A held series that took episodes is not an import (today's
    rule, kept).

16. **The form's wording?** ✅ The **Import mode** choice is headed _Link or
    copy_ wherever `ImportModeChoice` is drawn (form, Library folders, Import
    setup), so it never repeats the Files card's _FILES_. The form's subtitle
    names _Library folders_, the page that scans many at once.

### Documents

17. **Which documents change?** ✅ The checklist's step 34 entry (its known
    list becomes the findings) and row, README's Library paragraph, CLAUDE.md
    _Product Rules_ (**Media**: "removed only by a Delete, only to the
    Recycle Bin" becomes "kept by a Delete unless the household asks, then
    only to the Recycle Bin"), the glossary, and the docblocks of
    `linkedFiles`, `trashedFirst`, `seasonOf`, `readSeasonFolder`,
    `episodeTag`, `walkLibraryFolder`'s callers and `HomeRows`.

## Design

### Chosen and rejected

- ✅ The **Held video** rule second in **Already in library**; ❌ TMDB-title
  matching; ❌ a unique index.
- ✅ Delete keeps linked files by default, **Move them to the Recycle Bin**
  on request; ❌ always trash; ❌ two menu items.
- ✅ Never trash a file another title links.
- ✅ **Left-out videos** skipped by scans, cleared by a hand add or _Bring
  back_; ❌ a left-out file browser.
- ✅ Season folders: trailing text, `Seizoen`, release `S01`, `Specials` as
  0; ❌ every language.
- ✅ Relative paths on picked rows; the title follows the pick until typed.
- ✅ The **Other row**; ❌ a fake genre.

### Types and wire

```ts
// server/src/library (storage)
titleHolding(folderId: string, videoPath: string):
  { kind: 'movie' | 'series'; id: string } | null;
leaveOut(entries: readonly { folderId: string; videoPath: string }[]): void;
leftOut(folderId: string): ReadonlySet<string>;   // relative video paths
bringBack(folderId: string): number;              // entries forgotten
clearLeftOut(entries: readonly { folderId: string; videoPath: string }[]): void;

// src/types
export type LinkedFiles = 'folder' | 'videos' | 'shared' | 'unreachable';
export interface LibraryFolderView { /* … */ leftOut: number }  // Folder row
export interface HomePayload { /* … */ other: HomeRow | null }  // the Other row
```

| Route                                       | Change                                        |
| ------------------------------------------- | --------------------------------------------- |
| `DELETE /api/movies/:id`, `/api/series/:id` | `?files=trash` to trash; default keeps        |
| `DELETE /api/library-folders/:id/left-out`  | new: _Bring back_, `204`                      |
| `GET /api/library-folders`                  | each folder's `leftOut` count                 |
| `GET /api/home`                             | `other`, the **Other row**, after `rows`      |
| `GET /api/genre-less`                       | every film with no genre, the page's `other`  |
| `GET /api/show-folder`                      | Season folder climbs for title and held check |

### A Delete, decided

```mermaid
flowchart TD
  D[Delete pressed] --> L{linked title, in the shell?}
  L -- no --> G[row, art, Media folder go]
  L -- yes --> C{Keep the files / Recycle Bin}
  C -- keep --> K[record Left-out videos] --> G
  C -- bin --> S{another title links a file?}
  S -- yes --> T[trash only the unshared files] --> G
  S -- no --> W[trash Linked files] --> G
```

### The units

| Unit                                  | Where                                            | What                                                                         |
| ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `seasonOf` / `readSeasonFolder` (ch.) | `import-export/groupShows/`, `movie-form/…`      | the wider Season folder rule, season 0                                       |
| `episodeTag` / `readEpisodeTag` (ch.) | `media/episodeTag/`, `movie-form/readEpisodeTag` | `Aflevering`, `Afl.`                                                         |
| `titleHolding` (new)                  | `server/src/library/`                            | the **Held video** read                                                      |
| `createImporter` (ch.)                | `import-export/createImporter/`                  | Held video rule, left-out skip, title tallies                                |
| `left_out_videos` (new)               | `server/src/db/` migration 17                    | the table, cascade on Library folder                                         |
| `linkedFiles` (ch.)                   | `media/linkedFiles/`                             | drops shared paths, `shared`                                                 |
| delete routes (ch.)                   | `routes/index.ts`                                | `?files=trash`, left-out on keep                                             |
| `readShowFolder` (ch.)                | `import-export/readShowFolder/`                  | Season folder climb; relative paths                                          |
| `DeleteTitleDialog` (ch.)             | `features/manage-library/`                       | the two `ChoiceCard`s; `DeleteMovieDialog`, `DeleteSeriesDialog` draw it too |
| `useShowFolderPick` (ch.)             | `features/movie-form/`                           | the picked title follows the pick                                            |
| `FolderRow` (ch.)                     | `features/import-export/`                        | _N videos left out_ · _Bring back_                                           |
| `HomeRows` (ch.), home read (ch.)     | `features/library/home/`, `library/home/`        | the **Other row**                                                            |
| `ImportModeChoice` (ch.)              | `components/`                                    | heading _Link or copy_                                                       |

## Implementation Plan

1. **Prototype.** The files of Q2.
2. **Season folders.** The wider `seasonOf` and its client mirror, the
   Episode word, season 0: a scan of `Seizoen Show`, `Year Show (2008)`,
   `Release Show` and `Specials Show` makes four series.
3. **The Held video rule.** `titleHolding`, the importer's second rule, the
   form's refusal: a rescan of a renamed title with no folder on record adds
   nothing and records the folder.
4. **Delete keeps the files.** `?files=trash`, `linkedFiles`' `shared`, the
   dialog's two cards on all three Delete dialogs.
5. **Left-out videos.** Migration 17, the skip and its log line, an episode
   removed in the edit, a hand add clearing, _Bring back_ on the Folder row.
6. **The Show folder pick.** Relative paths, the start-truncated path, the
   title following the pick, the Season folder climb.
7. **The Other row.** The home's `other`, the Genre page's `other` mode.
8. **Copy and tallies.** _Found N titles_, series counted, _Link or copy_,
   the form's subtitle.
9. **Walk it again.** The sandbox shapes and the real layout, live in the
   shell, before the docs; then the documents of Q17.

## Trade-offs

- **Easier:** a Delete is safe to press: files go only when asked, never a
  file another title plays; a taken-out title stays out, and comes back with
  one press or one pick; the shapes real shows come in are read as shows;
  every film is on the home from the moment it is scanned.
- **Harder:** a new table that every scan reads, and a second state for a
  file in a Library folder (held, left out, or new); the Season folder rule
  is wider, so a film folder named `S01 Something` would now read as a
  season (accepted: no film the household holds is named so); the home gains
  a row with no genre behind it, so the Genre page grows a mode.
- **Out of scope:** Loading states, Scan new folders, cleaning up doubles an
  older library already holds, every language's season word, the Details
  state's reading of a parsed year.

## Follow-up: issues 463, 465 and 466

> **Initiative:** `library-audit` (unchanged)
> **Parent PRD:** #443 · **Issues:** #463, #465, #466 (closed by this entry)

A second `grill-me` for step 34, held on 2026-10-25 against `154914b`, after
the build slices and the walk of #462. It is appended, not merged: the
sections above stay the snapshot they were. The session ran alone, the
maintainer approving every recommendation in advance and asking, again, that
the codebase stay consistent with its naming, conventions, patterns and
architecture. Their brief: _for 463, 465 and 466. these are part of our
library-audit. after writing a design-log, close these issues. goal is to add
this as a follow-up to our library-audit feature and do the missing
request-a-refactor-plan and refactor steps to fully close the feature/epic._

### Background

Walking #462 against the household's real `D:\Movies` turned up three faults
the build slices left:

- **#463.** Two older records, _Star Wars_ (copied from
  `Star Wars/The Last Jedi (2017).mp4`) and _Guardians of the Galaxy_ (whose
  stored video is `Guardians of the Galaxy Vol. 2.mp4`), point at
  `media/star-wars/` and `media/guardians-of-the-galaxy/`, and neither folder
  exists. A scan matches the dead _Guardians_ by **Title key**, logs it
  **Already in library** and never links the real
  `Guardians of the Galaxy/Guardians of the Galaxy.mp4`; it links _The Last
  Jedi_ beside the dead _Star Wars_, so that film is held twice.
- **#465.** `walkListed` adds every film to `found` but only the shows
  `isHeldShow` calls new, so a rescan of everything held reads _Found 6
  titles_ beside eleven _Already in library_ lines.
- **#466.** `media/the-last-jedi-2017/` and
  `media/guardians-of-the-galaxy-vol-2/` are empty and no title names them;
  the next _The Last Jedi_ import lands in `the-last-jedi-2017-2/`.

### Problem

A title whose video is gone still counts as held by a guess, so it keeps a
real video out and leaves a double; a tally counts held films and not held
shows; and an edit can leave a folder in managed storage that nothing names.

### Questions and Answers

18. **One follow-up or three?** ✅ **One**, appended here, same initiative,
    three thin slices (_Implementation Plan_ below), then the initiative's
    `request-refactor-plan` and `refactor`, which close step 34. No new PRD:
    the slices are filed from this entry under #443. #463, #465 and #466 are
    closed by it.

#### The tallies (#465)

19. **What does _Found N titles_ count?** ✅ **Every title the walk found,
    held or new, films and shows alike.** The prototype's Found is the run's
    whole total, its _Already in library_ lines among them; _Scan complete:
    N imported_ stays the count of new titles (Q15, unchanged). `walkListed`
    loses its `isHeldShow` parameter. ❌ Both counting new titles only: the
    found line is written before any match, and a film's held check would
    move into the walk. The prototype's line said _movies_; amended here to
    _titles_ (`FamilyFlix.dc.html`), which Q15 decided and never reached.

20. **And the live stat, _Found N movies so far_?** ✅ **It counts folders
    and says so: _Found N folders so far_.** `run.found` counts each Source
    folder as the walk reaches it, so a show of two Season folders read as
    two _movies_. It becomes the same count as the found line's _across M
    folders_ (`foldersUnder`'s rule: every Source folder and every shelf
    above it, the Library folder not), kept as the walk goes, so its last
    value is M. M is counted before **Left-out videos** come off, since the
    walk did go through those folders. The prototype already used one
    number for both and labelled the first _movies_; amended to _folders_.

#### A title whose video is gone (#463)

21. **What is a title whose video is gone?** ✅ A **Missing video**: a held
    film whose `playback.videoFile` answers `missing`. One that answers
    `unreachable` (its Library folder offline) is not missing and still
    holds, as an **Unreachable** folder is skipped, never forgotten.

22. **Does a film with a Missing video keep a found video out?** ✅ **Not by
    guess.** The **Title key** rule passes over a held film whose video is
    missing wherever a found video is at stake, so that video is imported
    and plays (_Guardians of the Galaxy_). The folder on record and the
    **Held video** rule are evidence and still hold. A **Sheet row** with no
    folder found still reaches a missing film by key: nothing is placed
    there, only **Sheet fills**. ❌ Giving the found video to the film the
    key matched: the household's dead _Guardians of the Galaxy_ is _Vol. 2_,
    so a guess would give a record the wrong film.

23. **What finds a missing film on evidence?** ✅ **The Missing video
    rule**, third, before the Title key: a found video no earlier rule
    placed, whose file name is the file name of exactly one held film's
    Missing video. A copy keeps its source's name (`copyIn`), so the dead
    _Star Wars_ (`star-wars/The Last Jedi (2017).mp4`) is the found
    `Star Wars/The Last Jedi (2017).mp4`, and no double is made. Linked and
    copied films alike: a moved Linked video keeps its name too. Two
    missing films of one name answer neither. Read once per run, as
    `heldFilmsByKey` is. ❌ Episodes: a held episode's number already holds
    its place, the **Series edit job** picks its file back, and no
    household show has one.

24. **What does a scan do with a missing film it found?** ✅ **Found
    again**: when the folder on record or the Missing video rule finds a
    film whose video is missing, the film takes the found video, placed by
    the run's **Import mode** (a **Linked video** in Link; in Copy, copied
    into its **Media folder**, reserved and recorded when that is gone, as
    Q26 does), its runtime derived again and its folder recorded. Its
    title, details, rating and watch history are untouched. Logged as the
    Sheet fills' `✓ Updated` line naming `video`, so the review shows
    nothing new. ❌ A new Problem kind for missing films: a review row for
    a repair the scan can make on evidence, and none in the prototype.

#### Folders nothing names (#466)

25. **Which flows leave one?** ✅ **The two edits**, read in the code. The
    movie edit (`PATCH /api/movies/:id`) and the series edit
    (`PATCH /api/series/:id`) reserve a folder when the recorded **Media
    folder** is gone or none is recorded, write into it, and never record
    it (`updateMovie` takes no folder; the series write fills one only
    where none is recorded). The movie edit's rollback removes its files
    and leaves the folder: a refused edit of the dead _Star Wars_ retitled
    _The Last Jedi_ (2017) is exactly `the-last-jedi-2017/`, and of
    _Guardians of the Galaxy_ retitled _Vol. 2_,
    `guardians-of-the-galaxy-vol-2/`. Every add, import and Resolve already
    removes the folder it reserved (`removeFolder`).

26. **The fix?** ✅ **An edit owns the folder it reserves**: recorded as the
    title's Media folder on commit (`MoviePatch.mediaFolder`,
    `SeriesEdit.mediaFolder`), removed by a refused or failed edit (the
    movie edit's rollback gains the series edit's `reserved` branch). A
    Delete then removes the folder the files are really in. ❌ Removing a
    folder when its last file goes: no flow empties a recorded folder but a
    Delete, which removes it.

27. **The household's two empty folders?** ✅ **Removed by hand** (Settings
    → Open media folder, log 35). ❌ A sweep of folders no title names, at
    start or in the **Storage report**: a broad delete in managed storage
    for two folders, and Q1 already left an older library's tidying to the
    maintainer.

### Design

- ✅ _Found N titles_ counts every title found; ❌ new titles only.
- ✅ The live stat counts folders, ending at the found line's M.
- ✅ A **Missing video** holds by evidence, never by Title key.
- ✅ The **Missing video** rule, third; **Found again** on evidence;
  ❌ key-matched repair; ❌ a Problem kind; ❌ episodes.
- ✅ An edit records and rolls back the folder it reserves; ❌ a sweep.

A found film's video against the **Already in library** rules, in order:

```mermaid
flowchart TD
  V[found film video] --> F{folder on record?}
  F -- yes --> M{its video missing?}
  M -- no --> A[Already in library]
  M -- yes --> R[Found again: placed by Import mode, logged Updated video]
  F -- no --> H{Held video?}
  H -- yes --> A
  H -- no --> N{one missing film of this file name?}
  N -- yes --> R
  N -- no --> K{Title key and year, video not missing?}
  K -- yes --> A
  K -- no --> I[imported]
```

```ts
// src/types/write.ts
export interface MoviePatch {
  /* … */ mediaFolder?: string;
}
// server/src/library/series/write/write.ts
export interface SeriesEdit {
  /* … */ mediaFolder?: string;
}
// src/types/import.ts
export interface ImportRun {
  /* … */
  /** Folders the walk has gone through so far: the found line's M. */
  found: number;
}
```

| Unit                     | Where                                   | What                                                                     |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------ |
| `walkListed` (ch.)       | `import-export/createImporter/`         | every title in _Found_; `found` kept by `foldersUnder`'s rule as it goes |
| `heldFilm` (ch.)         | `import-export/createImporter/`         | the Missing video rule third; the key passes over a missing film         |
| `importMatch` area (ch.) | `import-export/createImporter/`         | **Found again**: place, derive, record, log `✓ Updated` naming `video`   |
| `importView` (ch.)       | `features/import-export/importView/`    | _Found N folders so far_                                                 |
| movie edit (ch.)         | `routes/index.ts`, `library/write/`     | `mediaFolder` recorded on commit; a reserved folder rolled back          |
| series edit (ch.)        | `routes/index.ts`, `library/series/...` | `mediaFolder` recorded on commit, replacing a dead one                   |

### Implementation Plan

Numbered on from the slices above.

10. **Every title found.** Held shows count in _Found N titles_; the live
    stat reads _Found N folders so far_ and ends at M: a rescan of
    everything held reads as many titles as it lists.
11. **An edit owns its folder.** The movie edit's rollback removes a folder
    it reserved; both edits record one on commit: a refused edit of a title
    whose folder is gone leaves nothing in `media/`.
12. **A missing film holds by evidence.** The Title key passes over a
    Missing video: a scan beside the dead _Guardians_ imports the real one.
13. **Found again.** The Missing video rule and the folder on record give a
    missing film the found video in either Import mode: a scan beside the
    dead _Star Wars_ makes no double.
14. **Close step 34.** The documents of Q17 for this entry (the glossary is
    written with it), then `request-refactor-plan` and `refactor` for
    `library-audit`; only then is step 34 ticked.

### Trade-offs

- **Easier:** the found line and the live stat say what they count; a dead
  record never keeps a real film out and is mended where the evidence is;
  nothing an edit writes into `media/` is left unnamed.
- **Harder:** a scan reads the held films' videos once per run to know
  which are missing, so the key rule now depends on the disk as well as
  the rows; a missing film whose file had a generic name (`movie.mp4`) can
  be given the wrong file by the Missing video rule (logged, and the
  **Movie form** edit picks the right one).
- **Out of scope:** a missing episode; a sweep of folders nothing names; a
  missing film no evidence reaches (no folder on record, its file renamed),
  which stays the maintainer's to delete, as Q1 left an older library's
  doubles.
